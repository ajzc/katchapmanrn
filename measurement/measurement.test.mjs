import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { META_PIXEL_ID, GA4_MEASUREMENT_ID, HS_PORTAL_ID } from "./config.mjs";
import { isConfiguredPixelId, metaInstallPlan, metaBootCommands, metaTrackCommand, cleanFrameTrack } from "./meta.mjs";
import { sanitizeHref } from "./utm.mjs";
import { publicPageHit, pageCategory } from "./redact.mjs";
import { buildHubSpotContext, submissionSucceeded, failureReason } from "./forms.mjs";
import { bookingSignalFromMessage } from "./booking.mjs";
import { classifyClick } from "./events.mjs";
import { createController } from "./controller.mjs";
import { COPY, bannerModel } from "./copy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_PIXEL = "123456789012345";

function mem(initial) {
  const m = new Map(Object.entries(initial || {}));
  return {
    get: (k) => (m.has(k) ? m.get(k) : null),
    set: (k, v) => { m.set(k, String(v)); },
  };
}

function flatten(value, acc = []) {
  if (value == null || value instanceof Date) return acc;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    acc.push(String(value));
    return acc;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => flatten(item, acc));
    return acc;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      acc.push(key);
      flatten(item, acc);
    });
  }
  return acc;
}

function setup(overrides = {}) {
  const scripts = [];
  const gtagCalls = [];
  const hsq = [];
  const hsp = [];
  const fbqCalls = [];
  let fbqFn = null;
  let loc = {
    href: "https://katchapmanrn.com/botox-huntersville?utm_source=instagram&utm_campaign=lip-filler&email=patient@example.com&gclid=CLICKID&fbclid=FB123",
    pathname: "/botox-huntersville",
    search: "?utm_source=instagram&utm_campaign=lip-filler&email=patient@example.com&gclid=CLICKID&fbclid=FB123",
    title: "Botox TITLETOKEN in Huntersville",
    referrer: "https://www.google.com/search?q=botox+huntersville",
    ...(overrides.location || {}),
  };
  const dataset = {};
  const controller = createController({
    metaPixelId: Object.prototype.hasOwnProperty.call(overrides, "pixelId") ? overrides.pixelId : "",
    local: overrides.local || mem(),
    session: overrides.session || mem(),
    getLocation: () => loc,
    replaceHref(href) {
      const u = new URL(href);
      loc = { ...loc, href, pathname: u.pathname, search: u.search };
    },
    getCookie: () => overrides.hutk || "",
    loadScript(url) { scripts.push(url); },
    gtag() { gtagCalls.push(Array.from(arguments)); },
    hsq,
    hsp,
    setDataset(name, value) { dataset[name] = value; },
    ensureFbq() {
      function fbq() { fbqCalls.push(Array.from(arguments)); }
      fbq.disablePushState = false;
      fbqFn = fbq;
    },
    get fbq() { return fbqFn; },
  });
  return {
    controller,
    scripts,
    gtagCalls,
    hsq,
    hsp,
    fbqCalls,
    dataset,
    get loc() { return loc; },
  };
}

function gaText(gtagCalls) {
  return flatten(gtagCalls).join("\n").toLowerCase();
}

test("production Meta pixel id is empty and known non-pixel ids are rejected", () => {
  assert.equal(META_PIXEL_ID, "");
  assert.equal(metaInstallPlan("", "granted").reason, "missing_id");
  assert.equal(isConfiguredPixelId(HS_PORTAL_ID), true);
  assert.equal(isConfiguredPixelId("12345678901234567"), true);
  assert.equal(isConfiguredPixelId(GA4_MEASUREMENT_ID), false);
  assert.equal(isConfiguredPixelId("12345"), true);
  assert.equal(isConfiguredPixelId("123,456"), false);
  assert.equal(isConfiguredPixelId(TEST_PIXEL), true);
  assert.equal(metaInstallPlan(TEST_PIXEL, "denied").reason, "consent_required");
  assert.equal(metaInstallPlan(TEST_PIXEL, "granted").reason, "ready");
});

