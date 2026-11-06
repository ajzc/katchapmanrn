import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { META_PIXEL_ID, GA4_MEASUREMENT_ID, HS_PORTAL_ID } from "./config.mjs";
import { isConfiguredPixelId, metaInstallPlan, metaBootCommands, metaTrackCommand, cleanFrameTrack } from "./meta.mjs";
import { sanitizeHref } from "./utm.mjs";
import { redactForAds, pageCategory } from "./redact.mjs";
import { buildHubSpotContext, submissionSucceeded, failureReason } from "./forms.mjs";
import { bookingSignalFromMessage } from "./booking.mjs";
import { classifyClick } from "./events.mjs";
import { createController } from "./controller.mjs";
import { createMetaFrame } from "./meta-mount.mjs";
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
  const posts = [];
  let frameHandlers = null;
  let destroyed = false;
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
    mountMetaFrame(handlers) {
      frameHandlers = handlers;
      return {
        post(data) { posts.push(data); },
        destroy() { destroyed = true; },
      };
    },
  });
  return {
    controller,
    scripts,
    gtagCalls,
    hsq,
    hsp,
    posts,
    dataset,
    get loc() { return loc; },
    ready(data) { frameHandlers.onFrameMessage(data); },
    get destroyed() { return destroyed; },
  };
}

function gaText(gtagCalls) {
  return flatten(gtagCalls).join("\n").toLowerCase();
}

