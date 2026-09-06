import { test, expect } from "@playwright/test";

const choose = (page, name) => page.getByRole("button", { name, exact: true }).click();
const next = page => choose(page, "下一步 →");
async function openContact(page) {
  if (!await page.locator("#contactDetails").getAttribute("open").then(value => value !== null)) {
    await page.locator("#contactDetails > summary").click();
  }
}
async function fillContact(page) {
  await openContact(page);
  await page.getByLabel("怎麼稱呼您？").fill("測試買方");
  await page.getByLabel("手機號碼或 LINE ID").fill("buyer_test");
  await page.getByLabel("我同意由小魏依這份結果與我聯繫").check();
}
async function mockSubmission(page) {
  await page.evaluate(() => {
    window.__calls = [];
    window.__buyerAppTest.configureServices({ endpoint: "https://example.test/submit", submitLead: ({payload}) => {
      window.__calls.push(structuredClone(payload));
      return new Promise((resolve, reject) => { window.__submissionControl = {resolve, reject}; });
    } });
  });
}
async function finishQuestions(page) {
  await page.goto("/");
  await choose(page, "找找我的買房方向");
  await choose(page, "自住"); await choose(page, "半年內"); await next(page);
  await choose(page, "東區"); await next(page);
  await choose(page, "3房"); await choose(page, "電梯大樓"); await choose(page, "一定要平車"); await next(page);
  await choose(page, "200～300萬"); await choose(page, "3～4萬"); await next(page);
  await choose(page, "格局"); await choose(page, "安靜");
  await choose(page, "看我的找房清單 ↗");
}

test("five-step journey exposes complete results before contact", async ({page}) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await finishQuestions(page);
  await expect(page.locator(".result-facts").first()).toContainText("3房");
  await expect(page.locator(".result-facts").first()).toContainText("1. 格局 → 2. 安靜");
  await expect(page.locator("[data-preview-priority]")).toHaveCount(3);
  await expect(page.locator("#contactDetails")).toHaveAttribute("open", "");
  await expect(page.getByLabel("怎麼稱呼您？")).toBeVisible();
  await expect(page.getByRole("button", {name:"儲存需求照片"})).toBeVisible();
  expect(errors).toEqual([]);
});

test("required fields are validated and keyboard navigation stays usable", async ({page}) => {
  await page.goto("/");
  await page.getByRole("button", {name:"找找我的買房方向"}).focus();
  await page.keyboard.press("Enter");
  await next(page);
  await expect(page.locator("#formError")).toBeFocused();
  await expect(page.locator("#formError")).toContainText("請選擇購屋目的");
  const purpose = page.getByRole("button", {name:"自住", exact:true});
  await purpose.focus(); await page.keyboard.press("Space");
  await expect(purpose).toHaveAttribute("aria-pressed", "true");
  await choose(page,"半年內"); await next(page); await choose(page,"上一步");
  await expect(purpose).toHaveAttribute("aria-pressed", "true");
});

test("custom location replaces undecided and optional disclosures survive choices", async ({page}) => {
  await page.goto("/?testStep=location");
  await choose(page,"還沒決定");
  await page.locator(".optional-details > summary").click();
  await page.getByLabel("其他區域").fill("東橋生活圈");
  await choose(page,"工作通勤");
  await expect(page.getByLabel("其他區域")).toHaveValue("東橋生活圈");
  await expect(page.getByRole("button", {name:"還沒決定",exact:true})).toHaveAttribute("aria-pressed","false");
  await next(page);
  await expect(page.locator("#progressText")).toContainText("03 / 05");
});

test("third-room details are optional and stale answers clear after changing rooms", async ({page}) => {
  await page.goto("/?testStep=property");
  await choose(page,"3房");
  await page.locator(".optional-details > summary").click();
  await choose(page,"工作／書房");
  await choose(page,"2房");
  await expect(page.getByText("第三房想拿來做什麼？")).toBeHidden();
  expect(await page.evaluate(() => window.__buyerAppTest.state.answers.thirdRoomUse)).toBe("");
});

test("priority ranking is bounded and exclusions survive a result round trip", async ({page}) => {
  await page.goto("/?testStep=priorities");
  await choose(page,"安靜"); await choose(page,"價格"); await choose(page,"地點");
  await expect(page.locator('[data-field="mustHaves"][aria-pressed="true"]')).toHaveCount(3);
  await expect(page.getByRole("status").last()).toContainText("已選滿 3 個");
  await page.getByRole("button",{name:/有一定避開的條件嗎/}).click();
  await choose(page,"其他"); await page.getByLabel("其他避開條件").fill("不要一樓");
  await choose(page,"看我的找房清單 ↗");
  await expect(page.locator(".result-facts").first()).toContainText("不要一樓");
  await choose(page,"修改優先順序");
  await choose(page,"安靜"); await choose(page,"更新方向卡");
  await expect(page.locator(".result-facts").first()).toContainText("1. 格局 → 2. 價格");
});

test("uncertain budgets produce a concrete first action and can be edited directly", async ({page}) => {
  await page.goto("/?testStep=result");
  await choose(page,"修改舒服預算");
  await choose(page,"還不確定"); await choose(page,"希望小魏協助試算");
  await choose(page,"更新方向卡");
  await expect(page.locator(".result-status")).toHaveText("先釐清預算");
  await expect(page.locator("[data-preview-priority]").first()).toContainText("自備款與舒服月付");
  await expect(page.locator("#leadJump")).toContainText("請小魏幫我釐清預算");
  await expect(page.locator("#submitButton")).toHaveText("請小魏幫我釐清預算");
  await page.locator("#contactDetails > summary").click();
  await page.locator("#leadJump").click();
  await expect(page.locator("#name")).toBeFocused();
  await expect(page.locator("#consent")).not.toBeChecked();
});

