# Buyer Result and Contact Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all eight annotated result-page refinements, including real phone-or-LINE-ID submission, correct LINE/phone actions, fixed result typography, aligned contact fields, and a downloadable branded PNG.

**Architecture:** Add one focused contact-normalization module shared by frontend payload logic, while duplicating its small validation contract in Apps Script. Add one focused Canvas renderer for the privacy-safe PNG. Keep the current 31-column payload and submission lifecycle unchanged; UI changes stay in the existing result renderer and stylesheet.

**Tech Stack:** Static ES modules, HTML/CSS, Canvas 2D, Node test runner, Playwright, Google Apps Script, GitHub Pages.

## Global Constraints

- Keep exactly six required question screens and the existing result-ranking logic.
- Keep payload key `phone`, 31 columns, source version `buyer-diagnosis-c-v2`, submission-ID dedupe, status polling, and failure snapshot behavior.
- Accept either a Taiwan `09` 10-digit mobile or a LINE ID made of lowercase half-width alphanumerics plus `.`, `-`, `_`; pure digits must be a valid mobile.
- Correct LINE URL: `https://line.me/R/ti/p/%40tainanwei`.
- Phone link: `tel:0927617207`; visible phone: `0927-617-207`.
- Contact guidance: `手機輸入10碼，例09XX；LINE ID 可直接輸入`.
- Result headline lines: `先把生活與負擔對齊；` and `再挑真正值得看的房子。`.
- PNG is 1080×1350 and must not contain the buyer name, phone, or LINE ID.
- Do not modify the original V1 repository, old Sheet, brand, phone number, six questions, or video topics.

---

### Task 1: Contact normalization, payload, and Apps Script contract

**Files:**
- Create: `src/contact.js`
- Modify: `src/payload.js`
- Modify: `src/app.js`
- Modify: `apps-script/Code.gs`
- Modify: `tests/payload.test.js`
- Modify: `tests/apps-script.test.js`
- Modify: `tests/app.spec.js`

**Interfaces:**
- Produces: `normalizeContact(value): string`, `isTaiwanMobile(value): boolean`, `isLineId(value): boolean`, `isValidContact(value): boolean`.
- Preserves: `buildPayload(...).phone` and the 31-column Apps Script row order.

- [ ] **Step 1: Write failing Node tests for both contact forms**

Add assertions equivalent to:

```js
assert.equal(normalizeContact("0912-345-678"), "0912345678");
assert.equal(normalizeContact("Tainan.Wei_88"), "tainan.wei_88");
assert.equal(isValidContact("0912 345 678"), true);
assert.equal(isValidContact("tainan.wei_88"), true);
assert.equal(isValidContact("0912"), false);
assert.equal(isValidContact("bad id"), false);
assert.equal(buildPayload({ answers: { ...answers, phone: "Tainan.Wei_88" }, result, submissionId: "sub-123" }).phone, "tainan.wei_88");
```

- [ ] **Step 2: Write failing Apps Script tests**

Update the expected fifth header to `手機／LINE ID`; assert a LINE-ID payload appends exactly 31 cells, stores the fifth cell as a text value, and rejects spaces or unsupported symbols. Retain the existing formula-safety, phone-leading-zero, lock, and dedupe tests.

- [ ] **Step 3: Run focused RED tests**

Run:

```powershell
node --test tests/payload.test.js tests/apps-script.test.js
npx.cmd playwright test tests/app.spec.js --grep "手機號碼 or LINE ID|contact validation" --project=desktop --project=mobile
```

Expected: failures because the dual-contact functions, label, guidance, and backend contract do not exist.

- [ ] **Step 4: Implement the minimal contact module and payload usage**

Implement the contract in `src/contact.js`. Phone separators are removed only when the normalized value is a valid Taiwan mobile; LINE IDs are trimmed/lowercased and validated against allowed characters. Update `buildPayload()` and `app.js` to use `isValidContact()` and show the approved label/guidance/error text.

- [ ] **Step 5: Implement the same Apps Script validation**

Change the fifth `HEADERS` value to `手機／LINE ID`; replace phone-only validation with a helper accepting the same two contact forms. Keep `data.phone`, column order, `safe_()`, lock/dedupe, and status response unchanged.

- [ ] **Step 6: Run focused GREEN tests and commit**

Run the Step 3 commands. Expected: all focused tests pass.

```powershell
git add src/contact.js src/payload.js src/app.js apps-script/Code.gs tests/payload.test.js tests/apps-script.test.js tests/app.spec.js
git commit -m "feat: accept phone or LINE contact"
```

---

### Task 2: Result typography, contact alignment, and direct actions

**Files:**
- Modify: `src/config.js`
- Modify: `src/result.js`
- Modify: `src/app.js`
- Modify: `assets/styles.css`
- Modify: `README.md`
- Test: `tests/result.test.js`
- Test: `tests/app.spec.js`

**Interfaces:**
- Consumes: `LINE_URL`, `PHONE`, `BuyerResult.headline`.
- Produces: two fixed headline spans, 1.5× result status, parallel desktop contact fields, `tel:0927617207`, and the correct LINE add-friend link.

- [ ] **Step 1: Write failing model/UI tests**

Assert:

```js
assert.equal(result.headline, "先把生活與負擔對齊；\n再挑真正值得看的房子。");
```

In Playwright desktop/mobile, assert two `.result-headline-line` elements with the exact lines, the LINE href equals the approved add-friend URL, the call href equals `tel:0927617207`, and the contact label/guidance are exact.

- [ ] **Step 2: Add failing layout measurements**

At 1440px, compare `#name` and `#phone` bounding boxes: same top, height, and width within 1px. At 360px, assert the inputs are vertically stacked, full-width, and `scrollWidth <= clientWidth`. Compare computed `.result-status` font size with the baseline design value and require `19.5px` or the equivalent 1.5× CSS calculation.

