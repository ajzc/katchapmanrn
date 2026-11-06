/**
 * Replacement for the live worker katchapmanrn-tracking.
 * Captured script SHA-256 39c6f399849a2018cb6dc10aa5cd629a61a138e919b91f2d85fa5382c5c36e89
 * redirected /book and served always-on tracking at /js/main.js. This file does not.
 * Do not deploy until Pages is already serving /book and script.js consent.
 */

const BLOG_UPSTREAM = "https://katchapmanrn.pages.dev/blog";

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

    return fetch(request);
  },
};
