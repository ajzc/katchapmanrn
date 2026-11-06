import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pageCategory } from "./redact.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = new Set(["about", "services", "pricing", "gallery", "faq", "privacy", "terms"]);

function templateOf(name) {
  if (name === "index.html") return "home";
  if (name === "contact.html") return "contact";
  if (name === "404.html") return "not_found";
  if (CORE.has(name.replace(/\.html$/, ""))) return "core";
  return "local";
}

const pages = fs.readdirSync(root).filter((name) => name.endsWith(".html")).sort();

test("every public template includes the shared classic script", () => {
  const seen = new Set();
  assert.ok(pages.length >= 70);
  for (const name of pages) {
    const html = fs.readFileSync(path.join(root, name), "utf8");
    const template = templateOf(name);
    seen.add(template);
    assert.match(html, /<script src="(?:\/)?script\.js\?v=11"><\/script>/, name);
    assert.doesNotMatch(html, /type=["']module["'][^>]*script\.js|script\.js\?v=11"[^>]*type=["']module["']/, name);
    assert.doesNotMatch(html, /cloudflareinsights\.com/, name);
    assert.match(html, /styles\.css\?v=13/, name);
    assert.doesNotMatch(html, /fbq\(|G-R3W00H7HMB|connect\.facebook\.net|googletagmanager\.com\/gtag/, name);
    assert.match(html, /meetings\.hubspot\.com\/ajchapman20\/book-a-visit-kat-chapman-rn/, name);
    assert.equal(pageCategory("/" + name), template === "home" ? "home" : template === "local" ? "local" : template === "core" ? pageCategory("/" + name.replace(/\.html$/, "")) : template === "not_found" ? "not_found" : pageCategory("/" + name.replace(/\.html$/, "")));
    if (html.includes("cf-beacon")) {
      assert.ok(html.indexOf("script.js?v=11") < html.indexOf("cf-beacon"), name);
    }
  }
  for (const template of ["home", "contact", "not_found", "core", "local"]) assert.ok(seen.has(template));
  assert.ok(pages.filter((name) => templateOf(name) === "local").length > 20);
});

test("contact is the only lead form and the homepage join block is not a form", () => {
  const forms = pages.filter((name) => /<form[\s>]/i.test(fs.readFileSync(path.join(root, name), "utf8")));
  assert.deepEqual(forms, ["contact.html"]);
  const contact = fs.readFileSync(path.join(root, "contact.html"), "utf8");
  assert.match(contact, /data-hs-cf-bound="true"/);
  assert.match(contact, /name="message"/);
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(home, /id="join"/);
  assert.doesNotMatch(home, /<form[\s>]/i);
});

test("coverage map names Meta as unconfigured and separates HubSpot from ads events", () => {
  const map = fs.readFileSync(path.join(root, "measurement/COVERAGE.md"), "utf8");
  for (const phrase of [
    "META_PIXEL_ID",
    "unconfigured",
    "PageView",
    "Lead",
    "Schedule",
    "OutboundClick",
    "booking_completed",
    "generate_lead",
    "/track/book",
    "not a completed booking",
    "Adspirer",
    "pageUri",
    "Automatic Advanced Matching",
  ]) {
    assert.match(map, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const meta = fs.readFileSync(path.join(root, "measurement/meta.mjs"), "utf8");
  assert.match(meta, /autoConfig", false/);
  assert.match(meta, /dataProcessingOptions", \["LDU"\]/);
  assert.doesNotMatch(meta, /\{15,16\}/);
  assert.match(fs.readFileSync(path.join(root, "measurement/config.mjs"), "utf8"), /2738351096678050/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, "script.js"), "utf8"), /G-R3W00H7HMB|Chapman Med Spa/);
});
