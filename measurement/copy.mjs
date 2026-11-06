/** Draft banner strings. Humanizer review is required before production. */
export const COPY = {
  heading: "Measurement choices",
  body: "Measurement stays off until you allow it. HubSpot can then record pages on Kat Chapman RN and connect a form you submit to that visit. Google, and Meta when a pixel is configured, receive a page category and event name only. They do not receive your name, message, appointment time, or which treatment page you opened. Book opens the scheduler. That click is not a completed booking.",
  allow: "Allow measurement",
  decline: "Not now",
  turnOff: "Turn measurement off",
  close: "Close",
  reopen: "Measurement choices",
  statusOn: "Measurement is on in this browser.",
  statusOff: "Measurement is off in this browser.",
  privacy: "Privacy policy",
};

export function bannerModel(consent, open) {
  if (!open) return { mode: "reopen" };
  if (consent === "granted") return { mode: "granted", primary: null, secondary: "turnOff" };
  if (consent === "denied") return { mode: "denied", primary: "allow", secondary: "close" };
  return { mode: "ask", primary: "allow", secondary: "decline" };
}
