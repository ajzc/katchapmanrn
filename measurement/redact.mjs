import { ADS_HOST, ADS_PAGE_TITLE } from "./config.mjs";

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

/** Neutral hit for Google. The treatment path, title, and query string are not included. */
export function redactForAds({ href, referrer }) {
  let pathname = "/";
  try {
    pathname = new URL(href, "https://" + ADS_HOST).pathname;
  } catch {
    pathname = "/";
  }
  const page_type = pageCategory(pathname);
  const out = {
    page_title: ADS_PAGE_TITLE,
    page_location: "https://" + ADS_HOST + "/p/" + page_type,
    page_type,
  };
  const page_referrer = referrerOrigin(referrer);
  if (page_referrer) out.page_referrer = page_referrer;
  return out;
}
