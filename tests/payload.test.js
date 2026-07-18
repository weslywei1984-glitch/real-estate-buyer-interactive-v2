import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPayload,
  buildSummary,
  isTaiwanMobile,
  normalizePhone
} from "../src/payload.js";

const answers = {
  name: "  王小明  ",
  phone: "0912-345-678",
  purpose: "首購",
  timeline: "三個月內",
  areas: ["東區"],
  customArea: "北區",
  lifeFocus: "通勤",
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
  consent: true
};

const result = {
  status: "可開始找房",
  direction: ["先鎖定東區與北區"],
  budgetReminder: "以每月可負擔金額為準",
  strategy: ["先安排生活圈帶看"],
  videoQuestions: []
};

test("normalizes a Taiwan mobile number", () => {
  assert.equal(normalizePhone("0912-345-678"), "0912345678");
  assert.equal(isTaiwanMobile("0912 345 678"), true);
  assert.equal(isTaiwanMobile("0212345678"), false);
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
  assert.equal("ip" in payload, false);
  assert.equal("fingerprint" in payload, false);
});

test("builds a readable summary from buyer answers and diagnosis", () => {
  const summary = buildSummary({ answers, result });

  assert.match(summary, /王小明/);
  assert.match(summary, /東區、北區/);
  assert.match(summary, /可開始找房/);
  assert.match(summary, /先安排生活圈帶看/);
  assert.match(summary, /台南小魏 買厝作伙｜魏泉承｜0927-617-207/);
});
