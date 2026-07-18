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

test("covers the required viewing themes in every episode", () => {
  const questionByEp = Object.fromEntries(VIDEO_QUESTIONS.map(item => [item.ep, item.text]));

  assert.match(questionByEp[1], /看屋前/);
  assert.match(questionByEp[1], /總預算/);
  assert.match(questionByEp[1], /可負擔範圍/);
  assert.match(questionByEp[2], /裝潢/);
  assert.match(questionByEp[2], /格局/);
  assert.match(questionByEp[3], /室外環境/);
  assert.match(questionByEp[3], /通勤/);
  assert.match(questionByEp[3], /生活圈/);
  assert.match(questionByEp[4], /價格/);
  assert.match(questionByEp[4], /必要條件/);
  assert.match(questionByEp[5], /完整成本/);
  assert.match(questionByEp[5], /生活緩衝|生活預備金/);
  assert.match(questionByEp[6], /白天/);
  assert.match(questionByEp[6], /晚上/);
  assert.match(questionByEp[6], /周邊環境/);
  assert.match(questionByEp[7], /第三房/);
  assert.match(questionByEp[7], /準備拿來做什麼/);
});

test("flags unclear third-room use without judging the buyer", () => {
  const result = deriveResult(complete);
  assert.ok(["方向探索中", "條件整理中", "可以開始精準比較"].includes(result.status));
  assert.match(result.strategy.join(" "), /彈性空間|第三房/);
  assert.ok(result.videoQuestions.some(item => item.ep === 7 && item.relevant));
});

test("selects only three to five relevant viewing questions for every result", () => {
  const branches = [
    complete,
    {
      ...complete,
      timeline: "先看看",
      downPayment: "還不確定",
      monthlyMortgage: "希望小魏協助試算",
      rooms: "2房",
      thirdRoomUse: "",
      lifeFocus: "無固定地點",
      mustHaves: ["價格"]
    },
    {
      ...complete,
      timeline: "1個月內",
      rooms: "2房",
      thirdRoomUse: "",
      mustHaves: ["格局"]
    }
  ];

  for (const answers of branches) {
    const relevantCount = deriveResult(answers).videoQuestions.filter(item => item.relevant).length;
    assert.ok(relevantCount >= 3 && relevantCount <= 5, `relevant count was ${relevantCount}`);
  }
});

test("changes relevant episodes deterministically for different buyer needs", () => {
  const unclearRoom = deriveResult(complete).videoQuestions.filter(item => item.relevant).map(item => item.ep);
  const unclearBudget = deriveResult({
    ...complete,
    timeline: "先看看",
    downPayment: "還不確定",
    monthlyMortgage: "希望小魏協助試算",
    rooms: "2房",
    thirdRoomUse: "",
    lifeFocus: "無固定地點",
    mustHaves: ["價格"]
  }).videoQuestions.filter(item => item.relevant).map(item => item.ep);
  const nearTerm = deriveResult({
    ...complete,
    timeline: "1個月內",
    rooms: "2房",
    thirdRoomUse: "",
    mustHaves: ["格局"]
  }).videoQuestions.filter(item => item.relevant).map(item => item.ep);

  assert.ok(unclearRoom.includes(7), "unclear third-room use should prioritize EP7");
  assert.ok(unclearRoom.includes(3), "commute/life-circle answers should prioritize EP3");
  assert.ok(unclearRoom.includes(6), "quiet/parking answers should prioritize EP6");
  assert.ok(unclearBudget.includes(1), "unclear budget should prioritize EP1");
  assert.ok(unclearBudget.includes(5), "unclear budget should prioritize EP5");
  assert.ok(nearTerm.includes(4), "near-term buying should prioritize EP4");
  assert.notDeepEqual(unclearRoom, unclearBudget);
  assert.notDeepEqual(unclearBudget, nearTerm);
});

test("includes purchase purpose and timing in the direction summary", () => {
  const result = deriveResult({ ...complete, purpose: "換屋", timeline: "1個月內" });
  const direction = result.direction.join(" ");

  assert.match(direction, /換屋/);
  assert.match(direction, /1個月內/);
});

test("keeps living buffer and repair or holding costs in the budget reminder", () => {
  const reminder = deriveResult(complete).budgetReminder;

  assert.match(reminder, /生活.*餘裕|生活預備金|生活緩衝/);
  assert.match(reminder, /修繕|持有成本|管理費/);
});

test("uses neutral readiness labels only", () => {
  const result = deriveResult({ ...complete, timeline: "先看看", areas: [] });
  assert.ok(["方向探索中", "條件整理中", "可以開始精準比較"].includes(result.status));
});

test("never emits a loan approval or guaranteed claim", () => {
  const text = JSON.stringify(deriveResult(complete));
  assert.doesNotMatch(text, /保證|核貸成功|一定買得到|穩賺/);
});
