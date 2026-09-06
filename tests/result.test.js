import test from "node:test";
import assert from "node:assert/strict";
import { deriveResult } from "../src/result.js";
import { createInitialAnswers } from "../src/questions.js";

test("empty answers produce three useful actions without a score or invented budget", () => {
  const result = deriveResult(createInitialAnswers());
  assert.equal(result.priorityPreview.length, 3);
  assert.equal(result.status, "先釐清預算");
  assert.match(result.direction.join(""), /生活圈待確認/);
  assert.doesNotMatch(JSON.stringify(result), /保證|核貸成功|穩賺/);
});

test("custom assistance requests stay explicitly uncertain", () => {
  const result = deriveResult({ ...createInitialAnswers(), downPayment: "自訂金額", customDownPayment: "還在抓",
    monthlyMortgage: "自訂", customMonthlyMortgage: "請協助試算", areas: ["永康區"] });
  assert.equal(result.status, "先釐清預算");
  assert.match(result.budgetReminder, /還在抓/);
});

test("results are deterministic and do not mutate the original answers", () => {
  const answers = { ...createInitialAnswers(), mustHaves: ["管理", "安靜"] };
  const before = structuredClone(answers);
  assert.deepEqual(deriveResult(answers), deriveResult(answers));
  assert.deepEqual(answers, before);
});
