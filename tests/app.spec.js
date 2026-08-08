import { test, expect } from "@playwright/test";

async function installDeferredSubmissionMock(page) {
  await page.evaluate(() => {
    window.__submitCalls = 0;
    window.__buyerAppTest.configureServices({
      endpoint: "https://example.test/confirmed-submit",
      submitLead: ({ payload }) => {
        window.__submitCalls += 1;
        window.__capturedPayload = structuredClone(payload);
        return new Promise((resolve, reject) => {
          window.__submissionControl = { resolve, reject };
        });
      }
    });
  });
}

async function fillValidContact(page) {
  await page.getByLabel("怎麼稱呼您？").fill("王小姐");
  await page.getByLabel("手機號碼 or LINE ID").fill("0912345678");
  await page.getByLabel("我同意由小魏依這份結果與我聯繫").check();
}

function relativeLuminance(color) {
  const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

async function completeQuestionnaire(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "開始整理" }).click();

  await page.getByRole("button", { name: "自住", exact: true }).click();
  await page.getByRole("button", { name: "3個月內", exact: true }).click();
  await page.getByRole("button", { name: "下一題" }).click();

  await page.getByRole("button", { name: "永康區", exact: true }).click();
  await page.getByRole("button", { name: "工作通勤", exact: true }).click();
  await page.getByRole("button", { name: "下一題" }).click();

  await page.getByRole("button", { name: "200～300萬", exact: true }).click();
  await page.getByRole("button", { name: "2～3萬", exact: true }).click();
  await page.getByRole("button", { name: "下一題" }).click();

  await page.getByRole("button", { name: "2 人", exact: true }).click();
  await page.getByRole("button", { name: "2房", exact: true }).click();
  await page.getByRole("button", { name: "下一題" }).click();

  await page.getByRole("button", { name: "電梯大樓", exact: true }).click();
  await page.getByRole("button", { name: "20年內", exact: true }).click();
  await page.getByRole("button", { name: "一定要平車", exact: true }).click();
  await page.getByRole("button", { name: "下一題" }).click();

  await page.getByRole("button", { name: "格局", exact: true }).click();
  await page.getByRole("button", { name: "查看方向" }).click();
}

test("buyer test hook exists only on exact local hostnames", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => typeof window.__buyerAppTest)).toBe("object");

  await page.goto("http://localhost:4173/");
  await expect.poll(() => page.evaluate(() => typeof window.__buyerAppTest)).toBe("object");

  await page.goto("http://production.localhost:4173/");
  await expect.poll(() => page.evaluate(() => typeof window.__buyerAppTest)).toBe("undefined");
});

test("static progress semantics match the six-screen questionnaire before JavaScript", async ({ page }) => {
  await page.route("**/src/app.js", route => route.abort());
  await page.goto("/");

  await expect(page.locator('[role="progressbar"]')).toHaveAttribute("aria-valuemax", "6");
});

test("completes the six-screen path and reveals the result/contact page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "找到適合生活的房子，從問對問題開始。" })).toBeVisible();
  await page.getByRole("button", { name: "開始整理" }).click();
  await page.getByRole("button", { name: "自住", exact: true }).click();
  await page.getByRole("button", { name: "3個月內", exact: true }).click();
  await page.getByRole("button", { name: "下一題" }).click();
  await expect(page.getByText("第 2 題，共 6 題")).toBeVisible();
  await expect(page.getByRole("heading", { name: "每天的生活，主要會落在哪裡？" })).toBeFocused();

  await completeQuestionnaire(page);
  await expect(page.locator(".result-status")).toHaveText("條件整理中");
  await expect(page.getByRole("heading", { name: "免費取得完整看屋方向卡" })).toBeVisible();
  await expect(page.getByRole("button", { name: "免費取得完整方向卡" })).toBeVisible();
});

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
  const priorityChecks = page.locator("[data-priority-check]");
  await expect(priorityChecks.locator("input[type=checkbox]")).toHaveCount(4);
  await expect(priorityChecks.locator(".video-question-text")).toHaveText([
    "室外環境、通勤與生活圈實際走過了嗎？",
    "第一眼心動後，價格與必要條件也確認了嗎？",
    "拿掉裝潢加分後，格局仍符合每天的使用方式嗎？",
    "白天與晚上都看過周邊環境嗎？"
  ]);
  const more = page.getByText("查看其餘 6 項（完整 10 項）");
  await expect(more).toBeVisible();
  await expect(page.locator("[data-secondary-check] input[type=checkbox]")).toHaveCount(6);
  await expect(page.locator("[data-secondary-check]").first()).not.toBeVisible();
  await more.click();
  await expect(page.locator("[data-secondary-check]").first()).toBeVisible();
});

