import test from "node:test";
import assert from "node:assert/strict";

import * as resultImage from "../src/result-image.js";
import { deriveResult } from "../src/result.js";

const { downloadResultImage, renderResultImage } = resultImage;

function createFakeCanvas({ blob = new Blob(["png"], { type: "image/png" }) } = {}) {
  const drawn = [];
  const context = {
    drawn,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arcTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    fillRect() {},
    strokeRect() {},
    measureText(value) {
      return { width: Array.from(String(value)).length * 20 };
    },
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
  };
  return {
    width: 0,
    height: 0,
    context,
    getContext(kind) {
      assert.equal(kind, "2d");
      return context;
    },
    toBlob(callback, type) {
      assert.equal(type, "image/png");
      callback(blob);
    }
  };
}

function publicResult() {
  return {
    status: "找房方向已整理",
    headline: "先把生活與負擔對齊；\n再挑真正值得看的房子。",
    direction: [
      "這次以自住為主，先以永康區為主要範圍。",
      "物件先看電梯大樓，再用屋齡與平面車位縮小範圍。"
    ],
    budgetReminder: "目前以自備款 200～300 萬與舒服月付 2～3 萬整理方向。",
    priorityPreview: [
      { text: "總預算與可負擔範圍先確認了嗎？" },
      { text: "格局仍符合每天的使用方式嗎？" },
      { text: "通勤與生活圈實際走過了嗎？" }
    ]
  };
}

function publicAnswers() {
  return {
    purpose: "自住",
    timeline: "3個月內",
    areas: ["永康區"],
    customArea: "",
    lifeFocus: ["工作通勤"],
    downPayment: "200～300萬",
    customDownPayment: "",
    monthlyMortgage: "2～3萬",
    customMonthlyMortgage: "",
    householdSize: "2 人",
    rooms: "2房",
    customRooms: "",
    thirdRoomUse: "",
    propertyTypes: ["電梯大樓"],
    agePreference: "20年內",
    customAgePreference: "",
    parking: "一定要平車",
    mustHaves: ["格局"],
    noGos: [],
    otherNoGo: "",
    moveInBudget: "",
    conditionTolerance: "",
    decisionLimit: "",
    name: "",
    phone: "",
    consent: false
  };
}

test("image-safe answers allow only schema choices without mutating the caller", () => {
  assert.equal(typeof resultImage.createImageSafeAnswers, "function");

  const pollutedAnswers = {
    ...publicAnswers(),
    purpose: "private.line.id",
    timeline: "0911222333",
    areas: ["buyer@example.com", "永康區"],
    lifeFocus: ["王小明", "工作通勤"],
    downPayment: "secret_line",
    monthlyMortgage: "0987654321",
    householdSize: "private-household",
    rooms: "private-rooms",
    thirdRoomUse: "private-third-room",
    propertyTypes: ["private-phone-0911222333", "電梯大樓"],
    agePreference: "tainan.wei_88",
    parking: "0911-222-333",
    mustHaves: ["private-priority", "格局"],
    noGos: ["private-no-go", "頂樓"]
  };
  const originalSnapshot = structuredClone(pollutedAnswers);
  const safePollutedAnswers = resultImage.createImageSafeAnswers(pollutedAnswers);

  assert.deepEqual(
    {
      purpose: safePollutedAnswers.purpose,
      timeline: safePollutedAnswers.timeline,
      areas: safePollutedAnswers.areas,
      lifeFocus: safePollutedAnswers.lifeFocus,
      downPayment: safePollutedAnswers.downPayment,
      monthlyMortgage: safePollutedAnswers.monthlyMortgage,
      householdSize: safePollutedAnswers.householdSize,
      rooms: safePollutedAnswers.rooms,
      thirdRoomUse: safePollutedAnswers.thirdRoomUse,
      propertyTypes: safePollutedAnswers.propertyTypes,
      agePreference: safePollutedAnswers.agePreference,
      parking: safePollutedAnswers.parking,
      mustHaves: safePollutedAnswers.mustHaves,
      noGos: safePollutedAnswers.noGos
    },
    {
      purpose: "",
      timeline: "",
      areas: ["永康區"],
      lifeFocus: ["工作通勤"],
      downPayment: "",
      monthlyMortgage: "",
      householdSize: "",
      rooms: "",
      thirdRoomUse: "",
      propertyTypes: ["電梯大樓"],
      agePreference: "",
      parking: "",
      mustHaves: ["格局"],
      noGos: ["頂樓"]
    }
  );
  assert.deepEqual(pollutedAnswers, originalSnapshot);

  const legalAnswers = {
    ...publicAnswers(),
    areas: ["東區", "永康區"],
    lifeFocus: ["工作通勤", "日常採買"],
    rooms: "3房",
    thirdRoomUse: "工作／書房",
    propertyTypes: ["電梯大樓", "透天"],
    mustHaves: ["格局", "採光通風"],
    noGos: ["頂樓"]
  };
  const safeLegalAnswers = resultImage.createImageSafeAnswers(legalAnswers);

  for (const key of [
    "purpose",
    "timeline",
    "areas",
    "lifeFocus",
    "downPayment",
    "monthlyMortgage",
    "householdSize",
    "rooms",
    "thirdRoomUse",
    "propertyTypes",
    "agePreference",
    "parking",
    "mustHaves",
    "noGos"
  ]) {
    assert.deepEqual(safeLegalAnswers[key], legalAnswers[key], `legal ${key} must be preserved`);
  }
});

