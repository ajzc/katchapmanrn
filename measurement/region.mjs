/** Conservative choice: only a known US visit may be measured. Not a legal finding for every state. */
export const MEASUREMENT_COUNTRIES = ["US"];

export function trustedCountryCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return "";
  return code;
}

export function measurementAllowed({ country, gpc, saved }) {
  if (gpc === true) return false;
  if (saved === "denied") return false;
  const code = trustedCountryCode(country);
  if (!code) return false;
  return MEASUREMENT_COUNTRIES.indexOf(code) !== -1;
}