test("Meta boot sequence disables auto events and advanced matching", () => {
  const commands = metaBootCommands(TEST_PIXEL);
  assert.deepEqual(commands.map((c) => c[0]), [
    "consent", "set", "dataProcessingOptions", "init", "consent",
  ]);
  assert.deepEqual(commands[0], ["consent", "revoke"]);
  assert.deepEqual(commands[1], ["set", "autoConfig", false, TEST_PIXEL]);
  assert.deepEqual(commands[2], ["dataProcessingOptions", ["LDU"], 0, 0]);
  assert.equal(commands[3].length, 2);
  assert.deepEqual(commands[3], ["init", TEST_PIXEL]);
  assert.deepEqual(commands[4], ["consent", "grant"]);
  assert.equal(metaBootCommands("").length, 0);
  assert.deepEqual(metaTrackCommand("page_view"), { method: "track", name: "PageView" });
  assert.deepEqual(metaTrackCommand("generate_lead"), { method: "track", name: "Lead" });
  assert.deepEqual(metaTrackCommand("booking_completed"), { method: "track", name: "Schedule" });
  assert.deepEqual(metaTrackCommand("outbound_click", { link_kind: "book" }), {
    method: "trackCustom",
    name: "OutboundClick",
    params: { link_kind: "book" },
  });
  assert.equal(metaTrackCommand("form_submit_failed"), null);
  assert.deepEqual(cleanFrameTrack({
    method: "trackCustom",
    name: "OutboundClick",
    params: { link_kind: "book", email: "a@b.com", page: "/botox-huntersville" },
  }), { method: "trackCustom", name: "OutboundClick", params: { link_kind: "book" } });
  assert.deepEqual(cleanFrameTrack({ method: "track", name: "Lead", params: { message: "lips" } }), {
    method: "track",
    name: "Lead",
  });
});

