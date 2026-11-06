import { META_SCRIPT_URL } from "./config.mjs";

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

/**
 * init receives the pixel ID only: no advanced-matching object.
 * Do not queue consent revoke before init. fbevents.js lockConsent()
 * stops the queue, so a later grant never runs and PageView stays queued.
 * This boot runs only after the US measurement gate has already allowed it.
 */
export function metaBootCommands(pixelId) {
  if (!isConfiguredPixelId(pixelId)) return [];
  return [
    ["set", "autoConfig", false, pixelId.trim()],
    ["dataProcessingOptions", ["LDU"], 0, 0],
    ["init", pixelId.trim()],
    ["consent", "grant"],
  ];
}

export function metaTrackCommand(eventName) {
  if (eventName === "page_view") return { method: "track", name: "PageView" };
  return null;
}

export function cleanFrameTrack(message) {
  if (!message || typeof message !== "object") return null;
  if (message.method !== "track" || message.name !== "PageView") return null;
  return { method: "track", name: "PageView" };
}

export { META_SCRIPT_URL };