test("keyboard opens the full checklist disclosure and keeps focus", async ({ page }) => {
  await page.goto("/?testStep=result");
  await installDeferredSubmissionMock(page);
  await fillValidContact(page);
  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  await page.evaluate(() => window.__submissionControl.resolve({
    ok: true,
    submissionId: window.__capturedPayload.submissionId
  }));

  const details = page.locator(".secondary-video-details");
  const summary = details.locator("summary");
  await expect(summary).toHaveCount(1);
  await expect(details).not.toHaveAttribute("open", "");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await expect(summary).toBeFocused();
});

test("three rooms shows the third-room question and two rooms clears it", async ({ page }) => {
  await page.goto("/?testStep=space");
  await page.getByRole("button", { name: "2 人", exact: true }).click();
  await page.getByRole("button", { name: "3房", exact: true }).click();
  await expect(page.getByText("第三個房間準備拿來做什麼？")).toBeVisible();
  await page.getByRole("button", { name: "工作／書房", exact: true }).click();
  await page.getByRole("button", { name: "2房", exact: true }).click();
  await expect(page.getByText("第三個房間準備拿來做什麼？")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__buyerAppTest.state.answers.thirdRoomUse)).toBe("");
});

test("other no-go expands inline on question six without adding a question screen", async ({ page }) => {
  await page.goto("/?testStep=priorities");
  await expect(page.getByText("第 6 題，共 6 題")).toBeVisible();
  await page.getByRole("button", { name: /有一定避開的條件嗎/ }).click();
  await page.getByRole("button", { name: "其他", exact: true }).click();
  await expect(page.getByLabel("其他避開條件")).toBeVisible();
  await expect(page.getByText("第 6 題，共 6 題")).toBeVisible();
  await page.getByRole("button", { name: "無特殊忌諱", exact: true }).click();
  await expect(page.getByLabel("其他避開條件")).toBeHidden();
});

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

test("keyboard no-go toggle preserves focus while opening and closing", async ({ page }) => {
  await page.goto("/?testStep=priorities");
  const toggle = page.getByRole("button", { name: /有一定避開的條件嗎/ });

  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toBeFocused();

  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
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

test("validation error is announced and receives focus", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "開始整理" }).click();
  await page.getByRole("button", { name: "下一題" }).click();
  const alert = page.getByRole("alert", { name: /請先完成這一題/ });
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  await expect(alert).toContainText("請選擇購屋目的");
});

test("keyboard can start and select an option with a visible pressed state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "開始整理" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "這次買房，最主要是為了什麼？" })).toBeFocused();
  const purpose = page.getByRole("button", { name: "自住", exact: true });
  await purpose.focus();
  await page.keyboard.press("Space");
  await expect(purpose).toHaveAttribute("aria-pressed", "true");
});

