import test from "node:test";
import assert from "node:assert/strict";
import {
  QUESTION_STEPS,
  createInitialAnswers,
  getVisibleStepIds,
  clearHiddenAnswers,
  validateStep
} from "../src/questions.js";

test("defines exactly six core question screens", () => {
  assert.deepEqual(QUESTION_STEPS.map(step => step.id), [
    "intent", "location", "budget", "space", "property", "priorities"
  ]);
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
  answers.lifeFocus = "工作通勤";
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

test("other no-go is an inline priorities field, not a seventh question screen", () => {
  const priorities = QUESTION_STEPS.find(step => step.id === "priorities");
  const otherNoGo = priorities.fields.find(field => field.key === "otherNoGo");
  const answers = createInitialAnswers();

  assert.equal(getVisibleStepIds(answers).length, 6);
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
