/**
 * Replacement for the live worker katchapmanrn-tracking.
 * Captured script SHA-256 39c6f399849a2018cb6dc10aa5cd629a61a138e919b91f2d85fa5382c5c36e89
 * redirected /book and served always-on tracking at /js/main.js. This file does not.
 * Do not deploy until Pages is already serving /book and script.js consent.
 */

const BLOG_UPSTREAM = "https://katchapmanrn.pages.dev/blog";

export function trustedCountry(request) {
  const cf = request && request.cf;
  const fromCf = cf && typeof cf.country === "string" ? cf.country : null;
  const raw = fromCf !== null ? fromCf : (request.headers.get("CF-IPCountry") || "");
  const code = String(raw).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return "";
  return code;
}

export async function withCountryMeta(response, country) {
  if (!country) return response;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;
  const html = await response.text();
  if (html.includes('name="kcrn-country"')) {
    return new Response(html, { status: response.status, headers: response.headers });
  }
  const tag = `<meta name="kcrn-country" content="${country}">`;
  const body = html.includes("</head>") ? html.replace("</head>", tag + "</head>") : tag + html;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(body, { status: response.status, headers });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

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

    const response = await fetch(request);
    return withCountryMeta(response, trustedCountry(request));
  },
};
