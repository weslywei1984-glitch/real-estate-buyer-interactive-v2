// crypto.randomUUID 只存在於安全情境（https 或 localhost）。自訂網域的憑證還沒
// 發下來時，網站是走 http 的，randomUUID 會是 undefined，整個送出流程會靜默中斷。
// crypto.getRandomValues 在非安全情境仍然可用，所以用它補一個等價的 v4 UUID。
export function randomId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
