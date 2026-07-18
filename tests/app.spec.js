import { test, expect } from "@playwright/test";

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

test("other no-go expands inline on question six without adding a seventh question", async ({ page }) => {
  await page.goto("/?testStep=priorities");
  await expect(page.getByText("第 6 題，共 6 題")).toBeVisible();
  await page.getByRole("button", { name: "其他", exact: true }).click();
  await expect(page.getByLabel("其他避開條件")).toBeVisible();
  await expect(page.getByText(/第 7 題/)).toHaveCount(0);
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
  await expect(page.getByText("第 1 題，共 6 題")).toBeVisible();
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

test("placeholder backend reports an honest error and keeps answers available", async ({ page }) => {
  await page.goto("/?testStep=result");
  await page.getByLabel("怎麼稱呼您？").fill("王小姐");
  await page.getByLabel("手機號碼").fill("0912345678");
  await page.getByLabel("我同意由小魏依這份結果與我聯繫").check();
  await page.getByRole("button", { name: "送出並查看完整方向卡" }).click();
  await expect(page.getByRole("alert")).toContainText("尚未設定獨立後端，資料還沒有送出");
  await expect(page.getByLabel("怎麼稱呼您？")).toHaveValue("王小姐");
  await expect(page.getByRole("heading", { name: "完整方向卡已確認送出" })).toHaveCount(0);
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
