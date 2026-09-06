import {
  QUESTION_STEPS,
  clearHiddenAnswers,
  createInitialAnswers,
  customFieldFor,
  getQuestionProgress,
  getStepFeedback,
  needsThirdRoomUse,
  validateStep
} from "./questions.js?v=20260906-r3";
import { deriveResult } from "./result.js?v=20260906-r3";
import { downloadResultImage } from "./result-image.js?v=20260906-r3";
import { buildPayload, buildSummary } from "./payload.js?v=20260906-r3";
import { isValidContact, normalizeContact } from "./contact.js";
import { submitLead } from "./api.js";
import { randomId } from "./random.js";
import { BACKEND_URL, LINE_URL, PHONE } from "./config.js";

const state = {
  answers: createInitialAnswers(),
  stepIndex: -1,
  phase: "intro",
  submitting: false,
  submitError: "",
  submitAttempted: false,
  phoneTouched: false,
  noGosExpanded: false,
  optionalSections: {},
  contactExpanded: true,
  editingResult: false,
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

    const ownerKey = errorKey;
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
  target?.focus({ preventScroll: true });
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
  const step = QUESTION_STEPS[state.stepIndex];
  const hiddenOptionalError = step?.fields.some(field => field.optional
    && (errors[field.key] || (field.custom && errors[field.custom.key])));
  if (hiddenOptionalError) state.optionalSections[step.id] = true;
  if (errors.otherNoGo) state.noGosExpanded = true;
  if (hiddenOptionalError || errors.otherNoGo) render({ focus: false });
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
  if (state.editingResult) {
    state.editingResult = false;
    state.phase = "result";
    render();
    return;
  }
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
      : "目前無法送出，答案已保留。請重新送出、儲存需求照片或改用 LINE。";
  } finally {
    state.submitting = false;
    render({ focus: state.phase === "complete" });
    if (state.phase !== "complete") focusElement($("submitError"));
  }
}