- [ ] **Step 3: Run focused RED tests**

```powershell
node --test tests/result.test.js
npx.cmd playwright test tests/app.spec.js --grep "result refinement|contact fields|LINE contact|call action" --project=desktop --project=mobile
```

Expected: failures on the old URL, one-line headline, small status, missing call action, and/or alignment contract.

- [ ] **Step 4: Implement the minimal markup and CSS**

- Set `LINE_URL` to `https://line.me/R/ti/p/%40tainanwei`.
- Store the headline with a newline and render escaped lines as block spans.
- Increase `.result-status` font size from 13px to 19.5px and tune padding/min-height.
- Make the desktop contact grid `repeat(2, minmax(0, 1fr))`; give both inputs the same explicit block size and aligned label rows; hide the name guidance spacer at the mobile breakpoint.
- Add a pre-contact call link with class `call-action`; keep the existing confirmed call link.
- Update README to match the live LINE link if necessary.

- [ ] **Step 5: Run focused GREEN tests and commit**

```powershell
git add src/config.js src/result.js src/app.js assets/styles.css README.md tests/result.test.js tests/app.spec.js
git commit -m "feat: refine result contact layout"
```

---

### Task 3: Downloadable privacy-safe result image

**Files:**
- Create: `src/result-image.js`
- Modify: `src/app.js`
- Modify: `assets/styles.css`
- Create: `tests/result-image.test.js`
- Modify: `tests/app.spec.js`

**Interfaces:**
- Produces: `renderResultImage({ result, answers, phone }): HTMLCanvasElement` and `downloadResultImage({ result, answers, phone, documentRef, urlRef }): Promise<string>`.
- Consumes: public diagnosis fields only; must not consume `answers.name` or `answers.phone`.

- [ ] **Step 1: Write failing renderer tests**

Use a fake Canvas 2D context to record drawn strings. Assert canvas dimensions 1080×1350; drawn content contains brand, status, headline, direction, budget, three priorities, and `0927-617-207`; it must not contain the test buyer name, mobile, or LINE ID.

- [ ] **Step 2: Write failing Playwright download tests**

On `/?testStep=result`, assert the button label is `儲存需求照片`. Use `page.waitForEvent("download")`, click it, and assert the suggested filename matches `台南小魏-買房方向卡-YYYYMMDD.png`; assert the toast says `需求照片已儲存`. Repeat in desktop/mobile projects.

- [ ] **Step 3: Run focused RED tests**

```powershell
node --test tests/result-image.test.js
npx.cmd playwright test tests/app.spec.js --grep "儲存需求照片" --project=desktop --project=mobile
```

Expected: failures because the module/button/download do not exist.

- [ ] **Step 4: Implement the Canvas renderer and bind both result states**

Draw a restrained warm-white consultant card with ink-green text and gold accents. Use a wrapping helper with measured text, cap long sections to the approved number of lines, and export via `canvas.toBlob()`. Create/click/revoke a temporary download link. Bind the button on both pre-contact and confirmed result views; report success/failure through the existing toast.

- [ ] **Step 5: Run focused GREEN tests and commit**

```powershell
git add src/result-image.js src/app.js assets/styles.css tests/result-image.test.js tests/app.spec.js
git commit -m "feat: save buyer result as image"
```

---

### Task 4: Full verification, Apps Script update, and production release

**Files:**
- Modify only if acceptance finds a defect: `src/**`, `assets/styles.css`, `apps-script/Code.gs`, `tests/**`.
- Record evidence: `.superpowers/sdd/2026-08-08-result-contact-refinement/report.md`.

**Interfaces:**
- Produces: updated Apps Script deployment, fast-forward Pages branch, one verified LINE-ID Sheet row, and preserved V1 isolation.

- [ ] **Step 1: Run the clean full suite**

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run test:ui
node --check src/questions.js
node --check src/result.js
node --check src/payload.js
node --check src/api.js
node --check src/app.js
node --check src/contact.js
node --check src/result-image.js
git diff --check
```

Expected: zero failures and a clean tracked worktree after commits.

- [ ] **Step 2: Verify locally at 360, 768, and 1440**

Use the browser to verify both contact forms, exact labels, aligned/stacked inputs, two-line headline, 1.5× status, download filename/visual, call link, LINE link, keyboard focus, reduced motion, and no overflow.

- [ ] **Step 3: Update and redeploy the existing Apps Script Web App**

Update only the existing C-version bound script with `apps-script/Code.gs`, create a new deployment version on the same `/exec` URL, and verify health/status. Stop for any CAPTCHA, security prompt, or missing authorization.

- [ ] **Step 4: TDD production verification with one LINE ID**

Submit one clearly marked test lead using a safe LINE ID such as `task5.line_test`; capture the submission ID. Read only the exact new-Sheet row and assert: unique match, 31 columns, header 5 is `手機／LINE ID`, value 5 is a string equal to the normalized LINE ID, AC:AE remain blank, and status returns `found:true`.

- [ ] **Step 5: Fast-forward Pages and verify live**

```powershell
git fetch origin codex/buyer-interactive-v2
git merge-base --is-ancestor origin/codex/buyer-interactive-v2 HEAD
git push origin HEAD:codex/buyer-interactive-v2
```

Wait for Pages `success`/`built`, then repeat the targeted desktop/mobile checks at `https://buyer.tainanwei.com/`. Verify the original V1 site is still 11 steps and the old Sheet contains no new test lead.

- [ ] **Step 6: Final review and report**

Record test counts, commit SHA, Apps Script version/endpoint, Pages run, browser measurements, submission ID/row, and old-site isolation. Request a scoped whole-change review; fix every Critical/Important before completion.
