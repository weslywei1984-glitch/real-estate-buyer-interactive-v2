# Buyer Interactive V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish an independent C-version buyer diagnosis that reduces the old 11-step flow to six focused question screens plus a result/contact screen, integrates the seven EP video lessons, and writes leads to a separate Google Sheet.

**Architecture:** Keep the production site as framework-free static HTML, CSS, and ES modules. Separate question/state rules, result derivation, payload creation, transport confirmation, and DOM rendering so each unit can be tested in Node; use an independent Apps Script web app and a submission-ID status check to confirm that cross-origin `no-cors` posts reached the new Sheet.

**Tech Stack:** HTML5, CSS, JavaScript ES modules, Node.js 24, Node built-in test runner, Playwright, Google Apps Script, Google Sheets, GitHub Pages.

## Global Constraints

- Do not modify, overwrite, deploy from, or change the backend of `weslywei1984-glitch/real-estate-buyer-interactive`.
- Build in `C:\Users\w\Documents\自動回覆系統\real-estate-buyer-interactive-v2` and publish to a new public repository named `weslywei1984-glitch/real-estate-buyer-interactive-v2`.
- The expected production URL is `https://weslywei1984-glitch.github.io/real-estate-buyer-interactive-v2/`.
- Use a new Google Sheet, a new Apps Script project/deployment, and source version `buyer-diagnosis-c-v2`.
- Keep production framework-free and dependency-free; development-only Playwright is allowed.
- The required flow is six question screens plus one result/contact screen. Per decision B (2026-07-18), third-room use remains the only conditional follow-up that changes core question content. Selecting "其他" for no-gos may reveal `otherNoGo` only as an inline explanatory field within the sixth `priorities` screen; it is not an additional question screen and must not create a seventh question screen.
- Use Traditional Chinese, deep ink green, warm ivory, and restrained gold; preserve the C-version consultant-card direction.
- Use the real LINE URL `https://line.me/R/ti/p/%40tainanwei` and the real contact block: 魏泉承, 永慶不動產-小東南紡店, 0927-617-207.
- Never claim a bank approval, exact loan amount, guaranteed price, return, or property fact that the supplied answers cannot support.
- Do not store IP addresses, device fingerprints, or unrelated sensitive data.

---

## Target File Structure

```text
real-estate-buyer-interactive-v2/
├── .gitignore
├── README.md
├── index.html
├── buyer-interactive.html
├── package.json
├── playwright.config.js
├── assets/
│   └── styles.css
├── src/
│   ├── config.js
│   ├── questions.js
│   ├── result.js
│   ├── payload.js
│   ├── api.js
│   └── app.js
├── apps-script/
│   └── Code.gs
├── tests/
│   ├── questions.test.js
│   ├── result.test.js
│   ├── payload.test.js
│   ├── api.test.js
│   ├── harness.test.js
│   └── app.spec.js
└── docs/superpowers/
    ├── specs/2026-07-18-buyer-interactive-v2-design.md
    └── plans/2026-07-18-buyer-interactive-v2.md
```

Responsibilities:

- `questions.js`: answer defaults, step order, conditional visibility, validation, and conditional-answer cleanup.
- `result.js`: pure answer-to-result transformation, including the relevant EP.01–EP.07 checklist.
- `payload.js`: phone normalization, submission ID generation, stable backend schema, and copyable summary.
- `api.js`: opaque POST dispatch followed by submission-ID status confirmation through JSONP.
- `app.js`: DOM rendering, focus management, navigation, submission state, copy fallback, and LINE handoff.
- `Code.gs`: server-side validation, formula-safe text conversion, deduplication, Sheet append, and status lookup.

---

### Task 1: Create the Isolated V2 Repository and Test Harness

**Files:**
- Create directory: `C:\Users\w\Documents\自動回覆系統\real-estate-buyer-interactive-v2`
- Modify: `.gitignore`
- Create: `package.json`
- Create: `playwright.config.js`
- Create: `tests/harness.test.js`
- Modify: `README.md`
- Preserve: `docs/superpowers/specs/2026-07-18-buyer-interactive-v2-design.md`
- Preserve: `docs/superpowers/plans/2026-07-18-buyer-interactive-v2.md`

**Interfaces:**
- Consumes: approved spec and plan committed in `C:\Users\w\AppData\Local\Temp\codex-buyer-ui-audit`.
- Produces: isolated local repository on branch `codex/buyer-interactive-v2`, Node test scripts, and a static test server configuration used by later tasks.

- [ ] **Step 1: Verify the source repository is clean enough to clone without mockup artifacts**

Run:

```powershell
$sourceRepo = 'C:\Users\w\AppData\Local\Temp\codex-buyer-ui-audit'
git -C $sourceRepo status --short
git -C $sourceRepo log -2 --oneline
```

Expected: `.superpowers/` may be untracked, but the committed spec and plan are present; no production source files are modified.

- [ ] **Step 2: Clone the approved documentation commit into a separate permanent directory**

Run:

```powershell
$sourceRepo = 'C:\Users\w\AppData\Local\Temp\codex-buyer-ui-audit'
$v2Repo = 'C:\Users\w\Documents\自動回覆系統\real-estate-buyer-interactive-v2'
git clone --single-branch --branch main $sourceRepo $v2Repo
git -C $v2Repo remote rename origin source-audit
git -C $v2Repo switch -c codex/buyer-interactive-v2
```

Expected: the new path exists, `source-audit` points only to the local audit clone, and the original GitHub repository is not a writable remote.

- [ ] **Step 3: Add the development harness**

Create `package.json`:

```json
{
  "name": "real-estate-buyer-interactive-v2",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js",
    "test:ui": "playwright test",
    "test:all": "npm run test && npm run test:ui",
    "serve": "python -m http.server 4173"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0"
  }
}
```

Create `playwright.config.js`:

```js
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "app.spec.js",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "python -m http.server 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } }
  ]
});
```

Append to `.gitignore`:

```gitignore
node_modules/
test-results/
playwright-report/
.superpowers/
```

Create `tests/harness.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

test("Node test harness is active", () => {
  assert.equal(typeof structuredClone, "function");
});
```

Replace `README.md` with:

```markdown
# 台南小魏｜買房方向診斷 C 版

獨立於舊版的買方需求互動頁。正式環境使用 GitHub Pages；名單寫入獨立的 Google Sheet。

## Local checks

```powershell
npm.cmd install
npm.cmd test
npm.cmd run test:ui
```

正式聯絡：魏泉承｜永慶不動產-小東南紡店｜0927-617-207  
LINE：https://line.me/R/ti/p/%40tainanwei
```

- [ ] **Step 4: Install and verify the harness**

Run:

```powershell
npm.cmd install
npm.cmd test
```

Expected: dependency installation succeeds; `Node test harness is active` passes and the command exits 0.

- [ ] **Step 5: Commit the isolated setup**

Run:

```powershell
git add .gitignore package.json package-lock.json playwright.config.js README.md tests/harness.test.js docs
git commit -m "chore: initialize isolated buyer diagnosis v2"
```

Expected: only V2-local setup and approved documentation are committed.

---

### Task 2: Implement the Six-Step Question Model and Validation

**Files:**
- Create: `src/questions.js`
- Create: `tests/questions.test.js`

**Interfaces:**
- Consumes: none.
- Produces:
  - `createInitialAnswers(): Answers`
  - `QUESTION_STEPS: QuestionStep[]`
  - `getVisibleStepIds(answers: Answers): string[]`
  - `clearHiddenAnswers(answers: Answers): Answers`
  - `validateStep(stepId: string, answers: Answers): { valid: boolean, errors: Record<string, string> }`

