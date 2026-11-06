/** Notice shown only while measurement is on. Not reviewed for publication. */
export const COPY = {
  notice: "Google, HubSpot, and Meta measure this page. Opt out any time.",
  keepOff: "Keep measurement off",
  privacy: "Privacy",
};

export function noticeModel(measuring) {
  return measuring ? { mode: "notice" } : { mode: "off" };
}
