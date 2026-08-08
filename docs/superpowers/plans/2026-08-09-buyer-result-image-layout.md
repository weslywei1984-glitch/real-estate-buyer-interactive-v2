# Buyer Result Image Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the downloadable 1080 × 1350 buyer direction card so its typography and spacing feel calmer, the top-right phone is removed, and the footer becomes a centered three-line contact block.

**Architecture:** Keep the existing Canvas pipeline and privacy boundary intact. Make the layout change inside `drawCard()` in `src/result-image.js`, extend the fake-canvas and real-browser assertions to cover phone count and centered footer placement, then visually verify real PNG output before publishing the same static site.

**Tech Stack:** Vanilla JavaScript ES modules, Canvas 2D API, Node test runner, Playwright Chromium, GitHub Pages.

## Global Constraints

- Preserve the exact 1080 × 1350 PNG size, filename format, download flow, toast, and current warm-white / ink-green / gold palette.
- Remove the top-right `0927-617-207`; render the fixed brand phone exactly once, centered in the footer.
- Center the footer copy exactly as `想了解台南行情、買房、賣房，都可以找我聊聊。`, `魏泉承｜永慶不動產-小東南紡店`, and `0927-617-207`.
- Do not change the result page, questionnaire, payload, Apps Script, Google Sheet, LINE link, or telephone link.
- Preserve the image allowlist and privacy behavior: buyer name, buyer phone, LINE ID, free text, caller-supplied result, caller-supplied phone, and illegal option values must remain absent from PNG text.
- Do not add a font dependency or external CDN.

---

### Task 1: Implement the refined Canvas composition with TDD

**Files:**
- Modify: `src/result-image.js:135-249`
- Modify: `tests/result-image.test.js:8-32`
- Modify: `tests/result-image.test.js:241-280`
- Modify: `tests/app.spec.js:744-820`

**Interfaces:**
- Consumes: sanitized `result` created by `deriveImageResult(answers)`, existing `renderResultImage({ answers })`, fake Canvas `context.drawn`, browser Canvas `fillText()` interception, and the existing drawing helpers.
- Produces: unchanged `renderResultImage({ answers }) -> HTMLCanvasElement` and `downloadResultImage({ answers, documentRef, urlRef }) -> Promise<void>` behavior with regression evidence that the public footer is centered, the fixed phone appears exactly once below the content area, and no header phone remains.

- [ ] **Step 1: Record alignment and color in fake Canvas draws**

Change the fake `fillText()` recorder to capture the state used for each draw:

```js
fillText(value, x, y) {
  drawn.push({
    value: String(value),
    x,
    y,
    font: this.font,
    textAlign: this.textAlign,
    fillStyle: this.fillStyle
  });
}
```

- [ ] **Step 2: Add a focused Node layout test**

Add a test beside the existing 1080 × 1350 privacy test:

```js
test("result image removes the header phone and centers the three-line footer", () => {
  const canvas = createFakeCanvas();
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => canvas };

  try {
    renderResultImage({ answers: publicAnswers() });
    const footerValues = [
      "想了解台南行情、買房、賣房，都可以找我聊聊。",
      "魏泉承｜永慶不動產-小東南紡店",
      "0927-617-207"
    ];
    const footerDraws = canvas.context.drawn.filter(entry => footerValues.includes(entry.value));
    const phones = canvas.context.drawn.filter(entry => entry.value === "0927-617-207");

    assert.equal(phones.length, 1);
    assert.ok(phones[0].y >= 1200);
    assert.deepEqual(footerDraws.map(entry => entry.x), [540, 540, 540]);
    assert.deepEqual(footerDraws.map(entry => entry.textAlign), ["center", "center", "center"]);
  } finally {
    globalThis.document = previousDocument;
  }
});
```

- [ ] **Step 3: Extend the real Canvas interception assertion**

In the existing long-text Playwright test, record `{ value, x, y, textAlign }` instead of concatenated text only, return the placement records, and assert:

```js
const phoneDraws = canvasMetrics.draws.filter(draw => draw.value === "0927-617-207");
expect(phoneDraws).toHaveLength(1);
expect(phoneDraws[0]).toMatchObject({ x: 540, textAlign: "center" });
expect(phoneDraws[0].y).toBeGreaterThanOrEqual(1200);
expect(canvasMetrics.draws.some(draw => draw.value === "0927-617-207" && draw.y < 1100)).toBe(false);
```

Keep the current private-value and legal-value checks by deriving `drawnText` from `draws.map(draw => draw.value).join("")`.

- [ ] **Step 4: Run the focused tests and confirm RED**

Run:

```powershell
node --test --test-name-pattern="removes the header phone|renders the public diagnosis" tests/result-image.test.js
npx.cmd playwright test tests/app.spec.js --grep "polluted long-text canvas" --project=desktop --project=mobile
```

Expected: the new Node assertion fails because the phone is drawn twice and the footer is left/right aligned; desktop and mobile fail on placement because the current footer is not centered.

- [ ] **Step 5: Remove the header phone draw**

Delete only this header block; keep `BRAND_PHONE` for the footer:

```js
context.textAlign = "right";
context.fillStyle = INK_SOFT;
setFont(context, 24, 700);
context.fillText(BRAND_PHONE, 972, 94);
context.textAlign = "start";
```

