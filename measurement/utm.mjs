import { CLICK_KEYS, UTM_KEYS } from "./config.mjs";

export function isSafeUtm(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v || v.length > 100) return false;
  if (/[@<>"'`\\\r\n]/.test(v)) return false;
  if (/https?:/i.test(v)) return false;
  if (/\d{10,}/.test(v.replace(/\D/g, ""))) return false;
  return /^[A-Za-z0-9 _.:~+\-|]+$/.test(v);
}

export function isSafeGl(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 800 && /^[A-Za-z0-9._~\-]+$/.test(value);
}

export function isSafeClickId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && /^[A-Za-z0-9._~\-]+$/.test(value);
}

/** Drop identifiers and contact fields from a query string. Keep safe UTMs and _gl. */
export function sanitizeHref(href) {
  let u;
  try { u = new URL(href); } catch { return href; }
  const next = new URLSearchParams();
  for (const [key, value] of u.searchParams.entries()) {
    if (UTM_KEYS.includes(key) && isSafeUtm(value)) next.append(key, value.trim());
    else if (CLICK_KEYS.includes(key) && isSafeClickId(value)) next.append(key, value);
    else if (key === "_gl" && isSafeGl(value)) next.append(key, value);
  }
  const search = next.toString();
  return u.origin + u.pathname + (search ? "?" + search : "") + u.hash;
}

export function readAllowlistedUtms(search) {
  const params = new URLSearchParams(search || "");
  const out = {};
  for (const key of UTM_KEYS) {
    const raw = params.get(key);
    if (raw && isSafeUtm(raw)) out[key] = raw.trim();
  }
  return out;
}

export function mergeFirstTouch(existing, incoming) {
  const out = { ...(existing || {}) };
  for (const key of UTM_KEYS) {
    if (!out[key] && incoming && incoming[key] && isSafeUtm(incoming[key])) out[key] = incoming[key];
  }
  return out;
}

export function appendUtms(url, utms) {
  let u;
  try { u = new URL(url); } catch { return url; }
  for (const key of UTM_KEYS) {
    const value = utms && utms[key];
    if (value && isSafeUtm(value) && !u.searchParams.has(key)) u.searchParams.set(key, value);
  }
  return u.toString();
}
