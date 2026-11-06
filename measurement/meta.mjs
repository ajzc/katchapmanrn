import { META_SCRIPT_URL } from "./config.mjs";

const META_NAMES = new Set(["PageView", "Lead", "Schedule", "OutboundClick"]);
const LINK_KINDS = new Set(["call", "text", "book"]);

/**
 * Meta's Google tag template validates a pixel ID as digits only (`^[0-9,]+$`).
 * It does not publish a 15- or 16-digit rule. One pixel is initialized here, so
 * commas (the template's multi-pixel form) are not accepted.
 */
export function isConfiguredPixelId(id) {
  if (typeof id !== "string") return false;
  const trimmed = id.trim();
  return /^[0-9]+$/.test(trimmed);
}

export function metaInstallPlan(pixelId, consent) {
  if (!isConfiguredPixelId(pixelId)) return { load: false, reason: "missing_id" };
  if (consent !== "granted") return { load: false, reason: "consent_required" };
  return { load: true, reason: "ready", script: META_SCRIPT_URL };
}

/** init receives the pixel ID only: no advanced-matching object. */
export function metaBootCommands(pixelId) {
  if (!isConfiguredPixelId(pixelId)) return [];
  return [
    ["consent", "revoke"],
    ["set", "autoConfig", false, pixelId.trim()],
    ["dataProcessingOptions", ["LDU"], 0, 0],
    ["init", pixelId.trim()],
    ["consent", "grant"],
  ];
}

export function metaTrackCommand(eventName, params) {
  if (eventName === "page_view") return { method: "track", name: "PageView" };
  if (eventName === "generate_lead") return { method: "track", name: "Lead" };
  if (eventName === "booking_completed") return { method: "track", name: "Schedule" };
  if (eventName === "outbound_click") {
    const kind = params && params.link_kind;
    if (!LINK_KINDS.has(kind)) return null;
    return { method: "trackCustom", name: "OutboundClick", params: { link_kind: kind } };
  }
  return null;
}

export function cleanFrameTrack(message) {
  if (!message || typeof message !== "object") return null;
  const method = message.method === "trackCustom" ? "trackCustom" : message.method === "track" ? "track" : "";
  const name = typeof message.name === "string" ? message.name : "";
  if (!method || !META_NAMES.has(name)) return null;
  if (name === "OutboundClick") {
    const kind = message.params && message.params.link_kind;
    if (!LINK_KINDS.has(kind)) return null;
    return { method: "trackCustom", name, params: { link_kind: kind } };
  }
  if (method !== "track") return null;
  return { method: "track", name };
}

export { META_SCRIPT_URL };
