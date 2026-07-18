export function normalizePhone(value = "") {
  return String(value).replace(/\D/g, "").slice(0, 10);
}

export function isTaiwanMobile(value) {
  return /^09\d{8}$/.test(normalizePhone(value));
}

export function buildPayload({ answers, result, submissionId, submittedAt = new Date().toISOString() }) {
  return {
    submissionId,
    submittedAt,
    sourceVersion: "buyer-diagnosis-c-v2",
    name: answers.name?.trim() || "",
    phone: normalizePhone(answers.phone),
    purpose: answers.purpose || "",
    timeline: answers.timeline || "",
    areas: [...(answers.areas || []), answers.customArea].filter(Boolean),
    lifeFocus: answers.lifeFocus || "",
    downPayment: answers.downPayment || "",
    monthlyMortgage: answers.monthlyMortgage || "",
    householdSize: answers.householdSize || "",
    rooms: answers.rooms || "",
    thirdRoomUse: answers.thirdRoomUse || "",
    propertyTypes: answers.propertyTypes || [],
    agePreference: answers.agePreference || "",
    parking: answers.parking || "",
    mustHaves: answers.mustHaves || [],
    noGos: answers.noGos || [],
    otherNoGo: answers.otherNoGo || "",
    buyerStatus: result.status,
    direction: result.direction,
    budgetReminder: result.budgetReminder,
    strategy: result.strategy,
    consent: Boolean(answers.consent)
  };
}

export function buildSummary({ answers, result }) {
  return [
    "買方需求診斷摘要",
    `聯絡人：${answers.name || "未填"}`,
    `區域：${[...(answers.areas || []), answers.customArea].filter(Boolean).join("、") || "未填"}`,
    `目的／時程：${answers.purpose || "未填"}／${answers.timeline || "未填"}`,
    `預算：${answers.downPayment || "未填"}／${answers.monthlyMortgage || "未填"}`,
    `家庭：${answers.householdSize || "未填"}；房數：${answers.rooms || "未填"}／${answers.thirdRoomUse || "無需填寫"}`,
    `物件：${(answers.propertyTypes || []).join("、") || "未填"}／${answers.agePreference || "未填"}／${answers.parking || "未填"}`,
    `必備：${(answers.mustHaves || []).join("、") || "未填"}`,
    `目前狀態：${result.status}`,
    ...result.strategy.map(item => `• ${item}`),
    "台南小魏 買厝作伙｜魏泉承｜0927-617-207"
  ].join("\n");
}
