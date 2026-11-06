import { GA4_MEASUREMENT_ID, HS_PORTAL_ID, LINKER_DOMAINS, META_PIXEL_ID, CONSENT_STORAGE_KEY, UTM_STORAGE_KEY } from "./config.mjs";
import { metaBootCommands, metaInstallPlan, metaTrackCommand, META_SCRIPT_URL } from "./meta.mjs";
import { sanitizeHref, readAllowlistedUtms, mergeFirstTouch, appendUtms } from "./utm.mjs";
import { buildHubSpotContext } from "./forms.mjs";
import { bookingSignalFromMessage, matchingIframeSrc } from "./booking.mjs";
import { classifyClick, pageViewEvent, clickEvent, formEvent, bookingEvent } from "./events.mjs";
import { mountBanner } from "./banner.mjs";

function createOnce() {
  const seen = new Set();
  return {
    claim(key) {
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
    clear() { seen.clear(); },
  };
}

function readJson(store, key) {
  try {
    const raw = store.get(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const DENIED = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
  security_storage: "granted",
};

export function createController(deps) {
  const pixelId = typeof deps.metaPixelId === "string" ? deps.metaPixelId : META_PIXEL_ID;
  const once = createOnce();
  let consent = "unset";
  let bannerOpen = true;
  let tagsLoaded = false;
  let metaBooted = false;
  let utms = readJson(deps.session, UTM_STORAGE_KEY);

  function persistConsent() {
    deps.local.set(CONSENT_STORAGE_KEY, consent);
  }
  function persistUtms() {
    deps.session.set(UTM_STORAGE_KEY, JSON.stringify(utms));
  }
  function publish() {
    const plan = metaInstallPlan(pixelId, consent);
    deps.setDataset("measurementGa", GA4_MEASUREMENT_ID);
    deps.setDataset("measurementHs", HS_PORTAL_ID);
    deps.setDataset("measurementMeta", plan.reason === "missing_id" ? "unconfigured" : "configured");
    deps.setDataset("measurementConsent", consent);
  }
  function location() {
    return deps.getLocation();
  }
  function captureUtms() {
    const loc = location();
    utms = mergeFirstTouch(utms, readAllowlistedUtms(loc.search));
    persistUtms();
  }
  function sanitize() {
    const loc = location();
    const next = sanitizeHref(loc.href);
    if (next && next !== loc.href && deps.replaceHref) deps.replaceHref(next);
  }

  function emitGa(event) {
    if (!event.ga || !deps.gtag) return;
    deps.gtag("event", event.name, event.params || {});
  }
  function bootMeta() {
    if (!metaInstallPlan(pixelId, consent).load) return;
    if (metaBooted) {
      if (deps.fbq) deps.fbq("consent", "grant");
      return;
    }
    metaBooted = true;
    if (deps.ensureFbq) deps.ensureFbq();
    const fbq = deps.fbq;
    if (!fbq) return;
    fbq.disablePushState = true;
    for (const command of metaBootCommands(pixelId)) fbq(...command);
    deps.loadScript(META_SCRIPT_URL, { id: "kcrn-meta", referrerPolicy: "origin" });
  }
  function emitMeta(event) {
    if (!event.meta) return;
    bootMeta();
    if (!deps.fbq) return;
    const command = metaTrackCommand(event.name, event.params);
    if (!command) return;
    if (command.params) deps.fbq(command.method, command.name, command.params);
    else deps.fbq(command.method, command.name);
  }
  function emit(event) {
    if (!event || consent !== "granted") return false;
    if (!once.claim(event.once)) return false;
    emitMeta(event);
    emitGa(event);
    if (event.hubspotPath && deps.hsq) {
      const path = location().pathname || "/";
      deps.hsq.push(["setPath", event.hubspotPath]);
      deps.hsq.push(["trackPageView"]);
      deps.hsq.push(["setPath", path]);
    }
    return true;
  }

  function loadTags() {
    const page = location();
    const safe = pageViewEvent(page).params;
    bootMeta();
    if (!tagsLoaded) {
      tagsLoaded = true;
      if (deps.ensureGtag) deps.ensureGtag();
      deps.gtag("consent", "default", { ...DENIED, wait_for_update: 0 });
      deps.gtag("set", "ads_data_redaction", true);
      deps.gtag("set", "url_passthrough", false);
      deps.gtag("set", "restricted_data_processing", true);
      deps.loadScript("https://www.googletagmanager.com/gtag/js?id=" + GA4_MEASUREMENT_ID, {
        id: "kcrn-ga",
        referrerPolicy: "origin",
      });
      deps.gtag("js", deps.now ? deps.now() : new Date());
      deps.gtag("consent", "update", { ...DENIED, analytics_storage: "granted" });
      deps.gtag("config", GA4_MEASUREMENT_ID, {
        send_page_view: false,
        page_title: safe.page_title,
        page_location: safe.page_location,
        page_referrer: safe.page_referrer,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        anonymize_ip: true,
        cookie_domain: ".katchapmanrn.com",
        cookie_flags: "SameSite=Lax;Secure",
        linker: { domains: LINKER_DOMAINS.slice(), accept_incoming: true },
      });
      if (deps.hsp) {
        deps.hsp.push(["setHubSpotConsent", {
          analytics: true,
          advertisement: false,
          functionality: true,
        }]);
      }
      deps.loadScript("https://js.hs-scripts.com/" + HS_PORTAL_ID + ".js", {
        id: "hs-script-loader",
        referrerPolicy: "origin",
      });
    } else if (deps.gtag) {
      deps.gtag("consent", "update", { ...DENIED, analytics_storage: "granted" });
    }
  }

  function activate() {
    consent = "granted";
    bannerOpen = false;
    persistConsent();
    publish();
    loadTags();
    emit(pageViewEvent(location()));
  }

  sanitize();
  captureUtms();
  const stored = deps.local.get(CONSENT_STORAGE_KEY);
  if (stored === "granted") activate();
  else if (stored === "denied") {
    consent = "denied";
    bannerOpen = false;
    publish();
  } else {
    publish();
  }

  return {
    getConsent() { return consent; },
    isBannerOpen() { return bannerOpen; },
    openBanner() { bannerOpen = true; },
    closeBanner() { bannerOpen = false; },
    grant() {
      if (consent === "granted") {
        bannerOpen = false;
        return;
      }
      activate();
    },
    deny() {
      consent = "denied";
      bannerOpen = false;
      persistConsent();
      publish();
    },
    revoke() {
      consent = "denied";
      bannerOpen = false;
      persistConsent();
      once.clear();
      if (tagsLoaded && deps.gtag) deps.gtag("consent", "update", { ...DENIED });
      if (tagsLoaded && deps.hsp) deps.hsp.push(["revokeCookieConsent"]);
      if (deps.fbq) deps.fbq("consent", "revoke");
      if (deps.clearMetaCookies) deps.clearMetaCookies();
      publish();
    },
    buildFormContext(pageName) {
      return buildHubSpotContext({
        pageName,
        hutk: deps.getCookie ? deps.getCookie() : "",
        consentGranted: consent === "granted",
      });
    },
    reportForm(formId, ok, reason) {
      return emit(formEvent(formId, ok, reason));
    },
    handleAnchor(anchor) {
      const href = (anchor && (anchor.href || (anchor.getAttribute && anchor.getAttribute("href")))) || "";
      const hasBook = !!(anchor && ((anchor.hasAttribute && anchor.hasAttribute("data-book")) || (anchor.dataset && Object.prototype.hasOwnProperty.call(anchor.dataset, "book"))));
      const kind = classifyClick(href, hasBook);
      if (!kind) return null;
      if (kind === "book" && anchor && anchor.setAttribute) {
        const absolute = anchor.href || href;
        anchor.setAttribute("href", appendUtms(absolute, utms));
      }
      const sent = emit(clickEvent(kind));
      return { kind, sent: !!sent };
    },
    onBookingMessage(event, iframes) {
      const iframeSrc = matchingIframeSrc(iframes, event && event.source);
      const signal = bookingSignalFromMessage({
        origin: event && event.origin,
        data: event && event.data,
        iframeSrc,
      });
      if (!signal.ok) return false;
      return emit(bookingEvent());
    },
    decorateBookingUrl(url) {
      return appendUtms(url, utms);
    },
  };
}

export function attachMeasurement(window, document) {
  if (window.__kcrnMeasure) return window.__kcrnMeasure;
  const local = {
    get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const session = {
    get(k) { try { return window.sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { window.sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const controller = createController({
    metaPixelId: META_PIXEL_ID,
    local,
    session,
    getLocation() {
      return {
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        title: document.title,
        referrer: document.referrer,
      };
    },
    replaceHref(href) {
      try { window.history.replaceState(null, "", href); } catch { /* ignore */ }
    },
    getCookie() {
      const match = String(document.cookie || "").match(/(?:^|; )hubspotutk=([^;]+)/);
      return match ? decodeURIComponent(match[1]) : "";
    },
    loadScript(url, opts) {
      if (opts && opts.id && document.getElementById(opts.id)) return;
      const s = document.createElement("script");
      s.async = true;
      if (opts && opts.id) s.id = opts.id;
      if (opts && opts.referrerPolicy) s.referrerPolicy = opts.referrerPolicy;
      s.src = url;
      document.head.appendChild(s);
    },
    ensureGtag() {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
    },
    get gtag() { return window.gtag; },
    get hsq() { window._hsq = window._hsq || []; return window._hsq; },
    get hsp() { window._hsp = window._hsp || []; return window._hsp; },
    setDataset(name, value) {
      if (document.documentElement && document.documentElement.dataset) {
        document.documentElement.dataset[name] = value;
      }
    },
    ensureFbq() {
      if (window.fbq) return;
      const fbq = function () {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
        else fbq.queue.push(arguments);
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      fbq.disablePushState = true;
      window.fbq = fbq;
      window._fbq = fbq;
    },
    get fbq() { return window.fbq; },
    clearMetaCookies() {
      document.cookie = "_fbp=; Max-Age=0; path=/";
      document.cookie = "_fbc=; Max-Age=0; path=/";
    },
  });
  mountBanner(document, controller);
  document.addEventListener("click", (event) => {
    const anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (anchor) controller.handleAnchor(anchor);
  }, true);
  window.addEventListener("message", (event) => {
    controller.onBookingMessage(event, document.querySelectorAll("iframe"));
  });
  window.__kcrnMeasure = controller;
  return controller;
}