test("back navigation preserves answers that are still valid", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "開始整理" }).click();
  await page.getByRole("button", { name: "自住", exact: true }).click();
  await page.getByRole("button", { name: "3個月內", exact: true }).click();
  await page.getByRole("button", { name: "下一題" }).click();
  await page.getByRole("button", { name: "上一步" }).click();
  await expect(page.getByText("第 1 題，共 6 題")).toBeVisible();
  await expect(page.getByRole("button", { name: "自住", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "3個月內", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("contact validation accepts 手機號碼 or LINE ID and exposes field guidance", async ({ page }) => {
  await page.goto("/?testStep=result");
  await page.getByLabel("怎麼稱呼您？").fill("王小姐");
  await expect(page.getByLabel("手機號碼 or LINE ID")).toHaveAttribute("aria-describedby", "phoneGuidance");
  await expect(page.getByText("手機輸入10碼，例09XX；LINE ID 可直接輸入")).toBeVisible();
  await page.getByLabel("手機號碼 or LINE ID").fill("1234");
  await page.getByLabel("我同意由小魏依這份結果與我聯繫").check();
  await expect(page.getByText("請輸入 09 開頭的 10 碼手機號碼或合法 LINE ID")).toBeVisible();
  await expect(page.getByLabel("手機號碼 or LINE ID")).toHaveAttribute("aria-invalid", "true");

  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  await expect(page.getByRole("alert")).toContainText("09 開頭的 10 碼手機號碼或合法 LINE ID");
  await expect(page.getByLabel("手機號碼 or LINE ID")).toBeFocused();
  await expect(page.getByRole("heading", { name: "完整方向卡已確認送出" })).toHaveCount(0);
});

test("手機號碼 or LINE ID normalizes a LINE ID before submission", async ({ page }) => {
  await page.goto("/?testStep=result");
  await installDeferredSubmissionMock(page);
  await page.getByLabel("怎麼稱呼您？").fill("王小姐");
  await page.getByLabel("手機號碼 or LINE ID").fill("Tainan.Wei_88");
  await page.getByLabel("我同意由小魏依這份結果與我聯繫").check();
  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();

  await expect.poll(() => page.evaluate(() => window.__capturedPayload.phone)).toBe("tainan.wei_88");
});

test("submits even without crypto.randomUUID, as on a plain http origin", async ({ page }) => {
  // 憑證還沒發下來時網站走 http，非安全情境沒有 crypto.randomUUID。
  // 少了備援，送出按鈕會丟例外並且完全沒有反應。
  await page.addInitScript(() => {
    Reflect.deleteProperty(Object.getPrototypeOf(crypto), "randomUUID");
    crypto.randomUUID = undefined;
  });
  await page.goto("/?testStep=result");
  await expect.poll(() => page.evaluate(() => typeof crypto.randomUUID)).toBe("undefined");

  await installDeferredSubmissionMock(page);
  await fillValidContact(page);
  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();

  await expect(page.getByRole("button", { name: "確認資料入表中…" })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.__submitCalls)).toBe(1);
  const submissionId = await page.evaluate(() => window.__capturedPayload.submissionId);
  expect(submissionId).toMatch(/^[0-9a-f-]{16,64}$/i);

  await page.evaluate(id => window.__submissionControl.resolve({ ok: true, submissionId: id }), submissionId);
  await expect(page.getByRole("heading", { name: "完整方向卡已確認送出" })).toBeVisible();
});

test("the confirmed page plays a completion animation and settles fully readable", async ({ page }) => {
  await page.goto("/?testStep=result");
  await installDeferredSubmissionMock(page);
  await fillValidContact(page);
  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  await page.evaluate(() => window.__submissionControl.resolve({
    ok: true,
    submissionId: window.__capturedPayload.submissionId
  }));
  await expect(page.getByRole("heading", { name: "完整方向卡已確認送出" })).toBeVisible();

  const played = await page.evaluate(() => document.getAnimations().map(animation => animation.animationName));
  expect(played).toContain("seal-pop");
  expect(played.filter(name => name === "card-in").length).toBeGreaterThanOrEqual(6);

  // 動畫收尾後每一塊都必須完全不透明，否則成功頁會停成一張白卡。
  await page.evaluate(async () => {
    document.getAnimations().forEach(animation => animation.finish());
    await document.fonts?.ready;
  });
  const opacities = await page.evaluate(() =>
    [...document.querySelectorAll(".complete-card > *")].map(el => getComputedStyle(el).opacity));
  expect(opacities.length).toBeGreaterThanOrEqual(8);
  expect(opacities.every(value => value === "1")).toBe(true);
});

test("the completion card stays readable when the animation never starts", async ({ page }) => {
  // .animate-in 是 JS 加的。JS 沒跑到這一步時，內容仍然要看得見。
  await page.goto("/?testStep=result");
  await installDeferredSubmissionMock(page);
  await fillValidContact(page);
  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  await page.evaluate(() => window.__submissionControl.resolve({
    ok: true,
    submissionId: window.__capturedPayload.submissionId
  }));
  await expect(page.getByRole("heading", { name: "完整方向卡已確認送出" })).toBeVisible();

  const opacities = await page.evaluate(() => {
    document.querySelector(".complete-card").classList.remove("animate-in");
    return [...document.querySelectorAll(".complete-card > *")].map(el => getComputedStyle(el).opacity);
  });
  expect(opacities.every(value => value === "1")).toBe(true);
});

test("reduced motion reveals confirmed content without stagger delay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?testStep=result");
  await installDeferredSubmissionMock(page);
  await fillValidContact(page);
  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  await page.evaluate(() => window.__submissionControl.resolve({
    ok: true,
    submissionId: window.__capturedPayload.submissionId
  }));
  await expect(page.locator(".complete-card.animate-in")).toHaveCount(1);

  const children = await page.locator(".complete-card.animate-in > *").evaluateAll(elements =>
    elements.map(element => {
      const style = getComputedStyle(element);
      return { delay: style.animationDelay, opacity: style.opacity };
    }));

  expect(children.length).toBeGreaterThanOrEqual(8);
  expect(children.every(({ delay }) => delay.split(",").every(value => Number.parseFloat(value) === 0))).toBe(true);
  expect(children.every(({ opacity }) => opacity === "1")).toBe(true);
});

