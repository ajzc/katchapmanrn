const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const m = require("../measurement.js");

const root = path.join(__dirname, "..");
const CONFIG = m.CONFIG;
const PHONE = "tel:+17045849785";
const MEETINGS = "https://meetings.hubspot.com/ajchapman20/book-a-visit-kat-chapman-rn";
const TREATMENT = "/botox-huntersville.html";
const TREATMENT_TITLE = "Botox in Huntersville | Kat Chapman RN";
const DIRTY_SEARCH = "?utm_term=botox&utm_content=lip-filler&utm_source=Instagram&utm_campaign=lipfiller&gclid=abcDEF12345&fbclid=IwAR0123456789&email=kate%40example.com&phone=7045849785";

function start(state, extra, config) {
  return m.transition(state || m.initialState(), Object.assign({
    type: "start",
    surface: "site",
    hostname: "katchapmanrn.com",
    pathname: "/",
    search: "",
    referrer: "",
    consent: "unknown",
    storedAttribution: {},
    title: TREATMENT_TITLE
  }, extra || {}), config || CONFIG);
}

function grant(state, extra, config) {
  return m.transition(state, Object.assign({
    type: "set_consent",
    choice: "granted",
    surface: state.surface,
    hostname: "katchapmanrn.com",
    pathname: "/pricing",
    search: "",
    referrer: "",
    title: TREATMENT_TITLE
  }, extra || {}), config || CONFIG);
}

function gaNames(effects) {
  return effects.filter(function (fx) { return fx.type === "ga_event"; }).map(function (fx) { return fx.name; });
}

test("production ids are the known GA4 property and nothing invented", function () {
  assert.equal(CONFIG.ga4MeasurementId, "G-0BX0PK6GZP");
  assert.equal(CONFIG.metaPixelId, "");
  assert.equal(CONFIG.googleAdsId, "");
  assert.equal(CONFIG.googleAdsConversions.generate_lead, "");
  assert.equal(CONFIG.googleAdsConversions.booking_completed, "");
  assert.equal(CONFIG.hubspotPortalId, "22023986");
  assert.equal(m.hasHealth("template"), false);
  assert.equal(m.hasHealth("lipfiller"), true);
  assert.equal(m.hasHealth("under-eye"), true);
});

test("consent denied or missing loads no tags and records no events", function () {
  const denied = start(null, { consent: "denied", pathname: TREATMENT, search: DIRTY_SEARCH });
  assert.equal(denied.state.consent, "denied");
  assert.equal(denied.effects.some(function (fx) { return fx.type === "ga_bootstrap" || fx.type === "ga_event" || fx.type === "hs_bootstrap" || fx.type === "meta_frame"; }), false);
  assert.equal(denied.effects.some(function (fx) { return fx.type === "notice" && fx.integration === "meta" && fx.status === "unconfigured"; }), true);
  assert.equal(denied.effects.some(function (fx) { return fx.type === "notice" && fx.integration === "google_ads" && fx.status === "unconfigured"; }), true);
  assert.equal(denied.effects.some(function (fx) { return fx.type === "notice" && fx.integration === "booking_completed" && fx.status === "embed_hook_only"; }), true);

  let state = start(null, { pathname: TREATMENT, search: DIRTY_SEARCH }).state;
  assert.equal(m.transition(state, { type: "click", href: MEETINGS, dataBook: true }).effects.length, 0);
  assert.equal(m.transition(state, { type: "form_success", formId: "contact", fields: { email: "kate@example.com" } }).effects.length, 0);
  assert.equal(m.transition(state, { type: "booking_signal", origin: "https://meetings.hubspot.com", data: { meetingBookSucceeded: true } }).effects.length, 0);

  const revoked = m.transition(state, { type: "set_consent", choice: "denied" });
  state = revoked.state;
  assert.equal(state.consent, "denied");
  assert.deepEqual(state.attribution, {});
  assert.equal(revoked.effects.some(function (fx) { return fx.type === "clear_cookies"; }), true);
  assert.equal(revoked.effects.some(function (fx) { return fx.type === "ga_consent_denied"; }), true);
  assert.equal(revoked.effects.some(function (fx) { return fx.type === "meta_revoke"; }), true);
  assert.equal(revoked.effects.some(function (fx) { return fx.type === "clear_attribution"; }), true);
  assert.equal(m.transition(state, { type: "click", href: PHONE }).effects.length, 0);
});