async function saveResultImage() {
  const snapshot = state.phase === "complete" ? state.confirmedSubmission : currentActiveSubmission();
  try {
    await downloadResultImage({
      answers: snapshot?.answers || state.answers,
      documentRef: document,
      urlRef: URL
    });
    showToast("需求照片已儲存");
  } catch {
    showToast("需求照片儲存失敗，請稍後再試");
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
    ? `<span class="field-guidance selected-summary" role="status">${values.length ? `已選 ${values.length}／${field.max}，依點選順序排列` : `選 1～${field.max} 個就好`}</span>`
    : field.type === "multi" ? `<span class="field-guidance">可複選</span>` : "";
  const custom = field.custom && state.answers[field.key] === field.custom.option
    ? `<label class="field custom-field" for="field-${field.custom.key}">
        <span>${escapeHtml(field.custom.label)}</span>
        <input id="field-${field.custom.key}" data-text-field="${field.custom.key}" value="${escapeHtml(state.answers[field.custom.key])}" placeholder="${escapeHtml(field.custom.placeholder)}" autocomplete="off"${disabled}>
      </label>`
    : "";
  return `<fieldset data-field-group="${field.key}">
    <legend>${escapeHtml(field.label)}</legend>${hint}
    <div class="choice-grid${compact}${field.descriptions ? " purpose-grid" : ""}">
      ${field.options.map((option, index) => {
        const selected = values.includes(option);
        const rank = field.max && selected ? `<span class="choice-rank" aria-hidden="true">${values.indexOf(option) + 1}</span>` : "";
        const description = field.descriptions ? `<small>${escapeHtml(field.descriptions[index])}</small>` : "";
        return `<button class="choice${selected ? " selected" : ""}" type="button" aria-label="${escapeHtml(option)}" data-field="${field.key}" data-type="${field.type}" data-value="${escapeHtml(option)}" data-max="${field.max || ""}" data-exclusive="${escapeHtml(field.exclusive || "")}" aria-pressed="${selected}"${disabled}>${rank}<span>${escapeHtml(option)}</span>${description}</button>`;
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
          showToast(`已選滿 ${max} 個，先取消一個再換選吧。`);
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
      if (fieldKey === "customArea" && event.currentTarget.value.trim()) {
        state.answers.areas = state.answers.areas.filter(area => area !== "還沒決定");
        const undecided = document.querySelector('[data-field="areas"][data-value="還沒決定"]');
        undecided?.classList.remove("selected");
        undecided?.setAttribute("aria-pressed", "false");
      }
      state.answers = clearHiddenAnswers(state.answers);
      refreshStepErrorState();
      syncStepErrorUi();
      syncQuestionProgress();
    });
  });

  document.querySelectorAll("[data-optional-section]").forEach(details => {
    details.addEventListener("toggle", () => {
      if (details.isConnected) state.optionalSections[details.dataset.optionalSection] = details.open;
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
      <p class="eyebrow">找房之前，先找到自己的方向</p>
      <h1 tabindex="-1">你的下一個家，<br><em>從這裡開始。</em></h1>
      <p class="hero-copy">點一點你的生活、預算與喜好，<br>把「想買房」變成清楚的找房清單。</p>
      <div class="intro-meta"><span>5 個小步驟</span><span>整理你的找房清單</span></div>
      <button class="primary" id="startButton" type="button">找找我的買房方向 <span aria-hidden="true">↗</span></button>
      <p class="hero-footnote">還沒想好也可以，邊選邊找到答案。</p>
    </div>
    <aside class="consultant-note" aria-label="小魏提醒">
      <div class="home-sketch" aria-hidden="true"><i class="home-roof"></i><i class="home-window"></i><i class="home-door"></i><span class="home-sun">✳</span><span class="home-heart">♡</span></div>
      <small>一張清單，讓找房更有方向</small>
      <blockquote>房子很多，<br>適合你的生活最重要。</blockquote>
      <p>台南小魏 買厝作伙<br>魏泉承｜永慶不動產-小東南紡店<br><a href="tel:0927617207">0927-617-207</a></p>
    </aside>
  </div>`;
  $("startButton").addEventListener("click", goNext);
  if (focus) focusElement($("hero").querySelector("h1"));
}

function syncQuestionProgress() {
  const step = QUESTION_STEPS[state.stepIndex];
  const currentStep = state.stepIndex + 1;
  const { completed, total, remaining } = getQuestionProgress(state.answers);
  $("progressText").textContent = `${String(currentStep).padStart(2, "0")} / ${String(QUESTION_STEPS.length).padStart(2, "0")}　${step.label}`;
  $("progressCount").textContent = remaining ? `已完成 ${completed}／${total}` : "選好了，隨時都能改";
  const progressRow = document.querySelector(".progress-row");
  let milestone = progressRow.querySelector(".progress-milestone");
  if (!milestone) {
    milestone = document.createElement("p");
    milestone.className = "progress-milestone";
    progressRow.append(milestone);
  }
  milestone.innerHTML = QUESTION_STEPS.map((item, index) => {
    const done = validateStep(item.id, state.answers).valid;
    return `<span class="step-stop${index === state.stepIndex ? " current" : ""}${done ? " done" : ""}" ${index === state.stepIndex ? 'aria-current="step"' : ""}><i aria-hidden="true">${done ? "✓" : index + 1}</i>${item.label}</span>`;
  }).join("");
  $("progressBar").style.width = `${(completed / total) * 100}%`;
  const progress = document.querySelector("[role='progressbar']");
  progress.setAttribute("aria-valuemax", String(total));
  progress.setAttribute("aria-valuenow", String(completed));
  progress.setAttribute("aria-valuetext", `已完成 ${completed} 個步驟，還有 ${remaining} 個：目前是${step.label}`);
  const feedback = getStepFeedback(step.id, state.answers);
  $("stepFeedback").textContent = feedback || "選好再往下，之後也能改。";
  $("stepFeedback").title = feedback;
  $("stepFeedback").classList.toggle("recorded", Boolean(feedback));
}

function renderQuestion({ focus = true } = {}) {
  $("hero").hidden = true;
  $("wizard").hidden = false;
  $("resultArea").hidden = true;
  const step = QUESTION_STEPS[state.stepIndex];
  syncQuestionProgress();
  const optional = step.fields.filter(field => field.optional || field.key === "customArea");
  const required = step.fields.filter(field => !optional.includes(field));
  const optionalTitle = step.id === "location" ? "指定生活圈、通勤需求" : "屋齡、居住人數等細節";
  const optionalFields = optional.length ? `<details class="optional-details" data-optional-section="${step.id}" ${state.optionalSections[step.id] ? "open" : ""}>
    <summary>${optionalTitle}<span>選填</span></summary><div class="optional-panel">${optional.map(renderField).join("")}</div></details>` : "";
  const questionFields = step.id === "priorities"
    ? `${renderField(step.fields[0])}
      <button class="optional-toggle" id="optionalNoGosToggle" type="button" aria-expanded="${state.noGosExpanded}" aria-controls="optionalNoGos">
        有一定避開的條件嗎？<span>選填</span>
      </button>
      <div class="optional-panel" id="optionalNoGos" ${state.noGosExpanded ? "" : "hidden"}>${step.fields.slice(1).map(renderField).join("")}</div>`
    : `${required.map(renderField).join("")}${optionalFields}`;
  $("questionArea").innerHTML = `<article class="question-card">
    <h2 tabindex="-1">${escapeHtml(step.title)}</h2>
    <p class="question-hint">${escapeHtml(step.tip)}</p>
    ${questionFields}
  </article>`;
  $("backButton").onclick = goBack;
  $("nextButton").onclick = goNext;
  $("backButton").disabled = state.submitting;
  $("nextButton").disabled = state.submitting;
  $("nextButton").textContent = state.editingResult ? "更新方向卡" : state.stepIndex === QUESTION_STEPS.length - 1 ? "看我的找房清單 ↗" : "下一步 →";
  bindQuestionEvents();
  syncStepErrorUi();
  if (focus) focusElement($("questionArea").querySelector("h2"));
}

function resultPreview(result) {
  const headlineLines = result.headline.split("\n");
  const mainLabels = ["生活圈", "舒服預算", "理想的家", "優先順序"];
  if (result.facts.some(fact => fact.label === "一定避開" && !fact.value.startsWith("未填"))) mainLabels.push("一定避開");
  const factHtml = fact => `<div class="result-fact"><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd><button class="edit-fact" type="button" data-edit-step="${fact.step}" aria-label="修改${escapeHtml(fact.label)}" ${state.submitting ? "disabled" : ""}>修改</button></div>`;
  return `<article class="result-card">
    <p class="eyebrow">YOUR HOME NOTES · 我的找房清單</p>
    <span class="result-status">${escapeHtml(result.status)}</span>
    <h2 tabindex="-1">${headlineLines.map(line => `<span class="result-headline-line">${escapeHtml(line)}</span>`).join("")}</h2>
    <dl class="result-facts">${result.facts.filter(fact => mainLabels.includes(fact.label)).map(factHtml).join("")}</dl>
    ${state.phase !== "complete" ? `<a class="primary lead-prompt" id="leadJump" href="#leadForm">${escapeHtml(result.contactOffer.action)} ↗</a>` : ""}
    <details class="result-details"><summary>查看完整條件與預算提醒</summary>
      <dl class="result-facts">${result.facts.filter(fact => !mainLabels.includes(fact.label)).map(factHtml).join("")}</dl>
      <p class="budget-note">${escapeHtml(result.budgetReminder)}</p>
    </details>
    <h3>接下來，先做這 3 件事</h3>
    <ol class="preview-priorities">${result.priorityPreview.map(item => `<li data-preview-priority>${escapeHtml(item.text)}</li>`).join("")}</ol>
    <p class="result-note">依你的回答整理，尚未比對即時物件與貸款條件。</p>
  </article>`;
}

function bindResultEdits() {
  document.querySelectorAll("[data-edit-step]").forEach(button => {
    if (state.phase === "complete") { button.hidden = true; return; }
    button.addEventListener("click", () => {
      if (state.submitting) return;
      state.stepIndex = QUESTION_STEPS.findIndex(step => step.id === button.dataset.editStep);
      state.editingResult = true;
      state.phase = "questions";
      clearAllStepErrors();
      render();
    });
  });
}

function bindContactEvents() {
  bindResultEdits();
  $("leadJump")?.addEventListener("click", event => {
    event.preventDefault();
    state.contactExpanded = true;
    $("contactDetails").open = true;
    focusElement($("name"));
  });
  $("contactDetails").addEventListener("toggle", event => {
    if (event.currentTarget.isConnected) state.contactExpanded = event.currentTarget.open;
  });
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
  $("saveImageButton").addEventListener("click", saveResultImage);
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
    ? "正在送出…"
    : state.submitAttempted && state.submitError
      ? "重新送出並確認"
      : result.contactOffer.action;

  $("resultArea").innerHTML = `${resultPreview(result)}
    <details id="contactDetails" class="contact-details" ${state.contactExpanded || state.submitting || state.submitError ? "open" : ""}>
    <summary>${escapeHtml(result.contactOffer.title)}<span>依你的需求回覆</span></summary>
    <form id="leadForm" class="result-card contact-card" novalidate aria-busy="${state.submitting}">
      <p class="contact-intro">${escapeHtml(result.contactOffer.description)}</p>
      <p class="contact-next">送出後：小魏聯繫你 → 確認需求 → 討論下一步</p>
      <div class="contact-grid">
        <label class="field" for="name"><span>怎麼稱呼您？</span><input id="name" autocomplete="name" value="${escapeHtml(state.answers.name)}" required${locked}><span class="field-guidance name-guidance" aria-hidden="true"></span></label>
        <label class="field" for="phone"><span>手機號碼或 LINE ID</span><input id="phone" type="text" inputmode="text" autocomplete="tel" aria-describedby="phoneGuidance" value="${escapeHtml(state.answers.phone)}" required${locked}><span class="field-guidance" id="phoneGuidance"></span></label>
      </div>
      <label class="consent" for="consent"><input id="consent" type="checkbox" ${state.answers.consent ? "checked" : ""}${locked}><span>我同意由小魏依這份結果與我聯繫</span></label>
      <p class="contact-privacy">聯絡資料只用於回覆這次需求；也可以先保存清單，之後再聊。</p>
      <div class="form-error" id="submitError" role="alert" tabindex="-1">${escapeHtml(state.submitError)}</div>
      <div class="submit-row">
        <button class="primary" id="submitButton" type="submit">${escapeHtml(buttonLabel)}</button>
        <p class="submit-state" id="submitState" role="status">${state.submitting ? "正在送出你的找房清單，請稍候。" : ""}</p>
      </div>
    </form></details>
    <div class="result-actions fallback-actions">
      <button class="save-image-action" id="saveImageButton" type="button"><span aria-hidden="true">↓</span> 儲存需求照片</button>
      <a class="primary" href="${LINE_URL}" target="_blank" rel="noopener">LINE 找小魏聊聊 ↗</a>
    </div>
    <div class="result-footer"><button id="resultBack" type="button"${locked}>回上一步</button>
      <a href="tel:${PHONE.replaceAll("-", "")}">直接撥打 ${PHONE}</a>
      <p>台南小魏 買厝作伙<br>魏泉承｜永慶不動產-小東南紡店</p>
    </div>`;
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
  $("resultArea").innerHTML = `${resultPreview(snapshot.result)}
    <section class="result-card complete-card">
      <div class="complete-seal" aria-hidden="true">✓</div>
      <h3 tabindex="-1">清單已送出，接下來交給小魏。</h3>
      <p>小魏會依這份需求與你聯繫。也可以先把清單存起來，看屋時隨時對照。</p>
      <p class="contact-signature">台南小魏 買厝作伙<br>魏泉承｜永慶不動產-小東南紡店｜0927-617-207</p>
      <div class="fallback-actions">
        <button class="save-image-action" id="saveImageButton" type="button"><span aria-hidden="true">↓</span> 儲存需求照片</button>
        <a class="call-action" href="tel:${PHONE.replaceAll("-", "")}">直接撥打</a>
        <a class="primary" href="${LINE_URL}" target="_blank" rel="noopener">LINE 找小魏聊聊 ↗</a>
      </div>
    </section>`;
  $("saveImageButton").addEventListener("click", saveResultImage);
  bindResultEdits();
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
