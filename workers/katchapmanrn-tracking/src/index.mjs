/**
 * Replacement for the live worker katchapmanrn-tracking.
 * Captured script SHA-256 39c6f399849a2018cb6dc10aa5cd629a61a138e919b91f2d85fa5382c5c36e89
 * redirected /book and served always-on tracking at /js/main.js. This file does not.
 * Do not deploy until Pages is already serving /book and the measurement script.
 */

const PAGES_ORIGIN = "https://katchapmanrn.pages.dev";
const BLOG_UPSTREAM = PAGES_ORIGIN + "/blog";

/** Pages deploy, not the zone URL. The bare apex `/` was still a stale cached homepage. */
export function pagesUrl(request) {
  const incoming = new URL(request.url);
  const upstream = new URL(PAGES_ORIGIN);
  upstream.pathname = incoming.pathname;
  upstream.search = incoming.search;
  return upstream;
}

/** Cloudflare's request.cf.country only. Client headers are not a country. */
export function trustedCountry(request) {
  const cf = request && request.cf;
  const raw = cf && typeof cf.country === "string" ? cf.country : "";
  const code = String(raw).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return "";
  return code;
}

function contextResponse(request) {
  return new Response(JSON.stringify({ country: trustedCountry(request) }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "cdn-cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/measurement/context") return contextResponse(request);

    if (path === "/blog" || path === "/blog/" || path === "/blog.html") {
      const upstream = await fetch(BLOG_UPSTREAM, { redirect: "manual" });
      const headers = new Headers(upstream.headers);
      headers.delete("location");
      headers.set("cache-control", "public, max-age=60");
      headers.set("x-robots-tag", "all");
      return new Response(upstream.body, {
        status: upstream.status === 200 ? 200 : upstream.status,
        headers,
      });
    }

    return fetch(new Request(pagesUrl(request), request), { redirect: "manual" });
  },
};