test("progress stays honest when going back or changing custom text", async ({page}) => {
  await page.goto("/"); await choose(page, "找找我的買房方向");
  const progress = page.getByRole("progressbar");
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await choose(page, "自住");
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await choose(page, "半年內");
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await expect(page.locator("#stepFeedback")).toContainText("自住 · 半年內");
  await next(page); await choose(page, "上一步");
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await next(page); await choose(page, "還沒決定");
  await page.locator(".optional-details > summary").click();
  await page.getByLabel("其他區域").fill("東橋生活圈");
  await expect(page.locator("#stepFeedback")).toContainText("東橋生活圈");
  await expect(progress).toHaveAttribute("aria-valuenow", "2");
  await page.getByLabel("其他區域").fill("");
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await expect(page.locator("#stepFeedback")).not.toContainText("已記下");
});

test("personalized invitation follows area and purpose edits and safely displays custom text", async ({page}) => {
  await page.goto("/?testStep=result");
  await choose(page, "修改生活圈"); await choose(page, "還沒決定"); await choose(page, "更新方向卡");
  await expect(page.locator("#submitButton")).toHaveText("請小魏幫我縮小生活圈");
  await choose(page, "修改生活圈");
  await page.locator(".optional-details > summary").click();
  await page.getByLabel("其他區域").fill("東橋 <em>生活圈</em>");
  await choose(page, "更新方向卡");
  await expect(page.locator(".contact-intro")).toContainText("東橋 <em>生活圈</em>");
  await expect(page.locator(".contact-intro em")).toHaveCount(0);
  await page.locator(".result-details > summary").click();
  await choose(page, "修改買房計畫"); await choose(page, "先了解行情"); await choose(page, "更新方向卡");
  await expect(page.locator("#submitButton")).toHaveText("請小魏和我聊聊找房方向");
});

test("contact validation names missing fields and requires consent", async ({page}) => {
  await page.goto("/?testStep=result"); await openContact(page);
  await choose(page,"請小魏幫我找房"); await expect(page.locator("#name")).toBeFocused();
  await page.getByLabel("怎麼稱呼您？").fill("測試");
  await choose(page,"請小魏幫我找房"); await expect(page.locator("#phone")).toBeFocused();
  await page.getByLabel("手機號碼或 LINE ID").fill("buyer_test");
  await choose(page,"請小魏幫我找房"); await expect(page.locator("#consent")).toBeFocused();
});

test("submission locks edits, sends once, and only confirmed success is shown", async ({page}) => {
  await page.goto("/?testStep=result"); await mockSubmission(page); await fillContact(page);
  await choose(page,"請小魏幫我找房");
  await expect(page.locator("#submitButton")).toBeDisabled();
  await expect(page.getByRole("button",{name:"修改生活圈"})).toBeDisabled();
  await expect(page.locator(".complete-card")).toHaveCount(0);
  await page.evaluate(() => window.__submissionControl.resolve({ok:true}));
  await expect(page.locator(".complete-card")).toContainText("清單已送出");
  await expect(page.locator(".edit-fact").first()).toBeHidden();
  expect(await page.evaluate(() => window.__calls.length)).toBe(1);
});

test("uncertain retries preserve submission ids; edited answers generate new snapshots", async ({page}) => {
  await page.goto("/?testStep=result"); await mockSubmission(page); await fillContact(page);
  await choose(page,"請小魏幫我找房");
  await page.evaluate(() => window.__submissionControl.reject(Object.assign(new Error("test"),{code:"SUBMISSION_NOT_CONFIRMED"})));
  await expect(page.locator("#submitError")).toContainText("尚未確認");
  await choose(page,"重新送出並確認");
  expect(await page.evaluate(() => window.__calls[0].submissionId === window.__calls[1].submissionId)).toBe(true);
  await page.evaluate(() => window.__submissionControl.reject(new Error("test")));
  await expect(page.locator("#submitError")).toContainText("目前無法送出");
  await page.getByLabel("怎麼稱呼您？").fill("測試二");
  await choose(page,"重新送出並確認");
  expect(await page.evaluate(() => window.__calls[1].submissionId !== window.__calls[2].submissionId)).toBe(true);
});

test("PNG is downloadable without contact data", async ({page}) => {
  await page.goto("/?testStep=result");
  const pending = page.waitForEvent("download"); await choose(page,"儲存需求照片");
  const download = await pending;
  const chunks = []; for await (const part of await download.createReadStream()) chunks.push(part);
  const bytes = Buffer.concat(chunks);
  expect(bytes.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.readUInt32BE(16)).toBe(1080); expect(bytes.readUInt32BE(20)).toBe(1350);
});

test("mobile width, large tap targets, and reduced motion remain usable", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  for (const path of ["/", "/?testStep=property", "/?testStep=priorities", "/?testStep=result"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.locator(".result-card").first()).toBeVisible();
  await expect(page.locator('a[href="https://line.me/R/ti/p/%40tainanwei"]')).toBeVisible();
});

test("a collapsed optional custom field opens when it needs correction", async ({page}) => {
  await page.goto("/?testStep=property");
  await page.locator(".optional-details > summary").click();
  await page.getByRole("group",{name:"屋齡接受度"}).getByRole("button",{name:"自訂",exact:true}).click();
  await page.locator(".optional-details > summary").click();
  await next(page);
  await expect(page.getByLabel("可接受的屋齡")).toBeVisible();
  await expect(page.locator("#formError")).toContainText("請輸入可接受的屋齡");
});
