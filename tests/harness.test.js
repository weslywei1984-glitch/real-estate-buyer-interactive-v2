import test from "node:test";
import assert from "node:assert/strict";

test("Node test harness is active", () => {
  assert.equal(typeof structuredClone, "function");
});
