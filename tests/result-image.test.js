import test from "node:test";
import assert from "node:assert/strict";

import { downloadResultImage, renderResultImage } from "../src/result-image.js";
import { deriveResult } from "../src/result.js";

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
      drawn.push({ value: String(value), x, y, font: this.font });
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
    status: "條件整理中",
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

test("result image renders the public diagnosis at 1080 by 1350 without buyer contact data", () => {
  const canvas = createFakeCanvas();
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => canvas };

  try {
    const rendered = renderResultImage({
      result: publicResult(),
      answers: {
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
      "條件整理中",
      "先把生活與負擔對齊；",
      "這次以自住為主",
      "目前以自備款",
      "總預算與可負擔範圍",
      "格局仍符合每天的使用方式",
      "通勤與生活圈實際走過了嗎",
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

test("result image redacts contact-shaped free text that entered through diagnosis answers", () => {
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
    assert.match(text, /這次以自住為主/);
    assert.match(text, /預算提醒/);
    assert.match(text, /聯絡資訊已隱藏/);
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