test("consent gates tags and keeps the real page address", () => {
  const env = setup({ hutk: "HUTKVALUE123" });
  assert.equal(env.dataset.measurementMeta, "unconfigured");
  assert.equal(env.scripts.length, 0);
  assert.equal(env.loc.search.includes("email="), false);
  assert.equal(env.loc.search.includes("gclid=CLICKID"), true);
  assert.equal(env.loc.search.includes("utm_campaign=lip-filler"), true);
  assert.equal(env.loc.pathname, "/botox-huntersville");

  const anchor = { href: "https://meetings.hubspot.com/ajchapman20/book-a-visit-kat-chapman-rn", hasAttribute: () => true, setAttribute(k, v) { this.href = v; } };
  assert.deepEqual(env.controller.handleAnchor(anchor), { kind: "book", sent: false });
  assert.match(anchor.href, /utm_campaign=lip-filler/);
  assert.doesNotMatch(anchor.href, /patient@|gclid|fbclid/);
  assert.equal(env.gtagCalls.length, 0);
  assert.equal(env.hsq.length, 0);

  env.controller.grant();
  assert.deepEqual(env.scripts, [
    "https://www.googletagmanager.com/gtag/js?id=G-0BX0PK6GZP",
    "https://js.hs-scripts.com/22023986.js",
  ]);
  assert.equal(env.scripts.some((src) => src.includes("facebook")), false);
  const text = gaText(env.gtagCalls);
  assert.match(text, /\/botox-huntersville/);
  assert.match(text, /titleToken/i);
  assert.equal(text.includes("patient@"), false);
  assert.equal(text.includes("hutkvalue123"), false);
  assert.equal(env.gtagCalls.filter((c) => c[0] === "event" && c[1] === "page_view").length, 1);
  const update = env.gtagCalls.find((c) => c[0] === "consent" && c[1] === "update");
  assert.equal(update[2].analytics_storage, "granted");
  assert.equal(update[2].ad_storage, "denied");
  assert.equal(update[2].ad_user_data, "denied");
  const config = env.gtagCalls.find((c) => c[0] === "config");
  assert.equal(config[2].send_page_view, false);
  assert.equal(config[2].allow_google_signals, false);
  assert.equal(config[2].allow_ad_personalization_signals, false);
  assert.deepEqual(config[2].linker.domains, ["katchapmanrn.com", "blog.katchapmanrn.com"]);
  assert.equal(JSON.stringify(config).includes("meetings.hubspot.com"), false);

  env.controller.grant();
  assert.equal(env.gtagCalls.filter((c) => c[1] === "page_view").length, 1);

  const booked = { href: anchor.href, hasAttribute: () => true, setAttribute(k, v) { this.href = v; } };
  env.controller.handleAnchor(booked);
  assert.equal(env.gtagCalls.filter((c) => c[1] === "booking_completed").length, 0);
  assert.equal(env.gtagCalls.filter((c) => c[1] === "generate_lead").length, 0);
  assert.equal(env.gtagCalls.filter((c) => c[1] === "outbound_click" && c[2].link_kind === "book").length, 1);
  assert.deepEqual(env.hsq.map((entry) => entry[0] === "setPath" ? entry[1] : entry[0]), [
    "/track/book", "trackPageView", "/botox-huntersville",
  ]);

  const context = env.controller.buildFormContext("Botox TITLETOKEN");
  assert.equal(context.hutk, "HUTKVALUE123");
  assert.equal(context.pageName, "Botox TITLETOKEN");
  assert.equal("pageUri" in context, false);
  assert.equal(env.controller.reportForm("contact", true), true);
  assert.equal(env.controller.reportForm("contact", true), false);
  assert.equal(env.gtagCalls.filter((c) => c[1] === "generate_lead").length, 1);
  const lead = env.gtagCalls.find((c) => c[1] === "generate_lead");
  assert.deepEqual(lead[2], { form_id: "contact", lead_source: "hubspot_form" });
  assert.equal(env.controller.reportForm("contact", false, "rejected"), true);
  assert.equal(env.gtagCalls.filter((c) => c[1] === "form_submit_failed").length, 1);
  assert.equal(JSON.stringify(lead).includes("patient@"), false);

  const beforeRevoke = env.gtagCalls.length;
  env.controller.revoke();
  assert.equal(env.gtagCalls.length, beforeRevoke + 1);
  const revoked = env.gtagCalls.at(-1);
  assert.equal(revoked[0], "consent");
  assert.equal(revoked[2].analytics_storage, "denied");
  const afterRevoke = env.gtagCalls.length;
  env.controller.handleAnchor(booked);
  assert.equal(env.gtagCalls.length, afterRevoke);
  env.controller.grant();
  assert.equal(env.gtagCalls.filter((c) => c[1] === "page_view").length, 2);
});

test("denied consent still keeps the CRM form and omits the HubSpot cookie", () => {
  const env = setup({ hutk: "HUTKVALUE123" });
  env.controller.deny();
  assert.equal(env.scripts.length, 0);
  const fields = [
    { name: "email", value: "qa-measurement@example.com" },
    { name: "message", value: "lip filler on 2026-12-01" },
  ];
  const body = { fields, context: env.controller.buildFormContext("Contact Kat Chapman RN") };
  assert.equal(body.fields[0].value, "qa-measurement@example.com");
  assert.equal(body.context.hutk, undefined);
  assert.equal(env.controller.reportForm("contact", true), false);
  assert.equal(env.gtagCalls.length, 0);
  assert.equal(env.fbqCalls.length, 0);
});

