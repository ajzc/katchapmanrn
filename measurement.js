/* Kat Chapman RN — privacy-safe measurement.
   Loaded by every public page via measurement.js, then started from script.js.
   Google and Meta receive coarse page categories only. Treatment paths, titles,
   form text, appointment details, and raw query strings are not hit parameters.
   A booking click is booking_start. booking_completed fires only for a verified
   HubSpot Meetings embed postMessage. Meta and Google Ads stay unconfigured
   until real IDs are entered in CONFIG below. */
(function (factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.KCRNMeasurement = api;
})(function () {
  "use strict";

  var NEUTRAL_TITLE = "Kat Chapman RN";

  /* Parent fills metaPixelId and Google Ads fields only with IDs that already
     exist in the ad accounts. Empty strings stay unloaded. */
  var CONFIG = {
    ga4MeasurementId: "G-0BX0PK6GZP",
    metaPixelId: "",
    googleAdsId: "",
    googleAdsConversions: {
      generate_lead: "",
      booking_completed: ""
    },
    hubspotPortalId: "22023986"
  };

  var COPY = {
    lead: "Measurement stays off until you choose.",
    detail: "Accept allows visit and click counts.",
    accept: "Accept",
    reject: "Reject",
    choices: "Measurement choices",
    on: "Measurement is on.",
    off: "Measurement is off.",
    privacy: "Privacy Policy",
    privacyHref: "/privacy"
  };

  var EVENT_COVERAGE = [
    {
      event: "page_view",
      when: "Once on the first granted load of each page",
      ga: "page_view with a coarse page_location and fixed title",
      meta: "PageView from /measure-frame.html only when a pixel id is configured",
      hubspot: "HubSpot analytics page view of the real path after consent"
    },
    {
      event: "contact_click",
      when: "A tel: or sms: link is clicked",
      ga: "contact_click with method call or text",
      meta: "Contact with no parameters, only when a pixel id is configured",
      hubspot: "Behavioral event contact_call or contact_text"
    },
    {
      event: "booking_start",
      when: "A book link or HubSpot Meetings link is clicked",
      ga: "booking_start with method scheduler",
      meta: "Custom BookingStart, never Schedule",
      hubspot: "Behavioral event booking_start"
    },
    {
      event: "outbound_click",
      when: "An Instagram, journal, or mailto link is clicked",
      ga: "outbound_click with destination instagram, blog, or email",
      meta: "Not sent",
      hubspot: "Not sent"
    },
    {
      event: "generate_lead",
      when: "The HubSpot Forms API accepts a submission",
      ga: "generate_lead with form_id consult_request or contact",
      meta: "Lead with no parameters, only when a pixel id is configured",
      hubspot: "Behavioral event lead_consult_request or lead_contact"
    },
    {
      event: "booking_completed",
      when: "Embedded HubSpot Meetings posts meetingBookSucceeded from meetings.hubspot.com",
      ga: "booking_completed with method hubspot_meetings",
      meta: "Schedule with no parameters, only when a pixel id is configured",
      hubspot: "Behavioral event booking_completed"
    }
  ];

  var HEALTH_WORDS = [
    "botox", "dysport", "xeomin", "jeuveau", "filler", "fillers", "rhinoplasty",
    "sculptra", "radiesse", "juvederm", "restylane", "kybella", "nasolabial",
    "neurotoxin", "injectable", "injectables", "medspa", "patient", "diagnosis",
    "symptom", "symptoms", "prescription", "appointment", "jawline", "cheek",
    "cheeks", "temple", "toxin", "toxins", "prp"
  ];
  var HEALTH_PHRASES = ["under eye", "brow lift", "lip flip", "med spa", "tear trough"];
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_id"];
  var CLICK_KEYS = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid"];
  var GAD_KEYS = ["gad_source", "gad_campaignid"];
  var GA_QUERY_KEYS = UTM_KEYS.concat(["gclid", "gbraid", "wbraid", "gad_source", "gad_campaignid"]);
  var OUTBOUND_KEYS = GA_QUERY_KEYS.concat(["fbclid", "msclkid"]);
  var EXACT_PATHS = {
    "/": "home",
    "/about": "about",
    "/pricing": "pricing",
    "/contact": "contact",
    "/gallery": "gallery",
    "/faq": "faq",
    "/services": "services",
    "/privacy": "legal",
    "/terms": "legal",
    "/404": "not_found",
    "/measure-frame": "not_found"
  };
  var GROUP_OK = {
    home: true, about: true, pricing: true, contact: true, gallery: true,
    faq: true, services: true, legal: true, not_found: true, service: true, journal: true
  };
  var FRAME_TRACK = {
    Contact: "track",
    Lead: "track",
    Schedule: "track",
    BookingStart: "trackCustom"
  };
  var MEETINGS_ORIGINS = {
    "https://meetings.hubspot.com": true,
    "https://meetings-eu1.hubspot.com": true
  };

  var HEALTH_SUBSTRINGS = [
    "botox", "dysport", "xeomin", "jeuveau", "filler", "rhinoplast", "sculptra",
    "radiesse", "juvederm", "restylane", "kybella", "nasolabial", "neurotoxin",
    "injectable", "medspa", "jawline", "symptom", "prescription", "appointment",
    "undereye"
  ];

  function hasHealth(value) {
    var lower = String(value || "").toLowerCase();
    var padded = " " + lower.replace(/[^a-z0-9]+/g, " ") + " ";
    var i;
    for (i = 0; i < HEALTH_PHRASES.length; i++) {
      if (padded.indexOf(" " + HEALTH_PHRASES[i] + " ") !== -1) return true;
    }
    for (i = 0; i < HEALTH_WORDS.length; i++) {
      if (padded.indexOf(" " + HEALTH_WORDS[i] + " ") !== -1) return true;
    }
    for (i = 0; i < HEALTH_SUBSTRINGS.length; i++) {
      if (lower.indexOf(HEALTH_SUBSTRINGS[i]) !== -1) return true;
    }
    return false;
  }

  function normalizePath(pathname) {
    var path = typeof pathname === "string" && pathname ? pathname : "/";
    try { path = decodeURIComponent(path); } catch (e) { return "/"; }
    path = path.split("?")[0].split("#")[0].toLowerCase();
    if (path.charAt(0) !== "/") path = "/" + path;
    path = path.replace(/\/{2,}/g, "/");
    if (path.length > 1 && path.charAt(path.length - 1) === "/") path = path.slice(0, -1);
    path = path.replace(/\.html$/, "");
    if (path === "/index" || path === "") path = "/";
    return path;
  }

  function publicPathKey(pathname) {
    var path = normalizePath(pathname);
    if (Object.prototype.hasOwnProperty.call(EXACT_PATHS, path)) return EXACT_PATHS[path];
    if (/^\/[a-z0-9-]{1,80}$/.test(path)) return "service";
    return "not_found";
  }

  function pageModel(surface, pathname) {
    if (surface === "blog") return { origin: "https://blog.katchapmanrn.com", key: "journal" };
    return { origin: "https://katchapmanrn.com", key: publicPathKey(pathname) };
  }

  function neutralOriginPath(origin, key) {
    if (key === "home") return origin + "/";
    return origin + "/" + key;
  }

  function isSafeHitLocation(url, surface) {
    if (typeof url !== "string" || hasHealth(url)) return false;
    if (surface === "blog") {
      return /^https:\/\/blog\.katchapmanrn\.com\/journal(?:\?[A-Za-z0-9._~=&%-]*)?$/.test(url);
    }
    return /^https:\/\/katchapmanrn\.com\/(?:services|service|about|pricing|contact|gallery|faq|legal|not_found)?(?:\?[A-Za-z0-9._~=&%-]*)?$/.test(url);
  }

  function isSafeReferrer(value) {
    if (value === "") return true;
    if (typeof value !== "string" || value.length > 180) return false;
    if (/[?#@\s<>]/.test(value) || hasHealth(value)) return false;
    return /^https?:\/\/[a-z0-9.-]+(?:\/[a-zA-Z0-9._~/-]*)?$/.test(value);
  }

  function eachParam(input, fn) {
    if (!input) return;
    if (typeof input === "string") {
      var raw = input.charAt(0) === "?" ? input.slice(1) : input;
      new URLSearchParams(raw).forEach(function (value, key) { fn(String(key).toLowerCase(), value); });
      return;
    }
    if (typeof input === "object") {
      Object.keys(input).forEach(function (key) { fn(String(key).toLowerCase(), input[key]); });
    }
  }

  function scrubAttribution(input) {
    var kept = {};
    eachParam(input, function (key, raw) {
      if (kept[key] || raw == null) return;
      var value = String(raw).trim();
      if (!value || value.length > 200) return;
      if (/[@/\\\s<>?&#]/.test(value) || hasHealth(value)) return;
      if (UTM_KEYS.indexOf(key) !== -1) {
        value = value.toLowerCase();
        if (!/^[a-z0-9][a-z0-9._-]{0,48}$/.test(value)) return;
      } else if (GAD_KEYS.indexOf(key) !== -1) {
        if (!/^[0-9]{1,20}$/.test(value)) return;
      } else if (CLICK_KEYS.indexOf(key) !== -1) {
        if (!/^[A-Za-z0-9._~-]{5,200}$/.test(value)) return;
      } else {
        return;
      }
      kept[key] = value;
    });
    return kept;
  }

  function mergeAttribution(stored, search) {
    var out = scrubAttribution(stored || {});
    var fromUrl = scrubAttribution(typeof search === "string" ? search : "");
    Object.keys(fromUrl).forEach(function (key) { out[key] = fromUrl[key]; });
    return out;
  }

  function buildLocation(model, attribution) {
    var base = neutralOriginPath(model.origin, model.key);
    var surface = model.key === "journal" ? "blog" : "site";
    var pairs = [];
    GA_QUERY_KEYS.forEach(function (key) {
      var value = attribution && attribution[key];
      if (!value || hasHealth(value)) return;
      pairs.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
    });
    var url = pairs.length ? base + "?" + pairs.join("&") : base;
    if (!isSafeHitLocation(url, surface) || hasHealth(url)) return base;
    return url;
  }

  function scrubReferrer(referrer) {
    if (!referrer || typeof referrer !== "string") return "";
    var url;
    try { url = new URL(referrer); } catch (e) { return ""; }
    if (url.username || url.password) return "";
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    var host = url.hostname.toLowerCase();
    if (hasHealth(host)) return "";
    var bare = host.replace(/^www\./, "");
    if (bare === "blog.katchapmanrn.com") return "https://blog.katchapmanrn.com/journal";
    if (bare === "katchapmanrn.com") {
      return neutralOriginPath("https://katchapmanrn.com", publicPathKey(url.pathname));
    }
    var extPath = url.pathname || "/";
    var reduced = url.protocol + "//" + host + "/";
    if (extPath.length > 80 || extPath.indexOf("..") !== -1 || hasHealth(extPath) || /[^a-zA-Z0-9._~/-]/.test(extPath)) {
      return isSafeReferrer(reduced) ? reduced : "";
    }
    var full = url.protocol + "//" + host + (extPath === "/" ? "/" : extPath.replace(/\/+$/, ""));
    return isSafeReferrer(full) ? full : (isSafeReferrer(reduced) ? reduced : "");
  }

  function sealPage(page, surface) {
    var key = page && GROUP_OK[page.content_group] ? page.content_group : (surface === "blog" ? "journal" : "not_found");
    var origin = surface === "blog" || key === "journal" ? "https://blog.katchapmanrn.com" : "https://katchapmanrn.com";
    var hitSurface = origin.indexOf("blog.") !== -1 ? "blog" : "site";
    var fallback = neutralOriginPath(origin, key === "journal" ? "journal" : key);
    var location = page && isSafeHitLocation(page.page_location, hitSurface) ? page.page_location : fallback;
    if (!isSafeHitLocation(location, hitSurface)) location = fallback;
    var referrer = page && isSafeReferrer(page.page_referrer) ? page.page_referrer : "";
    return {
      page_location: location,
      page_referrer: referrer,
      page_title: NEUTRAL_TITLE,
      content_group: key
    };
  }

  function gaOk(config) { return /^G-[A-Z0-9]{4,}$/.test(config.ga4MeasurementId || ""); }
  function metaOk(config) { return /^[0-9]{8,20}$/.test(config.metaPixelId || ""); }
  function hsOk(config) { return /^[0-9]{5,12}$/.test(config.hubspotPortalId || ""); }

  function adsSendTo(config, eventName) {
    if (eventName !== "generate_lead" && eventName !== "booking_completed") return "";
    var id = config.googleAdsId || "";
    var label = config.googleAdsConversions && config.googleAdsConversions[eventName] || "";
    if (!/^AW-\d{5,}$/.test(id)) return "";
    if (!/^[A-Za-z0-9_-]{4,40}$/.test(label)) return "";
    return id + "/" + label;
  }

  function googleAdsStatus(config) {
    if (adsSendTo(config, "generate_lead") || adsSendTo(config, "booking_completed")) return "configured";
    return "unconfigured";
  }

  function sealNamedEvent(name, params) {
    params = params || {};
    if (name === "contact_click" && (params.method === "call" || params.method === "text")) return { method: params.method };
    if (name === "booking_start") return { method: "scheduler" };
    if (name === "outbound_click" && (params.destination === "instagram" || params.destination === "blog" || params.destination === "email")) {
      return { destination: params.destination };
    }
    if (name === "generate_lead" && (params.form_id === "consult_request" || params.form_id === "contact")) {
      return { form_id: params.form_id };
    }
    if (name === "booking_completed") return { method: "hubspot_meetings" };
    if (name === "page_view") return sealPage(params, params.content_group === "journal" ? "blog" : "site");
    return null;
  }

  function gaEvent(name, params, config) {
    var sealed = sealNamedEvent(name, params);
    if (!sealed) return null;
    var sendTo = adsSendTo(config, name);
    if (sendTo) sealed.send_to = sendTo;
    return { type: "ga_event", name: name, params: sealed };
  }

  function gaBootstrapEffect(config, page) {
    return {
      type: "ga_bootstrap",
      measurementId: config.ga4MeasurementId,
      src: "https://www.googletagmanager.com/gtag/js?id=" + config.ga4MeasurementId,
      consentDefault: {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
        functionality_storage: "denied",
        personalization_storage: "denied",
        security_storage: "granted"
      },
      consentUpdate: {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "denied",
        analytics_storage: "granted",
        functionality_storage: "denied",
        personalization_storage: "denied",
        security_storage: "granted"
      },
      adsDataRedaction: true,
      urlPassthrough: false,
      config: {
        send_page_view: false,
        page_location: page.page_location,
        page_referrer: page.page_referrer,
        page_title: page.page_title,
        content_group: page.content_group,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        anonymize_ip: true,
        cookie_flags: "SameSite=Lax;Secure",
        linker: {
          domains: ["katchapmanrn.com", "www.katchapmanrn.com", "blog.katchapmanrn.com", "meetings.hubspot.com", "meetings-eu1.hubspot.com"],
          accept_incoming: true,
          decorate_forms: false
        }
      }
    };
  }

  function hsEventName(config, suffix) {
    if (!hsOk(config)) return "";
    var name = "pe" + config.hubspotPortalId + "_" + suffix;
    return /^pe[0-9]{5,12}_[a-z_]{3,40}$/.test(name) ? name : "";
  }

  function notices(config, action) {
    return [
      { type: "notice", integration: "ga4", status: action.existingGa ? "blocked_duplicate" : (gaOk(config) ? "configured" : "unconfigured") },
      { type: "notice", integration: "meta", status: metaOk(config) ? "configured" : "unconfigured" },
      { type: "notice", integration: "google_ads", status: googleAdsStatus(config) },
      { type: "notice", integration: "booking_completed", status: "embed_hook_only" },
      { type: "notice", integration: "hubspot", status: hsOk(config) ? "configured" : "unconfigured" }
    ];
  }

  function hostnameOf(href) {
    try { return new URL(href, "https://katchapmanrn.com").hostname.toLowerCase().replace(/^www\./, ""); }
    catch (e) { return ""; }
  }

  function classifyClick(href, hints) {
    if (typeof href !== "string") return null;
    var trimmed = href.trim();
    var lower = trimmed.toLowerCase();
    if (!lower || lower.indexOf("javascript:") === 0) return null;
    if (lower.indexOf("tel:") === 0) return { gaName: "contact_click", params: { method: "call" }, meta: "Contact", metaCustom: false, hs: "contact_call" };
    if (lower.indexOf("sms:") === 0) return { gaName: "contact_click", params: { method: "text" }, meta: "Contact", metaCustom: false, hs: "contact_text" };
    var host = hostnameOf(trimmed);
    if ((hints && hints.dataBook) || host === "meetings.hubspot.com" || host === "meetings-eu1.hubspot.com") {
      return { gaName: "booking_start", params: { method: "scheduler" }, meta: "BookingStart", metaCustom: true, hs: "booking_start" };
    }
    if (host === "instagram.com") return { gaName: "outbound_click", params: { destination: "instagram" }, meta: null, metaCustom: false, hs: "" };
    if (host === "blog.katchapmanrn.com") return { gaName: "outbound_click", params: { destination: "blog" }, meta: null, metaCustom: false, hs: "" };
    if (lower.indexOf("mailto:") === 0) return { gaName: "outbound_click", params: { destination: "email" }, meta: null, metaCustom: false, hs: "" };
    return null;
  }

  function isVerifiedBooking(action) {
    if (!action || !MEETINGS_ORIGINS[action.origin]) return false;
    var data = action.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) return false;
    return data.meetingBookSucceeded === true;
  }

  function metaFrameSrc(hostname, fbclid) {
    var host = String(hostname || "").toLowerCase().replace(/^www\./, "");
    var base = host === "blog.katchapmanrn.com" ? "https://katchapmanrn.com/measure-frame.html" : "/measure-frame.html";
    if (fbclid && /^[A-Za-z0-9._~-]{5,200}$/.test(fbclid) && !hasHealth(fbclid)) {
      return base + "?fbclid=" + encodeURIComponent(fbclid);
    }
    return base;
  }

  function pixelQueue(pixelId) {
    return [
      ["consent", "grant"],
      ["set", "autoConfig", false, pixelId],
      ["init", pixelId],
      ["track", "PageView"]
    ];
  }

  function createFrameSession() {
    return { pixelId: "", revoked: false, inited: false };
  }

  function handleFrameMessage(session, event, ctx) {
    var next = {
      pixelId: session && session.pixelId || "",
      revoked: !!(session && session.revoked),
      inited: !!(session && session.inited)
    };
    var commands = [];
    var origin = event && event.origin;
    var frameOrigin = ctx && ctx.frameOrigin || "";
    var allowed = origin === "https://katchapmanrn.com" || origin === "https://www.katchapmanrn.com" || origin === "https://blog.katchapmanrn.com" || (frameOrigin && origin === frameOrigin);
    if (!allowed) return { session: next, commands: commands };
    var data = event && event.data;
    if (!data || data.source !== "kcrn-parent") return { session: next, commands: commands };
    if (data.type === "revoke") {
      next.revoked = true;
      commands.push({ op: "revoke" });
      return { session: next, commands: commands };
    }
    if (next.revoked) return { session: next, commands: commands };
    if (readConsent(ctx && ctx.cookie, "") !== "granted") return { session: next, commands: commands };
    if (data.type === "init") {
      if (next.inited) return { session: next, commands: commands };
      if (!/^[0-9]{8,20}$/.test(data.pixelId || "")) return { session: next, commands: commands };
      next.inited = true;
      next.pixelId = data.pixelId;
      commands.push({ op: "init", pixelId: data.pixelId, autoConfig: false, advancedMatching: false });
      return { session: next, commands: commands };
    }
    if (data.type === "track") {
      if (!next.inited) return { session: next, commands: commands };
      var method = FRAME_TRACK[data.name];
      if (!method) return { session: next, commands: commands };
      commands.push({ op: "track", method: method, name: data.name });
    }
    return { session: next, commands: commands };
  }

  function readCookie(cookieString, name) {
    if (!cookieString || typeof cookieString !== "string") return "";
    var parts = cookieString.split(";");
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part.indexOf(name + "=") !== 0) continue;
      try { return decodeURIComponent(part.slice(name.length + 1)); }
      catch (e) { return ""; }
    }
    return "";
  }

  function readConsent(cookieString, sessionValue) {
    var fromCookie = readCookie(cookieString, "kcrn_consent");
    if (fromCookie === "granted" || fromCookie === "denied") return fromCookie;
    if (sessionValue === "granted" || sessionValue === "denied") return sessionValue;
    return "unknown";
  }

  function normalizeConsent(value) {
    return value === "granted" || value === "denied" ? value : "unknown";
  }

  function serializeConsentCookie(value, ctx) {
    if (value !== "granted" && value !== "denied") return "";
    var parts = ["kcrn_consent=" + value, "Path=/", "Max-Age=15552000", "SameSite=Lax"];
    var hostname = String(ctx && ctx.hostname || "").toLowerCase().replace(/^www\./, "");
    if (ctx && ctx.protocol === "https:") parts.push("Secure");
    if (hostname === "katchapmanrn.com" || hostname.endsWith(".katchapmanrn.com")) parts.push("Domain=.katchapmanrn.com");
    return parts.join("; ");
  }

  function scrubHsCookies(cookieString) {
    var out = {};
    ["__hstc", "__hssc", "__hsfp", "hubspotutk"].forEach(function (name) {
      var value = readCookie(cookieString, name);
      if (!value || value.length < 6 || value.length > 300) return;
      if (!/^[A-Za-z0-9._:-]+$/.test(value) || hasHealth(value)) return;
      out[name] = value;
    });
    return out;
  }

  function safeSearch(search) {
    var kept = scrubAttribution(search);
    var pairs = [];
    OUTBOUND_KEYS.forEach(function (key) {
      if (kept[key]) pairs.push(encodeURIComponent(key) + "=" + encodeURIComponent(kept[key]));
    });
    return pairs.length ? "?" + pairs.join("&") : "";
  }

  function decorateOutbound(url, attribution, cookieString) {
    if (typeof url !== "string" || !url) return url;
    var parsed;
    try { parsed = new URL(url, "https://katchapmanrn.com"); } catch (e) { return url; }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return url;
    var host = parsed.hostname.toLowerCase();
    var allowed = host === "blog.katchapmanrn.com" || host === "meetings.hubspot.com" || host === "meetings-eu1.hubspot.com";
    if (!allowed) return url;
    var attr = scrubAttribution(attribution || {});
    var hs = scrubHsCookies(cookieString || "");
    var changed = false;
    OUTBOUND_KEYS.forEach(function (key) {
      if (attr[key] && !parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, attr[key]);
        changed = true;
      }
    });
    Object.keys(hs).forEach(function (key) {
      if (!parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, hs[key]);
        changed = true;
      }
    });
    return changed ? parsed.toString() : url;
  }

  function initialState() {
    return {
      consent: "unknown",
      started: false,
      pageviewSent: false,
      gaEnabled: false,
      metaEnabled: false,
      hsEnabled: false,
      forms: {},
      bookingCompleted: false,
      attribution: {},
      surface: "site"
    };
  }

  function cloneState(state) {
    return {
      consent: state.consent,
      started: state.started,
      pageviewSent: state.pageviewSent,
      gaEnabled: state.gaEnabled,
      metaEnabled: state.metaEnabled,
      hsEnabled: state.hsEnabled,
      forms: Object.assign({}, state.forms),
      bookingCompleted: state.bookingCompleted,
      attribution: Object.assign({}, state.attribution),
      surface: state.surface
    };
  }

  function enableMeasurement(state, action, config) {
    var next = cloneState(state);
    var effects = [];
    var model = pageModel(next.surface, action.pathname);
    var draft = {
      page_location: buildLocation(model, next.attribution),
      page_referrer: scrubReferrer(action.referrer),
      page_title: action.title || "",
      content_group: model.key
    };
    var page = sealPage(draft, next.surface);
    if (gaOk(config) && !action.existingGa) {
      if (!next.pageviewSent) {
        effects.push(gaBootstrapEffect(config, page));
        var view = gaEvent("page_view", page, config);
        if (view) effects.push(view);
        next.pageviewSent = true;
      }
      next.gaEnabled = true;
    }
    if (hsOk(config)) {
      var consent = { analytics: true, advertisement: false, functionality: true };
      if (next.surface === "blog" || action.existingHs) effects.push(Object.assign({ type: "hs_consent" }, consent));
      else effects.push(Object.assign({ type: "hs_bootstrap", portalId: config.hubspotPortalId }, consent));
      next.hsEnabled = true;
    }
    if (metaOk(config)) {
      effects.push({
        type: "meta_frame",
        src: metaFrameSrc(action.hostname || "", next.attribution.fbclid || ""),
        pixelId: String(config.metaPixelId)
      });
      next.metaEnabled = true;
    }
    return { state: next, effects: effects };
  }

  function revokeTransition(state) {
    var next = cloneState(state);
    next.consent = "denied";
    next.gaEnabled = false;
    next.metaEnabled = false;
    next.hsEnabled = false;
    next.attribution = {};
    return {
      state: next,
      effects: [
        { type: "persist_consent", value: "denied" },
        { type: "clear_attribution" },
        { type: "ga_consent_denied" },
        { type: "hs_revoke" },
        { type: "meta_revoke" },
        { type: "clear_cookies" },
        { type: "ui", mode: "chip" }
      ]
    };
  }

  function transition(state, action, config) {
    config = config || CONFIG;
    action = action || {};
    if (action.type === "start") {
      if (state.started) return { state: state, effects: [] };
      var started = cloneState(state);
      started.started = true;
      started.surface = action.surface === "blog" ? "blog" : "site";
      started.consent = normalizeConsent(action.consent);
      started.attribution = mergeAttribution(action.storedAttribution, action.search);
      var effects = notices(config, action);
      effects.push({ type: "store_attribution", attribution: Object.assign({}, started.attribution) });
      if (started.consent === "granted") {
        var enabled = enableMeasurement(started, action, config);
        effects = effects.concat(enabled.effects);
        started = enabled.state;
        started.started = true;
        started.consent = "granted";
      }
      effects.push({ type: "ui", mode: started.consent === "unknown" ? "banner" : "chip" });
      return { state: started, effects: effects };
    }
    if (action.type === "set_consent") {
      if (action.choice === "denied") return revokeTransition(state);
      if (action.choice !== "granted") return { state: state, effects: [] };
      if (state.consent === "granted" && state.pageviewSent) {
        return { state: state, effects: [{ type: "ui", mode: "chip" }] };
      }
      var granted = cloneState(state);
      granted.consent = "granted";
      granted.attribution = mergeAttribution(granted.attribution, action.search);
      var grantEffects = [
        { type: "persist_consent", value: "granted" },
        { type: "store_attribution", attribution: Object.assign({}, granted.attribution) }
      ];
      var turnedOn = enableMeasurement(granted, action, config);
      grantEffects = grantEffects.concat(turnedOn.effects);
      granted = turnedOn.state;
      granted.consent = "granted";
      grantEffects.push({ type: "ui", mode: "chip" });
      return { state: granted, effects: grantEffects };
    }
    if (action.type === "click") {
      var spec = classifyClick(action.href, action);
      if (!spec || state.consent !== "granted") return { state: state, effects: [] };
      var clickEffects = [];
      if (state.gaEnabled) {
        var clickEvent = gaEvent(spec.gaName, spec.params, config);
        if (clickEvent) clickEffects.push(clickEvent);
      }
      if (state.metaEnabled && spec.meta) clickEffects.push({ type: "meta_track", name: spec.meta, custom: spec.metaCustom === true });
      if (state.hsEnabled && spec.hs) {
        var hsName = hsEventName(config, spec.hs);
        if (hsName) clickEffects.push({ type: "hs_event", name: hsName, properties: {} });
      }
      return { state: state, effects: clickEffects };
    }
    if (action.type === "form_success") {
      if (state.consent !== "granted") return { state: state, effects: [] };
      if (action.formId !== "consult_request" && action.formId !== "contact") return { state: state, effects: [] };
      if (state.forms[action.formId]) return { state: state, effects: [] };
      var formed = cloneState(state);
      formed.forms[action.formId] = true;
      var formEffects = [];
      if (formed.gaEnabled) {
        var lead = gaEvent("generate_lead", { form_id: action.formId }, config);
        if (lead) formEffects.push(lead);
      }
      if (formed.metaEnabled) formEffects.push({ type: "meta_track", name: "Lead", custom: false });
      if (formed.hsEnabled) {
        var leadName = hsEventName(config, action.formId === "consult_request" ? "lead_consult_request" : "lead_contact");
        if (leadName) formEffects.push({ type: "hs_event", name: leadName, properties: {} });
      }
      return { state: formed, effects: formEffects };
    }
    if (action.type === "booking_signal") {
      if (state.consent !== "granted" || state.bookingCompleted || !isVerifiedBooking(action)) {
        return { state: state, effects: [] };
      }
      var booked = cloneState(state);
      booked.bookingCompleted = true;
      var bookEffects = [];
      if (booked.gaEnabled) {
        var done = gaEvent("booking_completed", { method: "hubspot_meetings" }, config);
        if (done) bookEffects.push(done);
      }
      if (booked.metaEnabled) bookEffects.push({ type: "meta_track", name: "Schedule", custom: false });
      if (booked.hsEnabled) {
        var doneName = hsEventName(config, "booking_completed");
        if (doneName) bookEffects.push({ type: "hs_event", name: doneName, properties: {} });
      }
      return { state: booked, effects: bookEffects };
    }
    return { state: state, effects: [] };
  }

  function createController(config) {
    var state = initialState();
    return {
      apply: function (action) {
        var result = transition(state, action, config);
        state = result.state;
        return result.effects;
      },
      getState: function () { return state; }
    };
  }

  var browserApp = null;
  var metaFrame = null;
  var metaQueue = [];
  var metaReady = false;
  var bound = false;

  function storageGet(key) {
    try { return window.sessionStorage.getItem(key) || ""; } catch (e) { return ""; }
  }
  function storageSet(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch (e) {}
  }
  function storageRemove(key) {
    try { window.sessionStorage.removeItem(key); } catch (e) {}
  }

  function browserContext(surface) {
    var stored = {};
    try {
      var parsed = JSON.parse(storageGet("kcrn_attr") || "{}");
      if (parsed && typeof parsed === "object") stored = parsed;
    } catch (e) { stored = {}; }
    return {
      type: "start",
      surface: surface,
      hostname: location.hostname,
      pathname: location.pathname,
      search: location.search,
      referrer: document.referrer,
      consent: readConsent(document.cookie, storageGet("kcrn_consent")),
      storedAttribution: stored,
      title: document.title,
      existingGa: !!document.querySelector('script[src*="googletagmanager.com/gtag/js"]:not(#kcrn-ga4)'),
      existingHs: !!document.getElementById("hs-script-loader")
    };
  }

  function persistConsent(value) {
    var cookie = serializeConsentCookie(value, { hostname: location.hostname, protocol: location.protocol });
    if (cookie) document.cookie = cookie;
    storageSet("kcrn_consent", value);
  }

  function expireCookie(name) {
    var secure = location.protocol === "https:" ? "; Secure" : "";
    var base = name + "=; Path=/; Max-Age=0; SameSite=Lax" + secure;
    document.cookie = base;
    var host = location.hostname.toLowerCase();
    if (host === "katchapmanrn.com" || host.endsWith(".katchapmanrn.com")) {
      document.cookie = base + "; Domain=.katchapmanrn.com";
      document.cookie = base + "; Domain=" + location.hostname;
    }
  }

  function clearMeasurementCookies() {
    document.cookie.split(";").forEach(function (part) {
      var name = part.split("=")[0].trim();
      if (!name || name === "kcrn_consent") return;
      if (name === "_ga" || name === "_gid" || name === "_gat" || name.indexOf("_ga_") === 0 || name.indexOf("_gcl_") === 0 ||
        name === "hubspotutk" || name === "__hstc" || name === "__hssc" || name === "__hssrc" || name === "__hsfp" ||
        name === "_fbp" || name === "_fbc") expireCookie(name);
    });
  }

  function ensureCss() {
    if (document.getElementById("kcrn-measure-css")) return;
    var style = document.createElement("style");
    style.id = "kcrn-measure-css";
    style.textContent = [
      "#kcrn-measure-banner{position:fixed;left:.75rem;right:.75rem;bottom:calc(.75rem + env(safe-area-inset-bottom));z-index:160;max-width:42rem;margin:0 auto;background:#241c13;color:#f6f1e8;border-radius:16px;padding:.9rem 1rem;display:flex;gap:.75rem;align-items:center;justify-content:space-between;flex-wrap:wrap;box-shadow:0 24px 70px -28px rgba(36,28,19,.45);font-family:\"Plus Jakarta Sans\",-apple-system,sans-serif;font-size:.92rem;line-height:1.45}",
      "#kcrn-measure-banner p{margin:0;flex:1 1 16rem}",
      "#kcrn-measure-banner a{color:#f6f1e8}",
      "#kcrn-measure-banner button{font:inherit;border-radius:999px;padding:.45rem .95rem;cursor:pointer;border:1px solid transparent}",
      "#kcrn-measure-banner .kcrn-accept{background:#f6f1e8;color:#241c13}",
      "#kcrn-measure-banner .kcrn-reject{background:transparent;color:#f6f1e8;border-color:rgba(246,241,232,.45)}",
      "#kcrn-measure-chip{position:fixed;left:.75rem;bottom:calc(.75rem + env(safe-area-inset-bottom));z-index:150;font-family:\"Plus Jakarta Sans\",-apple-system,sans-serif;font-size:.78rem;background:#241c13;color:#f6f1e8;border:0;border-radius:999px;padding:.4rem .75rem;cursor:pointer}",
      "@media print{#kcrn-measure-banner,#kcrn-measure-chip{display:none}}"
    ].join("");
    document.head.appendChild(style);
  }

  function renderUi(mode, consent) {
    ensureCss();
    var existingBanner = document.getElementById("kcrn-measure-banner");
    var existingChip = document.getElementById("kcrn-measure-chip");
    if (existingBanner) existingBanner.remove();
    if (existingChip) existingChip.remove();
    if (mode === "chip") {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.id = "kcrn-measure-chip";
      chip.textContent = COPY.choices;
      chip.addEventListener("click", function () { renderUi("banner", browserApp.getState().consent); });
      document.body.appendChild(chip);
      return;
    }
    var banner = document.createElement("div");
    banner.id = "kcrn-measure-banner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Measurement");
    var text = document.createElement("p");
    if (consent === "granted") text.appendChild(document.createTextNode(COPY.on + " "));
    else if (consent === "denied") text.appendChild(document.createTextNode(COPY.off + " "));
    else text.appendChild(document.createTextNode(COPY.lead + " "));
    text.appendChild(document.createTextNode(COPY.detail + " "));
    var link = document.createElement("a");
    link.href = COPY.privacyHref;
    link.textContent = COPY.privacy;
    text.appendChild(link);
    var actions = document.createElement("div");
    var reject = document.createElement("button");
    reject.type = "button";
    reject.className = "kcrn-reject";
    reject.textContent = COPY.reject;
    var accept = document.createElement("button");
    accept.type = "button";
    accept.className = "kcrn-accept";
    accept.textContent = COPY.accept;
    reject.addEventListener("click", function () { choose("denied"); });
    accept.addEventListener("click", function () { choose("granted"); });
    actions.appendChild(reject);
    actions.appendChild(accept);
    banner.appendChild(text);
    banner.appendChild(actions);
    document.body.appendChild(banner);
  }

  function postToFrame(message) {
    if (!metaFrame || !metaFrame.contentWindow) return;
    var origin;
    try { origin = new URL(metaFrame.src, window.location.href).origin; } catch (e) { return; }
    metaFrame.contentWindow.postMessage(message, origin);
  }

  function applyEffects(effects) {
    effects.forEach(function (fx) {
      if (fx.type === "notice") {
        document.documentElement.setAttribute("data-kcrn-" + fx.integration.replace(/_/g, "-"), fx.status);
        window.kcrnMeasurementStatus = window.kcrnMeasurementStatus || {};
        window.kcrnMeasurementStatus[fx.integration] = fx.status;
      } else if (fx.type === "store_attribution") {
        storageSet("kcrn_attr", JSON.stringify(fx.attribution || {}));
      } else if (fx.type === "clear_attribution") {
        storageRemove("kcrn_attr");
      } else if (fx.type === "persist_consent") {
        persistConsent(fx.value);
      } else if (fx.type === "clear_cookies") {
        clearMeasurementCookies();
      } else if (fx.type === "ga_bootstrap") {
        installGa(fx);
      } else if (fx.type === "ga_event") {
        if (window.gtag && fx.name) window.gtag("event", fx.name, fx.params || {});
      } else if (fx.type === "ga_consent_denied") {
        if (window.gtag) {
          window.gtag("consent", "update", {
            ad_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied",
            analytics_storage: "denied",
            functionality_storage: "denied",
            personalization_storage: "denied"
          });
        }
      } else if (fx.type === "hs_bootstrap" || fx.type === "hs_consent") {
        installHubSpot(fx);
      } else if (fx.type === "hs_event") {
        if (!/^pe[0-9]{5,12}_[a-z_]{3,40}$/.test(fx.name || "")) return;
        window._hsq = window._hsq || [];
        window._hsq.push(["trackCustomBehavioralEvent", { name: fx.name, properties: {} }]);
      } else if (fx.type === "hs_revoke") {
        window._hsp = window._hsp || [];
        window._hsp.push(["revokeCookieConsent"]);
      } else if (fx.type === "meta_frame") {
        installMetaFrame(fx);
      } else if (fx.type === "meta_track") {
        enqueueMeta(fx.name);
      } else if (fx.type === "meta_revoke") {
        metaQueue = [];
        metaReady = false;
        postToFrame({ source: "kcrn-parent", type: "revoke" });
        if (metaFrame && metaFrame.parentNode) metaFrame.parentNode.removeChild(metaFrame);
        metaFrame = null;
      } else if (fx.type === "ui") {
        renderUi(fx.mode, browserApp.getState().consent);
      }
    });
  }

  function installGa(fx) {
    if (!/^G-[A-Z0-9]+$/.test(fx.measurementId || "")) return;
    if (fx.src !== "https://www.googletagmanager.com/gtag/js?id=" + fx.measurementId) return;
    if (document.getElementById("kcrn-ga4")) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", fx.consentDefault);
    window.gtag("consent", "update", fx.consentUpdate);
    window.gtag("set", "ads_data_redaction", true);
    window.gtag("set", "url_passthrough", false);
    window.gtag("set", "allow_google_signals", false);
    window.gtag("set", "allow_ad_personalization_signals", false);
    window.gtag("js", new Date());
    window.gtag("config", fx.measurementId, fx.config);
    var script = document.createElement("script");
    script.id = "kcrn-ga4";
    script.async = true;
    script.src = fx.src;
    document.head.appendChild(script);
  }

  function installHubSpot(fx) {
    window._hsp = window._hsp || [];
    window._hsp.push(["setHubSpotConsent", {
      analytics: fx.analytics === true,
      advertisement: false,
      functionality: fx.functionality !== false
    }]);
    if (fx.type !== "hs_bootstrap") return;
    if (!/^[0-9]{5,12}$/.test(fx.portalId || "")) return;
    if (document.getElementById("hs-script-loader")) return;
    var script = document.createElement("script");
    script.id = "hs-script-loader";
    script.async = true;
    script.defer = true;
    script.src = "https://js.hs-scripts.com/" + fx.portalId + ".js";
    document.head.appendChild(script);
  }

  function enqueueMeta(name) {
    if (!FRAME_TRACK[name]) return;
    if (metaReady) postToFrame({ source: "kcrn-parent", type: "track", name: name });
    else metaQueue.push(name);
  }

  function installMetaFrame(fx) {
    if (document.getElementById("kcrn-meta-frame")) return;
    if (!/^[0-9]{8,20}$/.test(fx.pixelId || "")) return;
    if (fx.src.indexOf("measure-frame.html") === -1) return;
    if (hasHealth(fx.src)) return;
    var iframe = document.createElement("iframe");
    iframe.id = "kcrn-meta-frame";
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.title = "";
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;clip:rect(0,0,0,0)";
    iframe.addEventListener("load", function () {
      postToFrame({ source: "kcrn-parent", type: "init", pixelId: fx.pixelId });
      metaReady = true;
      metaQueue.splice(0).forEach(function (name) {
        postToFrame({ source: "kcrn-parent", type: "track", name: name });
      });
    });
    metaFrame = iframe;
    iframe.src = fx.src;
    document.body.appendChild(iframe);
  }

  function choose(choice) {
    if (!browserApp) return;
    var state = browserApp.getState();
    applyEffects(browserApp.apply({
      type: "set_consent",
      choice: choice,
      surface: state.surface,
      hostname: location.hostname,
      pathname: location.pathname,
      search: location.search,
      referrer: document.referrer,
      title: document.title,
      existingGa: !!document.querySelector('script[src*="googletagmanager.com/gtag/js"]:not(#kcrn-ga4)'),
      existingHs: !!document.getElementById("hs-script-loader")
    }));
  }

  function bindInteractions() {
    if (bound) return;
    bound = true;
    function decorateEvent(e) {
      var node = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!node || !browserApp || browserApp.getState().consent !== "granted") return;
      var current = node.href || node.getAttribute("href") || "";
      var next = decorateOutbound(current, browserApp.getState().attribution, document.cookie);
      if (next && next !== current) node.href = next;
    }
    function trackEvent(e) {
      var node = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!node || !browserApp) return;
      applyEffects(browserApp.apply({
        type: "click",
        href: node.getAttribute("href") || "",
        dataBook: node.hasAttribute("data-book")
      }));
    }
    document.addEventListener("pointerdown", decorateEvent, true);
    document.addEventListener("click", function (e) {
      decorateEvent(e);
      trackEvent(e);
    }, true);
    document.addEventListener("auxclick", trackEvent, true);
    window.addEventListener("message", function (event) {
      if (!browserApp) return;
      applyEffects(browserApp.apply({ type: "booking_signal", origin: event.origin, data: event.data }));
    });
  }

  function start(options) {
    if (typeof document === "undefined" || typeof window === "undefined") return null;
    if (browserApp) return browserApp;
    try {
      if (normalizePath(location.pathname) === "/measure-frame") return null;
      var surface = options && options.surface === "blog" ? "blog" : "site";
      try {
        var safe = safeSearch(location.search);
        var hash = location.hash || "";
        if (hasHealth(hash) || hash.indexOf("@") !== -1 || hash.indexOf("?") !== -1) hash = "";
        if ((location.search || "") !== safe || (location.hash || "") !== hash) {
          history.replaceState(history.state, "", location.pathname + safe + hash);
        }
      } catch (ignore) {}
      browserApp = createController(CONFIG);
      applyEffects(browserApp.apply(browserContext(surface)));
      bindInteractions();
      window.kcrnMeasurement = browserApp;
      return browserApp;
    } catch (e) {
      if (document.documentElement) document.documentElement.setAttribute("data-kcrn-error", "start");
      return null;
    }
  }

  function trackFormSuccess(formId) {
    if (!browserApp || typeof formId !== "string") return;
    try { applyEffects(browserApp.apply({ type: "form_success", formId: formId })); }
    catch (e) { document.documentElement.setAttribute("data-kcrn-error", "form"); }
  }

  function bootFrame() {
    if (typeof window === "undefined") return;
    var session = createFrameSession();
    window.addEventListener("message", function (event) {
      var result = handleFrameMessage(session, event, {
        cookie: document.cookie,
        frameOrigin: window.location.origin
      });
      session = result.session;
      result.commands.forEach(function (command) {
        if (command.op === "init") installPixel(command.pixelId);
        else if (command.op === "track" && window.fbq) window.fbq(command.method, command.name);
        else if (command.op === "revoke" && window.fbq) window.fbq("consent", "revoke");
      });
    });
  }

  function installPixel(id) {
    if (window.__kcrnPixel) return;
    if (!/^[0-9]{8,20}$/.test(id || "")) return;
    window.__kcrnPixel = true;
    if (!window.fbq) {
      var fbq = function () {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
        else fbq.queue.push(arguments);
      };
      window.fbq = fbq;
      if (!window._fbq) window._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      fbq.disablePushState = true;
      var script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      (document.head || document.documentElement).appendChild(script);
    }
    window.fbq.disablePushState = true;
    pixelQueue(id).forEach(function (args) { window.fbq.apply(window.fbq, args); });
  }

  return {
    CONFIG: CONFIG,
    COPY: COPY,
    EVENT_COVERAGE: EVENT_COVERAGE,
    NEUTRAL_TITLE: NEUTRAL_TITLE,
    initialState: initialState,
    transition: transition,
    scrubAttribution: scrubAttribution,
    scrubReferrer: scrubReferrer,
    publicPathKey: publicPathKey,
    decorateOutbound: decorateOutbound,
    safeSearch: safeSearch,
    classifyClick: classifyClick,
    isVerifiedBooking: isVerifiedBooking,
    handleFrameMessage: handleFrameMessage,
    createFrameSession: createFrameSession,
    metaFrameSrc: metaFrameSrc,
    pixelQueue: pixelQueue,
    serializeConsentCookie: serializeConsentCookie,
    readConsent: readConsent,
    hasHealth: hasHealth,
    buildLocation: buildLocation,
    pageModel: pageModel,
    start: start,
    trackFormSuccess: trackFormSuccess,
    bootFrame: bootFrame
  };
});
