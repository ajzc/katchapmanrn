/** Paths that may load Meta on the HubSpot blog. Articles are not included. */
export const BLOG_INDEX_PATHS = ["/", "/blog"];

export function normalizeBlogPath(pathname) {
  const raw = String(pathname || "/").split("?")[0].split("#")[0];
  const withSlash = raw.startsWith("/") ? raw : "/" + raw;
  if (withSlash.length > 1 && withSlash.endsWith("/")) return withSlash.slice(0, -1);
  return withSlash || "/";
}

export function isBlogIndexPath(pathname) {
  return BLOG_INDEX_PATHS.indexOf(normalizeBlogPath(pathname)) !== -1;
}

export function referrerBlocksBlogPixel(referrer) {
  if (!referrer) return false;
  let url;
  try { url = new URL(referrer); } catch { return true; }
  if (url.search) return true;
  const path = normalizeBlogPath(url.pathname);
  const host = url.hostname.replace(/^www\./, "");
  if (host === "katchapmanrn.com" || host === "blog.katchapmanrn.com") return !isBlogIndexPath(path);
  return path !== "/";
}

export function titleBlocksBlogPixel(title) {
  const text = String(title || "");
  if (!text.trim()) return true;
  if (/https?:/i.test(text)) return true;
  return false;
}

export function blogPixelAllowed({ pathname, search, referrer, title }) {
  if (search) return false;
  if (!isBlogIndexPath(pathname)) return false;
  if (referrerBlocksBlogPixel(referrer)) return false;
  if (titleBlocksBlogPixel(title)) return false;
  return true;
}
