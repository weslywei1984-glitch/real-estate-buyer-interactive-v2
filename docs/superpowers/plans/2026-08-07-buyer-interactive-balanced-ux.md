# Buyer Interactive Balanced UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把正式買房方向診斷從 7 個高負擔頁面簡化為 6 個顧問式核心頁面，保留完整名單資料契約與 10 個影片主題，提升手機完成率與閱讀節奏。

**Architecture:** 問題結構與驗證集中在 `src/questions.js`，結果排序集中在 `src/result.js`，`src/app.js` 只負責狀態、語意化 HTML 與互動。既有 Apps Script 31 欄契約不變；移出必答流程的三個欄位由 `src/payload.js` 繼續送出空字串。CSS 延續顧問卡視覺，新增收合區、里程碑與結果漸進揭露。

**Tech Stack:** HTML5、CSS、JavaScript ES modules、Node.js 24、Node built-in test runner、Playwright、Google Apps Script、GitHub Pages。

## Global Constraints

- 正式流程固定為 6 個必答頁面；10 個影片主題不得增加必答頁。
- 聯絡前必須顯示找房方向、預算提醒與 3 個個人化重點。
- 聯絡後先顯示 4 個優先項目，其餘 6 個收合；合計仍為 10 個原生 checkbox。
- `moveInBudget`、`conditionTolerance`、`decisionLimit` 必須保留在 payload，未填時為空字串。
- Apps Script 31 欄順序、submission ID、JSONP status、去重、手機文字格式與公式安全不得改壞。
- 品牌固定為「台南小魏 買厝作伙」、魏泉承、永慶不動產-小東南紡店、0927-617-207、LINE `@tainanwei`。
- 不修改舊版網站、舊 Sheet 或舊 Apps Script。
- 所有互動必須支援鍵盤、可見焦點與 `prefers-reduced-motion`。

---

### Task 1: Simplify the Question Model and Preserve the 31-Column Contract

**Files:**
- Modify: `src/questions.js`
- Modify: `src/payload.js`
- Test: `tests/questions.test.js`
- Test: `tests/payload.test.js`

**Interfaces:**
- Consumes: `QUESTION_STEPS`, `createInitialAnswers()`, `validateStep(stepId, answers)`, `buildPayload({ answers, result, submissionId })`.
- Produces: exactly six `QUESTION_STEPS`; optional legacy decision fields in answers and payload; visible low-pressure budget and age choices.

- [ ] **Step 1: Write failing model tests**

Add focused assertions:

```js
test("defines exactly six required question screens without a decision screen", () => {
  assert.equal(QUESTION_STEPS.length, 6);
  assert.deepEqual(QUESTION_STEPS.map(step => step.id), [
    "intent", "location", "budget", "space", "property", "priorities"
  ]);
});

test("offers low-pressure budget and flexible age choices", () => {
  const budget = QUESTION_STEPS.find(step => step.id === "budget");
  const property = QUESTION_STEPS.find(step => step.id === "property");
  assert.ok(budget.fields.find(field => field.key === "downPayment").options.includes("還不確定"));
  assert.ok(budget.fields.find(field => field.key === "monthlyMortgage").options.includes("希望小魏協助試算"));
  assert.ok(property.fields.find(field => field.key === "agePreference").options.includes("不拘／看條件"));
});

test("does not require removed decision answers", () => {
  const answers = createInitialAnswers();
  answers.mustHaves = ["格局"];
  assert.equal(validateStep("priorities", answers).valid, true);
});
```

In `tests/payload.test.js`, assert:

```js
assert.equal(payload.moveInBudget, "");
assert.equal(payload.conditionTolerance, "");
assert.equal(payload.decisionLimit, "");
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```powershell
node --test tests/questions.test.js tests/payload.test.js
```

Expected: failures report 7 screens and missing low-pressure choices.

- [ ] **Step 3: Implement the six-screen data model**

In `src/questions.js`:

- Delete the `decision` step only.
- Keep `moveInBudget`, `conditionTolerance`, and `decisionLimit` in `createInitialAnswers()`.
- Add `還不確定` to `downPayment`.
- Add `希望小魏協助試算` to `monthlyMortgage`.
- Add `不拘／看條件` to `agePreference`.
- Remove the `validateStep("decision")` block.
- Change the priorities label to `如果只能留 3 個，您最在意什麼？`.

Do not remove custom options or conditional fields.

In `src/payload.js`, keep:

```js
moveInBudget: answers.moveInBudget || "",
conditionTolerance: answers.conditionTolerance || "",
decisionLimit: answers.decisionLimit || ""
```

Update `buildSummary()` so empty legacy decision values do not produce three `未填` labels in buyer-facing text.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:

```powershell
node --test tests/questions.test.js tests/payload.test.js
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit the model change**

