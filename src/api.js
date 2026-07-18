export function loadStatusWithJsonp(url) {
  return new Promise((resolve, reject) => {
    const callback = `buyerStatus_${crypto.randomUUID().replaceAll("-", "")}`;
    const script = document.createElement("script");
    const cleanup = () => {
      delete window[callback];
      script.remove();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("status timeout"));
    }, 5000);

    window[callback] = data => {
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("status load failed"));
    };
    script.src = `${url}&callback=${encodeURIComponent(callback)}`;
    document.head.append(script);
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
    const status = await statusLoader(url).catch(() => ({ found: false }));
    if (status?.ok && status?.found && status.submissionId === payload.submissionId) {
      return { ok: true, submissionId: payload.submissionId };
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  const error = new Error("送出後尚未確認資料已寫入");
  error.code = "SUBMISSION_NOT_CONFIRMED";
  throw error;
}