test("a supplied pixel id loads on the real page and does not receive form text", () => {
  const env = setup({ pixelId: TEST_PIXEL });
  assert.equal(env.dataset.measurementMeta, "configured");
  env.controller.grant();
  assert.equal(env.scripts[0], "https://connect.facebook.net/en_US/fbevents.js");
  const init = env.fbqCalls.find((call) => call[0] === "init");
  assert.deepEqual(init, ["init", TEST_PIXEL]);
  const page = env.fbqCalls.find((call) => call[1] === "PageView");
  assert.equal(page.length, 2);
  env.controller.handleAnchor({ href: "tel:+17045849785", hasAttribute: () => false, setAttribute() {} });
  const click = env.fbqCalls.find((call) => call[1] === "OutboundClick");
  assert.deepEqual(click[2], { link_kind: "call" });
  assert.equal(classifyClick("https://katchapmanrn.com/book", true), null);
  assert.equal(env.controller.onBookingMessage({
    origin: "https://meetings.hubspot.com",
    source: "frame-win",
    data: { meetingBookSucceeded: true, meetingsPayload: { email: "a@b.com", dateString: "2026-12-01" } },
  }, [{ contentWindow: "frame-win", src: "https://meetings.hubspot.com/ajchapman20/book-a-visit-kat-chapman-rn?embed=true" }]), true);
  const schedule = env.fbqCalls.find((call) => call[1] === "Schedule");
  assert.deepEqual(schedule, ["track", "Schedule"]);
  assert.equal(JSON.stringify(env.fbqCalls).includes("a@b.com"), false);
  assert.equal(JSON.stringify(env.fbqCalls).includes("2026-12-01"), false);
  env.controller.revoke();
  assert.equal(env.fbqCalls.at(-1)[0], "consent");
  assert.equal(env.fbqCalls.at(-1)[1], "revoke");
});

test("booking truthfulness rejects clicks, wrong origins, and string flags", () => {
  const good = "https://meetings.hubspot.com/ajchapman20/book-a-visit-kat-chapman-rn?embed=true";
  assert.equal(bookingSignalFromMessage({ origin: "https://meetings.hubspot.com", data: { meetingBookSucceeded: true }, iframeSrc: good }).ok, true);
  assert.equal(bookingSignalFromMessage({ origin: "https://evil.test", data: { meetingBookSucceeded: true }, iframeSrc: good }).reason, "origin");
  assert.equal(bookingSignalFromMessage({ origin: "https://app.hubspot.com", data: { meetingBookSucceeded: true }, iframeSrc: good }).reason, "origin");
  assert.equal(bookingSignalFromMessage({ origin: "https://meetings-eu1.hubspot.com", data: { meetingBookSucceeded: true }, iframeSrc: "https://meetings-eu1.hubspot.com/ajchapman20/book-a-visit-kat-chapman-rn" }).reason, "origin");
  assert.equal(bookingSignalFromMessage({ origin: "https://meetings.hubspot.com", data: { meetingBookSucceeded: "true" }, iframeSrc: good }).reason, "flag");
  assert.equal(bookingSignalFromMessage({ origin: "https://meetings.hubspot.com", data: "readyForConsentListener", iframeSrc: good }).reason, "data");
  assert.equal(bookingSignalFromMessage({ origin: "https://meetings.hubspot.com", data: { meetingBookSucceeded: true }, iframeSrc: "https://meetings.hubspot.com/someone-else/book" }).reason, "iframe");
  assert.equal(bookingSignalFromMessage({ origin: "https://meetings.hubspot.com", data: { meetingBookSucceeded: true }, iframeSrc: "" }).reason, "iframe");
  assert.equal(classifyClick("https://meetings.hubspot.com/ajchapman20/book-a-visit-kat-chapman-rn", false), "book");
  assert.equal(classifyClick("tel:+17045849785", false), "call");
  assert.equal(classifyClick("sms:+17045849785", false), "text");
  assert.equal(classifyClick("https://katchapmanrn.com/book", true), null);
  assert.equal(classifyClick("/book", true), null);
  const result = bookingSignalFromMessage({
    origin: "https://meetings.hubspot.com",
    data: { meetingBookSucceeded: true, meetingsPayload: { email: "hidden@example.com" } },
    iframeSrc: good,
  });
  assert.deepEqual(result, { ok: true });
});