```powershell
git add src/questions.js src/payload.js tests/questions.test.js tests/payload.test.js
git commit -m "feat: simplify buyer questions to six screens"
```

---

### Task 2: Reduce Question-Page Friction and Add Helpful Progress

**Files:**
- Modify: `src/app.js`
- Modify: `assets/styles.css`
- Test: `tests/app.spec.js`

**Interfaces:**
- Consumes: six-step `QUESTION_STEPS`, `state.answers`, `clearHiddenAnswers()`.
- Produces: one non-duplicated advisor note, six milestone messages, remaining-choice guidance, an accessible optional no-go disclosure, and a reversible `無特殊忌諱` selection.

- [ ] **Step 1: Write failing Playwright tests for the simplified question UI**

Add tests that assert:

```js
test("uses six progress steps and shows one advisor note per question", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "開始整理" }).click();
  await expect(page.getByText("第 1 題，共 6 題")).toBeVisible();
  await expect(page.locator(".advisor-tip")).toHaveCount(1);
  await expect(page.locator(".question-hint")).toHaveCount(0);
  await expect(page.getByText("目的定下來後，後面會更快。" )).toBeVisible();
});

test("keeps no-go choices collapsed until the buyer opens the optional section", async ({ page }) => {
  await page.goto("/?testStep=priorities");
  const toggle = page.getByRole("button", { name: /有一定避開的條件嗎/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "西曬", exact: true })).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "西曬", exact: true })).toBeVisible();
});

test("can clear no special no-go by pressing it again", async ({ page }) => {
  await page.goto("/?testStep=priorities");
  await page.getByRole("button", { name: /有一定避開的條件嗎/ }).click();
  const none = page.getByRole("button", { name: "無特殊忌諱", exact: true });
  await none.click();
  await expect(none).toHaveAttribute("aria-pressed", "true");
  await none.click();
  await expect(none).toHaveAttribute("aria-pressed", "false");
});

test("shows how many priority choices remain", async ({ page }) => {
  await page.goto("/?testStep=priorities");
  await expect(page.getByText("還能選 2 個")).toBeVisible();
  await page.getByRole("button", { name: "地點", exact: true }).click();
  await expect(page.getByText("還能選 1 個")).toBeVisible();
});
```

The local shortcut starts with one must-have, so the first remaining count is 2.

- [ ] **Step 2: Run the four focused UI tests and confirm RED**

Run:

```powershell
npx.cmd playwright test tests/app.spec.js --grep "six progress|collapsed|clear no special|how many priority"
```

Expected: all four tests fail against the current 7-screen duplicated UI.

- [ ] **Step 3: Add explicit UI state and milestone copy**

In `src/app.js`, add:

```js
const STEP_MILESTONES = [
  "目的定下來後，後面會更快。",
  "生活圈有方向了。",
  "負擔範圍更清楚了。",
  "空間需求整理好了。",
  "物件範圍縮小了。",
  "可以看方向卡了。"
];
```

Add `noGosExpanded: false` to state. Reset it only when starting a new questionnaire; preserve it during rerenders on the priorities page.

Render only the `.advisor-tip`; remove `.question-hint`. Add a `.progress-milestone` beside or beneath the progress text using `STEP_MILESTONES[state.stepIndex]`.

- [ ] **Step 4: Implement the optional no-go disclosure and remaining count**

Render `mustHaves` normally. Render `noGos` and `otherNoGo` inside a container only when `state.noGosExpanded` is true. The toggle must be a real button:

```html
<button class="optional-toggle" type="button" aria-expanded="false" aria-controls="optionalNoGos">
  有一定避開的條件嗎？<span>選填</span>
</button>
```

Bind it to toggle `state.noGosExpanded` and rerender without moving focus away from the button.

For a field with `max`, replace generic guidance with:

```js
const remaining = Math.max(0, field.max - values.length);
const hint = `<span class="field-guidance" role="status">還能選 ${remaining} 個</span>`;
```

