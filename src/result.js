import { resolveAnswer } from "./questions.js";

export const VIDEO_QUESTIONS = [
  { ep: 1, text: "看屋前，總預算與可負擔範圍先確認了嗎？" },
  { ep: 2, text: "拿掉裝潢加分後，格局仍符合每天的使用方式嗎？" },
  { ep: 3, text: "室外環境、通勤與生活圈實際走過了嗎？" },
  { ep: 4, text: "第一眼心動後，價格與必要條件也確認了嗎？" },
  { ep: 5, text: "購屋完整成本與生活預備金（生活緩衝）都保留了嗎？" },
  { ep: 6, text: "白天與晚上都看過周邊環境嗎？" },
  { ep: 7, text: "第三房準備拿來做什麼？" },
  { ep: 8, text: "中古屋除了裝潢，窗邊、牆角、浴室、陽台的屋況也看過了嗎？" },
  { ep: 9, text: "出價前，必要條件、整理費用與沒買到的心理底線都想過了嗎？" },
  { ep: 10, text: "需求範圍與物件資訊，有專人陪你一起確認與縮小嗎？" }
];

const LIFE_FOCUS_MOVEMENT = ["工作通勤", "學校接送", "家人照顧", "日常採買"];

function lifeFocusList(answers) {
  return Array.isArray(answers.lifeFocus)
    ? answers.lifeFocus
    : [answers.lifeFocus].filter(Boolean);
}

function readinessScore(answers) {
  let score = 0;
  if (answers.timeline && answers.timeline !== "先看看") score += 2;
  if (answers.areas?.length || answers.customArea) score += 2;
  if (answers.downPayment) score += 1;
  if (answers.monthlyMortgage) score += 1;
  if (answers.propertyTypes?.length) score += 1;
  if (answers.mustHaves?.length) score += 1;
  if (answers.moveInBudget && answers.moveInBudget !== "還沒估過") score += 1;
  if (answers.decisionLimit === "已有明確上限，不會超過") score += 1;
  return score;
}

function relevantVideoEpisodes(answers) {
  const scores = new Map(VIDEO_QUESTIONS.map(item => [item.ep, 0]));
  const add = (ep, points) => scores.set(ep, scores.get(ep) + points);
  const mustHaves = answers.mustHaves || [];
  const noGos = answers.noGos || [];
  const focus = lifeFocusList(answers);
  const budgetUnclear = answers.moveInBudget === "還沒估過"
    || answers.decisionLimit === "希望小魏幫我抓"
    || answers.decisionLimit === "還沒想過";

  if (budgetUnclear) add(1, 4);
  if (answers.downPayment) add(1, 1);

  if (mustHaves.some(item => ["格局", "採光通風", "屋況"].includes(item))) add(2, 4);

  if (answers.areas?.length || answers.customArea) add(3, 2);
  if (focus.some(item => LIFE_FOCUS_MOVEMENT.includes(item))) add(3, 4);

  if (["1個月內", "3個月內"].includes(answers.timeline)) add(4, 6);
  if (answers.timeline === "半年內") add(4, 2);

  add(5, 1);
  if (answers.moveInBudget === "還沒估過") add(5, 5);
  if (answers.moveInBudget === "50萬以上") add(5, 2);
  if (budgetUnclear) add(5, 2);

  if (answers.parking && answers.parking !== "不需要") add(6, 2);
  if (mustHaves.some(item => ["安靜", "停車", "生活機能"].includes(item))) add(6, 4);
  if (noGos.some(item => ["西曬", "頂樓", "基地台或高壓電"].includes(item))) add(6, 2);

  if (answers.rooms === "3房" || answers.rooms === "3房以上") {
    add(7, ["偶爾來客", "還沒想好", ""].includes(answers.thirdRoomUse || "") ? 8 : 4);
  }

  if (answers.conditionTolerance === "願意重新整理") add(8, 5);
  if (answers.conditionTolerance === "看價格再決定") add(8, 4);
  if (answers.conditionTolerance === "要能直接入住") add(8, 2);
  if (["20年內", "30年內"].includes(answers.agePreference)) add(8, 2);
  if (answers.agePreference === "自訂") add(8, 1);
  if (mustHaves.includes("屋況")) add(8, 2);

  if (answers.decisionLimit === "還沒想過") add(9, 7);
  if (answers.decisionLimit === "希望小魏幫我抓") add(9, 5);
  if (answers.decisionLimit === "可以再彈性一點") add(9, 3);
  if (["1個月內", "3個月內"].includes(answers.timeline)) add(9, 2);

  if (answers.timeline === "先看看") add(10, 4);
  if (answers.purpose === "先了解行情") add(10, 3);
  if ((answers.areas?.length || 0) >= 4) add(10, 2);
  if (!mustHaves.length) add(10, 2);

  return [...scores.entries()]
    .sort(([firstEp, firstScore], [secondEp, secondScore]) => secondScore - firstScore || firstEp - secondEp)
    .slice(0, 4)
    .map(([ep]) => ep);
}