test("public hits keep the real page and strip contact query values", () => {
  assert.equal(pageCategory("/"), "home");
  assert.equal(pageCategory("/contact"), "contact");
  assert.equal(pageCategory("/blog/is-botox-safe-for-first-timers"), "article");
  assert.equal(pageCategory("/botox-huntersville"), "local");
  assert.equal(pageCategory("/404.html"), "not_found");
  const hit = publicPageHit({
    href: "https://katchapmanrn.com/lip-filler-mooresville?email=a@b.com&utm_source=google&date=2026-11-06",
    title: "Lip filler in Mooresville | Kat Chapman RN",
    referrer: "https://www.google.com/search?q=lip+filler",
  });
  assert.equal(hit.page_location, "https://katchapmanrn.com/lip-filler-mooresville?utm_source=google");
  assert.equal(hit.page_title, "Lip filler in Mooresville | Kat Chapman RN");
  assert.equal(hit.page_referrer, "https://www.google.com/search");
  assert.equal(JSON.stringify(hit).includes("a@b.com"), false);
  assert.equal(JSON.stringify(hit).includes("2026-11-06"), false);
});

test("HubSpot form context stays on supported fields", () => {
  assert.deepEqual(buildHubSpotContext({ pageName: "Contact", hutk: "", consentGranted: true }), { pageName: "Contact" });
  assert.deepEqual(buildHubSpotContext({ pageName: "Contact", hutk: "abc", consentGranted: false }), { pageName: "Contact" });
  assert.equal(submissionSucceeded(true, {}), true);
  assert.equal(submissionSucceeded(true, { status: "error" }), false);
  assert.equal(submissionSucceeded(false, {}), false);
  assert.equal(failureReason(true), "rejected");
  assert.equal(failureReason(false), "network");
});

test("inline URL sanitizer matches the module", () => {
  const src = fs.readFileSync(path.join(root, "script.js"), "utf8");
  const start = src.indexOf("function kcrnSanitizeHref");
  const end = src.indexOf("(function () {", start);
  const sandbox = { URL, URLSearchParams };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src.slice(start, end) + "\nglobalThis.kcrnSanitizeHref = kcrnSanitizeHref;", sandbox);
  const samples = [
    "https://katchapmanrn.com/botox-huntersville?utm_campaign=lip-filler&email=patient@example.com&gclid=abc&fbclid=z&utm_source=bad@x.com&_gl=abc.DEF-123#visit",
    "https://katchapmanrn.com/contact?utm_medium=social&phone=7045849785",
    "https://katchapmanrn.com/",
    "https://katchapmanrn.com/pricing?utm_term=hello_world",
  ];
  for (const href of samples) assert.equal(sandbox.kcrnSanitizeHref(href), sanitizeHref(href));
});

test("booking iframe outside the scheduler container is ignored", () => {
  const env = setup();
  env.controller.grant();
  const outside = {
    contentWindow: "other-win",
    src: "https://meetings.hubspot.com/ajchapman20/book-a-visit-kat-chapman-rn?embed=true",
    closest: () => null,
  };
  assert.equal(env.controller.onBookingMessage({
    origin: "https://meetings.hubspot.com",
    source: "other-win",
    data: { meetingBookSucceeded: true },
  }, [outside]), false);
  assert.equal(env.gtagCalls.filter((call) => call[1] === "booking_completed").length, 0);
});

test("banner uses the humanized labels and the review file matches", () => {
  assert.equal(bannerModel("unset", true).secondary, "keepOff");
  assert.equal(bannerModel("denied", false).mode, "reopen");
  assert.equal(bannerModel("granted", true).secondary, "keepOff");
  assert.equal(bannerModel("denied", true).primary, "allow");
  assert.doesNotMatch(COPY.body, /category and event name only|event name only/i);
  const review = fs.readFileSync(path.join(root, "measurement/CONSENT_COPY_FOR_REVIEW.md"), "utf8");
  for (const value of Object.values(COPY)) assert.match(review, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(review, /second humanizer pass/i);
  assert.doesNotMatch(review, /Chapman Med Spa|Med Spa/i);
  const blog = fs.readFileSync(path.join(root, "measurement/HUBSPOT_BLOG_SNIPPET.html"), "utf8");
  assert.doesNotMatch(blog, /src=["'][^"']*(googletagmanager|hs-scripts\.com)/);
  assert.match(blog, /Do not add Google Analytics/);
  const book = fs.readFileSync(path.join(root, "book.html"), "utf8");
  assert.match(book, /meetings-iframe-container/);
  assert.match(book, /Open the scheduler in a new tab/);
});
