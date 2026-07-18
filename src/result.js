export const VIDEO_QUESTIONS = [
  { ep: 1, text: "看屋前，總預算與可負擔範圍先確認了嗎？" },
  { ep: 2, text: "拿掉裝潢加分後，格局仍符合每天的使用方式嗎？" },
  { ep: 3, text: "室外環境、通勤與生活圈實際走過了嗎？" },
  { ep: 4, text: "第一眼心動後，價格與必要條件也確認了嗎？" },
  { ep: 5, text: "購屋完整成本與生活預備金（生活緩衝）都保留了嗎？" },
  { ep: 6, text: "白天與晚上都看過周邊環境嗎？" },
  { ep: 7, text: "第三房準備拿來做什麼？" }
];

function readinessScore(answers) {
  let score = 0;
  if (answers.timeline && answers.timeline !== "先看看") score += 2;
  if (answers.areas?.length || answers.customArea) score += 2;
  if (answers.downPayment && answers.downPayment !== "還不確定") score += 1;
  if (answers.monthlyMortgage && answers.monthlyMortgage !== "希望小魏協助試算") score += 1;
  if (answers.propertyTypes?.length) score += 1;
  if (answers.mustHaves?.length) score += 1;
  return score;
}

export function deriveResult(answers) {
  const score = readinessScore(answers);
  const status = score >= 7 ? "可以開始精準比較" : score >= 4 ? "條件整理中" : "方向探索中";
  const area = [...(answers.areas || []), answers.customArea].filter(Boolean).join("、") || "台南生活圈";
  const direction = [
    `先以${area}為主要範圍，配合${answers.lifeFocus || "日常生活"}比較實際動線。`,
    `物件先看${(answers.propertyTypes || []).join("、") || "可接受類型"}，再用${answers.agePreference || "屋齡"}與${answers.parking || "車位"}縮小範圍。`
  ];
  const strategy = [
    `看屋時優先確認${(answers.mustHaves || []).join("、") || "每天真正會用到的條件"}。`,
    "不要只看裝潢；把格局、室外環境、白天與晚上的感受一起比較。"
  ];
  if ((answers.rooms === "3房" || answers.rooms === "3房以上") && ["偶爾來客", "還沒想好"].includes(answers.thirdRoomUse)) {
    strategy.unshift("第三房用途仍有彈性，可同步比較兩房加彈性空間，避免為不常使用的房間增加負擔。");
  }
  const relevant = new Set([1, 2, 3, 4, 5, 6]);
  if (answers.rooms === "3房" || answers.rooms === "3房以上") relevant.add(7);
  return {
    status,
    headline: `${status}｜先把生活與負擔對齊，再挑真正值得看的房子`,
    direction,
    budgetReminder: `目前以自備款「${answers.downPayment || "待確認"}」與舒服月付「${answers.monthlyMortgage || "待確認"}」整理方向；實際貸款仍以銀行審核與個人條件為準。`,
    strategy,
    videoQuestions: VIDEO_QUESTIONS.map(item => ({ ...item, relevant: relevant.has(item.ep) }))
  };
}