- [ ] **Step 1: Write failing tests for the six required steps, conditional third-room field, and inline other-no-go field**

Create `tests/questions.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  QUESTION_STEPS,
  createInitialAnswers,
  getVisibleStepIds,
  clearHiddenAnswers,
  validateStep
} from "../src/questions.js";

test("defines exactly six core question screens", () => {
  assert.deepEqual(QUESTION_STEPS.map(step => step.id), [
    "intent", "location", "budget", "space", "property", "priorities"
  ]);
});

test("third-room use is required only for three rooms or more", () => {
  const answers = createInitialAnswers();
  answers.householdSize = "2";
  answers.rooms = "3房";
  assert.equal(validateStep("space", answers).valid, false);
  answers.thirdRoomUse = "工作／書房";
  assert.equal(validateStep("space", answers).valid, true);
  answers.rooms = "2房";
  const cleaned = clearHiddenAnswers(answers);
  assert.equal(cleaned.thirdRoomUse, "");
});

test("location requires at least one area or a custom area", () => {
  const answers = createInitialAnswers();
  answers.lifeFocus = "工作通勤";
  assert.equal(validateStep("location", answers).valid, false);
  answers.areas = ["永康區"];
  assert.equal(validateStep("location", answers).valid, true);
});

test("priorities limits must-haves to three and accepts no special no-go", () => {
  const answers = createInitialAnswers();
  answers.mustHaves = ["地點", "格局", "採光通風", "安靜"];
  answers.noGos = ["無特殊忌諱"];
  assert.equal(validateStep("priorities", answers).valid, false);
  answers.mustHaves = ["地點", "格局", "採光通風"];
  assert.equal(validateStep("priorities", answers).valid, true);
});
```

- [ ] **Step 2: Run the question tests and confirm failure**

Run: `node --test tests/questions.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/questions.js`.

- [ ] **Step 3: Implement the question model and validation**

Create `src/questions.js` with these exact state keys and rules:

```js
export const QUESTION_STEPS = [
  {
    id: "intent", title: "這次買房，最主要是為了什麼？",
    tip: "先確認目的與時間，才不會一開始看很多、方向卻越來越亂。",
    fields: [
      { key: "purpose", label: "購屋目的", type: "single", options: ["自住", "換屋", "婚房", "幫家人找", "投資／置產", "先了解行情"] },
      { key: "timeline", label: "預計時程", type: "single", options: ["1個月內", "3個月內", "半年內", "一年內", "先看看"] }
    ]
  },
  {
    id: "location", title: "每天的生活，主要會落在哪裡？",
    tip: "看屋不只看室內，也要把通勤、採買與家人動線放進來。",
    fields: [
      { key: "areas", label: "想找區域", type: "multi", options: ["東區", "永康區", "安南區", "北區", "南區", "仁德區", "歸仁區", "新市／善化"] },
      { key: "customArea", label: "其他區域", type: "text", placeholder: "例：東橋、平實，或其他生活圈" },
      { key: "lifeFocus", label: "生活重心", type: "single", options: ["工作通勤", "學校接送", "家人照顧", "日常採買", "無固定地點"] }
    ]
  },
  {
    id: "budget", title: "買完房後，每月多少負擔最舒服？",
    tip: "不是想辦法買下來就好，而是買完後，生活仍要保留餘裕。",
    fields: [
      { key: "downPayment", label: "可準備自備款", type: "single", options: ["100萬以下", "100～200萬", "200～300萬", "300～500萬", "500萬以上", "還不確定"] },
      { key: "monthlyMortgage", label: "舒服的每月房貸", type: "single", options: ["2萬內", "2～3萬", "3～4萬", "4～5萬", "5萬以上", "希望小魏協助試算"] }
    ]
  },
  {
    id: "space", title: "這個家，平常會怎麼使用？",
    tip: "房間不是拿來收集的，把預算放在真正每天會用到的空間。",
    fields: [
      { key: "householdSize", label: "平常居住人數", type: "single", options: ["1 人", "2 人", "3 人", "4 人", "5 人以上"] },
      { key: "rooms", label: "希望房數", type: "single", options: ["1～2房", "2房", "3房", "3房以上", "還不確定"] },
      { key: "thirdRoomUse", label: "第三個房間準備拿來做什麼？", type: "single", options: ["家人長住", "工作／書房", "兒童房", "偶爾來客", "還沒想好"], when: "needsThirdRoomUse" }
    ]
  },
  {
    id: "property", title: "哪些物件條件是必要的？",
    tip: "先用類型、屋齡與車位縮小範圍，比一間一間碰運氣更有效率。",
    fields: [
      { key: "propertyTypes", label: "物件類型", type: "multi", options: ["電梯大樓", "華廈／公寓", "透天", "電梯透天", "其他"] },
      { key: "agePreference", label: "屋齡接受度", type: "single", options: ["10年內", "20年內", "30年內", "不拘"] },
      { key: "parking", label: "車位需求", type: "single", options: ["一定要平車", "車位即可", "有最好", "不需要"] }
    ]
  },
  {
    id: "priorities", title: "什麼最不能妥協？",
    tip: "裝潢可以改，但地點、格局與每天的生活方式更值得先確認。",
    fields: [
      { key: "mustHaves", label: "最重視，最多選 3 個", type: "multi", max: 3, options: ["地點", "格局", "採光通風", "安靜", "管理", "屋況", "生活機能", "停車", "價格"] },
      { key: "noGos", label: "一定避開，可不選", type: "multi", exclusive: "無特殊忌諱", options: ["西曬", "頂樓", "特殊風水／路沖", "基地台或高壓電", "格局問題", "無特殊忌諱", "其他"] },
      { key: "otherNoGo", label: "其他避開條件", type: "text", placeholder: "請簡單說明", when: "otherNoGo" }
    ]
  }
];

export function createInitialAnswers() {
  return {
    purpose: "", timeline: "", areas: [], customArea: "", lifeFocus: "",
    downPayment: "", monthlyMortgage: "", householdSize: "", rooms: "",
    thirdRoomUse: "", propertyTypes: [], agePreference: "", parking: "",
    mustHaves: [], noGos: [], otherNoGo: "", name: "", phone: "",
    consent: false
  };
}

export function needsThirdRoomUse(answers) {
  return answers.rooms === "3房" || answers.rooms === "3房以上";
}

export function getVisibleStepIds() {
  return QUESTION_STEPS.map(step => step.id);
}

export function clearHiddenAnswers(answers) {
  const next = structuredClone(answers);
  if (!needsThirdRoomUse(next)) next.thirdRoomUse = "";
  if (!next.noGos.includes("其他")) next.otherNoGo = "";
  if (next.noGos.includes("無特殊忌諱")) next.noGos = ["無特殊忌諱"];
  return next;
}

export function validateStep(stepId, rawAnswers) {
  const answers = clearHiddenAnswers(rawAnswers);
  const errors = {};
  const requireValue = (key, message) => { if (!answers[key]) errors[key] = message; };
  const requireList = (key, message) => { if (!answers[key]?.length) errors[key] = message; };

  if (stepId === "intent") {
    requireValue("purpose", "請選擇購屋目的");
    requireValue("timeline", "請選擇預計時程");
  }
  if (stepId === "location") {
    if (!answers.areas.length && !answers.customArea.trim()) errors.areas = "請選擇或輸入區域";
    requireValue("lifeFocus", "請選擇生活重心");
  }
  if (stepId === "budget") {
    requireValue("downPayment", "請選擇可準備自備款");
    requireValue("monthlyMortgage", "請選擇舒服的每月房貸");
  }
  if (stepId === "space") {
    requireValue("householdSize", "請選擇居住人數");
    requireValue("rooms", "請選擇希望房數");
    if (needsThirdRoomUse(answers)) requireValue("thirdRoomUse", "請選擇第三房用途");
  }
  if (stepId === "property") {
    requireList("propertyTypes", "請至少選擇一種物件類型");
    requireValue("agePreference", "請選擇屋齡接受度");
    requireValue("parking", "請選擇車位需求");
  }
  if (stepId === "priorities") {
    requireList("mustHaves", "請至少選擇一個重要條件");
    if (answers.mustHaves.length > 3) errors.mustHaves = "最多選擇 3 個";
    if (answers.noGos.includes("其他") && !answers.otherNoGo.trim()) errors.otherNoGo = "請簡單說明其他避開條件";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `node --test tests/questions.test.js`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit the question model**

Run:

```powershell
git add src/questions.js tests/questions.test.js
git commit -m "feat: add focused buyer question model"
```

---

### Task 3: Implement Result Derivation and the Seven Video Questions

**Files:**
- Create: `src/result.js`
- Create: `tests/result.test.js`

**Interfaces:**
- Consumes: an `Answers` object with the exact keys from `createInitialAnswers()`.
- Produces `deriveResult(answers): BuyerResult`, where `BuyerResult` contains `status`, `headline`, `direction`, `budgetReminder`, `strategy`, and `videoQuestions`.

- [ ] **Step 1: Write failing result tests**

Create `tests/result.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { deriveResult, VIDEO_QUESTIONS } from "../src/result.js";

