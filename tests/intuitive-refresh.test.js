import test from "node:test";
import assert from "node:assert/strict";
import { deriveResult } from "../src/result.js";
import { QUESTION_STEPS, clearHiddenAnswers, validateStep, createInitialAnswers } from "../src/questions.js";
import { buildSummary } from "../src/payload.js";

const complete = () => ({ ...createInitialAnswers(), purpose: "自住", timeline: "半年內",
  areas: ["永康區"], downPayment: "200～300萬", monthlyMortgage: "2～3萬",
  rooms: "3房", propertyTypes: ["電梯大樓"], parking: "一定要平車",
  mustHaves: ["格局", "採光通風"], noGos: ["西曬"] });

test("five screens can be completed without optional personal details", () => {
  assert.deepEqual(QUESTION_STEPS.map(step => step.id), ["intent", "location", "budget", "property", "priorities"]);
  for (const step of QUESTION_STEPS) assert.equal(validateStep(step.id, complete()).valid, true, step.id);
});

test("undecided area clears contradictory locations without inventing a preference", () => {
  const answers = { ...complete(), areas: ["東區", "還沒決定"], customArea: "東橋" };
  const cleaned = clearHiddenAnswers(answers);
  assert.deepEqual(cleaned.areas, ["還沒決定"]);
  assert.equal(cleaned.customArea, "");
});

test("current answers produce an actionable result without removed decision questions", () => {
  const result = deriveResult(complete());
  assert.equal(result.status, "找房方向已整理");
  assert.equal(result.priorityPreview.length, 3);
  assert.equal(new Set(result.priorityPreview.map(item => item.text)).size, 3);
  assert.ok(result.strategy.length <= 3);
});

test("unknown budget is a concrete next step, never counted as ready", () => {
  const result = deriveResult({ ...complete(), downPayment: "還不確定", monthlyMortgage: "希望小魏協助試算" });
  assert.equal(result.status, "先釐清預算");
  assert.match(result.priorityPreview[0].text, /自備款|月付/);
});

test("an undecided location is shown honestly and prioritized", () => {
  const result = deriveResult({ ...complete(), areas: ["還沒決定"] });
  assert.equal(result.status, "先縮小生活圈");
  assert.match(result.priorityPreview[0].text, /生活圈/);
  assert.doesNotMatch(result.direction.join(""), /以還沒決定/);
});

test("result and contact summary retain rooms and exclusions", () => {
  const answers = { ...complete(), rooms: "自訂", customRooms: "2房加工作室", noGos: ["其他", "西曬"], otherNoGo: "不要一樓" };
  const result = deriveResult(answers);
  assert.match(result.direction.join(""), /2房加工作室/);
  assert.match(JSON.stringify(result.facts), /不要一樓/);
  assert.match(buildSummary({answers, result}), /不要一樓/);
  assert.match(buildSummary({answers, result}), /西曬/);
});

test("first priority changes the primary viewing action", () => {
  const first = deriveResult({ ...complete(), mustHaves: ["格局", "安靜"] });
  const second = deriveResult({ ...complete(), mustHaves: ["安靜", "格局"] });
  assert.match(first.priorityPreview[0].text, /格局|家具/);
  assert.match(second.priorityPreview[0].text, /聲音|噪音|晚上/);
});

test("urgent presale buyer receives a delivery timing check", () => {
  const result = deriveResult({ ...complete(), timeline: "1個月內", agePreference: "預售屋" });
  assert.match(result.priorityPreview[0].text, /交屋|入住/);
});

test("empty optional data is not represented as no preference or invented income", () => {
  const result = deriveResult(complete());
  assert.match(JSON.stringify(result.facts), /未填/);
  assert.doesNotMatch(JSON.stringify(result), /保證|核貸成功|一定買得到|穩賺|年薪/);
  assert.match(result.budgetReminder, /銀行/);
  assert.match(result.budgetReminder, /修繕|生活預備金/);
});
