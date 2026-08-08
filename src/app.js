import {
  QUESTION_STEPS,
  clearHiddenAnswers,
  createInitialAnswers,
  customFieldFor,
  needsThirdRoomUse,
  validateStep
} from "./questions.js";
import { deriveResult } from "./result.js";
import { buildPayload, buildSummary } from "./payload.js";
import { isValidContact, normalizeContact } from "./contact.js";
import { submitLead } from "./api.js";
import { randomId } from "./random.js";
import { BACKEND_URL, LINE_URL, PHONE } from "./config.js";

const STEP_MILESTONES = [
  "目的定下來後，後面會更快。",
  "生活圈有方向了。",
  "負擔範圍更清楚了。",
  "空間需求整理好了。",
  "物件範圍縮小了。",
  "可以看方向卡了。"
];

const state = {
  answers: createInitialAnswers(),
  stepIndex: -1,
  phase: "intro",
  submitting: false,
  submitError: "",
  submitAttempted: false,
  phoneTouched: false,
  noGosExpanded: false,
  stepErrors: {},
  stepErrorTitle: "請先完成這一題",
  activeSubmission: null,
  confirmedSubmission: null
};

const $ = id => document.getElementById(id);
const services = { endpoint: BACKEND_URL, submitLead };
const LOCAL_TEST_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);
const RELATED_ERROR_FIELDS = {
  areas: ["areas", "customArea"],
  otherNoGo: ["noGos", "otherNoGo"]
};
let toastTimer;

function isLocalTestHost() {
  return LOCAL_TEST_HOSTNAMES.has(location.hostname);
}

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>'"]/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]
  );
}

function clearAllStepErrors() {
  state.stepErrors = {};
  state.stepErrorTitle = "請先完成這一題";
}

function refreshStepErrorState() {
  const shownKeys = Object.keys(state.stepErrors);
  if (!shownKeys.length) return;
  const step = QUESTION_STEPS[state.stepIndex];
  if (!step) {
    state.stepErrors = {};
    return;
  }
  const nextErrors = validateStep(step.id, state.answers).errors;
  for (const key of shownKeys) {
    if (nextErrors[key]) state.stepErrors[key] = nextErrors[key];
    else delete state.stepErrors[key];
  }
}

function syncStepErrorUi() {
  const questionArea = $("questionArea");
  const summary = $("formError");
  if (!questionArea || !summary) return;

  questionArea.querySelectorAll("[aria-invalid]").forEach(element => {
    element.removeAttribute("aria-invalid");
    element.removeAttribute("aria-describedby");
  });
  questionArea.querySelectorAll("[data-field-error]").forEach(element => element.remove());

  const entries = Object.entries(state.stepErrors);
  if (!entries.length) {
    summary.textContent = "";
    summary.removeAttribute("aria-label");
    return;
  }

  const messages = [...new Set(entries.map(([, message]) => message))];
  summary.setAttribute("aria-label", state.stepErrorTitle);
  summary.innerHTML = `<strong>${escapeHtml(state.stepErrorTitle)}</strong><ul>${messages.map(message => `<li>${escapeHtml(message)}</li>`).join("")}</ul>`;

  for (const [errorKey, message] of entries) {
    const relatedFields = RELATED_ERROR_FIELDS[errorKey] || [errorKey];
    const errorId = `fieldError-${errorKey}`;
    const targets = relatedFields.flatMap(fieldKey => [
      questionArea.querySelector(`[data-field-group="${fieldKey}"]`),
      questionArea.querySelector(`[data-text-field="${fieldKey}"]`)
    ]).filter(Boolean);

    targets.forEach(target => {
      target.setAttribute("aria-invalid", "true");
      target.setAttribute("aria-describedby", errorId);
    });

    const ownerKey = errorKey === "areas" ? "customArea" : errorKey;
    const owner = questionArea.querySelector(`[data-text-field="${ownerKey}"]`)?.closest(".field")
      || questionArea.querySelector(`[data-field-group="${ownerKey}"]`);
    if (owner) {
      const fieldError = document.createElement("span");
      fieldError.id = errorId;
      fieldError.className = "field-error";
      fieldError.dataset.fieldError = errorKey;
      fieldError.textContent = message;
      owner.append(fieldError);
    }
  }
}