test("result image never draws polluted fixed-choice values", () => {
  const canvas = createFakeCanvas();
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => canvas };
  const pollutedAnswers = {
    ...publicAnswers(),
    purpose: "private.line.id",
    timeline: "0911222333",
    areas: ["buyer@example.com", "永康區"],
    lifeFocus: ["王小明", "工作通勤"],
    downPayment: "secret_line",
    monthlyMortgage: "0987654321",
    householdSize: "private-household",
    rooms: "private-rooms",
    thirdRoomUse: "private-third-room",
    propertyTypes: ["private-phone-0911222333", "電梯大樓"],
    agePreference: "tainan.wei_88",
    parking: "0911-222-333",
    mustHaves: ["private-priority", "格局"],
    noGos: ["private-no-go", "頂樓"]
  };

  try {
    renderResultImage({ answers: pollutedAnswers });
    const text = canvas.context.drawn.map(entry => entry.value).join("");

    for (const privateValue of [
      "private.line.id",
      "0911222333",
      "buyer@example.com",
      "王小明",
      "secret_line",
      "0987654321",
      "private-household",
      "private-rooms",
      "private-third-room",
      "private-phone-0911222333",
      "tainan.wei_88",
      "0911-222-333",
      "private-priority",
      "private-no-go"
    ]) {
      assert.doesNotMatch(text, new RegExp(privateValue.replaceAll(".", "\\.")));
    }
    for (const legalValue of ["永康區", "工作通勤", "電梯大樓", "格局"]) {
      assert.match(text, new RegExp(legalValue));
    }
  } finally {
    globalThis.document = previousDocument;
  }
});

test("result image renders the public diagnosis at 1080 by 1350 without buyer contact data", () => {
  const canvas = createFakeCanvas();
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => canvas };

  try {
    const rendered = renderResultImage({
      result: publicResult(),
      answers: {
        ...publicAnswers(),
        name: "測試買方林小姐",
        phone: "0911222333",
        lineId: "private.line.id"
      },
      phone: "0927-617-207"
    });
    const text = canvas.context.drawn.map(entry => entry.value).join("");

    assert.equal(rendered, canvas);
    assert.equal(canvas.width, 1080);
    assert.equal(canvas.height, 1350);
    for (const expected of [
      "台南小魏",
      "買厝作伙",
      "找房方向已整理",
      "你的找房方向，",
      "自住 · 3個月內",
      "自備款：",
      "帶著常用家具尺寸看格局",
      "先確認交屋與搬家時間",
      "先確認平面車位是否包含在總價內",
      "0927-617-207"
    ]) {
      assert.match(text, new RegExp(expected));
    }
    for (const privateValue of ["測試買方林小姐", "0911222333", "private.line.id"]) {
      assert.doesNotMatch(text, new RegExp(privateValue.replaceAll(".", "\\.")));
    }
  } finally {
    globalThis.document = previousDocument;
  }
});

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

