function text(value = "") {
  return String(value).trim();
}

function mobileDigits(value) {
  return text(value).replace(/[\s-]/g, "");
}

export function isTaiwanMobile(value) {
  return /^09\d{8}$/.test(mobileDigits(value));
}

export function isLineId(value) {
  const normalized = text(value).toLowerCase();
  return /^(?!\d+$)[a-z0-9._-]+$/.test(normalized);
}

export function isValidContact(value) {
  return isTaiwanMobile(value) || isLineId(value);
}

export function normalizeContact(value) {
  return isTaiwanMobile(value) ? mobileDigits(value) : text(value).toLowerCase();
}
