import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker, { trustedCountry } from "./index.mjs";

const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "index.mjs"), "utf8");
const MEETINGS = "https://meetings.hubspot.com/ajchapman20/book-a-visit-kat-chapman-rn";

async function withFetch(handler, run) {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return handler(input, init);
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = previous;
  }
}

test("worker source does not force tracking, redirect /book, or remove a banner", () => {
  assert.equal(source.includes("Tracking loads for everyone"), false);
  assert.equal(source.includes("HTMLRewriter"), false);
  assert.equal(source.includes("#consent"), false);
  assert.equal(source.includes(MEETINGS), false);
  assert.equal(source.includes("connect.facebook.net"), false);
  assert.equal(source.includes("googletagmanager.com"), false);
});

test("/book and /book/ pass through to Pages", async () => {
  for (const pathname of ["/book", "/book/", "/book?utm_source=instagram"]) {
    const url = "https://katchapmanrn.com" + pathname;
    await withFetch(async (input) => {
      assert.equal(input instanceof Request ? input.url : String(input), url);
      return new Response("<main class=\"meetings-iframe-container\"></main>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }, async () => {
      const response = await worker.fetch(new Request(url));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("location"), null);
      const body = await response.text();
      assert.match(body, /meetings-iframe-container/);
      assert.equal(body.includes(MEETINGS), false);
    });
  }
});

test("/js/main.js is not replaced with always-on vendor loads", async () => {
  const originBody = "/* origin script.js consent gate */";
  await withFetch(async () => new Response(originBody, {
    status: 200,
    headers: { "content-type": "application/javascript" },
  }), async () => {
    const response = await worker.fetch(new Request("https://katchapmanrn.com/js/main.js"));
    const body = await response.text();
    assert.equal(body, originBody);
    assert.equal(body.includes("Cookie banner is never shown"), false);
    assert.equal(body.includes("fbq"), false);
  });
});

test("HTML keeps a consent banner and other paths are unchanged", async () => {
  const html = "<div id=\"consent\">Allow measurement</div><a href=\"/pricing\">Pricing</a>";
  await withFetch(async (input) => {
    assert.equal(new URL(input.url).pathname, "/pricing");
    return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
  }, async () => {
    const response = await worker.fetch(new Request("https://katchapmanrn.com/pricing"));
    assert.equal(await response.text(), html);
  });
});

function requestWithCountry(url, country, headers) {
  const request = new Request(url, { headers });
  if (country) Object.defineProperty(request, "cf", { value: { country } });
  return request;
}

test("country context is per request and ignores a spoofed header", async () => {
  assert.equal(trustedCountry({ cf: { country: "US" }, headers: { get: () => "GB" } }), "US");
  assert.equal(trustedCountry({ cf: { country: "XX" }, headers: { get: () => "US" } }), "");
  assert.equal(trustedCountry({ cf: { country: "T1" }, headers: { get: () => "US" } }), "");
  assert.equal(trustedCountry({ headers: { get: () => "US" } }), "");
  const html = "<head><title>About</title></head><div id=\"consent\">Allow measurement</div>";
  await withFetch(async () => new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" },
  }), async (calls) => {
    const us = await worker.fetch(requestWithCountry("https://katchapmanrn.com/measurement/context", "US", { "CF-IPCountry": "GB" }));
    assert.equal(us.headers.get("cache-control"), "private, no-store");
    assert.equal(us.headers.get("cdn-cache-control"), "no-store");
    assert.deepEqual(await us.json(), { country: "US" });
    const gb = await worker.fetch(requestWithCountry("https://katchapmanrn.com/measurement/context", "GB", { "CF-IPCountry": "US" }));
    assert.deepEqual(await gb.json(), { country: "GB" });
    const spoofed = await worker.fetch(new Request("https://katchapmanrn.com/measurement/context", { headers: { "CF-IPCountry": "US" } }));
    assert.deepEqual(await spoofed.json(), { country: "" });
    const unknown = await worker.fetch(requestWithCountry("https://katchapmanrn.com/measurement/context", "XX"));
    assert.deepEqual(await unknown.json(), { country: "" });
    assert.equal(calls.length, 0);
    const page = await worker.fetch(requestWithCountry("https://katchapmanrn.com/about", "US", { "CF-IPCountry": "GB" }));
    const body = await page.text();
    assert.equal(body, html);
    assert.equal(body.includes("kcrn-country"), false);
    assert.equal(page.headers.get("cache-control"), "public, max-age=600");
  });
});

test("/blog proxy behavior stays", async () => {
  await withFetch(async (input, init) => {
    assert.equal(String(input), "https://katchapmanrn.pages.dev/blog");
    assert.equal(init.redirect, "manual");
    return new Response("journal", {
      status: 200,
      headers: { location: "https://example.invalid/away", "content-type": "text/html" },
    });
  }, async () => {
    const response = await worker.fetch(new Request("https://katchapmanrn.com/blog"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("cache-control"), "public, max-age=60");
    assert.equal(response.headers.get("x-robots-tag"), "all");
    assert.equal(await response.text(), "journal");
  });
});