test("production Meta pixel id is empty and known non-pixel ids are rejected", () => {
  assert.equal(META_PIXEL_ID, "");
  assert.equal(metaInstallPlan("", "granted").reason, "missing_id");
  assert.equal(metaInstallPlan(HS_PORTAL_ID, "granted").load, false);
  assert.equal(isConfiguredPixelId(GA4_MEASUREMENT_ID), false);
  assert.equal(isConfiguredPixelId("12345"), false);
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

test("isolated frame boots a test id without parent page data and ignores junk", () => {
  const html = fs.readFileSync(path.join(root, "measurement/meta-frame.html"), "utf8");
  assert.match(html, /noindex/);
  assert.doesNotMatch(html, /parent\.document|parent\.location/);
  assert.doesNotMatch(html, /botox|patient@|TITLETOKEN/i);
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const calls = [];
  const scripts = [];
  const parent = { postMessage() {} };
  const win = {
    parent,
    document: {
      getElementById() { return null; },
      createElement() { return {}; },
      head: { appendChild(el) { scripts.push(el.src); } },
    },
    addEventListener() {},
  };
  vm.runInNewContext(script, { window: win });
  const parentEvent = (data, origin = "https://katchapmanrn.com") => win.__kcrnHandleMetaMessage({
    source: parent,
    origin,
    data,
  });
  assert.equal(parentEvent({ source: "kcrn-measure", command: "boot", pixelId: HS_PORTAL_ID }), false);
  assert.equal(scripts.length, 0);
  assert.equal(parentEvent({ source: "other", command: "boot", pixelId: TEST_PIXEL }), false);
  assert.equal(parentEvent({
    source: "kcrn-measure",
    command: "track",
    method: "track",
    name: "PageView",
    params: { page: "/botox-huntersville" },
  }), true);
  assert.equal(parentEvent({ source: "kcrn-measure", command: "boot", pixelId: TEST_PIXEL }), true);
  assert.deepEqual(scripts, ["https://connect.facebook.net/en_US/fbevents.js"]);
  const init = callsFrom(win).find((c) => c[0] === "init");
  assert.deepEqual(init, ["init", TEST_PIXEL]);
  assert.equal(parentEvent({ source: "kcrn-measure", command: "boot", pixelId: TEST_PIXEL }, "https://evil.test"), false);
  parentEvent({
    source: "kcrn-measure",
    command: "track",
    method: "trackCustom",
    name: "OutboundClick",
    params: { link_kind: "text", email: "a@b.com", date: "2026-12-01" },
  });
  parentEvent({
    source: "kcrn-measure",
    command: "track",
    method: "track",
    name: "Schedule",
    params: { date: "2026-12-01", meetingsPayload: { email: "a@b.com" } },
  });
  const fbqCalls = callsFrom(win);
  assert.ok(fbqCalls.some((c) => c[0] === "track" && c[1] === "PageView" && c.length === 2));
  assert.ok(fbqCalls.some((c) => c[0] === "trackCustom" && c[1] === "OutboundClick" && c[2].link_kind === "text" && Object.keys(c[2]).length === 1));
  const schedule = fbqCalls.find((c) => c[1] === "Schedule");
  assert.deepEqual(schedule, ["track", "Schedule"]);
  assert.equal(JSON.stringify(fbqCalls).includes("botox"), false);
  assert.equal(JSON.stringify(fbqCalls).includes("a@b.com"), false);
  assert.equal(JSON.stringify(fbqCalls).includes("2026-12-01"), false);
});

function callsFrom(win) {
  return win.fbq && win.fbq.queue ? win.fbq.queue.map((args) => Array.from(args)) : [];
}

test("consent gates tags, redacts ads hits, and does not load Meta without an id", () => {
  const env = setup({ hutk: "HUTKVALUE123" });
  assert.equal(env.dataset.measurementMeta, "unconfigured");
  assert.equal(env.scripts.length, 0);
  assert.equal(env.loc.search.includes("email="), false);
  assert.equal(env.loc.search.includes("gclid="), false);
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
  for (const leaked of ["botox", "titleToken", "lip-filler", "patient@", "gclid", "fbclid", "huntersville", "hutkvalue123", "2026-"]) {
    assert.equal(text.includes(leaked), false, leaked);
  }
  assert.match(text, /https:\/\/katchapmanrn\.com\/p\/local/);
  assert.match(text, /kat chapman rn/);
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
  assert.equal(gaText(env.gtagCalls).includes("titleToken"), false);

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

test("denied consent never loads tags and omits the HubSpot cookie", () => {
  const env = setup({ hutk: "HUTKVALUE123" });
  env.controller.deny();
  assert.equal(env.scripts.length, 0);
  assert.deepEqual(env.controller.buildFormContext("Contact"), { pageName: "Contact" });
  assert.equal(env.controller.reportForm("contact", true), false);
  assert.equal(env.gtagCalls.length, 0);
});

test("a supplied pixel id posts boot and neutral events only after the frame is ready", () => {
  const env = setup({ pixelId: TEST_PIXEL });
  assert.equal(env.dataset.measurementMeta, "configured");
  env.controller.grant();
  assert.equal(env.posts.length, 0);
  assert.equal(env.scripts[0].includes("googletagmanager"), true);
  env.ready({ source: "kcrn-measure", command: "ready" });
  assert.equal(env.posts[0].command, "boot");
  assert.equal(env.posts[0].pixelId, TEST_PIXEL);
  assert.equal(env.posts.some((p) => p.name === "PageView" && !p.params), true);
  assert.equal(JSON.stringify(env.posts).includes("botox"), false);
  assert.equal(JSON.stringify(env.posts).includes("TITLETOKEN"), false);
  env.controller.handleAnchor({ href: "tel:+17045849785", hasAttribute: () => false, setAttribute() {} });
  const click = env.posts.find((p) => p.name === "OutboundClick");
  assert.deepEqual(click.params, { link_kind: "call" });
  assert.equal(env.controller.onBookingMessage({
    origin: "https://meetings.hubspot.com",
    source: "frame-win",
    data: { meetingBookSucceeded: true, meetingsPayload: { email: "a@b.com", dateString: "2026-12-01" } },
  }, [{ contentWindow: "frame-win", src: "https://meetings.hubspot.com/ajchapman20/book-a-visit-kat-chapman-rn?embed=true" }]), true);
  const schedule = env.posts.find((p) => p.name === "Schedule");
  assert.equal(schedule.params, undefined);
  assert.equal(JSON.stringify(env.posts).includes("a@b.com"), false);
  env.controller.revoke();
  assert.equal(env.destroyed, true);
  assert.equal(env.posts.at(-1).command, "revoke");
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
  const result = bookingSignalFromMessage({
    origin: "https://meetings.hubspot.com",
    data: { meetingBookSucceeded: true, meetingsPayload: { email: "hidden@example.com" } },
    iframeSrc: good,
  });
  assert.deepEqual(result, { ok: true });
});

test("ads redaction collapses every public template and strips the query", () => {
  assert.equal(pageCategory("/"), "home");
  assert.equal(pageCategory("/contact"), "contact");
  assert.equal(pageCategory("/blog/is-botox-safe-for-first-timers"), "article");
  assert.equal(pageCategory("/botox-huntersville"), "local");
  assert.equal(pageCategory("/404.html"), "not_found");
  const redacted = redactForAds({
    href: "https://katchapmanrn.com/lip-filler-mooresville?email=a@b.com&date=2026-11-06",
    referrer: "https://blog.katchapmanrn.com/blog/is-botox-safe-for-first-timers?q=1",
  });
  assert.equal(redacted.page_location, "https://katchapmanrn.com/p/local");
  assert.equal(redacted.page_title, "Kat Chapman RN");
  assert.equal(redacted.page_referrer, "https://blog.katchapmanrn.com");
  assert.equal(JSON.stringify(redacted).includes("lip"), false);
  assert.equal(JSON.stringify(redacted).includes("botox"), false);
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

test("meta frame mount is sandboxed and ignores other windows", () => {
  const posted = [];
  const iframe = {
    style: {},
    contentWindow: { postMessage(data, origin) { posted.push({ data, origin }); } },
    setAttribute(k, v) { this[k] = v; },
  };
  const listeners = [];
  const api = createMetaFrame(
    { addEventListener(type, fn) { listeners.push(fn); }, removeEventListener() {} },
    { createElement() { return iframe; }, body: { appendChild() {} } },
    { onFrameMessage(data) { posted.push({ fromFrame: data }); } }
  );
  assert.equal(iframe.sandbox, "allow-scripts");
  assert.equal(iframe.referrerPolicy, "no-referrer");
  assert.equal(String(iframe.sandbox).includes("allow-same-origin"), false);
  listeners[0]({ source: iframe.contentWindow, origin: "null", data: { command: "ready" } });
  listeners[0]({ source: {}, origin: "null", data: { command: "ready" } });
  listeners[0]({ source: iframe.contentWindow, origin: "https://katchapmanrn.com", data: { command: "ready" } });
  assert.equal(posted.filter((p) => p.fromFrame).length, 1);
  api.post({ command: "boot", pixelId: TEST_PIXEL });
  assert.equal(posted.at(-1).data.source, "kcrn-measure");
  assert.equal(posted.at(-1).data.pixelId, TEST_PIXEL);
  assert.equal(JSON.stringify(posted).includes("botox"), false);
});

test("banner states cover ask, deny, allow, and revoke", () => {
  assert.equal(bannerModel("unset", true).mode, "ask");
  assert.equal(bannerModel("denied", false).mode, "reopen");
  assert.equal(bannerModel("granted", true).secondary, "turnOff");
  assert.equal(bannerModel("denied", true).primary, "allow");
  const review = fs.readFileSync(path.join(root, "measurement/CONSENT_COPY_FOR_REVIEW.md"), "utf8");
  for (const value of Object.values(COPY)) assert.match(review, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(review, /not approved for publication/i);
  assert.doesNotMatch(review, /Chapman Med Spa|Med Spa/i);
});
