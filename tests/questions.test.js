import test from "node:test";
import assert from "node:assert/strict";
import {
  QUESTION_STEPS,
  createInitialAnswers,
  getVisibleStepIds,
  clearHiddenAnswers,
  resolveAnswer,
  validateStep
} from "../src/questions.js";

test("defines exactly seven core question screens", () => {
  assert.deepEqual(QUESTION_STEPS.map(step => step.id), [
    "intent", "location", "budget", "space", "property", "priorities", "decision"
  ]);
});

test("life focus accepts multiple answers and collapses the no-fixed-place option", () => {
  const answers = createInitialAnswers();
  answers.areas = ["永康區"];
  assert.equal(validateStep("location", answers).valid, false);
  answers.lifeFocus = ["工作通勤", "日常採買"];
  assert.equal(validateStep("location", answers).valid, true);
  answers.lifeFocus = ["工作通勤", "無固定地點"];
  assert.deepEqual(clearHiddenAnswers(answers).lifeFocus, ["無固定地點"]);
});

test("custom choices require the typed value and clear when deselected", () => {
  const answers = createInitialAnswers();
  answers.downPayment = "自訂金額";
  answers.monthlyMortgage = "2～3萬";
  assert.equal(validateStep("budget", answers).errors.customDownPayment, "請輸入自備款金額");

  answers.customDownPayment = "250萬";
  assert.equal(validateStep("budget", answers).valid, true);
  assert.equal(resolveAnswer(answers, "downPayment"), "自訂：250萬");

  answers.downPayment = "300～500萬";
  const cleaned = clearHiddenAnswers(answers);
  assert.equal(cleaned.customDownPayment, "");
  assert.equal(resolveAnswer(cleaned, "downPayment"), "300～500萬");
});

test("the decision step captures move-in cost, condition and price ceiling", () => {
  const answers = createInitialAnswers();
  assert.equal(validateStep("decision", answers).valid, false);
  answers.moveInBudget = "10～30萬";
  answers.conditionTolerance = "小修可以接受";
  answers.decisionLimit = "還沒想過";
  assert.equal(validateStep("decision", answers).valid, true);
});

test("third-room use is required only for three rooms or more", () => {
  const answers = createInitialAnswers();
  answers.householdSize = "2";
  answers.rooms = "3房";
  assert.equal(validateStep("space", answers).valid, false);
  answers.thirdRoomUse = "工作／書房";
  assert.equal(validateStep("space", answers).valid, true);
  answers.rooms = "2房";
  const cleaned = clearHiddenAnswers(answers);
  assert.equal(cleaned.thirdRoomUse, "");
});

test("location requires at least one area or a custom area", () => {
  const answers = createInitialAnswers();
  answers.lifeFocus = ["工作通勤"];
  assert.equal(validateStep("location", answers).valid, false);
  answers.areas = ["永康區"];
  assert.equal(validateStep("location", answers).valid, true);
});

test("priorities limits must-haves to three and accepts no special no-go", () => {
  const answers = createInitialAnswers();
  answers.mustHaves = ["地點", "格局", "採光通風", "安靜"];
  answers.noGos = ["無特殊忌諱"];
  assert.equal(validateStep("priorities", answers).valid, false);
  answers.mustHaves = ["地點", "格局", "採光通風"];
  assert.equal(validateStep("priorities", answers).valid, true);
});

test("other no-go is an inline priorities field, not its own question screen", () => {
  const priorities = QUESTION_STEPS.find(step => step.id === "priorities");
  const otherNoGo = priorities.fields.find(field => field.key === "otherNoGo");
  const answers = createInitialAnswers();

  assert.equal(getVisibleStepIds(answers).length, 7);
  assert.equal(QUESTION_STEPS.some(step => step.id === "otherNoGo"), false);
  assert.equal(otherNoGo.when, "otherNoGo");

  answers.mustHaves = ["地點"];
  answers.noGos = ["其他"];
  assert.equal(validateStep("priorities", answers).valid, false);
  assert.equal(validateStep("priorities", answers).errors.otherNoGo, "請簡單說明其他避開條件");

  answers.otherNoGo = "不接受一樓";
  assert.equal(validateStep("priorities", answers).valid, true);

  answers.noGos = [];
  assert.equal(clearHiddenAnswers(answers).otherNoGo, "");
});
