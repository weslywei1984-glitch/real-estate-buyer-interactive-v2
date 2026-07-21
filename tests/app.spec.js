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
  await page.getByLabel("手機號碼").fill("0912345678");
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
  await page.getByRole("button", { name: "下一題" }).click();

  await page.getByRole("button", { name: "10～30萬", exact: true }).click();
  await page.getByRole("button", { name: "小修可以接受", exact: true }).click();
  await page.getByRole("button", { name: "已有明確上限，不會超過", exact: true }).click();
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

test("completes the six-screen path and reveals the result/contact page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "找到適合生活的房子，從問對問題開始。" })).toBeVisible();
  await page.getByRole("button", { name: "開始整理" }).click();
  await page.getByRole("button", { name: "自住", exact: true }).click();
  await page.getByRole("button", { name: "3個月內", exact: true }).click();
  await page.getByRole("button", { name: "下一題" }).click();
  await expect(page.getByText("第 2 題，共 7 題")).toBeVisible();
  await expect(page.getByRole("heading", { name: "每天的生活，主要會落在哪裡？" })).toBeFocused();

  await completeQuestionnaire(page);
  await expect(page.getByRole("heading", { name: /可以開始精準比較/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "把完整方向卡整理給您" })).toBeVisible();
  await expect(page.getByRole("button", { name: "送出並查看完整方向卡" })).toBeVisible();
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
  await expect(page.getByText("第 6 題，共 7 題")).toBeVisible();
  await page.getByRole("button", { name: "其他", exact: true }).click();
  await expect(page.getByLabel("其他避開條件")).toBeVisible();
  await expect(page.getByText("第 6 題，共 7 題")).toBeVisible();
  await page.getByRole("button", { name: "無特殊忌諱", exact: true }).click();
  await expect(page.getByLabel("其他避開條件")).toBeHidden();
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
  await expect(page.getByText("第 1 題，共 7 題")).toBeVisible();
  await expect(page.getByRole("button", { name: "自住", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "3個月內", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("invalid phone cannot submit and exposes field guidance", async ({ page }) => {
  await page.goto("/?testStep=result");
  await page.getByLabel("怎麼稱呼您？").fill("王小姐");
  await page.getByLabel("手機號碼").fill("1234");
  await page.getByLabel("我同意由小魏依這份結果與我聯繫").check();
  await expect(page.getByText("請輸入 09 開頭的 10 碼手機號碼")).toBeVisible();
  await expect(page.getByLabel("手機號碼")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: "送出並查看完整方向卡" })).toBeDisabled();
});

test("missing backend reports an honest error and keeps answers available", async ({ page }) => {
  await page.goto("/?testStep=result");
  await page.evaluate(() => window.__buyerAppTest.configureServices({ endpoint: "" }));
  await page.getByLabel("怎麼稱呼您？").fill("王小姐");
  await page.getByLabel("手機號碼").fill("0912345678");
  await page.getByLabel("我同意由小魏依這份結果與我聯繫").check();
  await page.getByRole("button", { name: "送出並查看完整方向卡" }).click();
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

  await page.getByRole("button", { name: "送出並查看完整方向卡" }).click();

  await expect(page.getByRole("button", { name: "確認資料入表中…" })).toBeDisabled();
  await expect(page.locator("#leadForm")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByLabel("怎麼稱呼您？")).toBeDisabled();
  await expect(page.getByLabel("手機號碼")).toBeDisabled();
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
  await page.getByRole("button", { name: "送出並查看完整方向卡" }).click();
  await page.evaluate(() => window.__submissionControl.resolve({
    ok: true,
    submissionId: window.__capturedPayload.submissionId
  }));
  await expect(page.getByRole("heading", { name: "完整方向卡已確認送出" })).toBeVisible();

  const checklist = page.getByRole("group", { name: "看屋前，問自己這 10 題" });
  const checkboxes = checklist.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(10);

  const relevantCount = await checklist.locator('[data-relevant="true"]').count();
  expect(relevantCount).toBeGreaterThanOrEqual(3);
  expect(relevantCount).toBeLessThanOrEqual(5);

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

  await page.getByRole("button", { name: "送出並查看完整方向卡" }).click();
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
  await expect(page.getByLabel("手機號碼")).toBeEnabled();
  await expect(page.getByLabel("手機號碼")).toHaveValue("0912345678");
  await expect(page.getByRole("button", { name: "回上一步" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "重新送出並確認" })).toBeEnabled();
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
  await page.getByRole("button", { name: "其他", exact: true }).click();
  await page.getByRole("button", { name: "下一題" }).click();
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

test("copies the demand summary and exposes the real LINE contact", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async text => { window.__copiedSummary = text; } }
    });
  });
  await page.goto("/?testStep=result");
  await expect(page.getByRole("link", { name: "改用 LINE 聯絡" })).toHaveAttribute("href", "https://line.me/R/ti/p/%40tainanwei");
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
