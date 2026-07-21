const SHEET_NAME = "C版買方診斷名單";
const SOURCE_VERSION = "buyer-diagnosis-c-v2";
const HEADERS = [
  "建立時間", "提交識別碼", "來源版本", "稱呼", "手機號碼", "購屋目的", "購屋時程",
  "想找區域", "生活重心", "自備款區間", "舒服月付區間", "居住人數", "希望房數",
  "第三房用途", "物件類型", "屋齡接受度", "車位需求", "最重視條件", "一定避開條件",
  "其他避開說明", "買方狀態", "找房方向摘要", "預算提醒", "看屋策略", "同意聯繫",
  "後續狀態", "承辦備註", "下次跟進日期",
  "入住整理預算", "屋況接受度", "出價心理底線"
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || "{}");
    validate_(data);
    const sheet = targetSheet_();
    ensureHeaders_(sheet);
    if (!findSubmission_(sheet, data.submissionId)) {
      sheet.appendRow([
        new Date(), safe_(data.submissionId), safe_(data.sourceVersion), safe_(data.name), phone_(data.phone),
        safe_(data.purpose), safe_(data.timeline), list_(data.areas), safe_(data.lifeFocus),
        safe_(data.downPayment), safe_(data.monthlyMortgage), safe_(data.householdSize), safe_(data.rooms),
        safe_(data.thirdRoomUse), list_(data.propertyTypes), safe_(data.agePreference), safe_(data.parking),
        list_(data.mustHaves), list_(data.noGos), safe_(data.otherNoGo), safe_(data.buyerStatus),
        list_(data.direction), safe_(data.budgetReminder), list_(data.strategy), data.consent ? "是" : "否",
        "新名單", "", "",
        safe_(data.moveInBudget), safe_(data.conditionTolerance), safe_(data.decisionLimit)
      ]);
    }
    return json_({ ok: true, submissionId: data.submissionId });
  } catch (error) {
    return json_({ ok: false, message: String(error.message || error) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.action !== "status") return json_({ ok: true, service: SOURCE_VERSION });
  const submissionId = safe_(params.submissionId);
  const found = submissionId ? findSubmission_(targetSheet_(), submissionId) : false;
  const payload = { ok: true, found, submissionId };
  const callback = String(params.callback || "");
  if (!/^[A-Za-z_$][\w$]*$/.test(callback)) return json_(payload);
  return ContentService.createTextOutput(`${callback}(${JSON.stringify(payload)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function validate_(data) {
  if (data.sourceVersion !== SOURCE_VERSION) throw new Error("invalid source version");
  if (!/^[0-9a-f-]{16,64}$/i.test(String(data.submissionId || ""))) throw new Error("invalid submission id");
  if (!/^09\d{8}$/.test(String(data.phone || ""))) throw new Error("invalid phone");
  if (!String(data.name || "").trim()) throw new Error("name required");
  if (data.consent !== true) throw new Error("consent required");
}

function targetSheet_() {
  const sheetId = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (!sheetId) throw new Error("sheet is not configured");
  const spreadsheet = SpreadsheetApp.openById(sheetId);
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function configureBoundSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("bind this script to the new C-version spreadsheet");
  PropertiesService.getScriptProperties().setProperty("SHEET_ID", spreadsheet.getId());
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  ensureHeaders_(sheet);
  return spreadsheet.getId();
}

function ensureHeaders_(sheet) {
  const existing = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (HEADERS.some((header, index) => existing[index] !== header)) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  sheet.setFrozenRows(1);
}

function findSubmission_(sheet, id) {
  if (sheet.getLastRow() < 2) return false;
  return Boolean(
    sheet.getRange(2, 2, sheet.getLastRow() - 1, 1)
      .createTextFinder(id)
      .matchEntireCell(true)
      .findNext()
  );
}

function list_(value) {
  return Array.isArray(value) ? value.map(safe_).filter(Boolean).join("、") : safe_(value);
}

function safe_(value) {
  const text = value === undefined || value === null ? "" : String(value).trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function phone_(value) {
  const text = String(value || "").trim();
  return text ? `'${text}` : "";
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
