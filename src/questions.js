export const QUESTION_STEPS = [
  {
    id: "intent", label: "買房計畫", title: "這次，想找一個怎樣的家？",
    tip: "選最接近現在的想法，之後都能改。",
    fields: [
      { key: "purpose", label: "買房的原因", type: "single", options: ["自住", "換屋", "婚房", "幫家人找", "投資／置產", "先了解行情"], descriptions: ["住進自己的家", "讓生活升級", "一起開始新生活", "替重要的人挑選", "先把條件算清楚", "還在找靈感"] },
      { key: "timeline", label: "預計時程", type: "single", options: ["1個月內", "3個月內", "半年內", "一年內", "先看看"] }
    ]
  },
  {
    id: "location", label: "生活圈", title: "你想把生活，安放在哪裡？",
    tip: "可選幾個區域；沒有方向也沒關係。",
    fields: [
      { key: "areas", label: "想住的區域", type: "multi", exclusive: "還沒決定", options: ["東區", "永康區", "北區", "安南區", "中西區", "南區", "仁德區", "歸仁區", "新市區", "善化區", "還沒決定"] },
      { key: "customArea", label: "其他區域", type: "text", placeholder: "例：東橋、平實，或其他生活圈" },
      { key: "lifeFocus", label: "希望顧到哪些生活動線？", optional: true, type: "multi", exclusive: "無固定地點", options: ["工作通勤", "學校接送", "家人照顧", "日常採買", "無固定地點"] }
    ]
  },
  {
    id: "property", label: "理想的家", title: "家的基本配備，你來選。",
    tip: "先選房數、類型和車位，其餘有想法再補。",
    fields: [
      {
        key: "rooms", label: "希望房數", type: "single",
        options: ["1房", "2房", "3房", "4房以上", "還沒決定", "自訂"],
        custom: { option: "自訂", key: "customRooms", label: "希望的房數或空間安排", placeholder: "例：2房加一個彈性空間" }
      },
      { key: "propertyTypes", label: "喜歡的房子類型", type: "multi", exclusive: "還沒決定", options: ["電梯大樓", "華廈（有電梯）", "公寓（無電梯）", "透天", "電梯透天", "其他", "還沒決定"] },
      { key: "parking", label: "車位需求", type: "single", options: ["一定要平車", "車位即可", "有最好", "不需要"] },
      {
        key: "agePreference", label: "屋齡接受度", optional: true, type: "single",
        options: ["預售屋", "5年內", "10年內", "20年內", "30年內", "不拘／看條件", "自訂"],
        custom: { option: "自訂", key: "customAgePreference", label: "可接受的屋齡", placeholder: "例：40年內可整理、或屋齡不拘" }
      },
      { key: "householdSize", label: "平常居住人數", optional: true, type: "single", options: ["1 人", "2 人", "3 人", "4 人", "5 人以上"] },
      { key: "thirdRoomUse", label: "第三房想拿來做什麼？", optional: true, type: "single", options: ["家人長住", "工作／書房", "兒童房", "偶爾來客", "還沒想好"], when: "needsThirdRoomUse" }
    ]
  },
  {
    id: "budget", label: "舒服預算", title: "買了房，生活也要剛剛好。",
    tip: "先抓舒服的範圍，還沒算過也能繼續。",
    fields: [
      {
        key: "downPayment", label: "可準備自備款", type: "single",
        options: ["100萬以下", "100～200萬", "200～300萬", "300～500萬", "500萬以上", "還不確定", "自訂金額"],
        custom: { option: "自訂金額", key: "customDownPayment", label: "自備款金額", placeholder: "例：250萬" }
      },
      {
        key: "monthlyMortgage", label: "舒服的每月房貸", type: "single",
        options: ["2萬內", "2～3萬", "3～4萬", "4～5萬", "5萬以上", "希望小魏協助試算", "自訂"],
        custom: { option: "自訂", key: "customMonthlyMortgage", label: "每月可負擔金額", placeholder: "例：3萬5，或想請小魏協助試算" }
      }
    ]
  },
  {
    id: "priorities", label: "優先順序", title: "如果只能留 3 個，你選誰？",
    tip: "先點最重要的，再點第二、第三名。點已選項目可取消。",
    fields: [
      { key: "mustHaves", label: "你的看屋優先順序", type: "multi", max: 3, options: ["地點", "格局", "採光通風", "安靜", "管理", "屋況", "生活機能", "停車", "價格"] },
      { key: "noGos", label: "一定避開，可不選", type: "multi", exclusive: "無特殊忌諱", options: ["西曬", "頂樓", "特殊風水／路沖", "基地台或高壓電", "格局問題", "無特殊忌諱", "其他"] },
      { key: "otherNoGo", label: "其他避開條件", type: "text", placeholder: "請簡單說明", when: "otherNoGo" }
    ]
  }
];

const ALL_FIELDS = QUESTION_STEPS.flatMap(step => step.fields);
const FIELD_BY_KEY = Object.fromEntries(ALL_FIELDS.map(field => [field.key, field]));
export const CUSTOM_FIELDS = ALL_FIELDS
  .filter(field => field.custom)
  .map(field => ({ parent: field.key, ...field.custom }));

