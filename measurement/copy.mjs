/** Notice shown only while measurement is on. */
export const COPY = {
  notice: "We use Google, HubSpot, and, when configured, Meta to measure this page. You can opt out at any time.",
  keepOff: "Keep measurement off",
  privacy: "Privacy",
};

export function noticeModel(measuring) {
  return measuring ? { mode: "notice" } : { mode: "off" };
}
