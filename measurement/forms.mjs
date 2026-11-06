/**
 * pageUri is intentionally omitted. A v3 submission whose context.pageUri is on
 * katchapmanrn.com was verified 2026-10-20 to return HTTP 200 and then be dropped,
 * so the contact never appears. pageName + hutk are the supported context fields
 * this site can send without that drop. Do not add form fields HubSpot has not
 * defined; unknown fields reject the whole submission.
 */
export function buildHubSpotContext({ pageName, hutk, consentGranted }) {
  const context = {};
  if (typeof pageName === "string" && pageName.trim()) {
    context.pageName = pageName.trim().slice(0, 256);
  }
  if (consentGranted && typeof hutk === "string" && hutk.trim()) {
    context.hutk = hutk.trim();
  }
  return context;
}

export function submissionSucceeded(httpOk, data) {
  if (!httpOk) return false;
  if (data && data.status === "error") return false;
  return true;
}

export function failureReason(httpOk) {
  return httpOk ? "rejected" : "network";
}