Fix the exclusive-option branch:

```js
if (exclusive && value === exclusive) {
  values = values.includes(exclusive) ? [] : [exclusive];
}
```

- [ ] **Step 5: Style the disclosure and milestone without changing the palette**

In `assets/styles.css`, add `.progress-milestone`, `.optional-toggle`, `.optional-panel`, and selected-summary styles. Maintain 48px minimum touch targets and the existing focus ring. Do not add a second note box.

- [ ] **Step 6: Run focused and full UI tests**

Run:

```powershell
npx.cmd playwright test tests/app.spec.js --grep "six progress|collapsed|clear no special|how many priority"
npm.cmd run test:ui
```

Expected: focused tests and the full desktop/mobile matrix pass.

- [ ] **Step 7: Commit the question UI change**

```powershell
git add src/app.js assets/styles.css tests/app.spec.js
git commit -m "feat: streamline buyer question interactions"
```

---

### Task 3: Make the Preview Valuable and Progressively Reveal the Full Checklist

**Files:**
- Modify: `src/result.js`
- Modify: `src/app.js`
- Modify: `src/payload.js`
- Modify: `assets/styles.css`
- Test: `tests/result.test.js`
- Test: `tests/payload.test.js`
- Test: `tests/app.spec.js`

**Interfaces:**
- Consumes: `deriveResult(answers)` with ten `videoQuestions` and 3–5 relevant items.
- Produces: `priorityPreview` with exactly three items; a pre-contact result preview; a four-item primary checklist plus six-item disclosure after confirmed submission.

- [ ] **Step 1: Write failing result-model tests**

Add:

```js
test("provides exactly three pre-contact priority questions", () => {
  const result = deriveResult(completeAnswers());
  assert.equal(result.priorityPreview.length, 3);
  assert.ok(result.priorityPreview.every(item => item.relevant));
});

test("does not claim the removed decision questions were answered", () => {
  const result = deriveResult({ ...completeAnswers(), moveInBudget: "", conditionTolerance: "", decisionLimit: "" });
  assert.doesNotMatch(result.budgetReminder, /待確認.*入住整理預算/);
  assert.ok(result.strategy.some(item => /修繕|屋況|出價底線/.test(item)));
});
```

- [ ] **Step 2: Write failing progressive-result Playwright tests**

Add:

```js
test("shows three useful priorities before asking for contact details", async ({ page }) => {
  await page.goto("/?testStep=result");
  await expect(page.getByRole("heading", { name: "最值得先確認的 3 件事" })).toBeVisible();
  await expect(page.locator("[data-preview-priority]")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "免費取得完整看屋方向卡" })).toBeVisible();
  await expect(page.getByText(/資料只用於回覆這次需求/)).toBeVisible();
});

test("shows four priority checks before the remaining six", async ({ page }) => {
  await page.goto("/?testStep=result");
  await installDeferredSubmissionMock(page);
  await fillValidContact(page);
  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  await page.evaluate(() => window.__submissionControl.resolve({
    ok: true,
    submissionId: window.__capturedPayload.submissionId
  }));
  await expect(page.locator("[data-priority-check] input[type=checkbox]")).toHaveCount(4);
  const more = page.getByText("查看其餘 6 項（完整 10 項）");
  await expect(more).toBeVisible();
  await expect(page.locator("[data-secondary-check] input[type=checkbox]")).toHaveCount(6);
  await expect(page.locator("[data-secondary-check]").first()).not.toBeVisible();
  await more.click();
  await expect(page.locator("[data-secondary-check]").first()).toBeVisible();
});
```

- [ ] **Step 3: Run the focused model and UI tests and confirm RED**

Run:

```powershell
node --test tests/result.test.js tests/payload.test.js
npx.cmd playwright test tests/app.spec.js --grep "three useful priorities|four priority checks"
```

Expected: missing `priorityPreview`, old contact copy, and a flat ten-item checklist cause failures.

- [ ] **Step 4: Implement result-model fallbacks**

In `src/result.js`:

- Preserve all ten `VIDEO_QUESTIONS`.
- Keep relevant selection at four items.
- Return `priorityPreview` as the first three relevant questions.
- When the removed decision fields are blank, use general guidance rather than rendering `待確認` as if the buyer skipped required work.
- Ensure strategy contains concise reminders for full cost,中古屋屋況, and出價底線 without claiming those answers were collected.

