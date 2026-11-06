import { META_FRAME_PATH, META_SCRIPT_URL, REJECTED_IDS } from "./config.mjs";

const PIXEL_RE = /^[0-9]{15,16}$/;
const META_NAMES = new Set(["PageView", "Lead", "Schedule", "OutboundClick"]);
const LINK_KINDS = new Set(["call", "text", "book"]);

/** True only for a pixel-shaped ID. Portal IDs, GA4 IDs, and blanks are rejected. */
export function isConfiguredPixelId(id) {
  if (typeof id !== "string") return false;
  const trimmed = id.trim();
  if (!PIXEL_RE.test(trimmed)) return false;
  if (REJECTED_IDS.has(trimmed)) return false;
  return true;
}

export function metaInstallPlan(pixelId, consent) {
  if (!isConfiguredPixelId(pixelId)) return { load: false, reason: "missing_id" };
  if (consent !== "granted") return { load: false, reason: "consent_required" };
  return { load: true, reason: "ready", frame: META_FRAME_PATH };
}

/**
 * Commands the isolated frame must run, in order, before any event.
 * init is the pixel ID only: no advanced-matching object.
 */
export function metaBootCommands(pixelId) {
  if (!isConfiguredPixelId(pixelId)) return [];
  return [
    ["consent", "revoke"],
    ["set", "autoConfig", false, pixelId],
    ["dataProcessingOptions", ["LDU"], 0, 0],
    ["init", pixelId],
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

export { META_SCRIPT_URL, META_FRAME_PATH };