test("accept sends one neutral pageview and a second start does not repeat it", function () {
  let state = start(null, { pathname: TREATMENT, search: DIRTY_SEARCH, referrer: "https://katchapmanrn.com/lip-filler-mooresville?email=kate@example.com" }).state;
  const accepted = grant(state, { pathname: TREATMENT, search: DIRTY_SEARCH, referrer: "https://www.google.com/search?q=botox+huntersville" });
  state = accepted.state;
  const views = accepted.effects.filter(function (fx) { return fx.name === "page_view"; });
  const boots = accepted.effects.filter(function (fx) { return fx.type === "ga_bootstrap"; });
  assert.equal(views.length, 1);
  assert.equal(boots.length, 1);
  assert.equal(boots[0].config.send_page_view, false);
  assert.equal(boots[0].config.allow_google_signals, false);
  assert.equal(boots[0].config.allow_ad_personalization_signals, false);
  assert.equal(boots[0].adsDataRedaction, true);
  assert.equal(boots[0].urlPassthrough, false);
  assert.equal(boots[0].config.linker.decorate_forms, false);
  assert.equal(boots[0].consentUpdate.ad_personalization, "denied");
  assert.equal(boots[0].consentUpdate.analytics_storage, "granted");
  assert.equal(boots[0].consentDefault.analytics_storage, "denied");
  assert.equal(views[0].params.page_title, "Kat Chapman RN");
  assert.equal(views[0].params.content_group, "service");
  assert.equal(views[0].params.page_location, "https://katchapmanrn.com/service?utm_source=instagram&gclid=abcDEF12345");
  assert.equal(views[0].params.page_referrer, "https://www.google.com/search");
  assert.equal(Object.prototype.hasOwnProperty.call(views[0].params, "send_to"), false);
  const blob = JSON.stringify(accepted.effects);
  const hit = JSON.stringify(views.concat(boots));
  assert.equal(blob.includes("botox"), false);
  assert.equal(blob.includes("lip"), false);
  assert.equal(blob.includes("kate@"), false);
  assert.equal(blob.includes("704"), false);
  assert.equal(blob.includes(TREATMENT_TITLE), false);
  assert.equal(blob.includes("utm_term"), false);
  assert.equal(hit.includes("fbclid"), false);
  const hs = accepted.effects.find(function (fx) { return fx.type === "hs_bootstrap"; });
  assert.equal(hs.portalId, "22023986");
  assert.equal(hs.advertisement, false);
  assert.equal(accepted.effects.some(function (fx) { return fx.type === "meta_frame"; }), false);

  const again = grant(state, { pathname: TREATMENT });
  assert.equal(again.effects.some(function (fx) { return fx.name === "page_view"; }), false);
  const restart = start(state, { pathname: "/contact", consent: "granted" });
  assert.equal(restart.effects.length, 0);
});

test("revoking and accepting again does not emit a second pageview", function () {
  let state = start(null, { pathname: "/faq", consent: "granted" }).state;
  state = m.transition(state, { type: "set_consent", choice: "denied" }).state;
  const back = grant(state, { pathname: "/faq" });
  assert.equal(back.effects.some(function (fx) { return fx.name === "page_view" || fx.type === "ga_bootstrap"; }), false);
  assert.equal(back.state.gaEnabled, true);
  const click = m.transition(back.state, { type: "click", href: PHONE });
  assert.deepEqual(gaNames(click.effects), ["contact_click"]);
  assert.equal(JSON.stringify(click.effects).includes("704"), false);
});

test("book clicks are not completed bookings", function () {
  let state = start(null, { consent: "granted", pathname: "/contact" }).state;
  const click = m.transition(state, { type: "click", href: MEETINGS, dataBook: true });
  assert.deepEqual(gaNames(click.effects), ["booking_start"]);
  assert.equal(click.effects[0].params.method, "scheduler");
  assert.equal(click.effects.some(function (fx) { return fx.name === "booking_completed" || fx.name === "Schedule"; }), false);
  assert.equal(click.effects.find(function (fx) { return fx.type === "hs_event"; }).name, "pe22023986_booking_start");
  assert.deepEqual(click.effects.find(function (fx) { return fx.type === "hs_event"; }).properties, {});
  const text = m.transition(state, { type: "click", href: "sms:+17045849785" });
  assert.equal(text.effects[0].params.method, "text");
  assert.equal(JSON.stringify(text.effects).includes("704"), false);
  const mail = m.transition(state, { type: "click", href: "mailto:kate@example.com" });
  assert.deepEqual(mail.effects[0].params, { destination: "email" });
  assert.equal(JSON.stringify(mail.effects).includes("kate@"), false);
});

