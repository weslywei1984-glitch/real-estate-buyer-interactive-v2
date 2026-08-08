import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPayload,
  buildSummary
} from "../src/payload.js";
import {
  isLineId,
  isTaiwanMobile,
  isValidContact,
  normalizeContact
} from "../src/contact.js";

const answers = {
  name: "  王小明  ",
  phone: "0912-345-678",
  purpose: "首購",
  timeline: "三個月內",
  areas: ["東區"],
  customArea: "北區",
  lifeFocus: ["通勤"],
  downPayment: "200萬以上",
  monthlyMortgage: "2萬以下",
  householdSize: "2人",
  rooms: "3房",
  thirdRoomUse: "書房",
  propertyTypes: ["大樓"],
  agePreference: "20年內",
  parking: "需要車位",
  mustHaves: ["電梯"],
  noGos: ["無管理"],
  otherNoGo: "不要頂樓",
  moveInBudget: "",
  conditionTolerance: "",
  decisionLimit: "",
  consent: true
};

const result = {
  status: "可開始找房",
  direction: ["先鎖定東區與北區"],
  budgetReminder: "以每月可負擔金額為準",
  strategy: ["先安排生活圈帶看"],
  videoQuestions: []
};

test("normalizes and validates phone numbers or LINE IDs", () => {
  assert.equal(normalizeContact("0912-345-678"), "0912345678");
  assert.equal(normalizeContact("Tainan.Wei_88"), "tainan.wei_88");
  assert.equal(isTaiwanMobile("0912 345 678"), true);
  assert.equal(isTaiwanMobile("0212345678"), false);
  assert.equal(isLineId("tainan.wei_88"), true);
  assert.equal(isLineId("0912345678"), false);
  assert.equal(isValidContact("0912 345 678"), true);
  assert.equal(isValidContact("tainan.wei_88"), true);
  assert.equal(isValidContact("0912"), false);
  assert.equal(isValidContact("bad id"), false);
});

test("builds the versioned backend contract", () => {
  const payload = buildPayload({
    answers,
    result,
    submissionId: "sub-123",
    submittedAt: "2026-07-18T00:00:00.000Z"
  });

  assert.equal(payload.sourceVersion, "buyer-diagnosis-c-v2");
  assert.equal(payload.phone, "0912345678");
  assert.equal(payload.submissionId, "sub-123");
  assert.equal(payload.name, "王小明");
  assert.deepEqual(payload.areas, ["東區", "北區"]);
  assert.deepEqual(payload.strategy, result.strategy);
  assert.equal(payload.consent, true);
  assert.equal(payload.moveInBudget, "");
  assert.equal(payload.conditionTolerance, "");
  assert.equal(payload.decisionLimit, "");
  assert.equal("ip" in payload, false);
  assert.equal("fingerprint" in payload, false);
});

test("builds the existing phone payload field from a normalized LINE ID", () => {
  const payload = buildPayload({
    answers: { ...answers, phone: "Tainan.Wei_88" },
    result,
    submissionId: "sub-123"
  });

  assert.equal(payload.phone, "tainan.wei_88");
});

test("builds a readable summary from buyer answers and diagnosis", () => {
  const summary = buildSummary({ answers, result });

  assert.doesNotMatch(summary, /入住整理預算|中古屋屋況接受度|出價心理底線/);

  assert.match(summary, /王小明/);
  assert.match(summary, /東區、北區/);
  assert.match(summary, /可開始找房/);
  assert.match(summary, /先安排生活圈帶看/);
  assert.match(summary, /台南小魏 買厝作伙｜魏泉承｜0927-617-207/);
});

test("does not label an unanswered optional legacy field as missing", () => {
  const summary = buildSummary({
    answers: { ...answers, moveInBudget: "10～30萬" },
    result
  });

  assert.match(summary, /入住整理預算：10～30萬/);
  assert.doesNotMatch(summary, /屋況接受度：未填|出價心理底線：未填/);
});
