import { resolveAnswer } from "./questions.js?v=20260906-r3";
import { normalizeContact } from "./contact.js";

function listOf(value) {
  return Array.isArray(value) ? value : [value].filter(Boolean);
}

export function buildPayload({ answers, result, submissionId, submittedAt = new Date().toISOString() }) {
  return {
    submissionId,
    submittedAt,
    sourceVersion: "buyer-diagnosis-c-v2",
    name: answers.name?.trim() || "",
    phone: normalizeContact(answers.phone),
    purpose: answers.purpose || "",
    timeline: answers.timeline || "",
    areas: [...(answers.areas || []), answers.customArea].filter(Boolean),
    lifeFocus: listOf(answers.lifeFocus),
    downPayment: resolveAnswer(answers, "downPayment"),
    monthlyMortgage: resolveAnswer(answers, "monthlyMortgage"),
    householdSize: answers.householdSize || "",
    rooms: resolveAnswer(answers, "rooms"),
    thirdRoomUse: answers.thirdRoomUse || "",
    propertyTypes: answers.propertyTypes || [],
    agePreference: resolveAnswer(answers, "agePreference"),
    parking: answers.parking || "",
    mustHaves: answers.mustHaves || [],
    noGos: answers.noGos || [],
    otherNoGo: answers.otherNoGo || "",
    moveInBudget: answers.moveInBudget || "",
    conditionTolerance: answers.conditionTolerance || "",
    decisionLimit: answers.decisionLimit || "",
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
    `生活重心：${listOf(answers.lifeFocus).join("、") || "未填"}`,
    `預算：${resolveAnswer(answers, "downPayment") || "未填"}／${resolveAnswer(answers, "monthlyMortgage") || "未填"}`,
    `家庭：${answers.householdSize || "未填"}；房數：${resolveAnswer(answers, "rooms") || "未填"}／${answers.thirdRoomUse || "無需填寫"}`,
    `物件：${(answers.propertyTypes || []).join("、") || "未填"}／${resolveAnswer(answers, "agePreference") || "未填"}／${answers.parking || "未填"}`,
    `必備：${(answers.mustHaves || []).join("、") || "未填"}`,
    `一定避開：${(answers.noGos || []).map(value => value === "其他" ? answers.otherNoGo : value).filter(Boolean).join("、") || "未填"}`,
    ...(answers.moveInBudget ? [`入住整理預算：${answers.moveInBudget}`] : []),
    ...(answers.conditionTolerance ? [`屋況接受度：${answers.conditionTolerance}`] : []),
    ...(answers.decisionLimit ? [`出價心理底線：${answers.decisionLimit}`] : []),
    `目前狀態：${result.status}`,
    ...result.strategy.map(item => `• ${item}`),
    "台南小魏 買厝作伙｜魏泉承｜0927-617-207"
  ].join("\n");
}