const complete = {
  purpose: "自住", timeline: "3個月內", areas: ["永康區"], customArea: "",
  lifeFocus: "工作通勤", downPayment: "200～300萬", monthlyMortgage: "2～3萬",
  householdSize: "2", rooms: "3房", thirdRoomUse: "偶爾來客",
  propertyTypes: ["電梯大樓"], agePreference: "20年內", parking: "一定要平車",
  mustHaves: ["格局", "採光通風", "安靜"], noGos: ["西曬"], otherNoGo: ""
};

test("always exposes all seven video-derived questions", () => {
  assert.equal(VIDEO_QUESTIONS.length, 7);
  assert.deepEqual(VIDEO_QUESTIONS.map(item => item.ep), [1, 2, 3, 4, 5, 6, 7]);
});

test("flags unclear third-room use without judging the buyer", () => {
  const result = deriveResult(complete);
  assert.ok(["方向探索中", "條件整理中", "可以開始精準比較"].includes(result.status));
  assert.match(result.strategy.join(" "), /彈性空間|第三房/);
  assert.ok(result.videoQuestions.some(item => item.ep === 7 && item.relevant));
});

test("uses neutral readiness labels only", () => {
  const result = deriveResult({ ...complete, timeline: "先看看", areas: [] });
  assert.ok(["方向探索中", "條件整理中", "可以開始精準比較"].includes(result.status));
});

test("never emits a loan approval or guaranteed claim", () => {
  const text = JSON.stringify(deriveResult(complete));
  assert.doesNotMatch(text, /保證|核貸成功|一定買得到|穩賺/);
});
```

- [ ] **Step 2: Run the result tests and confirm failure**

Run: `node --test tests/result.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/result.js`.

- [ ] **Step 3: Implement the result engine**

Create `src/result.js`:

```js
export const VIDEO_QUESTIONS = [
  { ep: 1, text: "每月房貸負擔後，生活還能保留餘裕嗎？" },
  { ep: 2, text: "拿掉裝潢加分後，格局仍符合每天的使用方式嗎？" },
  { ep: 3, text: "室外環境、通勤與生活圈實際走過了嗎？" },
  { ep: 4, text: "第一眼心動後，價格與必要條件也確認了嗎？" },
  { ep: 5, text: "加上修繕、管理費與持有成本後，總負擔仍合適嗎？" },
  { ep: 6, text: "白天與晚上都看過周邊環境嗎？" },
  { ep: 7, text: "每一個房間都有明確用途嗎？" }
];

function readinessScore(answers) {
  let score = 0;
  if (answers.timeline && answers.timeline !== "先看看") score += 2;
  if (answers.areas?.length || answers.customArea) score += 2;
  if (answers.downPayment && answers.downPayment !== "還不確定") score += 1;
  if (answers.monthlyMortgage && answers.monthlyMortgage !== "希望小魏協助試算") score += 1;
  if (answers.propertyTypes?.length) score += 1;
  if (answers.mustHaves?.length) score += 1;
  return score;
}

export function deriveResult(answers) {
  const score = readinessScore(answers);
  const status = score >= 7 ? "可以開始精準比較" : score >= 4 ? "條件整理中" : "方向探索中";
  const area = [...(answers.areas || []), answers.customArea].filter(Boolean).join("、") || "台南生活圈";
  const direction = [
    `先以${area}為主要範圍，配合${answers.lifeFocus || "日常生活"}比較實際動線。`,
    `物件先看${(answers.propertyTypes || []).join("、") || "可接受類型"}，再用${answers.agePreference || "屋齡"}與${answers.parking || "車位"}縮小範圍。`
  ];
  const strategy = [
    `看屋時優先確認${(answers.mustHaves || []).join("、") || "每天真正會用到的條件"}。`,
    "不要只看裝潢；把格局、室外環境、白天與晚上的感受一起比較。"
  ];
  if ((answers.rooms === "3房" || answers.rooms === "3房以上") && ["偶爾來客", "還沒想好"].includes(answers.thirdRoomUse)) {
    strategy.unshift("第三房用途仍有彈性，可同步比較兩房加彈性空間，避免為不常使用的房間增加負擔。");
  }
  const relevant = new Set([1, 2, 3, 4, 5, 6]);
  if (answers.rooms === "3房" || answers.rooms === "3房以上") relevant.add(7);
  return {
    status,
    headline: `${status}｜先把生活與負擔對齊，再挑真正值得看的房子`,
    direction,
    budgetReminder: `目前以自備款「${answers.downPayment || "待確認"}」與舒服月付「${answers.monthlyMortgage || "待確認"}」整理方向；實際貸款仍以銀行審核與個人條件為準。`,
    strategy,
    videoQuestions: VIDEO_QUESTIONS.map(item => ({ ...item, relevant: relevant.has(item.ep) }))
  };
}
```

- [ ] **Step 4: Run the result tests**

Run: `node --test tests/result.test.js`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit the result engine**

Run:

```powershell
git add src/result.js tests/result.test.js
git commit -m "feat: derive buyer direction and viewing checklist"
```

---

### Task 4: Implement the Stable Payload and Confirmed Apps Script Transport

**Files:**
- Create: `src/payload.js`
- Create: `src/api.js`
- Create: `tests/payload.test.js`
- Create: `tests/api.test.js`

**Interfaces:**
- Consumes: `Answers`, `BuyerResult`, a backend endpoint, and injectable `fetchImpl`/`statusLoader` functions.
- Produces:
  - `normalizePhone(value): string`
  - `isTaiwanMobile(value): boolean`
  - `buildPayload({ answers, result, submissionId, submittedAt }): LeadPayload`
  - `buildSummary({ answers, result }): string`
  - `submitLead({ endpoint, payload, fetchImpl, statusLoader, timeoutMs }): Promise<{ ok: true, submissionId: string }>`

- [ ] **Step 1: Write failing payload and transport tests**

Create `tests/payload.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, isTaiwanMobile, buildPayload } from "../src/payload.js";

