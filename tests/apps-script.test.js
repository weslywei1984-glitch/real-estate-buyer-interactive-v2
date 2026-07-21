import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const EXPECTED_HEADERS = [
  "建立時間", "提交識別碼", "來源版本", "稱呼", "手機號碼", "購屋目的", "購屋時程",
  "想找區域", "生活重心", "自備款區間", "舒服月付區間", "居住人數", "希望房數",
  "第三房用途", "物件類型", "屋齡接受度", "車位需求", "最重視條件", "一定避開條件",
  "其他避開說明", "買方狀態", "找房方向摘要", "預算提醒", "看屋策略", "同意聯繫",
  "後續狀態", "承辦備註", "下次跟進日期",
  "入住整理預算", "屋況接受度", "出價心理底線"
];

class MockSheet {
  constructor(name) {
    this.name = name;
    this.rows = [];
    this.frozenRows = 0;
  }

  getLastRow() {
    let last = 0;
    this.rows.forEach((row, index) => {
      if (row.some(value => value !== "" && value !== undefined)) last = index + 1;
    });
    return last;
  }

  appendRow(values) {
    this.rows.push([...values]);
  }

  setFrozenRows(count) {
    this.frozenRows = count;
  }

  getRange(row, column, rowCount = 1, columnCount = 1) {
    const sheet = this;
    return {
      getValues() {
        return Array.from({ length: rowCount }, (_, rowOffset) =>
          Array.from({ length: columnCount }, (_, columnOffset) =>
            sheet.rows[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? ""
          )
        );
      },
      setValues(values) {
        values.forEach((sourceRow, rowOffset) => {
          const targetIndex = row - 1 + rowOffset;
          sheet.rows[targetIndex] ||= [];
          sourceRow.forEach((value, columnOffset) => {
            sheet.rows[targetIndex][column - 1 + columnOffset] = value;
          });
        });
      },
      createTextFinder(search) {
        let exact = false;
        return {
          matchEntireCell(value) {
            exact = value;
            return this;
          },
          findNext() {
            for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
              const value = sheet.rows[row - 1 + rowOffset]?.[column - 1] ?? "";
              if ((exact && String(value) === search) || (!exact && String(value).includes(search))) {
                return { row: row + rowOffset, column };
              }
            }
            return null;
          }
        };
      }
    };
  }
}

function createRuntime({ propertySheetId = "new-sheet-id", activeSheetId = "new-sheet-id" } = {}) {
  const sheets = new Map();
  const properties = new Map(propertySheetId ? [["SHEET_ID", propertySheetId]] : []);
  const lock = { waits: 0, releases: 0 };

  const spreadsheet = {
    getId: () => activeSheetId,
    getSheetByName(name) {
      return sheets.get(name) || null;
    },
    insertSheet(name) {
      const sheet = new MockSheet(name);
      sheets.set(name, sheet);
      return sheet;
    }
  };

  function output(content) {
    return {
      content,
      mimeType: null,
      setMimeType(mimeType) {
        this.mimeType = mimeType;
        return this;
      },
      getContent() {
        return this.content;
      }
    };
  }

  const context = vm.createContext({
    Date,
    JSON,
    String,
    Boolean,
    Array,
    RegExp,
    Error,
    LockService: {
      getScriptLock: () => ({
        waitLock() { lock.waits += 1; },
        releaseLock() { lock.releases += 1; }
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => properties.get(key) || null,
        setProperty: (key, value) => properties.set(key, value)
      })
    },
    SpreadsheetApp: {
      openById(id) {
        assert.equal(id, activeSheetId);
        return spreadsheet;
      },
      getActiveSpreadsheet: () => spreadsheet
    },
    ContentService: {
      MimeType: { JSON: "application/json", JAVASCRIPT: "application/javascript" },
      createTextOutput: output
    }
  });

  const code = fs.readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");
  vm.runInContext(code, context, { filename: "apps-script/Code.gs" });

  return {
    call: (expression, value) => {
      context.__value = value;
      return vm.runInContext(expression, context);
    },
    sheets,
    properties,
    lock,
    spreadsheet
  };
}

function validPayload(overrides = {}) {
  return {
    submissionId: "c0de0000-2026-0718-abcd-000000000001",
    sourceVersion: "buyer-diagnosis-c-v2",
    name: "Codex整合測試",
    phone: "0912345678",
    purpose: "首購",
    timeline: "三個月內",
    areas: ["東區", "北區"],
    lifeFocus: "通勤",
    downPayment: "200萬以上",
    monthlyMortgage: "2萬以下",
    householdSize: "2人",
    rooms: "3房",
    thirdRoomUse: "書房",
    propertyTypes: ["大樓"],
    agePreference: "20年內",
    parking: "需要車位",
    mustHaves: ["電梯", "管理"],
    noGos: ["頂樓"],
    otherNoGo: "臨大路",
    buyerStatus: "可開始找房",
    direction: ["先鎖定東區與北區"],
    budgetReminder: "以每月可負擔金額為準",
    strategy: ["先安排生活圈帶看"],
    moveInBudget: "10～30萬",
    conditionTolerance: "小修可以接受",
    decisionLimit: "已有明確上限，不會超過",
    consent: true,
    ...overrides
  };
}