test("form success is verified, deduped, and redacted", function () {
  let state = start(null, { consent: "granted", pathname: "/contact" }).state;
  const lead = m.transition(state, {
    type: "form_success",
    formId: "consult_request",
    fields: { email: "kate@example.com", message: "lip filler on March 2", phone: "7045849785" }
  });
  state = lead.state;
  assert.deepEqual(lead.effects[0].params, { form_id: "consult_request" });
  assert.equal(JSON.stringify(lead.effects).includes("kate@"), false);
  assert.equal(JSON.stringify(lead.effects).includes("filler"), false);
  assert.equal(JSON.stringify(lead.effects).includes("704"), false);
  assert.equal(JSON.stringify(lead.effects).includes("March"), false);
  assert.equal(m.transition(state, { type: "form_success", formId: "consult_request" }).effects.length, 0);
  assert.equal(m.transition(state, { type: "form_success", formId: "botox_interest" }).effects.length, 0);
  const other = m.transition(state, { type: "form_success", formId: "contact" });
  assert.equal(other.effects[0].params.form_id, "contact");
  assert.equal(other.effects.find(function (fx) { return fx.type === "hs_event"; }).name, "pe22023986_lead_contact");
});

test("completed booking requires the HubSpot meetings signal and drops payload details", function () {
  let state = start(null, { consent: "granted", pathname: "/services" }).state;
  assert.equal(m.isVerifiedBooking({ origin: "https://meetings.hubspot.com.evil.com", data: { meetingBookSucceeded: true } }), false);
  assert.equal(m.isVerifiedBooking({ origin: "https://evil.example", data: { meetingBookSucceeded: true } }), false);
  assert.equal(m.isVerifiedBooking({ origin: "https://meetings.hubspot.com", data: "readyForConsentListener" }), false);
  assert.equal(m.isVerifiedBooking({ origin: "https://meetings.hubspot.com", data: { meetingBookSucceeded: false } }), false);
  const ignored = [
    { type: "booking_signal", origin: "https://katchapmanrn.com", data: { meetingBookSucceeded: true } },
    { type: "booking_signal", origin: "https://meetings.hubspot.com", data: { ready: true } }
  ];
  ignored.forEach(function (action) {
    assert.equal(m.transition(state, action).effects.length, 0);
  });
  const booked = m.transition(state, {
    type: "booking_signal",
    origin: "https://meetings.hubspot.com",
    data: {
      meetingBookSucceeded: true,
      contact: { email: "kate@example.com", phone: "7045849785" },
      date: "2026-12-01",
      meetingType: "Botox"
    }
  });
  state = booked.state;
  assert.deepEqual(booked.effects[0].params, { method: "hubspot_meetings" });
  assert.equal(booked.effects.some(function (fx) { return fx.name === "Schedule"; }), false);
  const blob = JSON.stringify(booked.effects);
  assert.equal(blob.includes("kate@"), false);
  assert.equal(blob.includes("2026"), false);
  assert.equal(blob.includes("Botox"), false);
  assert.equal(blob.includes("704"), false);
  assert.equal(m.transition(state, {
    type: "booking_signal",
    origin: "https://meetings-eu1.hubspot.com",
    data: { meetingBookSucceeded: true }
  }).effects.length, 0);
});

test("a configured pixel still cannot receive treatment context or a book click as Schedule", function () {
  const pixel = Object.assign({}, CONFIG, { metaPixelId: "123456789012345" });
  const started = start(null, {
    consent: "granted",
    pathname: "/is-botox-safe.html",
    hostname: "katchapmanrn.com",
    search: "?fbclid=IwAR0123456789&gclid=abcDEF12345"
  }, pixel);
  const frame = started.effects.find(function (fx) { return fx.type === "meta_frame"; });
  assert.equal(frame.src, "/measure-frame.html?fbclid=IwAR0123456789");
  assert.equal(frame.src.includes("botox"), false);
  assert.equal(started.effects.find(function (fx) { return fx.name === "page_view"; }).params.page_location.includes("fbclid"), false);
  const click = m.transition(started.state, { type: "click", href: MEETINGS, dataBook: true }, pixel);
  assert.equal(click.effects.some(function (fx) { return fx.type === "meta_track" && fx.name === "BookingStart" && fx.custom === true; }), true);
  assert.equal(click.effects.some(function (fx) { return fx.name === "Schedule" || fx.name === "booking_completed"; }), false);
  const done = m.transition(started.state, {
    type: "booking_signal",
    origin: "https://meetings.hubspot.com",
    data: { meetingBookSucceeded: true, email: "kate@example.com" }
  }, pixel);
  assert.equal(done.effects.some(function (fx) { return fx.type === "meta_track" && fx.name === "Schedule" && fx.custom === false; }), true);
  assert.equal(JSON.stringify(done.effects).includes("kate@"), false);
});