test("call action is available before and after confirmation", async ({ page }) => {
  await page.goto("/?testStep=result");
  const resultCall = page.getByRole("link", { name: /直接撥打/ });
  await expect(resultCall).toBeVisible();
  await expect(resultCall).toHaveAttribute("href", "tel:0927617207");
  await expect(resultCall).toContainText("0927-617-207");

  await installDeferredSubmissionMock(page);
  await fillValidContact(page);
  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  await page.evaluate(() => window.__submissionControl.resolve({
    ok: true,
    submissionId: window.__capturedPayload.submissionId
  }));
  await expect(page.getByRole("heading", { name: "完整方向卡已確認送出" })).toBeVisible();

  const call = page.getByRole("link", { name: /直接撥打/ });
  await expect(call).toBeVisible();
  await expect(call).toHaveAttribute("href", "tel:0927617207");
  await expect(call).toContainText("0927-617-207");
});

test("every missing contact field names itself instead of silently doing nothing", async ({ page }) => {
  await page.goto("/?testStep=result");
  const submit = page.getByRole("button", { name: "免費取得完整方向卡" });

  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("請填寫怎麼稱呼您");
  await expect(page.getByLabel("怎麼稱呼您？")).toBeFocused();

  await page.getByLabel("怎麼稱呼您？").fill("王小姐");
  await page.getByLabel("手機號碼 or LINE ID").fill("0912345678");
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("我同意由小魏依這份結果與我聯繫");
  await expect(page.getByLabel("我同意由小魏依這份結果與我聯繫")).toBeFocused();
});

test("missing backend reports an honest error and keeps answers available", async ({ page }) => {
  await page.goto("/?testStep=result");
  await page.evaluate(() => window.__buyerAppTest.configureServices({ endpoint: "" }));
  await page.getByLabel("怎麼稱呼您？").fill("王小姐");
  await page.getByLabel("手機號碼 or LINE ID").fill("0912345678");
  await page.getByLabel("我同意由小魏依這份結果與我聯繫").check();
  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  await expect(page.getByRole("alert")).toContainText("尚未設定獨立後端，資料還沒有送出");
  await expect(page.getByLabel("怎麼稱呼您？")).toHaveValue("王小姐");
  await expect(page.getByRole("heading", { name: "完整方向卡已確認送出" })).toHaveCount(0);
});

