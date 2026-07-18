export const QUESTION_STEPS = [
  {
    id: "intent", title: "這次買房，最主要是為了什麼？",
    tip: "先確認目的與時間，才不會一開始看很多、方向卻越來越亂。",
    fields: [
      { key: "purpose", label: "購屋目的", type: "single", options: ["自住", "換屋", "婚房", "幫家人找", "投資／置產", "先了解行情"] },
      { key: "timeline", label: "預計時程", type: "single", options: ["1個月內", "3個月內", "半年內", "一年內", "先看看"] }
    ]
  },
  {
    id: "location", title: "每天的生活，主要會落在哪裡？",
    tip: "看屋不只看室內，也要把通勤、採買與家人動線放進來。",
    fields: [
      { key: "areas", label: "想找區域", type: "multi", options: ["東區", "永康區", "安南區", "北區", "南區", "仁德區", "歸仁區", "新市／善化"] },
      { key: "customArea", label: "其他區域", type: "text", placeholder: "例：東橋、平實，或其他生活圈" },
      { key: "lifeFocus", label: "生活重心", type: "single", options: ["工作通勤", "學校接送", "家人照顧", "日常採買", "無固定地點"] }
    ]
  },
  {
    id: "budget", title: "買完房後，每月多少負擔最舒服？",
    tip: "不是想辦法買下來就好，而是買完後，生活仍要保留餘裕。",
    fields: [
      { key: "downPayment", label: "可準備自備款", type: "single", options: ["100萬以下", "100～200萬", "200～300萬", "300～500萬", "500萬以上", "還不確定"] },
      { key: "monthlyMortgage", label: "舒服的每月房貸", type: "single", options: ["2萬內", "2～3萬", "3～4萬", "4～5萬", "5萬以上", "希望小魏協助試算"] }
    ]
  },
  {
    id: "space", title: "這個家，平常會怎麼使用？",
    tip: "房間不是拿來收集的，把預算放在真正每天會用到的空間。",
    fields: [
      { key: "householdSize", label: "平常居住人數", type: "single", options: ["1 人", "2 人", "3 人", "4 人", "5 人以上"] },
      { key: "rooms", label: "希望房數", type: "single", options: ["1～2房", "2房", "3房", "3房以上", "還不確定"] },
      { key: "thirdRoomUse", label: "第三個房間準備拿來做什麼？", type: "single", options: ["家人長住", "工作／書房", "兒童房", "偶爾來客", "還沒想好"], when: "needsThirdRoomUse" }
    ]
  },
  {
    id: "property", title: "哪些物件條件是必要的？",
    tip: "先用類型、屋齡與車位縮小範圍，比一間一間碰運氣更有效率。",
    fields: [
      { key: "propertyTypes", label: "物件類型", type: "multi", options: ["電梯大樓", "華廈／公寓", "透天", "電梯透天", "其他"] },
      { key: "agePreference", label: "屋齡接受度", type: "single", options: ["10年內", "20年內", "30年內", "不拘"] },
      { key: "parking", label: "車位需求", type: "single", options: ["一定要平車", "車位即可", "有最好", "不需要"] }
    ]
  },
  {
    id: "priorities", title: "什麼最不能妥協？",
    tip: "裝潢可以改，但地點、格局與每天的生活方式更值得先確認。",
    fields: [
      { key: "mustHaves", label: "最重視，最多選 3 個", type: "multi", max: 3, options: ["地點", "格局", "採光通風", "安靜", "管理", "屋況", "生活機能", "停車", "價格"] },
      { key: "noGos", label: "一定避開，可不選", type: "multi", exclusive: "無特殊忌諱", options: ["西曬", "頂樓", "特殊風水／路沖", "基地台或高壓電", "格局問題", "無特殊忌諱", "其他"] },
      { key: "otherNoGo", label: "其他避開條件", type: "text", placeholder: "請簡單說明", when: "otherNoGo" }
    ]
  }
];

export function createInitialAnswers() {
  return {
    purpose: "", timeline: "", areas: [], customArea: "", lifeFocus: "",
    downPayment: "", monthlyMortgage: "", householdSize: "", rooms: "",
    thirdRoomUse: "", propertyTypes: [], agePreference: "", parking: "",
    mustHaves: [], noGos: [], otherNoGo: "", name: "", phone: "",
    consent: false
  };
}

export function needsThirdRoomUse(answers) {
  return answers.rooms === "3房" || answers.rooms === "3房以上";
}

export function getVisibleStepIds() {
  return QUESTION_STEPS.map(step => step.id);
}

export function clearHiddenAnswers(answers) {
  const next = structuredClone(answers);
  if (!needsThirdRoomUse(next)) next.thirdRoomUse = "";
  if (!next.noGos.includes("其他")) next.otherNoGo = "";
  if (next.noGos.includes("無特殊忌諱")) next.noGos = ["無特殊忌諱"];
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
    requireValue("lifeFocus", "請選擇生活重心");
  }
  if (stepId === "budget") {
    requireValue("downPayment", "請選擇可準備自備款");
    requireValue("monthlyMortgage", "請選擇舒服的每月房貸");
  }
  if (stepId === "space") {
    requireValue("householdSize", "請選擇居住人數");
    requireValue("rooms", "請選擇希望房數");
    if (needsThirdRoomUse(answers)) requireValue("thirdRoomUse", "請選擇第三房用途");
  }
  if (stepId === "property") {
    requireList("propertyTypes", "請至少選擇一種物件類型");
    requireValue("agePreference", "請選擇屋齡接受度");
    requireValue("parking", "請選擇車位需求");
  }
  if (stepId === "priorities") {
    requireList("mustHaves", "請至少選擇一個重要條件");
    if (answers.mustHaves.length > 3) errors.mustHaves = "最多選擇 3 個";
    if (answers.noGos.includes("其他") && !answers.otherNoGo.trim()) errors.otherNoGo = "請簡單說明其他避開條件";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