function focusElement(element) {
  if (!element) return;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: "center" });
}

function focusChoice(field, value) {
  const target = [...document.querySelectorAll("[data-field]")]
    .find(button => button.dataset.field === field && button.dataset.value === value);
  focusElement(target);
}

function setAnswer(key, value, focusValue = value) {
  if (state.submitting) return;
  state.answers[key] = value;
  state.answers = clearHiddenAnswers(state.answers);
  refreshStepErrorState();
  render({ focus: false });

  const custom = customFieldFor(key);
  if (custom && state.answers[key] === custom.option) {
    focusElement($(`field-${custom.key}`));
    return;
  }
  focusChoice(key, focusValue);
}

function showStepErrors(errors, title = "請先完成這一題") {
  state.stepErrors = { ...errors };
  state.stepErrorTitle = title;
  syncStepErrorUi();
  focusElement($("formError"));
}

function goNext() {
  if (state.submitting) return;
  if (state.stepIndex < 0) {
    state.phase = "questions";
    state.stepIndex = 0;
    state.noGosExpanded = false;
    clearAllStepErrors();
    render();
    return;
  }

  const stepId = QUESTION_STEPS[state.stepIndex].id;
  const validation = validateStep(stepId, state.answers);
  if (!validation.valid) {
    showStepErrors(validation.errors);
    return;
  }

  clearAllStepErrors();
  if (state.stepIndex === QUESTION_STEPS.length - 1) {
    state.phase = "result";
  } else {
    state.stepIndex += 1;
  }
  render();
}