test("submission locks mutable controls and confirmed success uses the immutable snapshot", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async text => { window.__copiedSummary = text; } }
    });
  });
  await page.goto("/?testStep=result");
  await installDeferredSubmissionMock(page);
  await fillValidContact(page);

  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();

  await expect(page.getByRole("button", { name: "確認資料入表中…" })).toBeDisabled();
  await expect(page.locator("#leadForm")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByLabel("怎麼稱呼您？")).toBeDisabled();
  await expect(page.getByLabel("手機號碼 or LINE ID")).toBeDisabled();
  await expect(page.getByLabel("我同意由小魏依這份結果與我聯繫")).toBeDisabled();
  await expect(page.getByRole("button", { name: "回上一步" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "回到買房方向診斷首頁" })).toHaveAttribute("aria-disabled", "true");

  await page.evaluate(() => {
    const name = document.querySelector("#name");
    name.value = "等待時竄改";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    window.__buyerAppTest.state.answers.areas = ["東區"];
    window.__buyerAppTest.handleSubmit();
  });

  await expect.poll(() => page.evaluate(() => window.__submitCalls)).toBe(1);
  await page.evaluate(() => window.__submissionControl.resolve({ ok: true, submissionId: window.__capturedPayload.submissionId }));

  await expect(page.getByRole("heading", { name: "完整方向卡已確認送出" })).toBeVisible();
  await expect(page.getByText("先以永康區為主要範圍，配合工作通勤比較實際動線。")).toBeVisible();
  await expect(page.getByText("先以東區為主要範圍，配合工作通勤比較實際動線。")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__capturedPayload)).toMatchObject({
    name: "王小姐",
    areas: ["永康區"]
  });

  await page.getByRole("button", { name: "複製需求摘要" }).click();
  await expect.poll(() => page.evaluate(() => window.__copiedSummary)).toContain("區域：永康區");
  await expect.poll(() => page.evaluate(() => window.__copiedSummary)).not.toContain("區域：東區");
});

test("confirmed result has ten keyboard-toggleable viewing checklist items", async ({ page }) => {
  await page.goto("/?testStep=result");
  await installDeferredSubmissionMock(page);
  await fillValidContact(page);
  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  await page.evaluate(() => window.__submissionControl.resolve({
    ok: true,
    submissionId: window.__capturedPayload.submissionId
  }));
  await expect(page.getByRole("heading", { name: "完整方向卡已確認送出" })).toBeVisible();

  const checklist = page.getByRole("group", { name: "看屋前，問自己這 10 題" });
  const checkboxes = checklist.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(4);
  await checklist.getByText("查看其餘 6 項（完整 10 項）").click();
  await expect(checkboxes).toHaveCount(10);

  await expect(checklist.locator('[data-relevant="true"]')).toHaveCount(4);

  const payloadBeforeToggle = await page.evaluate(() => structuredClone(window.__capturedPayload));
  const firstQuestion = checkboxes.nth(0);
  await expect(firstQuestion).not.toBeChecked();
  await firstQuestion.focus();
  await page.keyboard.press("Space");
  await expect(firstQuestion).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__submitCalls)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__capturedPayload)).toEqual(payloadBeforeToggle);
});