test("result image derives only from image-safe answers and ignores malicious result strings", () => {
  const canvas = createFakeCanvas();
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => canvas };
  const privateValues = [
    "中文姓名甲",
    "王小明",
    "陳小姐",
    "林先生",
    "黃小姐",
    "張先生",
    "李小姐",
    "蔡小姐",
    "吳先生",
    "許小姐",
    "惡意狀態周小姐",
    "惡意標題周小姐",
    "惡意方向周小姐",
    "惡意預算周小姐",
    "惡意優先周小姐"
  ];
  const answers = {
    ...publicAnswers(),
    downPayment: "自訂金額",
    monthlyMortgage: "自訂",
    rooms: "自訂",
    agePreference: "自訂",
    noGos: ["其他"],
    name: "中文姓名甲",
    phone: "0911222333",
    customArea: "王小明",
    customDownPayment: "陳小姐",
    customMonthlyMortgage: "林先生",
    customRooms: "黃小姐",
    customAgePreference: "張先生",
    otherNoGo: "李小姐",
    moveInBudget: "蔡小姐",
    conditionTolerance: "吳先生",
    decisionLimit: "許小姐"
  };
  const maliciousResult = {
    status: "惡意狀態周小姐",
    headline: "惡意標題周小姐",
    direction: ["惡意方向周小姐"],
    budgetReminder: "惡意預算周小姐",
    priorityPreview: [
      { text: "惡意優先周小姐" },
      { text: "惡意優先周小姐" },
      { text: "惡意優先周小姐" }
    ]
  };

  try {
    renderResultImage({ result: maliciousResult, answers, phone: "0911222333" });
    const text = canvas.context.drawn.map(entry => entry.value).join("");

    for (const privateValue of [...privateValues, "0911222333"]) {
      assert.doesNotMatch(text, new RegExp(privateValue));
    }
    assert.match(text, /永康區/);
    assert.match(text, /自訂金額/);
    assert.match(text, /0927-617-207/);
    assert.equal(answers.customArea, "王小明");
    assert.equal(answers.name, "中文姓名甲");
  } finally {
    globalThis.document = previousDocument;
  }
});

