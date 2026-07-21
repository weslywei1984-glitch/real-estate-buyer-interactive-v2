import {
  QUESTION_STEPS,
  clearHiddenAnswers,
  createInitialAnswers,
  customFieldFor,
  needsThirdRoomUse,
  validateStep
} from "./questions.js";
import { deriveResult } from "./result.js";
import { buildPayload, buildSummary, isTaiwanMobile } from "./payload.js";
import { submitLead } from "./api.js";
import { BACKEND_URL, LINE_URL, PHONE } from "./config.js";

const state = {
  answers: createInitialAnswers(),
  stepIndex: -1,
  phase: "intro",
  submitting: false,
  submitError: "",
  submitAttempted: false,
  phoneTouched: false,
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
  const submissionId = crypto.randomUUID();
  const payload = buildPayload({ answers, result, submissionId });
  const summary = buildSummary({ answers, result });
  return deepFreeze({ answers, result, payload, summary });
}

async function handleSubmit() {
  if (state.submitting) return;
  state.phoneTouched = true;
  updateSubmitState();

  if (!state.answers.name.trim()) {
    focusElement($("name"));
    return;
  }
  if (!isTaiwanMobile(state.answers.phone)) {
    focusElement($("phone"));
    return;
  }
  if (!state.answers.consent) {
    focusElement($("consent"));
    return;
  }

  state.submitAttempted = true;
  if (!services.endpoint) {
    state.submitError = "尚未設定獨立後端，資料還沒有送出。您可以保留答案，或先用 LINE 聯絡小魏。";
    render({ focus: false });
    focusElement($("submitError"));
    return;
  }

  const endpoint = services.endpoint;
  const submit = services.submitLead;
  const snapshot = createSubmissionSnapshot();
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
    if (state.phase !== "complete") state.activeSubmission = null;
    render({ focus: state.phase === "complete" });
    if (state.phase !== "complete") focusElement($("submitError"));
  }
}