- [ ] **Step 6: Rebalance title and content typography**

Apply these explicit Canvas values inside `drawCard()`:

```js
setFont(context, 52, 800, DISPLAY_FONT);
drawWrappedText(context, result?.headline, {
  x: 84,
  y: 258,
  maxWidth: 912,
  maxLines: 2,
  lineHeight: 70
});
drawRule(context, 390);

drawSectionLabel(context, "目前找房方向", 422);
setFont(context, 27, 600);
let directionY = 474;
```

Use `lineHeight: 36` and `+ 12` spacing for direction bullets. Set `budgetLabelY` to `Math.max(664, directionY + 18)`, budget body to 25 px with `lineHeight: 34`, and `prioritiesLabelY` to `Math.max(852, budgetEnd + 34)`. Keep three priorities, set their body line-height to 33, and preserve the existing maximum line counts.

- [ ] **Step 7: Replace the footer with a centered three-line block**

Use a taller footer so the three levels breathe while remaining within the border:

```js
context.fillStyle = INK;
roundedRect(context, 84, 1144, 912, 152, 18);
context.fill();

context.textAlign = "center";
context.fillStyle = PAPER;
setFont(context, 23, 700);
context.fillText("想了解台南行情、買房、賣房，都可以找我聊聊。", 540, 1167);

context.fillStyle = GOLD_PALE;
setFont(context, 19, 600);
context.fillText("魏泉承｜永慶不動產-小東南紡店", 540, 1211);

setFont(context, 22, 800);
context.fillText(BRAND_PHONE, 540, 1250);
context.textAlign = "start";
```

- [ ] **Step 8: Run focused tests and confirm GREEN**

Run:

```powershell
node --test --test-name-pattern="removes the header phone|renders the public diagnosis" tests/result-image.test.js
npx.cmd playwright test tests/app.spec.js --grep "polluted long-text canvas" --project=desktop --project=mobile
```

Expected: all selected Node and desktop/mobile Playwright tests pass; the phone count is one and all three footer lines report `{ x: 540, textAlign: "center" }`.

- [ ] **Step 9: Run the complete automated verification**

Run:

```powershell
npm.cmd test
npm.cmd run test:ui
node --check src/result-image.js
node --check tests/result-image.test.js
node --check tests/app.spec.js
git diff --check
```

Expected: every Node and desktop/mobile Playwright test passes, all syntax checks exit 0, and `git diff --check` emits no errors.

- [ ] **Step 10: Commit the implementation**

```powershell
git add -- src/result-image.js tests/result-image.test.js tests/app.spec.js
git commit -m "feat: refine buyer result image layout"
```

---

### Task 2: Produce, inspect, and release the real PNG

**Files:**
- Verify: `src/result-image.js`
- Generate ignored evidence: `output/playwright/buyer-result-card-layout.png`
- Generate ignored evidence: `output/playwright/buyer-result-card-layout-long.png`

**Interfaces:**
- Consumes: the committed Canvas generator and the existing browser result flow.
- Produces: visually inspected PNG evidence and the same public GitHub Pages site serving the verified commit.

- [ ] **Step 1: Generate two real Chromium PNGs**

Use Playwright against the local site to complete one normal fixture and one longest-supported fixture, click `儲存需求照片`, and save the downloads as:

```text
output/playwright/buyer-result-card-layout.png
output/playwright/buyer-result-card-layout-long.png
```

For each file, read the PNG signature and IHDR and confirm width `1080`, height `1350`, and a non-empty payload larger than 10 KB.

- [ ] **Step 2: Visually inspect both images**

Open both files at original detail and verify:

- no phone appears in the top-right header;
- the two-line headline is relaxed and neither clipped nor crowded;
- section labels, paragraphs, bullets, and 01/02/03 rows have consistent spacing;
- the gap above the footer feels intentional rather than empty;
- all three footer lines are centered and fully visible;
- the phone appears once at the bottom;
- no buyer name, phone, LINE ID, or other private/free-text value is visible.

If a visual defect is found, add a failing regression assertion before changing production coordinates, then repeat Task 2's GREEN and full verification steps.

- [ ] **Step 3: Verify fast-forward safety and publish**

```powershell
git fetch origin codex/buyer-interactive-v2
git merge-base --is-ancestor origin/codex/buyer-interactive-v2 HEAD
git push origin HEAD:codex/buyer-interactive-v2
```

Expected: the ancestor check exits 0 and the push is a normal fast-forward. Stop without force-pushing if either condition fails.

- [ ] **Step 4: Verify GitHub Pages and the live download**

Wait for the Pages run whose `headSha` equals the pushed commit to finish successfully. Open `https://buyer.tainanwei.com/?v=<short-sha>` in the built-in browser, complete the six-step flow without submitting contact data, download the PNG, and verify:

- live `src/result-image.js` contains the new centered footer coordinates and matches the pushed source;
- the live PNG is 1080 × 1350 and shows the approved composition;
- the browser console has no errors or warnings;
- no horizontal overflow appears at 360 px or desktop width;
- no Apps Script request or Google Sheet write occurs during this visual-only release check.

- [ ] **Step 5: Record final evidence**

Run `git status --short`, confirm the tracked worktree is clean, and report the implementation commit, full test counts, PNG dimensions, Pages run, live URL, and the inspected PNG file path.