The return shape must include:

```js
{
  status,
  headline,
  direction,
  budgetReminder,
  strategy,
  priorityPreview,
  videoQuestions
}
```

- [ ] **Step 5: Implement the preview and confirmed-card disclosure**

In `resultPreview(result)`, append:

```html
<h3>最值得先確認的 3 件事</h3>
<ol class="preview-priorities">
  <!-- exactly three li[data-preview-priority] -->
</ol>
```

Change contact heading and button to `免費取得完整看屋方向卡`. Add the sentence `資料只用於回覆這次需求，不會用來發送無關訊息。`

In `renderComplete()`, split:

```js
const priorities = result.videoQuestions.filter(item => item.relevant).slice(0, 4);
const secondary = result.videoQuestions.filter(item => !priorities.some(priority => priority.ep === item.ep));
```

Render four visible native checkbox labels with `data-priority-check`, then a native `<details>` whose summary is `查看其餘 6 項（完整 10 項）` and whose six checkbox labels carry `data-secondary-check`.

- [ ] **Step 6: Update summary text and styles**

In `src/payload.js`, remove buyer-facing `未填` lines for the three optional legacy fields. Keep the three keys in the payload object.

In `assets/styles.css`, style `.preview-priorities`, `.priority-video-list`, and `.secondary-video-details`; preserve native checkbox semantics and visible focus.

- [ ] **Step 7: Run focused and full tests**

Run:

```powershell
node --test tests/result.test.js tests/payload.test.js
npx.cmd playwright test tests/app.spec.js --grep "three useful priorities|four priority checks"
npm.cmd test
npm.cmd run test:ui
```

Expected: all tests pass; existing submission snapshot, call, LINE, copy, timeout, and retry tests remain green after updating button locators.

- [ ] **Step 8: Commit the result progression**

```powershell
git add src/result.js src/app.js src/payload.js assets/styles.css tests/result.test.js tests/payload.test.js tests/app.spec.js
git commit -m "feat: reveal buyer results progressively"
```

---

### Task 4: Polish Mobile Density, Trust, and Motion

**Files:**
- Modify: `src/app.js`
- Modify: `assets/styles.css`
- Modify: `index.html`
- Test: `tests/app.spec.js`

**Interfaces:**
- Consumes: simplified question markup and progressive result markup.
- Produces: mobile-visible privacy message, shorter first-screen spacing, two-column compact choices, 48px targets, and reduced-motion-safe micro-interactions.

- [ ] **Step 1: Write failing mobile-layout tests**

Add:

```js
test("mobile intro keeps the trust message and start action in the first viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByText("資料只用於回覆本次需求")).toBeVisible();
  await expect(page.getByRole("button", { name: "開始整理" })).toBeInViewport();
});

test("mobile priority page starts with only the core choices", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/?testStep=priorities");
  await expect(page.locator('[data-field-group="mustHaves"] .choice')).toHaveCount(9);
  await expect(page.locator('[data-field-group="noGos"]')).toHaveCount(0);
  const columns = await page.locator('[data-field-group="mustHaves"] .choice-grid').evaluate(
    element => getComputedStyle(element).gridTemplateColumns
  );
  expect(columns.split(" ").length).toBe(2);
});
```

- [ ] **Step 2: Run the focused mobile tests and confirm RED**

Run:

```powershell
npx.cmd playwright test tests/app.spec.js --project=mobile --grep "mobile intro keeps|mobile priority page"
```

Expected: hidden mobile privacy chip and one-column choices fail.

- [ ] **Step 3: Mark compact choice groups and reduce intro whitespace**

In `renderField()`, add `compact` when all options are short enough for two columns:

```js
const compact = field.options.every(option => [...option].length <= 7) ? " compact" : "";
```

Render `<div class="choice-grid${compact}">`.

Update intro copy to `用 6 個關鍵選擇，先整理生活圈、舒服負擔與真正底線。` and meta to `約 60～90 秒完成`.

- [ ] **Step 4: Implement mobile and motion CSS**

Within `@media (max-width: 760px)`:

- Keep `.privacy-chip` visible and compact instead of `display:none`.
- Reduce hero top padding so the CTA is inside an 800px viewport.
- Set `.choice-grid.compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }`.
- Keep `.choice` min-height at 52px on mobile.
- Keep long labels in one column by leaving non-compact grids unchanged.