export function createInitialAnswers() {
  return {
    purpose: "", timeline: "", areas: [], customArea: "", lifeFocus: [],
    downPayment: "", customDownPayment: "", monthlyMortgage: "", customMonthlyMortgage: "",
    householdSize: "", rooms: "", customRooms: "", thirdRoomUse: "",
    propertyTypes: [], agePreference: "", customAgePreference: "", parking: "",
    mustHaves: [], noGos: [], otherNoGo: "",
    moveInBudget: "", conditionTolerance: "", decisionLimit: "",
    name: "", phone: "", consent: false
  };
}

export function customFieldFor(fieldKey) {
  return FIELD_BY_KEY[fieldKey]?.custom || null;
}

export function isCustomChoice(answers, fieldKey) {
  const custom = customFieldFor(fieldKey);
  return Boolean(custom) && answers[fieldKey] === custom.option;
}

export function resolveAnswer(answers, fieldKey) {
  const custom = customFieldFor(fieldKey);
  if (custom && answers[fieldKey] === custom.option) {
    const typed = String(answers[custom.key] || "").trim();
    return typed ? `自訂：${typed}` : custom.option;
  }
  return answers[fieldKey] || "";
}

export function needsThirdRoomUse(answers) {
  return ["3房", "4房以上", "3房以上"].includes(answers.rooms);
}

export function getVisibleStepIds() {
  return QUESTION_STEPS.map(step => step.id);
}

export function clearHiddenAnswers(answers) {
  const next = structuredClone(answers);
  if (!needsThirdRoomUse(next)) next.thirdRoomUse = "";
  if (!next.noGos.includes("其他")) next.otherNoGo = "";
  if (next.noGos.includes("無特殊忌諱")) next.noGos = ["無特殊忌諱"];
  if (next.lifeFocus.includes("無固定地點")) next.lifeFocus = ["無固定地點"];
  if (next.areas.includes("還沒決定")) {
    next.areas = ["還沒決定"];
    next.customArea = "";
  }
  if (next.propertyTypes.includes("還沒決定")) next.propertyTypes = ["還沒決定"];
  for (const custom of CUSTOM_FIELDS) {
    if (next[custom.parent] !== custom.option) next[custom.key] = "";
  }
  return next;
}

export function validateStep(stepId, rawAnswers) {
  const answers = clearHiddenAnswers(rawAnswers);
  const errors = {};
  const requireValue = (key, message) => { if (!answers[key]) errors[key] = message; };
  const requireList = (key, message) => { if (!answers[key]?.length) errors[key] = message; };

  if (stepId === "intent") {
    requireValue("purpose", "請選擇購屋目的");
    requireValue("timeline", "請選擇預計時程");
  }
  if (stepId === "location") {
    if (!answers.areas.length && !answers.customArea.trim()) errors.areas = "請選擇或輸入區域";
  }
  if (stepId === "budget") {
    requireValue("downPayment", "請選擇可準備自備款");
    requireValue("monthlyMortgage", "請選擇舒服的每月房貸");
  }
  if (stepId === "property") {
    requireValue("rooms", "請選擇希望房數");
    requireList("propertyTypes", "請至少選擇一種物件類型");
    requireValue("parking", "請選擇車位需求");
  }
  if (stepId === "priorities") {
    requireList("mustHaves", "請至少選擇一個重要條件");
    if (answers.mustHaves.length > 3) errors.mustHaves = "最多選擇 3 個";
    if (answers.noGos.includes("其他") && !answers.otherNoGo.trim()) errors.otherNoGo = "請簡單說明其他避開條件";
  }
  const step = QUESTION_STEPS.find(item => item.id === stepId);
  for (const field of step?.fields || []) {
    if (!field.custom) continue;
    if (answers[field.key] !== field.custom.option) continue;
    if (!String(answers[field.custom.key] || "").trim()) {
      errors[field.custom.key] = `請輸入${field.custom.label}`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function getQuestionProgress(answers) {
  const total = QUESTION_STEPS.length;
  const completed = QUESTION_STEPS.filter(step => validateStep(step.id, answers).valid).length;
  return { completed, total, remaining: total - completed };
}

export function getStepFeedback(stepId, rawAnswers) {
  const answers = clearHiddenAnswers(rawAnswers);
  if (!validateStep(stepId, answers).valid) return "";
  const summary = {
    intent: () => `${answers.purpose} · ${answers.timeline}`,
    location: () => [...answers.areas, answers.customArea.trim()].filter(Boolean).join("、"),
    property: () => `${resolveAnswer(answers, "rooms")} · ${answers.propertyTypes.join("、")} · ${answers.parking}`,
    budget: () => `自備 ${resolveAnswer(answers, "downPayment")} · 月付 ${resolveAnswer(answers, "monthlyMortgage")}`,
    priorities: () => answers.mustHaves.map((value, i) => `${i + 1}. ${value}`).join(" → ")
  }[stepId];
  return summary ? `已記下：${summary()}` : "";
}