test("result image never lets a caller override the brand phone", () => {
  const canvas = createFakeCanvas();
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => canvas };

  try {
    renderResultImage({ answers: publicAnswers(), phone: "0911222333" });
    const text = canvas.context.drawn.map(entry => entry.value).join("");
    assert.doesNotMatch(text, /0911222333/);
    assert.match(text, /0927-617-207/);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("result image excludes contact-shaped free text that entered through diagnosis answers", () => {
  const canvas = createFakeCanvas();
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => canvas };
  const answers = {
    purpose: "自住",
    timeline: "3個月內",
    areas: [],
    customArea: "0911222333 private.line.id",
    lifeFocus: ["工作通勤"],
    downPayment: "200～300萬",
    monthlyMortgage: "2～3萬",
    propertyTypes: ["電梯大樓"],
    agePreference: "20年內",
    parking: "一定要平車",
    mustHaves: ["格局"],
    noGos: [],
    moveInBudget: "請洽 0911-222-333 或 buyer@example.com",
    conditionTolerance: "",
    decisionLimit: ""
  };
  const result = deriveResult(answers);
  result.status += " lineplain ab";
  result.headline += "\nline-id line_id";
  result.priorityPreview = [
    { text: "聯絡 linename" },
    { text: "聯絡 line.name" },
    { text: "聯絡 line-name_line" }
  ];

  try {
    renderResultImage({ result, answers, phone: "0927-617-207" });
    const text = canvas.context.drawn.map(entry => entry.value).join("");

    for (const privateValue of [
      "0911222333",
      "private.line.id",
      "0911-222-333",
      "buyer@example.com",
      "lineplain",
      "ab",
      "line-id",
      "line_id",
      "linename",
      "line.name",
      "line-name_line"
    ]) {
      assert.doesNotMatch(text, new RegExp(privateValue.replaceAll(".", "\\.")));
    }
    assert.match(text, /自住 · 3個月內/);
    assert.match(text, /預算提醒/);
    assert.match(text, /0927-617-207/);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("download creates a dated PNG link and revokes its temporary object URL", async () => {
  const canvas = createFakeCanvas();
  const clicks = [];
  const links = [];
  const revoked = [];
  const documentRef = {
    createElement(tagName) {
      if (tagName === "canvas") return canvas;
      const link = {
        href: "",
        download: "",
        click() { clicks.push({ href: this.href, download: this.download }); },
        remove() {}
      };
      links.push(link);
      return link;
    },
    body: { append() {} }
  };
  const urlRef = {
    createObjectURL(blob) {
      assert.equal(blob.type, "image/png");
      return "blob:result-image";
    },
    revokeObjectURL(url) { revoked.push(url); }
  };

  const filename = await downloadResultImage({
    result: publicResult(),
    answers: { name: "絕對不可畫入圖片" },
    phone: "0927-617-207",
    documentRef,
    urlRef
  });
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.match(filename, /^台南小魏-買房方向卡-\d{8}\.png$/);
  assert.deepEqual(clicks, [{ href: "blob:result-image", download: filename }]);
  assert.equal(links.length, 1);
  assert.deepEqual(revoked, ["blob:result-image"]);
});

test("download rejects when canvas cannot create a PNG blob", async () => {
  const canvas = createFakeCanvas({ blob: null });
  const documentRef = {
    createElement(tagName) {
      if (tagName === "canvas") return canvas;
      assert.fail("download link must not be created without a PNG blob");
    },
    body: { append() {} }
  };

  await assert.rejects(
    downloadResultImage({
      result: publicResult(),
      answers: { phone: "0911222333" },
      phone: "0927-617-207",
      documentRef,
      urlRef: { createObjectURL() {}, revokeObjectURL() {} }
    }),
    /無法建立需求照片/
  );
});

test("download revokes the object URL even when the mobile link click fails", async () => {
  const canvas = createFakeCanvas();
  const revoked = [];
  const documentRef = {
    createElement(tagName) {
      if (tagName === "canvas") return canvas;
      return {
        href: "",
        download: "",
        click() { throw new Error("download blocked"); },
        remove() {}
      };
    },
    body: { append() {} }
  };
  const urlRef = {
    createObjectURL() { return "blob:blocked-download"; },
    revokeObjectURL(url) { revoked.push(url); }
  };

  await assert.rejects(
    downloadResultImage({
      result: publicResult(),
      answers: {},
      phone: "0927-617-207",
      documentRef,
      urlRef
    }),
    /download blocked/
  );
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(revoked, ["blob:blocked-download"]);
});

test("download revokes the object URL when link creation fails", async () => {
  const canvas = createFakeCanvas();
  const revoked = [];
  const documentRef = {
    createElement(tagName) {
      if (tagName === "canvas") return canvas;
      throw new Error("link creation blocked");
    },
    body: { append() {} }
  };
  const urlRef = {
    createObjectURL() { return "blob:create-failure"; },
    revokeObjectURL(url) { revoked.push(url); }
  };

  await assert.rejects(
    downloadResultImage({ result: publicResult(), answers: {}, phone: "0927-617-207", documentRef, urlRef }),
    /link creation blocked/
  );
  assert.deepEqual(revoked, ["blob:create-failure"]);
});

test("download revokes the object URL when assigning link attributes fails", async () => {
  const canvas = createFakeCanvas();
  const revoked = [];
  const documentRef = {
    createElement(tagName) {
      if (tagName === "canvas") return canvas;
      const link = { click() {}, remove() {} };
      Object.defineProperty(link, "download", {
        set() { throw new Error("attribute assignment blocked"); }
      });
      return link;
    },
    body: { append() {} }
  };
  const urlRef = {
    createObjectURL() { return "blob:attribute-failure"; },
    revokeObjectURL(url) { revoked.push(url); }
  };

  await assert.rejects(
    downloadResultImage({ result: publicResult(), answers: {}, phone: "0927-617-207", documentRef, urlRef }),
    /attribute assignment blocked/
  );
  assert.deepEqual(revoked, ["blob:attribute-failure"]);
});

test("download revokes the object URL when temporary link removal fails", async () => {
  const canvas = createFakeCanvas();
  const revoked = [];
  const documentRef = {
    createElement(tagName) {
      if (tagName === "canvas") return canvas;
      return {
        href: "",
        download: "",
        click() {},
        remove() { throw new Error("link removal blocked"); }
      };
    },
    body: { append() {} }
  };
  const urlRef = {
    createObjectURL() { return "blob:remove-failure"; },
    revokeObjectURL(url) { revoked.push(url); }
  };

  await assert.rejects(
    downloadResultImage({ result: publicResult(), answers: {}, phone: "0927-617-207", documentRef, urlRef }),
    /link removal blocked/
  );
  assert.deepEqual(revoked, ["blob:remove-failure"]);
});
