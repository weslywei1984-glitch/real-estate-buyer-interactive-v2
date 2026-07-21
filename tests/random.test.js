import test from "node:test";
import assert from "node:assert/strict";
import { randomId } from "../src/random.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// Apps Script 的 validate_ 用這個樣式擋掉不合法的識別碼。
const BACKEND_SUBMISSION_ID = /^[0-9a-f-]{16,64}$/i;

function withoutRandomUuid(run) {
  const original = crypto.randomUUID;
  Reflect.deleteProperty(Object.getPrototypeOf(crypto), "randomUUID");
  crypto.randomUUID = undefined;
  try {
    return run();
  } finally {
    crypto.randomUUID = original;
  }
}

test("uses the native uuid generator when it is available", () => {
  assert.match(randomId(), UUID_V4);
});

test("still generates backend-acceptable ids without crypto.randomUUID", () => {
  // http 上的非安全情境（自訂網域憑證未發下來時）沒有 crypto.randomUUID，
  // 少了備援整個送出流程會靜默中斷。
  withoutRandomUuid(() => {
    assert.equal(typeof crypto.randomUUID, "undefined");
    const ids = new Set();
    for (let index = 0; index < 200; index += 1) {
      const id = randomId();
      assert.match(id, UUID_V4);
      assert.match(id, BACKEND_SUBMISSION_ID);
      ids.add(id);
    }
    assert.equal(ids.size, 200, "generated ids must be unique");
  });
});