test("submission error unlocks controls and preserves contact answers for retry", async ({ page }) => {
  await page.goto("/?testStep=result");
  await installDeferredSubmissionMock(page);
  await fillValidContact(page);

  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  await expect(page.getByLabel("怎麼稱呼您？")).toBeDisabled();
  await page.evaluate(() => {
    const error = new Error("confirmation timeout");
    error.code = "SUBMISSION_NOT_CONFIRMED";
    window.__submissionControl.reject(error);
  });

  await expect(page.getByRole("alert")).toContainText("資料尚未確認入表");
  await expect(page.locator("#leadForm")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByLabel("怎麼稱呼您？")).toBeEnabled();
  await expect(page.getByLabel("怎麼稱呼您？")).toHaveValue("王小姐");
  await expect(page.getByLabel("手機號碼 or LINE ID")).toBeEnabled();
  await expect(page.getByLabel("手機號碼 or LINE ID")).toHaveValue("0912345678");
  await expect(page.getByRole("button", { name: "回上一步" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "重新送出並確認" })).toBeEnabled();
});

test("retry after an uncertain failure reuses the same submission id", async ({ page }) => {
  await page.goto("/?testStep=result");
  await installDeferredSubmissionMock(page);
  await fillValidContact(page);

  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  const firstSubmissionId = await page.evaluate(() => window.__capturedPayload.submissionId);
  await page.evaluate(() => {
    const error = new Error("confirmation timeout");
    error.code = "SUBMISSION_NOT_CONFIRMED";
    window.__submissionControl.reject(error);
  });
  await expect(page.getByRole("button", { name: "重新送出並確認" })).toBeEnabled();

  await page.evaluate(() => {
    window.__buyerAppTest.configureServices({
      endpoint: "https://example.test/retry-submit",
      submitLead: ({ payload }) => {
        window.__retryPayload = structuredClone(payload);
        return Promise.resolve({ ok: true, submissionId: payload.submissionId });
      }
    });
  });
  await page.getByRole("button", { name: "重新送出並確認" }).click();
  await expect(page.getByRole("heading", { name: "完整方向卡已確認送出" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__retryPayload.submissionId)).toBe(firstSubmissionId);
});

test("editing contact details after a failed attempt creates a fresh snapshot", async ({ page }) => {
  await page.goto("/?testStep=result");
  await installDeferredSubmissionMock(page);
  await fillValidContact(page);

  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  const firstSubmissionId = await page.evaluate(() => window.__capturedPayload.submissionId);
  await page.evaluate(() => {
    const error = new Error("confirmation timeout");
    error.code = "SUBMISSION_NOT_CONFIRMED";
    window.__submissionControl.reject(error);
  });
  await expect(page.getByRole("button", { name: "重新送出並確認" })).toBeEnabled();
  await page.getByLabel("手機號碼 or LINE ID").fill("0987654321");

  await page.evaluate(() => {
    window.__buyerAppTest.configureServices({
      endpoint: "https://example.test/retry-submit",
      submitLead: ({ payload }) => {
        window.__retryPayload = structuredClone(payload);
        return Promise.resolve({ ok: true, submissionId: payload.submissionId });
      }
    });
  });
  await page.getByRole("button", { name: "重新送出並確認" }).click();
  await expect(page.getByRole("heading", { name: "完整方向卡已確認送出" })).toBeVisible();
  const retryPayload = await page.evaluate(() => window.__retryPayload);
  expect(retryPayload.submissionId).not.toBe(firstSubmissionId);
  expect(retryPayload.phone).toBe("0987654321");
});

test("result preview uses revised questionnaire answers after a failed submission", async ({ page }) => {
  await page.goto("/?testStep=result");
  await installDeferredSubmissionMock(page);
  await fillValidContact(page);

  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  await page.evaluate(() => {
    const error = new Error("confirmation timeout");
    error.code = "SUBMISSION_NOT_CONFIRMED";
    window.__submissionControl.reject(error);
  });
  await expect(page.getByRole("button", { name: "重新送出並確認" })).toBeEnabled();

  await page.getByRole("button", { name: "回上一步" }).click();
  await page.getByRole("button", { name: "格局", exact: true }).click();
  await page.getByRole("button", { name: "價格", exact: true }).click();
  await page.getByRole("button", { name: "查看方向" }).click();

  const preview = page.locator(".preview-priorities");
  await expect(preview).toContainText("室外環境、通勤與生活圈實際走過了嗎？");
  await expect(preview).not.toContainText("拿掉裝潢加分後，格局仍符合每天的使用方式嗎？");
});

test("copied summary uses revised contact details after a failed submission", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async text => { window.__copiedSummary = text; } }
    });
  });
  await page.goto("/?testStep=result");
  await installDeferredSubmissionMock(page);
  await fillValidContact(page);

  await page.getByRole("button", { name: "免費取得完整方向卡" }).click();
  await page.evaluate(() => {
    const error = new Error("confirmation timeout");
    error.code = "SUBMISSION_NOT_CONFIRMED";
    window.__submissionControl.reject(error);
  });
  await expect(page.getByRole("button", { name: "重新送出並確認" })).toBeEnabled();

  await page.getByLabel("怎麼稱呼您？").fill("陳先生");
  await page.getByRole("button", { name: "複製需求摘要" }).click();
  await expect.poll(() => page.evaluate(() => window.__copiedSummary)).toContain("聯絡人：陳先生");
  await expect.poll(() => page.evaluate(() => window.__copiedSummary)).not.toContain("聯絡人：王小姐");
});