test("normalizes a Taiwan mobile number", () => {
  assert.equal(normalizePhone("0912-345-678"), "0912345678");
  assert.equal(isTaiwanMobile("0912 345 678"), true);
  assert.equal(isTaiwanMobile("0212345678"), false);
});

test("builds the versioned backend contract", () => {
  const payload = buildPayload({
    answers: { name: "王小姐", phone: "0912-345-678", consent: true, areas: ["永康區"], propertyTypes: ["電梯大樓"], mustHaves: ["格局"], noGos: [] },
    result: { status: "條件整理中", direction: ["方向"], budgetReminder: "提醒", strategy: ["策略"], videoQuestions: [] },
    submissionId: "sub-123",
    submittedAt: "2026-07-18T00:00:00.000Z"
  });
  assert.equal(payload.sourceVersion, "buyer-diagnosis-c-v2");
  assert.equal(payload.phone, "0912345678");
  assert.equal(payload.submissionId, "sub-123");
});
```

Create `tests/api.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { submitLead } from "../src/api.js";

test("posts once and confirms the submission id", async () => {
  const calls = [];
  const result = await submitLead({
    endpoint: "https://script.google.com/macros/s/example/exec",
    payload: { submissionId: "sub-123" },
    fetchImpl: async (url, init) => { calls.push({ url, init }); return { type: "opaque" }; },
    statusLoader: async () => ({ ok: true, found: true, submissionId: "sub-123" }),
    timeoutMs: 50
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(result, { ok: true, submissionId: "sub-123" });
});

test("throws a typed timeout when the row cannot be confirmed", async () => {
  await assert.rejects(() => submitLead({
    endpoint: "https://script.google.com/macros/s/example/exec",
    payload: { submissionId: "sub-404" },
    fetchImpl: async () => ({ type: "opaque" }),
    statusLoader: async () => ({ ok: true, found: false }),
    timeoutMs: 5,
    pollIntervalMs: 1
  }), error => error.code === "SUBMISSION_NOT_CONFIRMED");
});
```

- [ ] **Step 2: Run both test files and confirm failure**

Run: `node --test tests/payload.test.js tests/api.test.js`

Expected: FAIL with missing `src/payload.js` and `src/api.js`.

- [ ] **Step 3: Implement payload construction**

Create `src/payload.js`:

```js
export function normalizePhone(value = "") {
  return String(value).replace(/\D/g, "").slice(0, 10);
}

export function isTaiwanMobile(value) {
  return /^09\d{8}$/.test(normalizePhone(value));
}

export function buildPayload({ answers, result, submissionId, submittedAt = new Date().toISOString() }) {
  return {
    submissionId,
    submittedAt,
    sourceVersion: "buyer-diagnosis-c-v2",
    name: answers.name?.trim() || "",
    phone: normalizePhone(answers.phone),
    purpose: answers.purpose || "",
    timeline: answers.timeline || "",
    areas: [...(answers.areas || []), answers.customArea].filter(Boolean),
    lifeFocus: answers.lifeFocus || "",
    downPayment: answers.downPayment || "",
    monthlyMortgage: answers.monthlyMortgage || "",
    householdSize: answers.householdSize || "",
    rooms: answers.rooms || "",
    thirdRoomUse: answers.thirdRoomUse || "",
    propertyTypes: answers.propertyTypes || [],
    agePreference: answers.agePreference || "",
    parking: answers.parking || "",
    mustHaves: answers.mustHaves || [],
    noGos: answers.noGos || [],
    otherNoGo: answers.otherNoGo || "",
    buyerStatus: result.status,
    direction: result.direction,
    budgetReminder: result.budgetReminder,
    strategy: result.strategy,
    consent: Boolean(answers.consent)
  };
}

export function buildSummary({ answers, result }) {
  return [
    "【台南小魏｜買房方向摘要】",
    `稱呼：${answers.name || "未填"}`,
    `區域：${[...(answers.areas || []), answers.customArea].filter(Boolean).join("、") || "未填"}`,
    `用途／時程：${answers.purpose || "未填"}／${answers.timeline || "未填"}`,
    `自備款／舒服月付：${answers.downPayment || "未填"}／${answers.monthlyMortgage || "未填"}`,
    `空間：${answers.householdSize || "未填"} 人／${answers.rooms || "未填"}／${answers.thirdRoomUse || "無條件追問"}`,
    `物件：${(answers.propertyTypes || []).join("、") || "未填"}／${answers.agePreference || "未填"}／${answers.parking || "未填"}`,
    `最重視：${(answers.mustHaves || []).join("、") || "未填"}`,
    `找房狀態：${result.status}`,
    ...result.strategy.map(item => `・${item}`),
    "台南小魏 買厝作伙｜魏泉承｜0927-617-207"
  ].join("\n");
}
```

- [ ] **Step 4: Implement opaque POST plus JSONP confirmation**

Create `src/api.js`:

```js
export function loadStatusWithJsonp(url) {
  return new Promise((resolve, reject) => {
    const callback = `buyerStatus_${crypto.randomUUID().replaceAll("-", "")}`;
    const script = document.createElement("script");
    const cleanup = () => { delete window[callback]; script.remove(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("status timeout")); }, 5000);
    window[callback] = data => { clearTimeout(timer); cleanup(); resolve(data); };
    script.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error("status load failed")); };
    script.src = `${url}&callback=${encodeURIComponent(callback)}`;
    document.head.append(script);
  });
}

