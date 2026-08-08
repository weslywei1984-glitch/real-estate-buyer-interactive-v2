import test from "node:test";
import assert from "node:assert/strict";

import { downloadResultImage, renderResultImage } from "../src/result-image.js";

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