test("correcting related text fields clears field-level ARIA errors", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "開始整理" }).click();
  await page.getByRole("button", { name: "自住", exact: true }).click();
  await page.getByRole("button", { name: "3個月內", exact: true }).click();
  await page.getByRole("button", { name: "下一題" }).click();
  await page.getByRole("button", { name: "下一題" }).click();

  const areas = page.locator('[data-field-group="areas"]');
  const customArea = page.getByLabel("其他區域");
  await expect(areas).toHaveAttribute("aria-invalid", "true");
  await expect(customArea).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator('[data-field-error="areas"]')).toHaveCount(1);

  await customArea.fill("東橋");
  await expect(areas).not.toHaveAttribute("aria-invalid");
  await expect(areas).not.toHaveAttribute("aria-describedby");
  await expect(customArea).not.toHaveAttribute("aria-invalid");
  await expect(customArea).not.toHaveAttribute("aria-describedby");
  await expect(page.locator('[data-field-error="areas"]')).toHaveCount(0);
  await expect(page.locator('[data-field-group="lifeFocus"]')).toHaveAttribute("aria-invalid", "true");

  await page.goto("/?testStep=priorities");
  await page.getByRole("button", { name: /有一定避開的條件嗎/ }).click();
  await page.getByRole("button", { name: "其他", exact: true }).click();
  await page.getByRole("button", { name: "查看方向" }).click();
  const noGos = page.locator('[data-field-group="noGos"]');
  const otherNoGo = page.getByLabel("其他避開條件");
  await expect(noGos).toHaveAttribute("aria-invalid", "true");
  await expect(otherNoGo).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator('[data-field-error="otherNoGo"]')).toHaveCount(1);

  await otherNoGo.fill("不要面高架道路");
  await expect(noGos).not.toHaveAttribute("aria-invalid");
  await expect(noGos).not.toHaveAttribute("aria-describedby");
  await expect(otherNoGo).not.toHaveAttribute("aria-invalid");
  await expect(otherNoGo).not.toHaveAttribute("aria-describedby");
  await expect(page.locator('[data-field-error="otherNoGo"]')).toHaveCount(0);
});

test("focus indicator has at least 3 to 1 contrast on both card backgrounds", async ({ page }) => {
  await page.goto("/");
  const start = page.getByRole("button", { name: "開始整理" });
  await start.focus();
  const outlineColor = await start.evaluate(element => getComputedStyle(element).outlineColor);

  expect(contrastRatio(outlineColor, "rgb(255, 253, 248)")).toBeGreaterThanOrEqual(3);
  expect(contrastRatio(outlineColor, "rgb(247, 241, 230)")).toBeGreaterThanOrEqual(3);
});