test("google ads labels attach only to real success events", function () {
  const ads = Object.assign({}, CONFIG, {
    googleAdsId: "AW-123456789",
    googleAdsConversions: { generate_lead: "", booking_completed: "AbCdEfGh" }
  });
  const state = start(null, { consent: "granted", pathname: "/pricing" }, ads).state;
  const startClick = m.transition(state, { type: "click", href: MEETINGS, dataBook: true }, ads);
  assert.equal(Object.prototype.hasOwnProperty.call(startClick.effects[0].params, "send_to"), false);
  const lead = m.transition(state, { type: "form_success", formId: "contact" }, ads);
  assert.equal(Object.prototype.hasOwnProperty.call(lead.effects[0].params, "send_to"), false);
  const done = m.transition(state, {
    type: "booking_signal",
    origin: "https://meetings.hubspot.com",
    data: { meetingBookSucceeded: true }
  }, ads);
  assert.equal(done.effects[0].params.send_to, "AW-123456789/AbCdEfGh");
  const broken = Object.assign({}, CONFIG, { googleAdsId: "AW-TEST", googleAdsConversions: { booking_completed: "AbCdEfGh" } });
  const unsafe = m.transition(state, {
    type: "booking_signal",
    origin: "https://meetings.hubspot.com",
    data: { meetingBookSucceeded: true }
  }, broken);
  assert.equal(Object.prototype.hasOwnProperty.call(unsafe.effects[0].params, "send_to"), false);
});

test("journal measurement collapses article addresses", function () {
  const result = start(null, {
    surface: "blog",
    consent: "granted",
    hostname: "blog.katchapmanrn.com",
    pathname: "/blog/is-botox-safe-for-first-timers",
    title: "Is Botox safe for first timers | Kat Chapman RN",
    referrer: "https://katchapmanrn.com/botox-huntersville"
  });
  const view = result.effects.find(function (fx) { return fx.name === "page_view"; });
  assert.equal(view.params.page_location, "https://blog.katchapmanrn.com/journal");
  assert.equal(view.params.page_title, "Kat Chapman RN");
  assert.equal(view.params.content_group, "journal");
  assert.equal(view.params.page_referrer, "https://katchapmanrn.com/service");
  assert.equal(result.effects.some(function (fx) { return fx.type === "hs_bootstrap"; }), false);
  assert.equal(result.effects.some(function (fx) { return fx.type === "hs_consent" && fx.advertisement === false; }), true);
  assert.equal(JSON.stringify(result.effects).toLowerCase().includes("botox"), false);
  assert.equal(m.metaFrameSrc("blog.katchapmanrn.com", "IwAR0123456789"), "https://katchapmanrn.com/measure-frame.html?fbclid=IwAR0123456789");
});

test("attribution decoration keeps the meetings path and drops unsafe parameters", function () {
  const attr = m.scrubAttribution(DIRTY_SEARCH + "&utm_medium=social&msclkid=abcDEF12345");
  assert.equal(attr.utm_source, "instagram");
  assert.equal(attr.utm_medium, "social");
  assert.equal(attr.gclid, "abcDEF12345");
  assert.equal(attr.fbclid, "IwAR0123456789");
  assert.equal(attr.utm_term, undefined);
  assert.equal(attr.utm_campaign, undefined);
  assert.equal(attr.email, undefined);
  const decorated = m.decorateOutbound(MEETINGS, attr, "hubspotutk=0123456789abcdef0123456789abcdef; __hstc=12345.botox.1");
  const url = new URL(decorated);
  assert.equal(url.pathname, "/ajchapman20/book-a-visit-kat-chapman-rn");
  assert.equal(url.searchParams.get("gclid"), "abcDEF12345");
  assert.equal(url.searchParams.get("utm_source"), "instagram");
  assert.equal(url.searchParams.get("hubspotutk"), "0123456789abcdef0123456789abcdef");
  assert.equal(url.searchParams.get("__hstc"), null);
  assert.equal(url.searchParams.get("utm_term"), null);
  assert.equal(url.searchParams.get("email"), null);
  assert.equal(m.safeSearch(DIRTY_SEARCH), "?utm_source=instagram&gclid=abcDEF12345&fbclid=IwAR0123456789");
  assert.equal(m.decorateOutbound(PHONE, attr, ""), PHONE);
  assert.equal(m.decorateOutbound("https://katchapmanrn.com/pricing", attr, ""), "https://katchapmanrn.com/pricing");
  const stored = m.scrubAttribution({ utm_source: "botox", gclid: "abcDEF12345" });
  assert.equal(stored.utm_source, undefined);
  assert.equal(stored.gclid, "abcDEF12345");
});