function post(runtime, payload) {
  return runtime.call("doPost({ postData: { contents: JSON.stringify(__value) } })", payload);
}

test("configureBoundSheet stores the active id and creates the exact frozen header", () => {
  const runtime = createRuntime({ propertySheetId: "", activeSheetId: "new-sheet-id" });
  assert.equal(runtime.call("configureBoundSheet()"), "new-sheet-id");
  assert.equal(runtime.properties.get("SHEET_ID"), "new-sheet-id");
  const sheet = runtime.sheets.get("C版買方診斷名單");
  assert.deepEqual(sheet.rows[0], EXPECTED_HEADERS);
  assert.equal(sheet.frozenRows, 1);
});

test("configureBoundSheet freezes an imported sheet whose exact headers already exist", () => {
  const runtime = createRuntime({ propertySheetId: "", activeSheetId: "new-sheet-id" });
  const sheet = runtime.spreadsheet.insertSheet("C版買方診斷名單");
  sheet.rows[0] = [...EXPECTED_HEADERS];

  runtime.call("configureBoundSheet()");

  assert.equal(sheet.frozenRows, 1);
  assert.deepEqual(sheet.rows[0], EXPECTED_HEADERS);
});

test("doPost validates version, submission id, phone, name, and consent", () => {
  const invalidCases = [
    ["wrong-version", { sourceVersion: "old" }, "invalid source version"],
    ["bad-id", { submissionId: "short" }, "invalid submission id"],
    ["bad-phone", { phone: "0212345678" }, "invalid phone"],
    ["missing-name", { name: "   " }, "name required"],
    ["no-consent", { consent: false }, "consent required"]
  ];

  for (const [label, override, expected] of invalidCases) {
    const runtime = createRuntime();
    const response = JSON.parse(post(runtime, validPayload(override)).getContent());
    assert.equal(response.ok, false, label);
    assert.equal(response.message, expected, label);
    assert.equal(runtime.sheets.size, 0, label);
  }
});

test("doPost appends the contract in header order and neutralizes formula-leading text", () => {
  const runtime = createRuntime();
  const payload = validPayload({
    name: "=IMPORTXML(\"https://example.test\")",
    areas: ["+東區", "北區"],
    otherNoGo: "@危險",
    strategy: ["-先看生活圈", "正常內容"]
  });
  const response = JSON.parse(post(runtime, payload).getContent());
  const sheet = runtime.sheets.get("C版買方診斷名單");

  assert.deepEqual(response, { ok: true, submissionId: payload.submissionId });
  assert.deepEqual(sheet.rows[0], EXPECTED_HEADERS);
  assert.equal(sheet.rows[1].length, EXPECTED_HEADERS.length);
  assert.equal(sheet.rows[1][3], "'=IMPORTXML(\"https://example.test\")");
  assert.equal(sheet.rows[1][4], "'0912345678");
  assert.equal(sheet.rows[1][7], "'+東區、北區");
  assert.equal(sheet.rows[1][19], "'@危險");
  assert.equal(sheet.rows[1][23], "'-先看生活圈、正常內容");
  assert.equal(sheet.rows[1][24], "是");
  assert.equal(sheet.rows[1][25], "新名單");
});

test("doPost deduplicates one submission id while holding and releasing the lock", () => {
  const runtime = createRuntime();
  const payload = validPayload();
  post(runtime, payload);
  post(runtime, payload);
  const sheet = runtime.sheets.get("C版買方診斷名單");

  assert.equal(sheet.rows.filter(row => row[1] === payload.submissionId).length, 1);
  assert.equal(runtime.lock.waits, 2);
  assert.equal(runtime.lock.releases, 2);
});

test("doGet returns status JSON and only callback-safe JSONP", () => {
  const runtime = createRuntime();
  const payload = validPayload();
  post(runtime, payload);

  const status = runtime.call("doGet({ parameter: __value })", {
    action: "status",
    submissionId: payload.submissionId
  });
  assert.deepEqual(JSON.parse(status.getContent()), {
    ok: true,
    found: true,
    submissionId: payload.submissionId
  });

  const jsonp = runtime.call("doGet({ parameter: __value })", {
    action: "status",
    submissionId: payload.submissionId,
    callback: "buyerStatus_abc123"
  });
  assert.match(jsonp.getContent(), /^buyerStatus_abc123\(\{"ok":true,"found":true,/);
  assert.equal(jsonp.mimeType, "application/javascript");

  const unsafe = runtime.call("doGet({ parameter: __value })", {
    action: "status",
    submissionId: payload.submissionId,
    callback: "alert(1)"
  });
  assert.equal(unsafe.mimeType, "application/json");
  assert.doesNotMatch(unsafe.getContent(), /alert/);
});