export async function submitLead({
  endpoint,
  payload,
  fetchImpl = fetch,
  statusLoader = loadStatusWithJsonp,
  timeoutMs = 12000,
  pollIntervalMs = 750
}) {
  await fetchImpl(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = `${endpoint}?action=status&submissionId=${encodeURIComponent(payload.submissionId)}`;
    const status = await statusLoader(url).catch(() => ({ found: false }));
    if (status?.ok && status?.found && status.submissionId === payload.submissionId) {
      return { ok: true, submissionId: payload.submissionId };
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  const error = new Error("送出後尚未確認資料入表");
  error.code = "SUBMISSION_NOT_CONFIRMED";
  throw error;
}
```

- [ ] **Step 5: Run payload and transport tests**

Run: `node --test tests/payload.test.js tests/api.test.js`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 6: Commit the payload and transport layer**

Run:

```powershell
git add src/payload.js src/api.js tests/payload.test.js tests/api.test.js
git commit -m "feat: add confirmed lead submission contract"
```

---

### Task 5: Build the Consultant-Card UI and Accessible Wizard

**Files:**
- Replace: `index.html`
- Replace: `buyer-interactive.html`
- Create: `assets/styles.css`
- Create: `src/config.js`
- Create: `src/app.js`
- Create: `tests/app.spec.js`

**Interfaces:**
- Consumes: every public function from Tasks 2–4 and `BACKEND_URL` from `src/config.js`.
- Produces: the complete six-step wizard, conditionally rendered third-room field, inline `otherNoGo` field within the sixth priorities screen, preview/result/contact page, copy fallback, LINE link, keyboard support, and responsive UI; no seventh question screen.

- [ ] **Step 1: Write failing browser tests for the complete path**

Create `tests/app.spec.js`:

```js
import { test, expect } from "@playwright/test";

test("completes the six-screen path and reveals the result/contact page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "找到適合生活的房子，從問對問題開始。" })).toBeVisible();
  await page.getByRole("button", { name: "開始整理" }).click();
  await page.getByRole("button", { name: "自住" }).click();
  await page.getByRole("button", { name: "3個月內" }).click();
  await page.getByRole("button", { name: "下一題" }).click();
  await expect(page.getByText("第 2 題，共 6 題")).toBeVisible();
});

test("three rooms shows the third-room question and two rooms clears it", async ({ page }) => {
  await page.goto("/?testStep=space");
  await page.getByRole("button", { name: "2 人" }).click();
  await page.getByRole("button", { name: "3房" }).click();
  await expect(page.getByText("第三個房間準備拿來做什麼？")).toBeVisible();
  await page.getByRole("button", { name: "2房" }).click();
  await expect(page.getByText("第三個房間準備拿來做什麼？")).toBeHidden();
});

test("invalid phone cannot submit", async ({ page }) => {
  await page.goto("/?testStep=result");
  await page.getByLabel("怎麼稱呼您？").fill("王小姐");
  await page.getByLabel("手機號碼").fill("1234");
  await page.getByLabel("我同意由小魏依這份結果與我聯繫").check();
  await expect(page.getByRole("button", { name: "送出並查看完整方向卡" })).toBeDisabled();
});

test("mobile viewport has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});
```

- [ ] **Step 2: Run the browser tests and confirm failure**

Run:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:ui
```

Expected: FAIL because the old 11-step page does not expose the new headings, test hooks, or controls.

- [ ] **Step 3: Replace the HTML shell**

Replace `index.html` with a semantic shell containing these required regions and IDs:

```html
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="用 6 個關鍵問題整理台南買房方向、預算與看屋重點。">
  <title>台南小魏｜買房方向診斷</title>
  <link rel="stylesheet" href="./assets/styles.css">
</head>
<body>
  <div class="ambient" aria-hidden="true"></div>
  <main class="app-shell" id="app">
    <header class="brand-bar">
      <a class="brand" href="./" aria-label="回到買房方向診斷首頁"><span class="brand-mark">家</span><span>台南小魏 買厝作伙</span></a>
      <span class="privacy-chip">資料只用於回覆本次需求</span>
    </header>
    <section class="hero" id="hero"></section>
    <section class="wizard" id="wizard" hidden>
      <div class="progress-row"><span id="progressText"></span><div class="progress-track"><i id="progressBar"></i></div></div>
      <div id="questionArea" aria-live="polite"></div>
      <p class="form-error" id="formError" role="alert"></p>
      <nav class="wizard-actions" aria-label="問卷操作"><button id="backButton" type="button">上一步</button><button id="nextButton" type="button">下一題</button></nav>
    </section>
    <section class="result" id="resultArea" hidden></section>
  </main>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <script type="module" src="./src/app.js"></script>
</body>
</html>
```

Replace `buyer-interactive.html` with a no-duplicate redirect:

```html
<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./"><link rel="canonical" href="./"><title>前往買房方向診斷</title></head><body><a href="./">前往買房方向診斷</a></body></html>
```

- [ ] **Step 4: Add the exact visual foundation**

Create `assets/styles.css` with the following tokens and required behavior; keep all selectors in this file and do not add inline styles:

```css
:root{--ink:#18352e;--ink-2:#2e4b43;--ivory:#f7f1e6;--paper:#fffdf8;--gold:#d9a34c;--mint:#dcebe5;--line:#cfdbd6;--danger:#a33c32;--shadow:0 22px 70px rgba(24,53,46,.15);font-family:"Noto Serif TC","Microsoft JhengHei",serif;color:var(--ink);background:var(--ivory)}
*{box-sizing:border-box}html{min-width:320px;background:var(--ivory)}body{margin:0;min-height:100vh;overflow-x:hidden;background:radial-gradient(circle at 85% 10%,#d8ebe4 0,transparent 36%),linear-gradient(135deg,#fbf7ee,#eef6f2)}
button,input,textarea{font:inherit}button{min-height:44px;cursor:pointer}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
.ambient{position:fixed;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 45%,rgba(255,255,255,.5));z-index:-1}
.app-shell{width:min(1120px,calc(100% - 32px));margin:24px auto;min-height:calc(100vh - 48px);background:rgba(255,253,248,.9);border:1px solid rgba(207,219,214,.9);border-radius:28px;box-shadow:var(--shadow);backdrop-filter:blur(18px);overflow:hidden}
.brand-bar{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;font-weight:800}.brand-mark{display:grid;place-items:center;width:40px;height:40px;border-radius:13px;background:var(--ink);color:#f4d594}.privacy-chip{font-size:13px;color:var(--ink-2)}
.hero,.wizard,.result{padding:clamp(28px,6vw,76px);max-width:900px;margin:auto}.hero{min-height:650px;display:grid;align-content:center}.hero h1,.question-card h2,.result h2{font-size:clamp(34px,5vw,64px);line-height:1.08;margin:0 0 18px}.hero p,.question-hint{font-size:clamp(16px,2vw,20px);line-height:1.7;color:var(--ink-2)}
.primary,.choice.selected,#nextButton{background:var(--ink);color:white;border-color:var(--ink)}.primary,#nextButton,#backButton{border:1px solid var(--ink);border-radius:14px;padding:12px 22px;font-weight:800}.choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:24px}.choice{padding:15px 16px;text-align:left;border:1px solid var(--line);border-radius:15px;background:var(--paper);color:var(--ink)}
.progress-row{display:flex;align-items:center;gap:16px;margin-bottom:34px;font-size:14px}.progress-track{height:6px;flex:1;border-radius:99px;background:var(--line);overflow:hidden}.progress-track i{display:block;height:100%;background:var(--gold);transition:width .25s ease}.advisor-tip{margin:18px 0;padding:15px 17px;border-left:4px solid var(--gold);border-radius:0 14px 14px 0;background:#fff7e8;line-height:1.6}.wizard-actions{display:flex;justify-content:space-between;gap:12px;margin-top:34px}.form-error{min-height:24px;color:var(--danger)}
.result-card{padding:clamp(22px,5vw,50px);border:1px solid var(--line);border-radius:24px;background:linear-gradient(145deg,#fffdf8,#edf6f2)}.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.field{display:grid;gap:8px}.field input,.field textarea{width:100%;min-height:48px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:white}.fallback-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,130%);padding:12px 18px;border-radius:999px;background:var(--ink);color:white;transition:.2s}.toast.show{transform:translate(-50%,0)}
@media(max-width:700px){.app-shell{width:100%;min-height:100vh;margin:0;border-radius:0}.brand-bar{padding:14px 16px}.privacy-chip{display:none}.hero,.wizard,.result{padding:28px 18px}.hero{min-height:calc(100vh - 70px)}.choice-grid,.contact-grid{grid-template-columns:1fr}.wizard-actions{position:sticky;bottom:0;padding:12px 0;background:linear-gradient(transparent,var(--paper) 28%)}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
```

- [ ] **Step 5: Implement the wizard renderer and submission states**

Create `src/config.js`:

```js
export const BACKEND_URL = "";
export const LINE_URL = "https://line.me/R/ti/p/%40tainanwei";
export const PHONE = "0927-617-207";
```

Create `src/app.js` around these exact state transitions:

```js
import { QUESTION_STEPS, createInitialAnswers, clearHiddenAnswers, validateStep, needsThirdRoomUse } from "./questions.js";
import { deriveResult } from "./result.js";
import { buildPayload, buildSummary, isTaiwanMobile } from "./payload.js";
import { submitLead } from "./api.js";
import { BACKEND_URL, LINE_URL, PHONE } from "./config.js";

const state = { answers: createInitialAnswers(), stepIndex: -1, phase: "intro", submitting: false, submitError: "" };
const $ = id => document.getElementById(id);

function setAnswer(key, value) {
  state.answers[key] = value;
  state.answers = clearHiddenAnswers(state.answers);
  render();
}

function goNext() {
  if (state.stepIndex < 0) { state.phase = "questions"; state.stepIndex = 0; return render(); }
  const stepId = QUESTION_STEPS[state.stepIndex].id;
  const validation = validateStep(stepId, state.answers);
  if (!validation.valid) { $("formError").textContent = Object.values(validation.errors)[0]; return; }
  if (state.stepIndex === QUESTION_STEPS.length - 1) state.phase = "result";
  else state.stepIndex += 1;
  render();
}

function goBack() {
  if (state.phase === "result") { state.phase = "questions"; state.stepIndex = QUESTION_STEPS.length - 1; }
  else if (state.stepIndex > 0) state.stepIndex -= 1;
  else { state.phase = "intro"; state.stepIndex = -1; }
  render();
}

async function handleSubmit() {
  if (!BACKEND_URL) { state.submitError = "尚未設定獨立後端"; return render(); }
  if (!state.answers.name.trim() || !isTaiwanMobile(state.answers.phone) || !state.answers.consent) return;
  state.submitting = true; state.submitError = ""; render();
  const result = deriveResult(state.answers);
  const submissionId = crypto.randomUUID();
  try {
    await submitLead({ endpoint: BACKEND_URL, payload: buildPayload({ answers: state.answers, result, submissionId }) });
    state.phase = "complete";
  } catch (error) {
    state.submitError = error.code === "SUBMISSION_NOT_CONFIRMED" ? "資料尚未確認入表，請重新送出或改用 LINE。" : "目前無法送出，答案已保留。";
  } finally { state.submitting = false; render(); }
}

async function copySummary() {
  const text = buildSummary({ answers: state.answers, result: deriveResult(state.answers) });
  try { await navigator.clipboard.writeText(text); showToast("需求摘要已複製"); }
  catch { window.prompt("複製這段需求摘要：", text); }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function fieldIsVisible(field) {
  if (field.when === "needsThirdRoomUse") return needsThirdRoomUse(state.answers);
  if (field.when === "otherNoGo") return state.answers.noGos.includes("其他");
  return true;
}

function renderField(field) {
  if (!fieldIsVisible(field)) return "";
  if (field.type === "text") {
    return `<label class="field"><span>${escapeHtml(field.label)}</span><input data-text-field="${field.key}" value="${escapeHtml(state.answers[field.key])}" placeholder="${escapeHtml(field.placeholder)}"></label>`;
  }
  const values = field.type === "multi" ? state.answers[field.key] : [state.answers[field.key]];
  return `<fieldset><legend>${escapeHtml(field.label)}</legend><div class="choice-grid">${field.options.map(option => `<button class="choice ${values.includes(option) ? "selected" : ""}" type="button" data-field="${field.key}" data-type="${field.type}" data-value="${escapeHtml(option)}" data-max="${field.max || ""}" data-exclusive="${escapeHtml(field.exclusive || "")}" aria-pressed="${values.includes(option)}">${escapeHtml(option)}</button>`).join("")}</div></fieldset>`;
}

function bindQuestionEvents() {
  document.querySelectorAll("[data-field]").forEach(button => button.addEventListener("click", () => {
    const { field, type, value, max, exclusive } = button.dataset;
    if (type === "single") return setAnswer(field, value);
    let values = [...state.answers[field]];
    if (exclusive && value === exclusive) values = [exclusive];
    else {
      values = values.filter(item => item !== exclusive);
      values = values.includes(value) ? values.filter(item => item !== value) : [...values, value];
      if (max && values.length > Number(max)) { $("formError").textContent = `最多選擇 ${max} 個`; return; }
    }
    setAnswer(field, values);
  }));
  document.querySelectorAll("[data-text-field]").forEach(input => input.addEventListener("input", event => {
    state.answers[event.currentTarget.dataset.textField] = event.currentTarget.value;
    state.answers = clearHiddenAnswers(state.answers);
  }));
}

function renderIntro() {
  $("hero").hidden = false; $("wizard").hidden = true; $("resultArea").hidden = true;
  $("hero").innerHTML = `<div><p class="eyebrow">台南小魏 · 買厝作伙</p><h1 tabindex="-1">找到適合生活的房子，從問對問題開始。</h1><p>用 6 個關鍵選擇，整理預算、空間與看屋風險。約 1 分鐘完成。</p><div class="advisor-tip"><strong>小魏提醒：</strong>裝潢可以改，格局與每天的生活方式更值得先確認。</div><button class="primary" id="startButton" type="button">開始整理</button></div>`;
  $("startButton").addEventListener("click", goNext);
  $("hero").querySelector("h1").focus();
}

function renderQuestion() {
  $("hero").hidden = true; $("wizard").hidden = false; $("resultArea").hidden = true;
  const step = QUESTION_STEPS[state.stepIndex];
  $("progressText").textContent = `第 ${state.stepIndex + 1} 題，共 ${QUESTION_STEPS.length} 題`;
  $("progressBar").style.width = `${((state.stepIndex + 1) / QUESTION_STEPS.length) * 100}%`;
  $("questionArea").innerHTML = `<article class="question-card"><p class="eyebrow">買房方向診斷</p><h2 tabindex="-1">${escapeHtml(step.title)}</h2><p class="question-hint">${escapeHtml(step.tip)}</p><div class="advisor-tip">小魏提醒：${escapeHtml(step.tip)}</div>${step.fields.map(renderField).join("")}</article>`;
  $("formError").textContent = "";
  $("backButton").onclick = goBack; $("nextButton").onclick = goNext; $("nextButton").textContent = state.stepIndex === QUESTION_STEPS.length - 1 ? "查看方向" : "下一題";
  bindQuestionEvents();
  $("questionArea").querySelector("h2").focus();
}

function resultPreview(result) {
  return `<div class="result-card"><p class="eyebrow">${escapeHtml(result.status)}</p><h2 tabindex="-1">${escapeHtml(result.headline)}</h2><h3>目前找房方向</h3><ul>${result.direction.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul><h3>預算提醒</h3><p>${escapeHtml(result.budgetReminder)}</p></div>`;
}

function bindContactEvents() {
  $("name").addEventListener("input", event => { state.answers.name = event.target.value; updateSubmitState(); });
  $("phone").addEventListener("input", event => { state.answers.phone = event.target.value; updateSubmitState(); });
  $("consent").addEventListener("change", event => { state.answers.consent = event.target.checked; updateSubmitState(); });
  $("leadForm").addEventListener("submit", event => { event.preventDefault(); handleSubmit(); });
  $("resultBack").addEventListener("click", goBack);
  $("copyButton").addEventListener("click", copySummary);
}

function updateSubmitState() {
  const valid = state.answers.name.trim() && isTaiwanMobile(state.answers.phone) && state.answers.consent;
  $("submitButton").disabled = !valid || state.submitting;
}

function renderResult() {
  $("hero").hidden = true; $("wizard").hidden = true; $("resultArea").hidden = false;
  const result = deriveResult(state.answers);
  $("resultArea").innerHTML = `${resultPreview(result)}<form id="leadForm" class="result-card"><h3>把完整方向卡整理給您</h3><div class="contact-grid"><label class="field"><span>怎麼稱呼您？</span><input id="name" autocomplete="name" value="${escapeHtml(state.answers.name)}"></label><label class="field"><span>手機號碼</span><input id="phone" type="tel" inputmode="numeric" autocomplete="tel" value="${escapeHtml(state.answers.phone)}"></label></div><label class="consent"><input id="consent" type="checkbox" ${state.answers.consent ? "checked" : ""}> 我同意由小魏依這份結果與我聯繫</label><p class="form-error" role="alert">${escapeHtml(state.submitError)}</p><button class="primary" id="submitButton" type="submit">${state.submitting ? "確認資料入表中…" : "送出並查看完整方向卡"}</button><div class="fallback-actions"><button id="resultBack" type="button">回上一步</button><button id="copyButton" type="button">複製需求摘要</button><a href="${LINE_URL}" target="_blank" rel="noopener">改用 LINE 聯絡</a></div></form>`;
  bindContactEvents(); updateSubmitState(); $("resultArea").querySelector("h2").focus();
}

function renderComplete() {
  $("hero").hidden = true; $("wizard").hidden = true; $("resultArea").hidden = false;
  const result = deriveResult(state.answers);
  $("resultArea").innerHTML = `${resultPreview(result)}<div class="result-card"><h3>最適合您的看屋策略</h3><ul>${result.strategy.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul><h3>看屋前，問自己這 7 題</h3><ol>${result.videoQuestions.map(item => `<li class="${item.relevant ? "relevant" : ""}">${escapeHtml(item.text)}</li>`).join("")}</ol><p>魏泉承｜永慶不動產-小東南紡店｜<a href="tel:${PHONE.replaceAll("-", "")}">${PHONE}</a></p><div class="fallback-actions"><button id="copyButton" type="button">複製需求摘要</button><a class="primary" href="${LINE_URL}" target="_blank" rel="noopener">LINE 找台南小魏</a></div></div>`;
  $("copyButton").addEventListener("click", copySummary); $("resultArea").querySelector("h2").focus();
}

function applyLocalTestShortcut() {
  if (!new Set(["localhost", "127.0.0.1"]).has(location.hostname)) return;
  const target = new URLSearchParams(location.search).get("testStep");
  if (!target) return;
  Object.assign(state.answers, { purpose: "自住", timeline: "3個月內", areas: ["永康區"], lifeFocus: "工作通勤", downPayment: "200～300萬", monthlyMortgage: "2～3萬", householdSize: "2 人", rooms: "2房", propertyTypes: ["電梯大樓"], agePreference: "20年內", parking: "一定要平車", mustHaves: ["格局"], noGos: [] });
  if (target === "result") state.phase = "result";
  else { const index = QUESTION_STEPS.findIndex(step => step.id === target); if (index >= 0) { state.phase = "questions"; state.stepIndex = index; } }
}

function render() {
  if (state.phase === "intro") return renderIntro();
  if (state.phase === "questions") return renderQuestion();
  if (state.phase === "complete") return renderComplete();
  return renderResult();
}

function showToast(message) { const toast = $("toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2500); }

window.__buyerAppTest = { state, setAnswer, goNext, goBack, handleSubmit };
applyLocalTestShortcut();
render();
```

- [ ] **Step 6: Run unit and browser tests, then inspect desktop and mobile**

Run:

```powershell
npm.cmd test
npm.cmd run test:ui
```

Expected: all Node tests pass; all 8 Playwright project cases pass (4 tests × desktop/mobile); no horizontal overflow at mobile width.

- [ ] **Step 7: Commit the UI**

Run:

```powershell
git add index.html buyer-interactive.html assets/styles.css src/config.js src/app.js tests/app.spec.js
git commit -m "feat: build consultant-card buyer diagnosis"
```

---

### Task 6: Create and Deploy the Independent Google Sheet Backend

**Files:**
- Create: `apps-script/Code.gs`
- Modify after deployment: `src/config.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: the exact `LeadPayload` from `buildPayload()`.
- Produces:
  - `doPost(e)` to validate, deduplicate, and append one row.
  - `doGet(e)` with `action=status` to return callback-safe JSONP for one `submissionId`.
  - Independent Sheet headers matching the payload.

- [ ] **Step 1: Write the Apps Script backend with explicit validation and formula safety**

Create `apps-script/Code.gs`:

```js
const SHEET_NAME = "C版買方診斷名單";
const SOURCE_VERSION = "buyer-diagnosis-c-v2";
const HEADERS = [
  "建立時間", "提交識別碼", "來源版本", "稱呼", "手機號碼", "購屋目的", "購屋時程",
  "想找區域", "生活重心", "自備款區間", "舒服月付區間", "居住人數", "希望房數",
  "第三房用途", "物件類型", "屋齡接受度", "車位需求", "最重視條件", "一定避開條件",
  "其他避開說明", "買方狀態", "找房方向摘要", "預算提醒", "看屋策略", "同意聯繫",
  "後續狀態", "承辦備註", "下次跟進日期"
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || "{}");
    validate_(data);
    const sheet = targetSheet_();
    ensureHeaders_(sheet);
    if (!findSubmission_(sheet, data.submissionId)) {
      sheet.appendRow([
        new Date(), safe_(data.submissionId), safe_(data.sourceVersion), safe_(data.name), safe_(data.phone),
        safe_(data.purpose), safe_(data.timeline), list_(data.areas), safe_(data.lifeFocus),
        safe_(data.downPayment), safe_(data.monthlyMortgage), safe_(data.householdSize), safe_(data.rooms),
        safe_(data.thirdRoomUse), list_(data.propertyTypes), safe_(data.agePreference), safe_(data.parking),
        list_(data.mustHaves), list_(data.noGos), safe_(data.otherNoGo), safe_(data.buyerStatus),
        list_(data.direction), safe_(data.budgetReminder), list_(data.strategy), data.consent ? "是" : "否",
        "新名單", "", ""
      ]);
    }
    return json_({ ok: true, submissionId: data.submissionId });
  } catch (error) {
    return json_({ ok: false, message: String(error.message || error) });
  } finally { lock.releaseLock(); }
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.action !== "status") return json_({ ok: true, service: SOURCE_VERSION });
  const submissionId = safe_(params.submissionId);
  const found = submissionId ? findSubmission_(targetSheet_(), submissionId) : false;
  const payload = { ok: true, found, submissionId };
  const callback = String(params.callback || "");
  if (!/^[A-Za-z_$][\w$]*$/.test(callback)) return json_(payload);
  return ContentService.createTextOutput(`${callback}(${JSON.stringify(payload)});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function validate_(data) {
  if (data.sourceVersion !== SOURCE_VERSION) throw new Error("invalid source version");
  if (!/^[0-9a-f-]{16,64}$/i.test(String(data.submissionId || ""))) throw new Error("invalid submission id");
  if (!/^09\d{8}$/.test(String(data.phone || ""))) throw new Error("invalid phone");
  if (!String(data.name || "").trim()) throw new Error("name required");
  if (data.consent !== true) throw new Error("consent required");
}

function targetSheet_() {
  const sheetId = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (!sheetId) throw new Error("sheet is not configured");
  const spreadsheet = SpreadsheetApp.openById(sheetId);
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}
function configureBoundSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("bind this script to the new C-version spreadsheet");
  PropertiesService.getScriptProperties().setProperty("SHEET_ID", spreadsheet.getId());
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  ensureHeaders_(sheet);
  return spreadsheet.getId();
}
function ensureHeaders_(sheet) {
  const existing = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (HEADERS.some((header, index) => existing[index] !== header)) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}
function findSubmission_(sheet, id) {
  if (sheet.getLastRow() < 2) return false;
  return Boolean(sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext());
}
function list_(value) { return Array.isArray(value) ? value.map(safe_).filter(Boolean).join("、") : safe_(value); }
function safe_(value) {
  const text = value === undefined || value === null ? "" : String(value).trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}
function json_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
```

- [ ] **Step 2: Create and bind the independent Sheet**

Create a new spreadsheet named `台南小魏｜買房方向診斷 C 版名單`. Open Extensions → Apps Script from that spreadsheet so the script is bound to the new file, paste `Code.gs`, run `configureBoundSheet()` once, and authorize it. The function stores the active spreadsheet ID in Script Properties and creates the `C版買方診斷名單` tab with exact headers.

Verification: re-open the new spreadsheet, read the Script Property `SHEET_ID`, and compare it with the current old backend's `SHEET_ID`; they must differ before continuing.

- [ ] **Step 3: Deploy a new Apps Script web app**

Create a new Apps Script project bound to or authorized for the new Sheet, paste `Code.gs`, and deploy as a web app executable by the owner and accessible to anyone with the URL. Record the new `/exec` URL.

Verification:

```powershell
$newBackend = Read-Host 'Paste the newly deployed C-version /exec URL'
$response = Invoke-WebRequest -UseBasicParsing -Uri $newBackend
$response.StatusCode
$response.Content
```

Expected: HTTP 200 and a body containing `buyer-diagnosis-c-v2`.

- [ ] **Step 4: Configure the frontend and run one real integration submission**

Replace `BACKEND_URL` in `src/config.js` with the new `/exec` URL. Serve the site locally, complete one submission using an unmistakable test name such as `Codex測試-20260718`, and wait for the UI to show the confirmed result state.

Re-read the exact newly appended Sheet row and confirm:

- `來源版本` equals `buyer-diagnosis-c-v2`.
- `提交識別碼` equals the frontend submission ID.
- every array field maps to the correct Chinese delimiter-separated cell.
- no formula-leading input is executed as a formula.
- the old Sheet has no new test row.

- [ ] **Step 5: Verify deduplication and failure behavior**

POST the same JSON body with the same `submissionId` twice, then re-read the new Sheet and confirm only one row has that ID. Temporarily set `BACKEND_URL` to an unreachable test URL, run the browser test/manual path, and confirm answers remain with retry, copy summary, and LINE actions visible; then restore the real endpoint.

- [ ] **Step 6: Document and commit the backend integration**

Add to `README.md`:

```markdown
## Backend

- Source: `apps-script/Code.gs`
- Sheet: independent C-version lead ledger
- Source version: `buyer-diagnosis-c-v2`
- Frontend endpoint: `src/config.js`

Deployment verification must include an exact row re-read and a duplicate-submission check.
```

Run:

```powershell
git add apps-script/Code.gs src/config.js README.md
git commit -m "feat: connect isolated buyer lead backend"
```

---

### Task 7: Run Full Acceptance, Publish the New Repository, and Verify Both URLs

**Files:**
- Modify only if checks reveal defects: files created in Tasks 2–6.
- No changes allowed in the old repository.

**Interfaces:**
- Consumes: complete static site, deployed Apps Script endpoint, and new Sheet.
- Produces: verified public GitHub Pages URL and evidence that the old production URL is unchanged.

- [ ] **Step 1: Run the full automated suite from a clean install**

Run:

```powershell
Remove-Item -LiteralPath '.\node_modules' -Recurse -Force -ErrorAction SilentlyContinue
npm.cmd ci
npm.cmd test
npm.cmd run test:ui
```

Expected: all Node tests pass; all Playwright desktop/mobile tests pass; 0 failures.

- [ ] **Step 2: Run static and syntax checks**

Run:

```powershell
node --check src/questions.js
node --check src/result.js
node --check src/payload.js
node --check src/api.js
node --check src/app.js
rg -n 'BACKEND_URL\s*=\s*""|SHEET_ID\s*=\s*""|AKfycbxEDeuBcfgv9T9eJ7VnGYCWP5VALRv0JwF5dRiOwPPpcYQadmtInBs0-ithXkBhR1Fv|1T32661HLRNWSz0vfm5Y3tBYt9XQ58QDLoopYW1WlA5s' index.html buyer-interactive.html assets src apps-script README.md
```

Expected: all `node --check` commands exit 0; `rg` returns no empty production endpoint or old backend ID/URL.

- [ ] **Step 3: Perform browser acceptance at required breakpoints**

Use the browser at widths 360px, 768px, and a standard desktop width. Verify intro, all six questions, three-room conditional state, back navigation, validation errors, result preview, sending, success, failure fallback, copy summary, LINE URL, reduced-motion behavior, focus visibility, and no horizontal overflow.

Expected: all states match the approved C consultant-card design and Traditional Chinese copy.

- [ ] **Step 4: Create the new public GitHub repository without changing the old remote**

Run:

```powershell
gh auth status
gh repo view weslywei1984-glitch/real-estate-buyer-interactive-v2
```

If the second command reports that the repository does not exist, run:

```powershell
gh repo create weslywei1984-glitch/real-estate-buyer-interactive-v2 --public --description '台南小魏買房方向診斷 C 版'
git remote add origin https://github.com/weslywei1984-glitch/real-estate-buyer-interactive-v2.git
```

If it already exists, stop and inspect it before adding or pushing; do not overwrite unknown remote content.

- [ ] **Step 5: Commit any acceptance fixes and push the V2 branch**

Run:

```powershell
git status --short
git add index.html buyer-interactive.html assets src apps-script tests README.md package.json package-lock.json playwright.config.js docs
git commit -m "fix: complete buyer diagnosis acceptance"
git push -u origin codex/buyer-interactive-v2
```

Expected: the new remote receives only the V2 branch; the old repository receives no push.

- [ ] **Step 6: Publish GitHub Pages from the verified branch**

Enable GitHub Pages for `codex/buyer-interactive-v2` at the repository root using the GitHub UI/API available during execution. Wait until Pages reports a successful deployment, then open:

```text
https://weslywei1984-glitch.github.io/real-estate-buyer-interactive-v2/
```

Expected: HTTP 200, title `台南小魏｜買房方向診斷`, and the new six-step intro.

- [ ] **Step 7: Re-run the production happy path and verify the old URL is untouched**

On the new URL, complete a real test path and re-read the exact appended row in the new Sheet. Then open the old URL:

```text
https://weslywei1984-glitch.github.io/real-estate-buyer-interactive/
```

Expected:

- New URL: C-version UI, confirmed Sheet write, real LINE URL, correct contact information.
- Old URL: original 11-step site still loads and its repository commit/content has not changed.

- [ ] **Step 8: Record final evidence**

Run:

```powershell
git status --short
git log --oneline --decorate -8
gh repo view weslywei1984-glitch/real-estate-buyer-interactive-v2 --json url,defaultBranchRef
```

Expected: clean worktree, all task commits present, new repository URL returned, and no unfinished acceptance items.