test("an existing google tag blocks a second tag", function () {
  const result = start(null, { consent: "granted", existingGa: true, pathname: "/about" });
  assert.equal(result.effects.some(function (fx) { return fx.integration === "ga4" && fx.status === "blocked_duplicate"; }), true);
  assert.equal(result.effects.some(function (fx) { return fx.type === "ga_bootstrap" || fx.name === "page_view"; }), false);
  assert.equal(result.state.gaEnabled, false);
});

test("meta frame ignores untrusted messages, repeats, and extra fields", function () {
  let session = m.createFrameSession();
  const cookie = "kcrn_consent=granted";
  function send(origin, data, jar) {
    const result = m.handleFrameMessage(session, { origin: origin, data: data }, { cookie: jar == null ? cookie : jar, frameOrigin: "https://katchapmanrn.com" });
    session = result.session;
    return result.commands;
  }
  assert.equal(send("https://evil.example", { source: "kcrn-parent", type: "init", pixelId: "123456789012345" }).length, 0);
  assert.equal(send("https://katchapmanrn.com", { source: "kcrn-parent", type: "init", pixelId: "123456789012345" }, "kcrn_consent=denied").length, 0);
  assert.equal(send("https://katchapmanrn.com", { source: "kcrn-parent", type: "init", pixelId: "PIXEL" }).length, 0);
  const init = send("https://katchapmanrn.com", { source: "kcrn-parent", type: "init", pixelId: "123456789012345", em: "kate@example.com" });
  assert.deepEqual(init, [{ op: "init", pixelId: "123456789012345", autoConfig: false, advancedMatching: false }]);
  assert.equal(send("https://katchapmanrn.com", { source: "kcrn-parent", type: "init", pixelId: "123456789012345" }).length, 0);
  assert.equal(send("https://katchapmanrn.com", { source: "kcrn-parent", type: "track", name: "PageView" }).length, 0);
  assert.equal(send("https://katchapmanrn.com", { source: "kcrn-parent", type: "track", name: "Purchase" }).length, 0);
  const tracked = send("https://blog.katchapmanrn.com", { source: "kcrn-parent", type: "track", name: "Lead", email: "kate@example.com" });
  assert.deepEqual(tracked, [{ op: "track", method: "track", name: "Lead" }]);
  assert.equal(send("https://katchapmanrn.com", { source: "kcrn-parent", type: "revoke" })[0].op, "revoke");
  assert.equal(send("https://katchapmanrn.com", { source: "kcrn-parent", type: "track", name: "Lead" }).length, 0);
  const queue = m.pixelQueue("123456789012345");
  assert.equal(queue[1][1], "autoConfig");
  assert.equal(queue[2].length, 2);
  assert.deepEqual(queue[3], ["track", "PageView"]);
});

test("consent cookie is shared on the brand hosts and can be revoked", function () {
  assert.equal(m.serializeConsentCookie("granted", { hostname: "www.katchapmanrn.com", protocol: "https:" }), "kcrn_consent=granted; Path=/; Max-Age=15552000; SameSite=Lax; Secure; Domain=.katchapmanrn.com");
  assert.equal(m.serializeConsentCookie("denied", { hostname: "blog.katchapmanrn.com", protocol: "https:" }).includes("Domain=.katchapmanrn.com"), true);
  assert.equal(m.serializeConsentCookie("granted", { hostname: "127.0.0.1", protocol: "http:" }).includes("Domain="), false);
  assert.equal(m.serializeConsentCookie("granted", { hostname: "127.0.0.1", protocol: "http:" }).includes("Secure"), false);
  assert.equal(m.serializeConsentCookie("maybe", { hostname: "katchapmanrn.com", protocol: "https:" }), "");
  assert.equal(m.readConsent("kcrn_consent=denied; other=1", "granted"), "denied");
  assert.equal(m.readConsent("", "granted"), "granted");
  assert.equal(m.readConsent("", "nope"), "unknown");
});

