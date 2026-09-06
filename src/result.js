import { resolveAnswer } from "./questions.js?v=20260906-r3";

const PRIORITY_ACTIONS = {
  地點: "把上班、接送或探望家人的路線走一遍，確認這個地點適合每天生活。",
  格局: "帶著常用家具尺寸看格局，確認床、餐桌與收納真的放得下。",
  採光通風: "白天關燈看自然採光，開窗感受通風，別只看照片。",
  安靜: "平日晚上再走一趟，聽聽車流、鄰居與附近店家的聲音。",
  管理: "確認管理費、收包裹方式與公共設施維護，再看社區公告。",
  屋況: "現場查看窗邊、牆角、浴室與陽台，先問清楚修繕紀錄。",
  生活機能: "從家門走到常去的超市、公園或車站，感受實際距離。",
  停車: "實際試走車道與車位，確認尺寸、動線和日常使用方式。",
  價格: "找同區、相近屋齡與坪數的成交資料比較，車位價格也要拆開看。"
};

export function deriveResult(answers) {
  const selectedAreas = (answers.areas || []).filter(area => area !== "還沒決定");
  const area = [...selectedAreas, answers.customArea].filter(Boolean).join("、");
  const areaUnclear = !area;
  const downPayment = resolveAnswer(answers, "downPayment");
  const monthlyMortgage = resolveAnswer(answers, "monthlyMortgage");
  // Free text stays a stated preference, not an inferred numeric affordability assessment.
  const budgetUnclear = !downPayment || !monthlyMortgage
    || answers.downPayment === "還不確定" || answers.monthlyMortgage === "希望小魏協助試算"
    || (answers.downPayment === "自訂金額" && /不確定|不知道|還在|未定|協助|試算|不清楚/.test(answers.customDownPayment || ""))
    || (answers.monthlyMortgage === "自訂" && /不確定|不知道|還在|未定|協助|試算|不清楚/.test(answers.customMonthlyMortgage || ""));
  const rooms = resolveAnswer(answers, "rooms") || "未填";
  const types = (answers.propertyTypes || []).join("、") || "未填";
  const age = resolveAnswer(answers, "agePreference") || "未填，之後確認";
  const priorities = answers.mustHaves || [];
  const noGos = (answers.noGos || []).map(value => value === "其他" ? answers.otherNoGo : value).filter(Boolean);
  const status = budgetUnclear ? "先釐清預算" : areaUnclear ? "先縮小生活圈" : "找房方向已整理";
  const contactOffer = budgetUnclear ? {
    title: "先釐清預算，再開始找房",
    description: "還沒算清楚也沒關係。留下聯絡方式，小魏會先和你整理自備款與舒服月付，再討論找房範圍。",
    action: "請小魏幫我釐清預算"
  } : areaUnclear ? {
    title: "一起把生活圈，縮小一點",
    description: "還沒決定住哪裡，就從每天常去的地方聊起。小魏會和你確認通勤與生活需求，一起挑出想看的區域。",
    action: "請小魏幫我縮小生活圈"
  } : answers.purpose === "先了解行情" ? {
    title: "先聊方向，慢慢找也可以",
    description: `你正在了解「${area}」。留下聯絡方式，小魏會依這份清單和你聊聊條件，先找到適合自己的下一步。`,
    action: "請小魏和我聊聊找房方向"
  } : {
    title: "下一步，讓小魏幫你找房",
    description: `你想找「${area}${rooms !== "還沒決定" && rooms !== "未填" ? `、${rooms}` : ""}」${priorities[0] ? `，最在意「${priorities[0]}」` : ""}。留下聯絡方式，小魏會先確認這些需求，再和你一起縮小找房範圍。`,
    action: "請小魏幫我找房"
  };
  const actionTexts = [];
  const add = text => { if (text && !actionTexts.includes(text)) actionTexts.push(text); };

  if (budgetUnclear) add("先整理可用自備款與舒服月付，再和小魏一起確認總預算範圍。");
  if (areaUnclear) add("先挑一個常去的地點，從可接受的通勤時間縮小生活圈。");
  if (answers.agePreference === "預售屋" && ["1個月內", "3個月內", "半年內"].includes(answers.timeline)) {
    add("你希望近期買房，也選了預售屋；先確認是簽約時程還是入住時程，再核對交屋時間。");
  }
  add(PRIORITY_ACTIONS[priorities[0]]);
  if (noGos.length && !noGos.includes("無特殊忌諱")) add(`約看前先核對「${noGos.join("、")}」，減少不符合底線的帶看。`);
  if (answers.parking === "一定要平車") add("先確認平面車位是否包含在總價內，再實際試停車道與車位。");
  if (["3房", "4房以上", "3房以上"].includes(answers.rooms) && ["偶爾來客", "還沒想好"].includes(answers.thirdRoomUse)) {
    add("第三房用途仍有彈性，可以一起比較兩房加彈性空間，看看哪種更好用。");
  }
  priorities.slice(1).forEach(priority => add(PRIORITY_ACTIONS[priority]));
  if (answers.rooms === "還沒決定") add("先列出每天使用的睡眠、工作與收納空間，再決定房數。");
  if (["1個月內", "3個月內"].includes(answers.timeline)) add("先確認交屋與搬家時間，再挑符合時程的物件安排看屋。");
  add("把房價、稅費與修繕一起列出，並保留生活預備金。");
  add("先比較 2～3 間符合條件的房子，每間用相同條件做筆記。");
  add("看屋時拍下喜歡與有疑問的地方，回家再一起比較。");
  const strategy = actionTexts.slice(0, 3);
  const direction = [
    `${answers.purpose || "購屋"} · ${answers.timeline || "時程未填"} · ${area || "生活圈待確認"}${answers.lifeFocus?.length ? `（${[].concat(answers.lifeFocus).join("、")}）` : ""}`,
    `${rooms} · ${types} · ${answers.parking || "車位未填"}${answers.agePreference ? ` · ${age}` : ""}`
  ];
  const budgetReminder = `自備款：${downPayment || "未填"}；舒服月付：${monthlyMortgage || "未填"}。另留稅費、修繕與生活預備金；實際貸款依銀行審核。`;
  const facts = [
    { label: "買房計畫", value: `${answers.purpose || "未填"} · ${answers.timeline || "未填"}`, step: "intent" },
    { label: "生活圈", value: area || "還沒決定，一起找方向", step: "location" },
    { label: "舒服預算", value: `自備 ${downPayment || "未填"} ／ 月付 ${monthlyMortgage || "未填"}`, step: "budget" },
    { label: "理想的家", value: `${rooms} · ${types} · ${answers.parking || "車位未填"}`, step: "property" },
    { label: "屋齡", value: age, step: "property" },
    ...(answers.lifeFocus?.length ? [{ label: "生活動線", value: [].concat(answers.lifeFocus).join("、"), step: "location" }] : []),
    ...(answers.householdSize ? [{ label: "居住人數", value: answers.householdSize, step: "property" }] : []),
    ...(answers.thirdRoomUse ? [{ label: "第三房用途", value: answers.thirdRoomUse, step: "property" }] : []),
    { label: "優先順序", value: priorities.map((value, i) => `${i + 1}. ${value}`).join(" → ") || "未填", step: "priorities" },
    { label: "一定避開", value: noGos.join("、") || "未填，之後確認", step: "priorities" }
  ];
  return { status, headline: "你的找房方向，\n有輪廓了。", direction, facts, budgetReminder, strategy, contactOffer,
    priorityPreview: strategy.map((text, i) => ({ id: `next-${i + 1}`, text, relevant: true })) };
}
