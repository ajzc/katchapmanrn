import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { blogPixelAllowed } from "./blog-gate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snippet = fs.readFileSync(path.join(root, "measurement/HUBSPOT_BLOG_SNIPPET.html"), "utf8");
const PIXEL = "2738351096678050";

function run(page) {
  const calls = [];
  let reloads = 0;
  const stored = [];
  const fields = page.fields || [];
  const win = {
    fbq: undefined,
    _fbq: undefined,
    _hsp: [],
    localStorage: { setItem(k, v) { stored.push(["local", k, v]); } },
    sessionStorage: { setItem(k, v) { stored.push(["session", k, v]); } },
  };
  const location = {
    pathname: page.pathname,
    search: page.search || "",
    href: "https://blog.katchapmanrn.com" + page.pathname + (page.search || ""),
    reload() { reloads += 1; },
  };
  const document = {
    title: page.title,
    referrer: page.referrer || "",
    querySelectorAll() { return fields; },
    createElement() { return { async: false, src: "" }; },
    head: { appendChild(el) { calls.push(["script", el.src]); } },
  };
  const script = snippet.match(/<script>([\s\S]*)<\/script>/)[1];
  vm.runInNewContext(script, { window: win, location, document, URL });
  const listener = win._hsp[0][1];
  return {
    calls,
    stored,
    get reloads() { return reloads; },
    consent(flag) { listener({ allowed: flag }); },
    fbq() { return win.fbq && win.fbq.queue ? win.fbq.queue.map((args) => Array.from(args)) : []; },
  };
}

test("blog indexes are the only paths, without a treatment-word list", () => {
  assert.equal(blogPixelAllowed({ pathname: "/blog", search: "", referrer: "", title: "Journal" }), true);
  assert.equal(blogPixelAllowed({ pathname: "/", search: "", referrer: "https://www.google.com/", title: "Journal" }), true);
  assert.equal(blogPixelAllowed({
    pathname: "/blog/neurotoxin-notes",
    search: "",
    referrer: "",
    title: "Journal",
  }), false);
  assert.equal(blogPixelAllowed({
    pathname: "/blog",
    search: "",
    referrer: "https://blog.katchapmanrn.com/blog/neurotoxin-notes",
    title: "Journal",
  }), false);
  assert.equal(blogPixelAllowed({
    pathname: "/blog",
    search: "",
    referrer: "https://katchapmanrn.com/services",
    title: "Journal",
  }), false);
  assert.equal(blogPixelAllowed({ pathname: "/blog", search: "", referrer: "", title: "" }), false);
  assert.equal(blogPixelAllowed({
    pathname: "/blog",
    search: "",
    referrer: "",
    title: "See https://katchapmanrn.com/blog",
  }), false);
  assert.equal(snippet.includes("botox|"), false);
});

test("deny, allow, revoke, and allow again keep consent usable", () => {
  const page = run({ pathname: "/blog", title: "Journal", referrer: "" });
  page.consent(false);
  assert.equal(page.fbq().length, 0);
  assert.equal(page.reloads, 0);
  page.consent(true);
  const queued = page.fbq();
  assert.deepEqual(queued.find((call) => call[0] === "init"), ["init", PIXEL]);
  assert.equal(queued.filter((call) => call[0] === "consent" && call[1] === "grant").length, 1);
  assert.deepEqual(queued.at(-1), ["track", "PageView"]);
  page.consent(false);
  assert.equal(page.reloads, 1);
  assert.deepEqual(page.fbq().at(-1), ["consent", "revoke"]);
  page.consent(true);
  assert.deepEqual(page.fbq().at(-1), ["consent", "grant"]);
  assert.equal(page.fbq().filter((call) => call[1] === "PageView").length, 1);
  assert.equal(page.stored.length, 0);
});

test("a typed HubSpot field blocks reload and is not stored", () => {
  const page = run({
    pathname: "/blog",
    title: "Journal",
    referrer: "",
    fields: [{ type: "email", value: "patient@example.com" }],
  });
  page.consent(true);
  page.consent(false);
  assert.equal(page.reloads, 0);
  assert.deepEqual(page.fbq().at(-1), ["consent", "revoke"]);
  assert.equal(JSON.stringify(page.stored).includes("patient@example.com"), false);
  page.consent(true);
  assert.deepEqual(page.fbq().at(-1), ["consent", "grant"]);
});

test("article, referrer, and title gates refuse the pixel", () => {
  for (const page of [
    { pathname: "/blog/neurotoxin-notes", title: "Journal", referrer: "" },
    { pathname: "/blog", title: "Journal", referrer: "https://blog.katchapmanrn.com/blog/neurotoxin-notes" },
    { pathname: "/blog", title: "", referrer: "" },
    { pathname: "/blog", title: "Read https://blog.katchapmanrn.com/blog/neurotoxin-notes", referrer: "" },
  ]) {
    const ran = run(page);
    ran.consent(true);
    assert.equal(ran.fbq().length, 0, JSON.stringify(page));
    assert.equal(ran.reloads, 0);
  }
});