test("every public template classifies without leaking its filename", function () {
  const exact = {
    "index.html": "home",
    "about.html": "about",
    "pricing.html": "pricing",
    "contact.html": "contact",
    "gallery.html": "gallery",
    "faq.html": "faq",
    "services.html": "services",
    "privacy.html": "legal",
    "terms.html": "legal",
    "404.html": "not_found"
  };
  const files = fs.readdirSync(root).filter(function (name) { return name.endsWith(".html") && name !== "measure-frame.html"; });
  assert.ok(files.length >= 70);
  files.forEach(function (file) {
    const route = file === "index.html" ? "/" : "/" + file.replace(/\.html$/, "");
    const key = exact[file] || "service";
    assert.equal(m.publicPathKey(route), key);
    assert.equal(m.publicPathKey(route + ".html"), key);
    const model = m.pageModel("site", route);
    const location = m.buildLocation(model, {});
    if (!exact[file]) {
      assert.equal(location, "https://katchapmanrn.com/service");
      assert.equal(location.includes(file.replace(/\.html$/, "")), false);
    }
    assert.equal(JSON.stringify(location).toLowerCase().includes("botox"), false);
    assert.equal(JSON.stringify(location).toLowerCase().includes("filler"), false);
  });
  assert.equal(m.publicPathKey("/%62otox-huntersville"), "service");
  assert.equal(m.buildLocation(m.pageModel("site", "/%62otox-huntersville"), {}), "https://katchapmanrn.com/service");
  assert.equal(m.publicPathKey("/measure-frame.html"), "not_found");
});

test("pages include the shared scripts once and the frame stays empty", function () {
  const files = fs.readdirSync(root).filter(function (name) { return name.endsWith(".html"); });
  files.forEach(function (file) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    if (file === "measure-frame.html") {
      assert.equal(text.includes("script.js"), false);
      assert.equal(text.includes('src="/measurement.js?v=1"'), true);
      assert.equal(text.includes('content="noindex, nofollow"'), true);
      assert.equal(text.includes('content="no-referrer"'), true);
      assert.equal(text.includes("<title>Kat Chapman RN</title>"), true);
      assert.equal(text.includes("<form"), false);
      assert.equal(text.toLowerCase().includes("botox"), false);
      assert.equal(text.toLowerCase().includes("med spa"), false);
      return;
    }
    assert.equal((text.match(/\/measurement\.js\?v=1/g) || []).length, 1, file);
    assert.equal((text.match(/\/script\.js\?v=6/g) || []).length, 1, file);
    assert.equal(text.includes("script.js?v=5"), false, file);
    assert.equal(text.includes("googletagmanager"), false, file);
    assert.equal(text.includes("fbq("), false, file);
    if (file !== "404.html") assert.equal(text.includes("cloudflareinsights.com/beacon"), true, file);
  });
  const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
  assert.equal(script.includes("/track/"), false);
  assert.equal(script.includes("googletagmanager"), false);
  assert.equal(script.includes("G-0BX0PK6GZP"), false);
  assert.equal(script.includes('KCRNMeasurement.start({ surface: "site" })'), true);
  assert.equal(script.includes("trackFormSuccess(formKey)"), true);
  assert.equal(script.includes('trackFormSuccess("consult_request")'), false);
  const calls = script.match(/hsSubmit\(HS_FORMS\.join[\s\S]*?"consult_request"\)/);
  assert.ok(calls);
  assert.match(script, /hsSubmit\(HS_FORMS\.contact[\s\S]*?"contact"\)/);
  const errorAt = script.indexOf('data.status === "error"');
  const trackAt = script.indexOf("trackFormSuccess(formKey)");
  assert.ok(errorAt !== -1 && trackAt > errorAt);
  const legacyAt = script.indexOf('params.get("joined")');
  assert.equal(script.indexOf("trackFormSuccess", legacyAt), -1);
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  assert.equal(sitemap.includes("measure-frame"), false);
  const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
  assert.equal(robots.includes("Disallow: /measure-frame"), true);
  const blog = fs.readFileSync(path.join(root, "measurement-blog.js"), "utf8");
  assert.equal(blog.includes("blog.katchapmanrn.com"), true);
  ["measurement.js", "measurement-blog.js", "docs/measurement.md", "measure-frame.html"].forEach(function (file) {
    assert.equal(fs.readFileSync(path.join(root, file), "utf8").toLowerCase().includes("chapman med spa"), false, file);
  });
});