function goBack() {
  if (state.submitting) return;
  clearAllStepErrors();
  if (state.phase === "result") {
    state.phase = "questions";
    state.stepIndex = QUESTION_STEPS.length - 1;
  } else if (state.stepIndex > 0) {
    state.stepIndex -= 1;
  } else {
    state.phase = "intro";
    state.stepIndex = -1;
  }
  render();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function createSubmissionSnapshot() {
  const answers = structuredClone(clearHiddenAnswers(state.answers));
  const result = deriveResult(answers);
  const submissionId = randomId();
  const payload = buildPayload({ answers, result, submissionId });
  const summary = buildSummary({ answers, result });
  return deepFreeze({ answers, result, payload, summary });
}

function activeSubmissionMatchesCurrentData() {
  if (!state.activeSubmission) return false;
  return JSON.stringify(state.activeSubmission.answers) === JSON.stringify(clearHiddenAnswers(state.answers));
}

function currentActiveSubmission() {
  return activeSubmissionMatchesCurrentData() ? state.activeSubmission : null;
}

function reportSubmitBlocked(message, fieldId) {
  state.submitError = message;
  render({ focus: false });
  focusElement($(fieldId));
}

async function handleSubmit() {
  if (state.submitting) return;
  state.phoneTouched = true;
  updateSubmitState();

  if (!state.answers.name.trim()) {
    reportSubmitBlocked("還差一步：請填寫怎麼稱呼您。", "name");
    return;
  }
  if (!isValidContact(state.answers.phone)) {
    reportSubmitBlocked("還差一步：請輸入 09 開頭的 10 碼手機號碼或合法 LINE ID。", "phone");
    return;
  }
  if (!state.answers.consent) {
    reportSubmitBlocked("還差一步：請勾選「我同意由小魏依這份結果與我聯繫」。", "consent");
    return;
  }
  state.submitError = "";

  state.submitAttempted = true;
  if (!services.endpoint) {
    state.submitError = "尚未設定獨立後端，資料還沒有送出。您可以保留答案，或先用 LINE 聯絡小魏。";
    render({ focus: false });
    focusElement($("submitError"));
    return;
  }

  const endpoint = services.endpoint;
  const submit = services.submitLead;

  let snapshot;
  try {
    snapshot = currentActiveSubmission() || createSubmissionSnapshot();
  } catch {
    // 寧可講出來，也不要讓按鈕按下去毫無反應。
    reportSubmitBlocked("目前無法整理這份方向卡，請重新整理頁面再送出一次，或改用 LINE 聯絡小魏。", "submitError");
    return;
  }
  state.activeSubmission = snapshot;
  state.submitting = true;
  state.submitError = "";
  render({ focus: false });

  try {
    await submit({ endpoint, payload: snapshot.payload });
    state.confirmedSubmission = snapshot;
    state.phase = "complete";
  } catch (error) {
    state.submitError = error.code === "SUBMISSION_NOT_CONFIRMED"
      ? "資料尚未確認入表，請重新送出或改用 LINE。答案都還保留著。"
      : "目前無法送出，答案已保留。請重新送出、複製摘要或改用 LINE。";
  } finally {
    state.submitting = false;
    render({ focus: state.phase === "complete" });
    if (state.phase !== "complete") focusElement($("submitError"));
  }
}

async function copySummary() {
  const snapshot = state.phase === "complete" ? state.confirmedSubmission : currentActiveSubmission();
  const text = snapshot?.summary
    || buildSummary({ answers: state.answers, result: deriveResult(state.answers) });
  try {
    await navigator.clipboard.writeText(text);
    showToast("需求摘要已複製");
  } catch {
    window.prompt("複製這段需求摘要：", text);
  }
}

function fieldIsVisible(field) {
  if (field.when === "needsThirdRoomUse") return needsThirdRoomUse(state.answers);
  if (field.when === "otherNoGo") return state.answers.noGos.includes("其他");
  return true;
}

function renderField(field) {
  if (!fieldIsVisible(field)) return "";
  const disabled = state.submitting ? " disabled" : "";

  if (field.type === "text") {
    const inputId = `field-${field.key}`;
    return `<label class="field" for="${inputId}">
      <span>${escapeHtml(field.label)}</span>
      <input id="${inputId}" data-text-field="${field.key}" value="${escapeHtml(state.answers[field.key])}" placeholder="${escapeHtml(field.placeholder)}" autocomplete="off"${disabled}>
    </label>`;
  }

  const values = field.type === "multi" ? state.answers[field.key] : [state.answers[field.key]];
  const compact = field.options.every(option => [...option].length <= 6) ? " compact" : "";
  const hint = field.max
    ? `<span class="field-guidance selected-summary" role="status">還能選 ${Math.max(0, field.max - values.length)} 個</span>`
    : field.type === "multi" ? `<span class="field-guidance">可複選</span>` : "";
  const custom = field.custom && state.answers[field.key] === field.custom.option
    ? `<label class="field custom-field" for="field-${field.custom.key}">
        <span>${escapeHtml(field.custom.label)}</span>
        <input id="field-${field.custom.key}" data-text-field="${field.custom.key}" value="${escapeHtml(state.answers[field.custom.key])}" placeholder="${escapeHtml(field.custom.placeholder)}" autocomplete="off"${disabled}>
      </label>`
    : "";
  return `<fieldset data-field-group="${field.key}">
    <legend>${escapeHtml(field.label)}</legend>${hint}
    <div class="choice-grid${compact}">
      ${field.options.map(option => {
        const selected = values.includes(option);
        return `<button class="choice${selected ? " selected" : ""}" type="button" aria-label="${escapeHtml(option)}" data-field="${field.key}" data-type="${field.type}" data-value="${escapeHtml(option)}" data-max="${field.max || ""}" data-exclusive="${escapeHtml(field.exclusive || "")}" aria-pressed="${selected}"${disabled}>${escapeHtml(option)}</button>`;
      }).join("")}
    </div>
    ${custom}
  </fieldset>`;
}

function bindQuestionEvents() {
  document.querySelectorAll("[data-field]").forEach(button => {
    button.addEventListener("click", () => {
      if (state.submitting) return;
      const { field, type, value, max, exclusive } = button.dataset;

      if (type === "single") {
        setAnswer(field, value);
        return;
      }

      let values = [...state.answers[field]];
      if (exclusive && value === exclusive) {
        values = values.includes(exclusive) ? [] : [exclusive];
      } else {
        values = values.filter(item => item !== exclusive);
        values = values.includes(value)
          ? values.filter(item => item !== value)
          : [...values, value];

        if (max && values.length > Number(max)) {
          showStepErrors({ [field]: `最多選擇 ${max} 個` }, "請調整選擇");
          return;
        }
      }
      setAnswer(field, values, value);
    });
  });

  document.querySelectorAll("[data-text-field]").forEach(input => {
    input.addEventListener("input", event => {
      if (state.submitting) return;
      const fieldKey = event.currentTarget.dataset.textField;
      state.answers[fieldKey] = event.currentTarget.value;
      state.answers = clearHiddenAnswers(state.answers);
      refreshStepErrorState();
      syncStepErrorUi();
    });
  });

  const optionalToggle = $("optionalNoGosToggle");
  optionalToggle?.addEventListener("click", () => {
    if (state.submitting) return;
    state.noGosExpanded = !state.noGosExpanded;
    render({ focus: false });
    focusElement($("optionalNoGosToggle"));
  });
}

function renderIntro({ focus = true } = {}) {
  $("hero").hidden = false;
  $("wizard").hidden = true;
  $("resultArea").hidden = true;
  $("hero").innerHTML = `<div class="hero-layout">
    <div>
      <p class="eyebrow">台南小魏 · 買厝作伙</p>
      <h1 tabindex="-1">找到適合生活的房子，從問對問題開始。</h1>
      <p class="hero-copy">用 6 個關鍵選擇，先整理生活圈、舒服負擔與真正底線。</p>
      <div class="intro-meta"><span>約 60～90 秒完成</span><span>可隨時返回修改</span></div>
      <button class="primary" id="startButton" type="button">開始整理</button>
    </div>
    <aside class="consultant-note" aria-label="小魏提醒">
      <small>CONSULTANT NOTE</small>
      <blockquote>「裝潢可以改，格局與每天的生活方式，更值得先確認。」</blockquote>
      <p>魏泉承｜永慶不動產－小東南紡店</p>
    </aside>
  </div>`;
  $("startButton").addEventListener("click", goNext);
  if (focus) focusElement($("hero").querySelector("h1"));
}

function renderQuestion({ focus = true } = {}) {
  $("hero").hidden = true;
  $("wizard").hidden = false;
  $("resultArea").hidden = true;
  const step = QUESTION_STEPS[state.stepIndex];
  const currentStep = state.stepIndex + 1;
  $("progressText").textContent = `第 ${currentStep} 題，共 ${QUESTION_STEPS.length} 題`;
  const progressRow = $("progressText").parentElement;
  let milestone = progressRow.querySelector(".progress-milestone");
  if (!milestone) {
    milestone = document.createElement("p");
    milestone.className = "progress-milestone";
    progressRow.append(milestone);
  }
  milestone.textContent = STEP_MILESTONES[state.stepIndex];
  $("progressBar").style.width = `${(currentStep / QUESTION_STEPS.length) * 100}%`;
  const progress = document.querySelector("[role='progressbar']");
  progress.setAttribute("aria-valuemax", String(QUESTION_STEPS.length));
  progress.setAttribute("aria-valuenow", String(currentStep));
  progress.setAttribute("aria-valuetext", `第 ${currentStep} 題，共 ${QUESTION_STEPS.length} 題`);
  const questionFields = step.id === "priorities"
    ? `${renderField(step.fields[0])}
      <button class="optional-toggle" id="optionalNoGosToggle" type="button" aria-expanded="${state.noGosExpanded}" aria-controls="optionalNoGos">
        有一定避開的條件嗎？<span>選填</span>
      </button>
      ${state.noGosExpanded ? `<div class="optional-panel" id="optionalNoGos">${step.fields.slice(1).map(renderField).join("")}</div>` : ""}`
    : step.fields.map(renderField).join("");
  $("questionArea").innerHTML = `<article class="question-card">
    <p class="eyebrow">買房方向診斷 · ${String(currentStep).padStart(2, "0")}</p>
    <h2 tabindex="-1">${escapeHtml(step.title)}</h2>
    <div class="advisor-tip"><strong>小魏提醒：</strong>${escapeHtml(step.tip)}</div>
    ${questionFields}
  </article>`;
  $("backButton").onclick = goBack;
  $("nextButton").onclick = goNext;
  $("backButton").disabled = state.submitting;
  $("nextButton").disabled = state.submitting;
  $("nextButton").textContent = state.stepIndex === QUESTION_STEPS.length - 1 ? "查看方向" : "下一題";
  bindQuestionEvents();
  syncStepErrorUi();
  if (focus) focusElement($("questionArea").querySelector("h2"));
}

function resultPreview(result) {
  const headlineLines = result.headline.split("\n");
  return `<article class="result-card">
    <span class="result-status">${escapeHtml(result.status)}</span>
    <h2 tabindex="-1">${headlineLines.map(line => `<span class="result-headline-line">${escapeHtml(line)}</span>`).join("")}</h2>
    <h3>目前找房方向</h3>
    <ul class="direction-list">${result.direction.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <h3>預算提醒</h3>
    <p>${escapeHtml(result.budgetReminder)}</p>
    <h3>最值得先確認的 3 件事</h3>
    <ol class="preview-priorities">${result.priorityPreview.map(item => `<li data-preview-priority>${escapeHtml(item.text)}</li>`).join("")}</ol>
  </article>`;
}

function bindContactEvents() {
  $("name").addEventListener("input", event => {
    if (state.submitting) return;
    state.answers.name = event.target.value;
    updateSubmitState();
  });
  $("phone").addEventListener("input", event => {
    if (state.submitting) return;
    state.answers.phone = event.target.value;
    state.phoneTouched = true;
    updateSubmitState();
  });
  $("phone").addEventListener("blur", () => {
    if (state.submitting) return;
    state.answers.phone = normalizeContact(state.answers.phone);
    $("phone").value = state.answers.phone;
    state.phoneTouched = true;
    updateSubmitState();
  });
  $("consent").addEventListener("change", event => {
    if (state.submitting) return;
    state.answers.consent = event.target.checked;
    updateSubmitState();
  });
  $("leadForm").addEventListener("submit", event => {
    event.preventDefault();
    handleSubmit();
  });
  $("resultBack").addEventListener("click", goBack);
  $("copyButton").addEventListener("click", copySummary);
}

function updateSubmitState() {
  const phoneValid = isValidContact(state.answers.phone);
  const phone = $("phone");
  const guidance = $("phoneGuidance");
  const showPhoneError = state.phoneTouched && !phoneValid;

  phone.setAttribute("aria-invalid", String(showPhoneError));
  guidance.textContent = showPhoneError
    ? "請輸入 09 開頭的 10 碼手機號碼或合法 LINE ID"
    : "手機輸入10碼，例09XX；LINE ID 可直接輸入";
  guidance.classList.toggle("error", showPhoneError);
  // 按鈕只在送出中鎖住。缺欄位時仍可按，由 handleSubmit 指出還差什麼，
  // 避免使用者按了完全沒反應。
  $("submitButton").disabled = state.submitting;
}

function renderResult({ focus = true } = {}) {
  $("hero").hidden = true;
  $("wizard").hidden = true;
  $("resultArea").hidden = false;
  const result = currentActiveSubmission()?.result || deriveResult(state.answers);
  const locked = state.submitting ? " disabled" : "";
  const buttonLabel = state.submitting
    ? "確認資料入表中…"
    : state.submitAttempted && state.submitError
      ? "重新送出並確認"
      : "免費取得完整方向卡";

  $("resultArea").innerHTML = `${resultPreview(result)}
    <form id="leadForm" class="result-card contact-card" novalidate aria-busy="${state.submitting}">
      <p class="eyebrow">最後一步 · 確認聯絡方式</p>
      <h3>免費取得完整看屋方向卡</h3>
      <p class="contact-intro">資料只用於回覆這次需求，不會用來發送無關訊息。送出後會先確認資料確實入表；確認前不會顯示成功。若目前不方便送出，也可複製摘要或改用 LINE。</p>
      <div class="contact-grid">
        <label class="field" for="name"><span>怎麼稱呼您？</span><input id="name" autocomplete="name" value="${escapeHtml(state.answers.name)}" required${locked}><span class="field-guidance name-guidance" aria-hidden="true"></span></label>
        <label class="field" for="phone"><span>手機號碼 or LINE ID</span><input id="phone" type="text" inputmode="text" autocomplete="tel" aria-describedby="phoneGuidance" value="${escapeHtml(state.answers.phone)}" required${locked}><span class="field-guidance" id="phoneGuidance"></span></label>
      </div>
      <label class="consent" for="consent"><input id="consent" type="checkbox" ${state.answers.consent ? "checked" : ""}${locked}><span>我同意由小魏依這份結果與我聯繫</span></label>
      <div class="form-error" id="submitError" role="alert" tabindex="-1">${escapeHtml(state.submitError)}</div>
      <div class="submit-row">
        <button class="primary" id="submitButton" type="submit">${buttonLabel}</button>
        <p class="submit-state" id="submitState" role="status">${state.submitting ? "正在送出，並確認資料是否已入表，請稍候。" : "送出期間請不要關閉頁面。"}</p>
      </div>
      <div class="fallback-actions">
        <button id="resultBack" type="button"${locked}>回上一步</button>
        <button id="copyButton" type="button">複製需求摘要</button>
        <a class="call-action" href="tel:${PHONE.replaceAll("-", "")}"><span aria-hidden="true">📞</span> 直接撥打 ${PHONE}</a>
        <a href="${LINE_URL}" target="_blank" rel="noopener">改用 LINE 聯絡</a>
      </div>
    </form>`;
  bindContactEvents();
  updateSubmitState();
  if (focus) focusElement($("resultArea").querySelector("h2"));
}

// 分頁在背景時動畫時間軸是凍結的，直接掛上去買方回來只會看到播到一半的畫面。
// 等真的看得到再開始播，讓他從頭看到完整的完成動畫。
function playCompleteAnimation() {
  const card = document.querySelector(".complete-card");
  if (!card) return;

  const start = () => document.querySelector(".complete-card")?.classList.add("animate-in");
  if (document.visibilityState === "visible") {
    start();
    return;
  }
  document.addEventListener("visibilitychange", function onVisible() {
    if (document.visibilityState !== "visible") return;
    document.removeEventListener("visibilitychange", onVisible);
    start();
  });
}

function renderComplete({ focus = true } = {}) {
  $("hero").hidden = true;
  $("wizard").hidden = true;
  $("resultArea").hidden = false;
  const snapshot = state.confirmedSubmission;
  if (!snapshot) {
    state.phase = "result";
    renderResult({ focus });
    return;
  }
  const result = snapshot.result;
  const priorities = result.videoQuestions.filter(item => item.relevant).slice(0, 4);
  const secondary = result.videoQuestions.filter(item => !priorities.some(priority => priority.ep === item.ep));
  $("resultArea").innerHTML = `${resultPreview(result)}
    <section class="result-card complete-card">
      <div class="complete-seal" aria-hidden="true">✓</div>
      <h3 tabindex="-1">完整方向卡已確認送出</h3>
      <p>資料已確認入表，小魏會依這份方向與您聯繫。以下清單也可以先保存，之後看屋時逐項確認。</p>
      <h3>最適合您的看屋策略</h3>
      <ul class="strategy-list">${result.strategy.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <fieldset class="video-list">
        <legend>看屋前，問自己這 ${result.videoQuestions.length} 題</legend>
        <div class="video-list-items priority-video-list">${priorities.map(item => `
          <label class="video-check-item relevant" data-priority-check data-relevant="true">
            <input type="checkbox">
            <span class="video-question-text">${escapeHtml(item.text)}</span>
            <span class="video-relevant-badge">優先確認</span>
          </label>`).join("")}
        </div>
        <details class="secondary-video-details">
          <summary>查看其餘 6 項（完整 10 項）</summary>
          <div class="video-list-items">${secondary.map(item => `
            <label class="video-check-item ${item.relevant ? "relevant" : ""}" data-secondary-check data-relevant="${item.relevant}">
              <input type="checkbox">
              <span class="video-question-text">${escapeHtml(item.text)}</span>
              ${item.relevant ? '<span class="video-relevant-badge">優先確認</span>' : ""}
            </label>`).join("")}
          </div>
        </details>
      </fieldset>
      <p class="contact-signature">魏泉承｜永慶不動產-小東南紡店</p>
      <div class="fallback-actions">
        <button id="copyButton" type="button">複製需求摘要</button>
        <a class="call-action" href="tel:${PHONE.replaceAll("-", "")}"><span aria-hidden="true">📞</span> 直接撥打 ${PHONE}</a>
        <a class="primary" href="${LINE_URL}" target="_blank" rel="noopener">LINE 找台南小魏</a>
      </div>
    </section>`;
  $("copyButton").addEventListener("click", copySummary);
  playCompleteAnimation();
  if (focus) focusElement($("resultArea").querySelector("h3[tabindex]"));
}

function applyLocalTestShortcut() {
  if (!isLocalTestHost()) return;
  const target = new URLSearchParams(location.search).get("testStep");
  if (!target) return;

  Object.assign(state.answers, {
    purpose: "自住",
    timeline: "3個月內",
    areas: ["永康區"],
    lifeFocus: ["工作通勤"],
    downPayment: "200～300萬",
    monthlyMortgage: "2～3萬",
    householdSize: "2 人",
    rooms: "2房",
    propertyTypes: ["電梯大樓"],
    agePreference: "20年內",
    parking: "一定要平車",
    mustHaves: ["格局"],
    noGos: [],
    moveInBudget: "",
    conditionTolerance: "",
    decisionLimit: ""
  });

  if (target === "result") {
    state.phase = "result";
    state.stepIndex = QUESTION_STEPS.length - 1;
    return;
  }

  const index = QUESTION_STEPS.findIndex(step => step.id === target);
  if (index >= 0) {
    state.phase = "questions";
    state.stepIndex = index;
  }
}

function configureServices({ endpoint, submitLead: submitImplementation } = {}) {
  if (!isLocalTestHost()) return;
  if (state.submitting) throw new Error("cannot reconfigure services while submitting");
  if (typeof endpoint === "string") services.endpoint = endpoint;
  if (typeof submitImplementation === "function") services.submitLead = submitImplementation;
}

function syncGlobalBusyState() {
  $("app").setAttribute("aria-busy", String(state.submitting));
  const brand = document.querySelector(".brand");
  brand.setAttribute("aria-disabled", String(state.submitting));
  brand.classList.toggle("disabled", state.submitting);
  brand.tabIndex = state.submitting ? -1 : 0;
}

function render(options = {}) {
  syncGlobalBusyState();
  if (state.phase === "intro") {
    renderIntro(options);
    return;
  }
  if (state.phase === "questions") {
    renderQuestion(options);
    return;
  }
  if (state.phase === "complete") {
    renderComplete(options);
    return;
  }
  renderResult(options);
}

function showToast(message) {
  const toast = $("toast");
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}

document.querySelector(".brand").addEventListener("click", event => {
  if (state.submitting) event.preventDefault();
});
if (isLocalTestHost()) {
  window.__buyerAppTest = { state, setAnswer, goNext, goBack, handleSubmit, render, configureServices };
}
applyLocalTestShortcut();
render();