async function copySummary() {
  const snapshot = state.phase === "complete" ? state.confirmedSubmission : state.activeSubmission;
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
  const hint = field.max
    ? `<span class="field-guidance">可選 1～${field.max} 個</span>`
    : field.type === "multi" ? `<span class="field-guidance">可複選</span>` : "";
  const custom = field.custom && state.answers[field.key] === field.custom.option
    ? `<label class="field custom-field" for="field-${field.custom.key}">
        <span>${escapeHtml(field.custom.label)}</span>
        <input id="field-${field.custom.key}" data-text-field="${field.custom.key}" value="${escapeHtml(state.answers[field.custom.key])}" placeholder="${escapeHtml(field.custom.placeholder)}" autocomplete="off"${disabled}>
      </label>`
    : "";
  return `<fieldset data-field-group="${field.key}">
    <legend>${escapeHtml(field.label)}</legend>${hint}
    <div class="choice-grid">
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
        values = [exclusive];
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
}

function renderIntro({ focus = true } = {}) {
  $("hero").hidden = false;
  $("wizard").hidden = true;
  $("resultArea").hidden = true;
  $("hero").innerHTML = `<div class="hero-layout">
    <div>
      <p class="eyebrow">台南小魏 · 買厝作伙</p>
      <h1 tabindex="-1">找到適合生活的房子，從問對問題開始。</h1>
      <p class="hero-copy">用 ${QUESTION_STEPS.length} 個關鍵選擇，先整理預算、空間、屋況與出價底線。不是替您打分數，而是把值得看的方向變清楚。</p>
      <div class="intro-meta"><span>約 1 分鐘完成</span><span>可隨時返回修改</span></div>
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
  $("progressBar").style.width = `${(currentStep / QUESTION_STEPS.length) * 100}%`;
  const progress = document.querySelector("[role='progressbar']");
  progress.setAttribute("aria-valuenow", String(currentStep));
  progress.setAttribute("aria-valuetext", `第 ${currentStep} 題，共 ${QUESTION_STEPS.length} 題`);
  $("questionArea").innerHTML = `<article class="question-card">
    <p class="eyebrow">買房方向診斷 · ${String(currentStep).padStart(2, "0")}</p>
    <h2 tabindex="-1">${escapeHtml(step.title)}</h2>
    <p class="question-hint">${escapeHtml(step.tip)}</p>
    <div class="advisor-tip"><strong>小魏提醒：</strong>${escapeHtml(step.tip)}</div>
    ${step.fields.map(renderField).join("")}
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
  return `<article class="result-card">
    <span class="result-status">${escapeHtml(result.status)}</span>
    <h2 tabindex="-1">${escapeHtml(result.headline)}</h2>
    <h3>目前找房方向</h3>
    <ul class="direction-list">${result.direction.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <h3>預算提醒</h3>
    <p>${escapeHtml(result.budgetReminder)}</p>
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
  const nameValid = Boolean(state.answers.name.trim());
  const phoneValid = isTaiwanMobile(state.answers.phone);
  const valid = nameValid && phoneValid && state.answers.consent;
  const phone = $("phone");
  const guidance = $("phoneGuidance");
  const showPhoneError = state.phoneTouched && !phoneValid;

  phone.setAttribute("aria-invalid", String(showPhoneError));
  guidance.textContent = showPhoneError
    ? "請輸入 09 開頭的 10 碼手機號碼"
    : "可輸入 0912-345-678，送出時會整理為 10 碼數字。";
  guidance.classList.toggle("error", showPhoneError);
  $("submitButton").disabled = !valid || state.submitting;
}

function renderResult({ focus = true } = {}) {
  $("hero").hidden = true;
  $("wizard").hidden = true;
  $("resultArea").hidden = false;
  const result = state.activeSubmission?.result || deriveResult(state.answers);
  const locked = state.submitting ? " disabled" : "";
  const buttonLabel = state.submitting
    ? "確認資料入表中…"
    : state.submitAttempted && state.submitError
      ? "重新送出並確認"
      : "送出並查看完整方向卡";

  $("resultArea").innerHTML = `${resultPreview(result)}
    <form id="leadForm" class="result-card contact-card" aria-busy="${state.submitting}">
      <p class="eyebrow">最後一步 · 確認聯絡方式</p>
      <h3>把完整方向卡整理給您</h3>
      <p class="contact-intro">送出後會先確認資料確實入表；確認前不會顯示成功。若目前不方便送出，也可複製摘要或改用 LINE。</p>
      <div class="contact-grid">
        <label class="field" for="name"><span>怎麼稱呼您？</span><input id="name" autocomplete="name" value="${escapeHtml(state.answers.name)}" required${locked}></label>
        <label class="field" for="phone"><span>手機號碼</span><input id="phone" type="tel" inputmode="numeric" autocomplete="tel" aria-describedby="phoneGuidance" value="${escapeHtml(state.answers.phone)}" required${locked}><span class="field-guidance" id="phoneGuidance"></span></label>
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
        <a href="${LINE_URL}" target="_blank" rel="noopener">改用 LINE 聯絡</a>
      </div>
    </form>`;
  bindContactEvents();
  updateSubmitState();
  if (focus) focusElement($("resultArea").querySelector("h2"));
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
  $("resultArea").innerHTML = `${resultPreview(result)}
    <section class="result-card">
      <div class="complete-seal" aria-hidden="true">✓</div>
      <h3 tabindex="-1">完整方向卡已確認送出</h3>
      <p>資料已確認入表，小魏會依這份方向與您聯繫。以下清單也可以先保存，之後看屋時逐項確認。</p>
      <h3>最適合您的看屋策略</h3>
      <ul class="strategy-list">${result.strategy.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <fieldset class="video-list">
        <legend>看屋前，問自己這 ${result.videoQuestions.length} 題</legend>
        <div class="video-list-items">${result.videoQuestions.map(item => `
          <label class="video-check-item ${item.relevant ? "relevant" : ""}" data-relevant="${item.relevant}">
            <input type="checkbox">
            <span class="video-question-text">${escapeHtml(item.text)}</span>
            ${item.relevant ? '<span class="video-relevant-badge">優先確認</span>' : ""}
          </label>`).join("")}
        </div>
      </fieldset>
      <p class="contact-signature">魏泉承｜永慶不動產-小東南紡店｜<a href="tel:${PHONE.replaceAll("-", "")}">${PHONE}</a></p>
      <div class="fallback-actions">
        <button id="copyButton" type="button">複製需求摘要</button>
        <a class="primary" href="${LINE_URL}" target="_blank" rel="noopener">LINE 找台南小魏</a>
      </div>
    </section>`;
  $("copyButton").addEventListener("click", copySummary);
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
    moveInBudget: "10～30萬",
    conditionTolerance: "小修可以接受",
    decisionLimit: "已有明確上限，不會超過"
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
