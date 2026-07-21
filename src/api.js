import { randomId } from "./random.js";

export function loadStatusWithJsonp(url, { timeoutMs = 5000, signal } = {}) {
  return new Promise((resolve, reject) => {
    const callback = `buyerStatus_${randomId().replaceAll("-", "")}`;
    const script = document.createElement("script");
    let settled = false;
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      delete window[callback];
      script.remove();
    };
    const fail = message => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };
    const onAbort = () => fail("status aborted");

    if (signal?.aborted) {
      onAbort();
      return;
    }

    window[callback] = data => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      fail("status load failed");
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => fail("status timeout"), timeoutMs);
    script.src = `${url}&callback=${encodeURIComponent(callback)}`;
    document.head.append(script);
  });
}

function waitForStatus(statusLoader, url, deadline) {
  const remainingMs = Math.max(0, deadline - Date.now());
  const controller = new AbortController();

  return new Promise(resolve => {
    let settled = false;
    const finish = outcome => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };
    const timer = setTimeout(() => {
      controller.abort();
      finish({ timedOut: true });
    }, remainingMs);

    Promise.resolve()
      .then(() => statusLoader(url, { timeoutMs: remainingMs, signal: controller.signal }))
      .then(
        status => {
          if (Date.now() >= deadline) {
            controller.abort();
            finish({ timedOut: true });
            return;
          }
          finish({ status });
        },
        () => finish({ status: { found: false } })
      );
  });
}

export async function submitLead({
  endpoint,
  payload,
  fetchImpl = fetch,
  statusLoader = loadStatusWithJsonp,
  timeoutMs = 12000,
  pollIntervalMs = 750
}) {
  await fetchImpl(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const url = `${endpoint}?action=status&submissionId=${encodeURIComponent(payload.submissionId)}`;
    const { status, timedOut } = await waitForStatus(statusLoader, url, deadline);
    if (status?.ok && status?.found && status.submissionId === payload.submissionId) {
      return { ok: true, submissionId: payload.submissionId };
    }
    if (timedOut) break;

    const sleepMs = Math.min(Math.max(0, pollIntervalMs), Math.max(0, deadline - Date.now()));
    if (sleepMs > 0) await new Promise(resolve => setTimeout(resolve, sleepMs));
  }

  const error = new Error("送出後尚未確認資料已寫入");
  error.code = "SUBMISSION_NOT_CONFIRMED";
  throw error;
}