Add 120～180ms transitions for selected cards and progress. Under `prefers-reduced-motion: reduce`, set animation and transition durations to `0.00001ms` and `scroll-behavior:auto`.

- [ ] **Step 5: Run mobile, accessibility, and complete tests**

Run:

```powershell
npx.cmd playwright test tests/app.spec.js --project=mobile --grep "mobile intro keeps|mobile priority page|focus indicator|horizontal overflow"
npm.cmd run test:ui
```

Expected: focused mobile checks and the full desktop/mobile suite pass.

- [ ] **Step 6: Commit the visual polish**

```powershell
git add src/app.js assets/styles.css index.html tests/app.spec.js
git commit -m "feat: polish mobile buyer diagnosis flow"
```

---

### Task 5: Full Acceptance, Safe Publish, and Production Verification

**Files:**
- Modify only if acceptance reveals a defect: `src/**`, `assets/styles.css`, `index.html`, `tests/**`.
- Record evidence: `.superpowers/sdd/task-balanced-ux-report.md`.

**Interfaces:**
- Consumes: verified six-page static site and existing Apps Script endpoint.
- Produces: a fast-forward update of `origin/codex/buyer-interactive-v2`, successful GitHub Pages build, and exact new-Sheet evidence.

- [ ] **Step 1: Run a clean full suite**

Run:

```powershell
Remove-Item -LiteralPath '.\node_modules' -Recurse -Force -ErrorAction SilentlyContinue
npm.cmd ci
npm.cmd test
npm.cmd run test:ui
node --check src/questions.js
node --check src/result.js
node --check src/payload.js
node --check src/api.js
node --check src/app.js
git diff --check
```

Expected: Node and Playwright report zero failures; syntax and diff checks exit 0.

- [ ] **Step 2: Perform browser acceptance at 360, 768, and 1440 widths**

Verify intro, six progress states, conditional third room, optional no-go disclosure, reversible `無特殊忌諱`, back navigation, error focus, pre-contact three priorities, contact validation, failure fallback, confirmed four-plus-six checklist, copy, call, LINE, focus, reduced motion, and no horizontal overflow.

Expected: the approved consultant-card design remains recognizable and no page repeats the same hint.

- [ ] **Step 3: Confirm the publish is a fast-forward**

Run:

```powershell
git fetch origin codex/buyer-interactive-v2
git merge-base --is-ancestor origin/codex/buyer-interactive-v2 HEAD
git status --short
```

Expected: ancestor check exits 0 and worktree is clean. If it fails, stop and inspect remote changes; do not force push.

- [ ] **Step 4: Push the tested head to the existing Pages branch**

Run:

```powershell
git push origin HEAD:codex/buyer-interactive-v2
```

Expected: normal fast-forward push; never use `--force`.

- [ ] **Step 5: Wait for GitHub Pages success and inspect production**

Use GitHub Pages status and deployment run evidence. Wait for `built`/`success`, then open:

```text
https://buyer.tainanwei.com/
```

Expected: HTTP 200, title `台南小魏｜買房方向診斷`, six-step copy, mobile trust message, and the simplified live flow.

- [ ] **Step 6: Complete one real production test and re-read the exact Sheet row**

Use a clearly marked test name and a valid non-personal test mobile. Complete all six pages, submit once, capture the submission ID, and query only the bounded range in the new Sheet.

Expected:

- One matching row in `C版買方診斷名單`.
- 31 columns in header order.
- `moveInBudget`, `conditionTolerance`, and `decisionLimit` are blank strings.
- Phone retains its leading `0`.
- Formula-leading text remains a string.
- Status endpoint returns `found:true` for the same submission ID.

- [ ] **Step 7: Re-verify old-site isolation and record evidence**

Open the original 11-step URL and verify its repository and Sheet remain unchanged:

```text
https://weslywei1984-glitch.github.io/real-estate-buyer-interactive/
```

Record exact tests, commit, Pages run, production URL, submission ID, Sheet range, and old-site evidence in `.superpowers/sdd/task-balanced-ux-report.md`.

- [ ] **Step 8: Commit any acceptance-only fixes**

If acceptance required a code correction, use TDD and commit only the verified files:

```powershell
git add src assets index.html tests docs
git commit -m "fix: complete balanced buyer UX acceptance"
```

If no correction was needed, do not create an empty commit.
