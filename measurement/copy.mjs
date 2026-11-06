/** Humanized banner. Do not add collection claims beyond this text. */
export const COPY = {
  heading: "Privacy settings",
  body: "Measurement stays off until you allow it. With your permission, HubSpot can record pages you visit on Kat Chapman RN and connect a submitted form to that visit. Submitted contact form details go to HubSpot. Google, and Meta when a pixel is configured, receive measurement data. You can change your choice in Privacy settings.",
  allow: "Allow measurement",
  keepOff: "Keep measurement off",
  privacySettings: "Privacy settings",
};

export function bannerModel(consent, open) {
  if (!open) return { mode: "reopen" };
  if (consent === "granted") return { mode: "granted", primary: null, secondary: "keepOff" };
  if (consent === "denied") return { mode: "denied", primary: "allow", secondary: "keepOff" };
  return { mode: "ask", primary: "allow", secondary: "keepOff" };
}