test("LINE contact uses the approved add-friend link and copies the demand summary", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async text => { window.__copiedSummary = text; } }
    });
  });
  await page.goto("/?testStep=result");
  const lineHref = await page.getByRole("link", { name: "改用 LINE 聯絡" }).getAttribute("href");
  expect(lineHref).toBe("https://line.me/R/ti/p/%40tainanwei");
  await page.getByRole("button", { name: "複製需求摘要" }).click();
  await expect(page.locator("#toast")).toHaveText("需求摘要已複製");
  await expect.poll(() => page.evaluate(() => window.__copiedSummary)).toContain("台南小魏 買厝作伙");
});

test("mobile viewport has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});

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

test("mobile optional no-go choices keep long labels in one readable column", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/?testStep=priorities");
  await page.getByRole("button", { name: /有一定避開的條件嗎/ }).click();

  const noGoGrid = page.locator('[data-field-group="noGos"] .choice-grid');
  const columns = await noGoGrid.evaluate(element => getComputedStyle(element).gridTemplateColumns);
  expect(columns.split(" ").length).toBe(1);

  for (const label of ["特殊風水／路沖", "基地台或高壓電"]) {
    const metrics = await page.getByRole("button", { name: label, exact: true }).evaluate(element => ({
      height: element.getBoundingClientRect().height,
      fullyReadable: element.scrollWidth <= element.clientWidth + 1
    }));
    expect(metrics.height).toBeGreaterThanOrEqual(52);
    expect(metrics.fullyReadable).toBe(true);
  }
});

test("result refinement renders fixed headline lines and the approved status scale", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?testStep=result");

  await expect(page.locator(".result-headline-line")).toHaveText([
    "先把生活與負擔對齊；",
    "再挑真正值得看的房子。"
  ]);
  await expect(page.locator(".result-status")).toHaveCSS("font-size", "19.5px");
});

test("contact fields stay aligned on desktop and stack without mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?testStep=result");

  await expect(page.getByLabel("怎麼稱呼您？")).toHaveCount(1);
  await expect(page.getByLabel("手機號碼 or LINE ID")).toHaveCount(1);
  await expect(page.getByText("手機輸入10碼，例09XX；LINE ID 可直接輸入")).toBeVisible();

  const desktop = await page.evaluate(() => {
    const name = document.querySelector("#name").getBoundingClientRect();
    const phone = document.querySelector("#phone").getBoundingClientRect();
    return { name, phone };
  });
  expect(Math.abs(desktop.name.top - desktop.phone.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(desktop.name.height - desktop.phone.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(desktop.name.width - desktop.phone.width)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 360, height: 800 });
  const mobile = await page.evaluate(() => {
    const name = document.querySelector("#name").getBoundingClientRect();
    const phone = document.querySelector("#phone").getBoundingClientRect();
    const root = document.documentElement;
    return {
      name,
      phone,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth
    };
  });
  expect(mobile.phone.top).toBeGreaterThanOrEqual(mobile.name.bottom);
  expect(Math.abs(mobile.name.width - mobile.phone.width)).toBeLessThanOrEqual(1);
  expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.clientWidth);
});

test("reduced motion keeps the question readable without visible transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?testStep=priorities");

  const motion = await page.evaluate(() => {
    const choice = getComputedStyle(document.querySelector(".choice"));
    const card = getComputedStyle(document.querySelector(".question-card"));
    const seconds = value => Number.parseFloat(value) * (value.endsWith("ms") ? 0.001 : 1);
    return {
      mediaMatches: matchMedia("(prefers-reduced-motion: reduce)").matches,
      maximumTransitionSeconds: Math.max(...choice.transitionDuration.split(",").map(value => seconds(value.trim()))),
      animationSeconds: seconds(card.animationDuration),
      cardOpacity: card.opacity,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior
    };
  });

  expect(motion.mediaMatches).toBe(true);
  expect(motion.maximumTransitionSeconds).toBeLessThanOrEqual(0.0000001);
  expect(motion.animationSeconds).toBeLessThanOrEqual(0.0000001);
  expect(motion.cardOpacity).toBe("1");
  expect(motion.scrollBehavior).toBe("auto");
});