export function deriveResult(answers) {
  const score = readinessScore(answers);
  const status = score >= 9 ? "可以開始精準比較" : score >= 6 ? "條件整理中" : "方向探索中";
  const area = [...(answers.areas || []), answers.customArea].filter(Boolean).join("、") || "台南生活圈";
  const focusText = lifeFocusList(answers).join("、") || "日常生活";
  const downPayment = resolveAnswer(answers, "downPayment");
  const monthlyMortgage = resolveAnswer(answers, "monthlyMortgage");
  const agePreference = resolveAnswer(answers, "agePreference");
  const rooms = resolveAnswer(answers, "rooms");
  const direction = [
    `這次以${answers.purpose || "購屋"}為主，預計${answers.timeline || "尚未確定時程"}；先以${area}為主要範圍，配合${focusText}比較實際動線。`,
    `物件先看${(answers.propertyTypes || []).join("、") || "可接受類型"}，再用屋齡「${agePreference || "待確認"}」與車位「${answers.parking || "待確認"}」縮小範圍。`
  ];
  const strategy = [
    `看屋時優先確認${(answers.mustHaves || []).join("、") || "每天真正會用到的條件"}。`,
    "不要只看裝潢；把格局、室外環境、白天與晚上的感受一起比較。",
    answers.moveInBudget
      ? `入住整理預算以「${answers.moveInBudget}」為起點，再把修繕、家具家電、管理費與持有成本一起算進完整成本。`
      : "房價之外，把修繕、家具家電、管理費與持有成本一起算進購屋完整成本。",
    answers.conditionTolerance
      ? `依「${answers.conditionTolerance}」比較中古屋，仍要確認窗邊、牆角、浴室與陽台的實際屋況。`
      : "比較中古屋時，確認窗邊、牆角、浴室與陽台的實際屋況，不只看裝潢。",
    answers.decisionLimit
      ? `出價前再用「${answers.decisionLimit}」核對必要條件與出價底線。`
      : "出價前先設定必要條件與可接受的出價底線，避免被現場氣氛推著走。"
  ];
  if ((answers.rooms === "3房" || answers.rooms === "3房以上") && ["偶爾來客", "還沒想好"].includes(answers.thirdRoomUse)) {
    strategy.unshift(`目前規劃${rooms}，但第三房用途仍有彈性，可同步比較兩房加彈性空間，避免為不常使用的房間增加負擔。`);
  }
  const relevantEpisodes = relevantVideoEpisodes(answers);
  const relevant = new Set(relevantEpisodes);
  const questionByEpisode = new Map(VIDEO_QUESTIONS.map(item => [item.ep, item]));
  const videoQuestions = [
    ...relevantEpisodes.map(ep => ({ ...questionByEpisode.get(ep), relevant: true })),
    ...VIDEO_QUESTIONS.filter(item => !relevant.has(item.ep)).map(item => ({ ...item, relevant: false }))
  ];
  const priorityPreview = videoQuestions.filter(item => item.relevant).slice(0, 3);
  const budgetDetail = answers.moveInBudget
    ? `入住整理預算「${answers.moveInBudget}」也一起估入。`
    : "房價之外，再預留入住整理與修繕空間。";
  return {
    status,
    headline: "先把生活與負擔對齊；\n再挑真正值得看的房子。",
    direction,
    budgetReminder: `目前以自備款「${downPayment || "待確認"}」與舒服月付「${monthlyMortgage || "待確認"}」整理方向；${budgetDetail}另外保留生活餘裕，並把修繕、管理費與持有成本一起算。實際貸款仍以銀行審核與個人條件為準。`,
    strategy,
    priorityPreview,
    videoQuestions
  };
}
