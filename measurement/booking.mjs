import { MEETINGS_ORIGIN, MEETINGS_PATH } from "./config.mjs";

export function iframeSrcAllowed(src) {
  if (typeof src !== "string" || !src) return false;
  let u;
  try { u = new URL(src); } catch { return false; }
  if (u.protocol !== "https:") return false;
  if (u.origin !== MEETINGS_ORIGIN) return false;
  const path = u.pathname.replace(/\/$/, "") || "/";
  return path === MEETINGS_PATH;
}

/**
 * Authoritative booking signal from the official Meetings embed only.
 * A new-tab visit does not post this message. The meetings payload is ignored.
 */
export function bookingSignalFromMessage({ origin, data, iframeSrc }) {
  if (origin !== MEETINGS_ORIGIN) return { ok: false, reason: "origin" };
  if (!iframeSrcAllowed(iframeSrc)) return { ok: false, reason: "iframe" };
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, reason: "data" };
  if (data.meetingBookSucceeded !== true) return { ok: false, reason: "flag" };
  return { ok: true };
}

export function matchingIframeSrc(iframes, source) {
  if (!source || !iframes) return "";
  for (const frame of iframes) {
    if (frame && frame.contentWindow === source) {
      return frame.src || (frame.getAttribute && frame.getAttribute("src")) || "";
    }
  }
  return "";
}
