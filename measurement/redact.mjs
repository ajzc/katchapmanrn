import { ADS_HOST } from "./config.mjs";
import { sanitizeHref } from "./utm.mjs";

const CORE = new Map([
  ["/", "home"],
  ["/index.html", "home"],
  ["/about", "about"],
  ["/about.html", "about"],
  ["/services", "services"],
  ["/services.html", "services"],
  ["/pricing", "pricing"],
  ["/pricing.html", "pricing"],
  ["/contact", "contact"],
  ["/contact.html", "contact"],
  ["/gallery", "gallery"],
  ["/gallery.html", "gallery"],
  ["/faq", "faq"],
  ["/faq.html", "faq"],
  ["/privacy", "privacy"],
  ["/privacy.html", "privacy"],
  ["/terms", "terms"],
  ["/terms.html", "terms"],
  ["/404", "not_found"],
  ["/404.html", "not_found"],
]);

export function normalizePath(pathname) {
  let p = String(pathname || "/").split("?")[0].split("#")[0];
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p.toLowerCase();
}

export function pageCategory(pathname) {
  const p = normalizePath(pathname);
  if (CORE.has(p)) return CORE.get(p);
  if (p === "/blog" || p.startsWith("/blog/")) return "article";
  return "local";
}

export function referrerOrigin(referrer) {
  if (!referrer) return undefined;
  try {
    const u = new URL(referrer);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    return u.origin;
  } catch {
    return undefined;
  }
}

const NEUTRAL = new Set([
  "/", "/about", "/services", "/pricing", "/contact", "/gallery",
  "/faq", "/privacy", "/terms", "/book", "/404",
]);

/** Treatment words that must not appear in a Google or Meta field. */
const TREATMENT = /botox|dysport|filler|injectable|rhinoplasty|sculptra|radiesse|nasolabial|jawline|neurotoxin|facial-balancing|dermal|under-eye|brow-lift|lip-flip|lip-filler|prp|temple-filler|cheek-filler/i;

export function isNeutralPath(pathname) {
  const path = normalizePath(pathname).replace(/\.html$/, "");
  return NEUTRAL.has(path || "/");
}

export function leaksTreatment(value) {
  return TREATMENT.test(String(value || ""));
}

function ownHost(hostname) {
  const host = String(hostname || "").replace(/^www\./, "");
  return host === ADS_HOST || host === "blog." + ADS_HOST;
}

/** Origin only when the referrer path or query would reveal a treatment page. */
export function referrerForAds(referrer) {
  if (!referrer) return undefined;
  let u;
  try { u = new URL(referrer); } catch { return undefined; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
  const unsafe = leaksTreatment(u.pathname) || leaksTreatment(u.search) || (ownHost(u.hostname) && !isNeutralPath(u.pathname));
  if (unsafe) return u.origin;
  return u.origin + u.pathname;
}

/**
 * Google Analytics hit for a non-treatment URL only.
 * Treatment pages return null so no substitute page view is invented.
 * Titles and referrers that name a treatment are not copied through.
 */
export function publicPageHit({ href, title, referrer }) {
  let u;
  try { u = new URL(href, "https://" + ADS_HOST); } catch { return null; }
  if (!isNeutralPath(u.pathname)) return null;
  const clean = new URL(sanitizeHref(u.href));
  const kept = new URLSearchParams();
  for (const [key, value] of clean.searchParams.entries()) {
    if (!leaksTreatment(key + "=" + value)) kept.append(key, value);
  }
  const search = kept.toString();
  const rawTitle = typeof title === "string" ? title.trim() : "";
  const out = {
    page_location: clean.origin + clean.pathname + (search ? "?" + search : ""),
    page_title: rawTitle && !leaksTreatment(rawTitle) ? rawTitle.slice(0, 300) : "Kat Chapman RN",
  };
  const pageReferrer = referrerForAds(referrer);
  if (pageReferrer) out.page_referrer = pageReferrer;
  return out;
}

/** Meta's pixel has no supported switch for the page URL or referrer it attaches. */
export function metaAudienceAllowed({ href, referrer }) {
  let u;
  try { u = new URL(href, "https://" + ADS_HOST); } catch { return false; }
  if (!isNeutralPath(u.pathname)) return false;
  if (leaksTreatment(u.pathname) || leaksTreatment(u.search)) return false;
  if (referrer && (leaksTreatment(referrer) || referrerNamesTreatmentPage(referrer))) return false;
  return true;
}

function referrerNamesTreatmentPage(referrer) {
  try {
    const u = new URL(referrer);
    return ownHost(u.hostname) && !isNeutralPath(u.pathname);
  } catch {
    return true;
  }
}
