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

/**
 * Real page identity for Google and Meta. Personal query values are removed.
 * The host and path stay, so the hit is not moved onto a stand-in URL.
 */
export function publicPageHit({ href, title, referrer }) {
  let page_location = "https://" + ADS_HOST + "/";
  try {
    page_location = sanitizeHref(new URL(href, "https://" + ADS_HOST).href);
  } catch {
    page_location = "https://" + ADS_HOST + "/";
  }
  const out = {
    page_location,
    page_title: typeof title === "string" && title.trim() ? title.trim().slice(0, 300) : "Kat Chapman RN",
  };
  if (referrer) {
    try {
      const safeRef = sanitizeHref(new URL(referrer).href);
      if (safeRef) out.page_referrer = safeRef;
    } catch {
      /* ignore a referrer that is not a URL */
    }
  }
  return out;
}
