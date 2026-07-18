import test from "node:test";
import assert from "node:assert/strict";
import { loadStatusWithJsonp, submitLead } from "../src/api.js";

test("posts once and confirms the submission id", async () => {
  const calls = [];
  const result = await submitLead({
    endpoint: "https://script.google.com/macros/s/example/exec",
    payload: { submissionId: "sub-123" },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { type: "opaque" };
    },
    statusLoader: async () => ({ ok: true, found: true, submissionId: "sub-123" }),
    timeoutMs: 50
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    url: "https://script.google.com/macros/s/example/exec",
    init: {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ submissionId: "sub-123" })
    }
  });
  assert.deepEqual(result, { ok: true, submissionId: "sub-123" });
});

test("throws a typed timeout when the row cannot be confirmed", async () => {
  await assert.rejects(
    () => submitLead({
      endpoint: "https://script.google.com/macros/s/example/exec",
      payload: { submissionId: "sub-404" },
      fetchImpl: async () => ({ type: "opaque" }),
      statusLoader: async () => ({ ok: true, found: false }),
      timeoutMs: 5,
      pollIntervalMs: 1
    }),
    error => error.code === "SUBMISSION_NOT_CONFIRMED"
  );
});

test("keeps polling after a JSONP status load failure", async () => {
  let attempts = 0;
  const result = await submitLead({
    endpoint: "https://script.google.com/macros/s/example/exec",
    payload: { submissionId: "sub-retry" },
    fetchImpl: async () => ({ type: "opaque" }),
    statusLoader: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary JSONP error");
      return { ok: true, found: true, submissionId: "sub-retry" };
    },
    timeoutMs: 50,
    pollIntervalMs: 1
  });

  assert.equal(attempts, 2);
  assert.deepEqual(result, { ok: true, submissionId: "sub-retry" });
});

test("removes JSONP callback and script after a successful status response", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let appendedScript;
  let removed = 0;

  globalThis.window = {};
  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, "script");
      return { remove: () => { removed += 1; } };
    },
    head: {
      append(script) {
        appendedScript = script;
      }
    }
  };

  try {
    const pending = loadStatusWithJsonp(
      "https://script.google.com/macros/s/example/exec?action=status"
    );
    const callback = new URL(appendedScript.src).searchParams.get("callback");

    globalThis.window[callback]({ ok: true, found: true, submissionId: "sub-jsonp" });

    assert.deepEqual(await pending, { ok: true, found: true, submissionId: "sub-jsonp" });
    assert.equal(globalThis.window[callback], undefined);
    assert.equal(removed, 1);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test("removes JSONP callback and script when the status script errors", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let appendedScript;
  let removed = 0;

  globalThis.window = {};
  globalThis.document = {
    createElement: () => ({ remove: () => { removed += 1; } }),
    head: { append: script => { appendedScript = script; } }
  };

  try {
    const pending = loadStatusWithJsonp(
      "https://script.google.com/macros/s/example/exec?action=status"
    );
    const callback = new URL(appendedScript.src).searchParams.get("callback");

    appendedScript.onerror();

    await assert.rejects(pending, /status load failed/);
    assert.equal(globalThis.window[callback], undefined);
    assert.equal(removed, 1);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test("removes JSONP callback and script when status loading times out", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let appendedScript;
  let removed = 0;
  let onTimeout;

  globalThis.window = {};
  globalThis.document = {
    createElement: () => ({ remove: () => { removed += 1; } }),
    head: { append: script => { appendedScript = script; } }
  };
  globalThis.setTimeout = callback => {
    onTimeout = callback;
    return 1;
  };
  globalThis.clearTimeout = () => {};

  try {
    const pending = loadStatusWithJsonp(
      "https://script.google.com/macros/s/example/exec?action=status"
    );
    const callback = new URL(appendedScript.src).searchParams.get("callback");

    onTimeout();

    await assert.rejects(pending, /status timeout/);
    assert.equal(globalThis.window[callback], undefined);
    assert.equal(removed, 1);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});
