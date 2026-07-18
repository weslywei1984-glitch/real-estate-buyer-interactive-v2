import test from "node:test";
import assert from "node:assert/strict";
import { deriveResult, VIDEO_QUESTIONS } from "../src/result.js";

const complete = {
  purpose: "自住", timeline: "3個月內", areas: ["永康區"], customArea: "",
  lifeFocus: "工作通勤", downPayment: "200～300萬", monthlyMortgage: "2～3萬",
  householdSize: "2", rooms: "3房", thirdRoomUse: "偶爾來客",
  propertyTypes: ["電梯大樓"], agePreference: "20年內", parking: "一定要平車",
  mustHaves: ["格局", "採光通風", "安靜"], noGos: ["西曬"], otherNoGo: ""
};

test("always exposes all seven video-derived questions", () => {
  assert.equal(VIDEO_QUESTIONS.length, 7);
  assert.deepEqual(VIDEO_QUESTIONS.map(item => item.ep), [1, 2, 3, 4, 5, 6, 7]);
});

test("flags unclear third-room use without judging the buyer", () => {
  const result = deriveResult(complete);
  assert.ok(["方向探索中", "條件整理中", "可以開始精準比較"].includes(result.status));
  assert.match(result.strategy.join(" "), /彈性空間|第三房/);
  assert.ok(result.videoQuestions.some(item => item.ep === 7 && item.relevant));
});

test("uses neutral readiness labels only", () => {
  const result = deriveResult({ ...complete, timeline: "先看看", areas: [] });
  assert.ok(["方向探索中", "條件整理中", "可以開始精準比較"].includes(result.status));
});

test("never emits a loan approval or guaranteed claim", () => {
  const text = JSON.stringify(deriveResult(complete));
  assert.doesNotMatch(text, /保證|核貸成功|一定買得到|穩賺/);
});
