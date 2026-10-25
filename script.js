/* ============================================================
   Kat Chapman, BSN, RN — shared behavior
   ============================================================ */

/* Progressive enhancement flag: reveal animations only run with JS,
   so content is never gated on scripts loading. */
document.documentElement.classList.add("js");

/* Google Analytics 4 (G-0BX0PK6GZP)
   Loaded here so every page that includes script.js is tracked. */
(function () {
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=G-0BX0PK6GZP";
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", "G-0BX0PK6GZP");
})();

/* HubSpot tracking (portal 22023986).
   Enables analytics and ties form submissions to visitor sessions
   via the hubspotutk cookie. Loaded for everyone; no cookie banner. */
(function () {
  var h = document.createElement("script");
  h.async = true;
  h.defer = true;
  h.id = "hs-script-loader";
  h.src = "https://js.hs-scripts.com/22023986.js";
  document.head.appendChild(h);
})();

/* >>> EDIT THESE IN ONE PLACE <<<
   Swap the placeholders below and every page updates. */
const SITE_CONFIG = {
  /* HubSpot Meetings (opens in a new tab). */
  bookingUrl: "https://meetings.hubspot.com/ajchapman20/book-a-visit-kat-chapman-rn",
  phone: "(704) 584-9785",
  phoneHref: "tel:+17045849785",
  email: "",      // unpublished on purpose; do not render mailto links
  address: "Canvas & Glow on Sam Furr Road in Huntersville",
  instagram: "https://www.instagram.com/kathrynshelton"
};

/* Public social: Instagram only (@kathrynshelton). */
document.querySelectorAll(".site-footer a[data-instagram]").forEach(a => {
  a.href = SITE_CONFIG.instagram;
  a.target = "_blank";
  a.rel = "noopener";
});

/* Apply config to all tagged elements */
document.querySelectorAll("[data-book]").forEach(el => {
  el.href = SITE_CONFIG.bookingUrl;
  el.target = "_blank";
  el.rel = "noopener";
});
document.querySelectorAll("[data-phone]").forEach(el => {
  el.href = SITE_CONFIG.phoneHref;
  if (el.dataset.phone === "text") el.textContent = SITE_CONFIG.phone;
});
/* Never emit mailto: links. Cloudflare Email Address Obfuscation
   rewrites them into /cdn-cgi/l/email-protection, which Google indexes
   as a 404. Drop any leftover data-email node instead. */
document.querySelectorAll("[data-email]").forEach(el => {
  const li = el.closest("li") || el.closest(".info-item");
  if (li) li.remove();
  else el.remove();
});
document.querySelectorAll("[data-address]").forEach(el => (el.textContent = SITE_CONFIG.address));
document.querySelectorAll("[data-instagram]").forEach(el => { el.href = SITE_CONFIG.instagram; el.target = "_blank"; el.rel = "noopener"; });

/* Sticky nav: glass effect on scroll */
const nav = document.querySelector(".nav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* Mobile menu */
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
function setMenu(open) {
  toggle.classList.toggle("open", open);
  links.classList.toggle("open", open);
  nav.classList.toggle("menu-open", open);
  document.body.classList.toggle("nav-open", open);
}
if (toggle && links) {
  toggle.addEventListener("click", () => setMenu(!links.classList.contains("open")));
  links.querySelectorAll("a").forEach(a =>
    a.addEventListener("click", () => setMenu(false))
  );
}

/* Staggered mask reveal for mobile menu links */
if (links) {
  links.querySelectorAll(":scope > li").forEach((li, i) => {
    li.style.transitionDelay = 60 + i * 45 + "ms";
  });
}

/* Button-in-button: wrap CTA arrows in their own orb */
document.querySelectorAll(".btn .arrow").forEach(a => {
  if (a.closest(".orb")) return;
  const orb = document.createElement("span");
  orb.className = "orb";
  a.replaceWith(orb);
  orb.appendChild(a);
});

/* Mobile: tap-to-expand chevron for the Services submenu */
document.querySelectorAll(".nav-links .has-dropdown").forEach(li => {
  const btn = document.createElement("button");
  btn.className = "submenu-toggle";
  btn.setAttribute("aria-label", "Show treatment pages");
  btn.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    li.classList.toggle("open");
  });
  li.appendChild(btn);
});

/* Scroll-reveal animations.
   Content is visible without JS (styles gate on .js); reveals only
   enhance. Elements jumped past (anchor links, restored scroll,
   fast flicks) are marked visible by the sweep so nothing is ever
   left hidden. */
/* Photos unveil inside their frames once their section is revealed */
document.querySelectorAll(".portrait-frame img.cover, .split-visual .frame img.cover").forEach(img => {
  if (img.closest(".reveal")) img.classList.add("clip-reveal");
});

function markVisible(el) {
  el.classList.add("visible");
  el.querySelectorAll("img.clip-reveal").forEach(img => {
    requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add("revealed")));
  });
}

const revealEls = Array.from(document.querySelectorAll(".reveal"));
const io = new IntersectionObserver(
  entries => {
    entries.forEach(e => {
      if (e.isIntersecting || e.boundingClientRect.top < 0) {
        markVisible(e.target);
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
revealEls.forEach(el => io.observe(el));

let pendingReveals = revealEls;
function revealSweep() {
  if (!pendingReveals.length) return;
  pendingReveals = pendingReveals.filter(el => {
    if (el.classList.contains("visible")) return false;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top < window.innerHeight - 40) {
      markVisible(el);
      io.unobserve(el);
      return false;
    }
    return true;
  });
}
window.addEventListener("scroll", () => requestAnimationFrame(revealSweep), { passive: true });

/* ============================================================
   Motion layer — choreography that makes the page feel alive.
   All transform/opacity, exponential ease-out, gated for touch
   and reduced motion per Emil Kowalski's rules.
   ============================================================ */
/* Evaluated live (not cached at load): device profiles can change,
   and some environments misreport pointer capabilities during boot. */
const fineMQ = window.matchMedia("(hover: hover) and (pointer: fine)");
const calmMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
const motionOK = () => fineMQ.matches && !calmMQ.matches;

/* 1 — Entrance choreography: hero elements cascade in on load */
(function heroChoreography() {
  const hero = document.querySelector(".hero, .page-hero");
  if (!hero) return;
  hero.querySelectorAll(".reveal").forEach((el, i) => {
    el.style.transitionDelay = 90 + i * 110 + "ms";
  });
})();

/* 2 — Auto-stagger: children of every grid cascade 55ms apart */
(function autoStagger() {
  const grids = document.querySelectorAll(
    ".card-grid, .quote-grid, .blog-grid, .gallery-grid, .t-facts, .info-block, .checklist"
  );
  grids.forEach(grid => {
    Array.from(grid.children).forEach((child, i) => {
      if (!child.classList.contains("reveal")) return;
      child.style.transitionDelay = Math.min(i * 55, 380) + "ms";
    });
  });
})();

/* 3 — Magnetic buttons: primary CTAs lean toward the cursor */
(function magneticButtons() {
  document.querySelectorAll(".btn").forEach(btn => {
    let raf = null, tx = 0, ty = 0, cx = 0, cy = 0, hovering = false, pressed = false;
    function tick() {
      cx += (tx - cx) * 0.16;
      cy += (ty - cy) * 0.16;
      const s = pressed ? 0.97 : 1;
      btn.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px) scale(${s})`;
      if (hovering || Math.abs(cx) > 0.15 || Math.abs(cy) > 0.15) {
        raf = requestAnimationFrame(tick);
      } else {
        btn.style.transform = "";
        raf = null;
      }
    }
    function start() { if (!raf) raf = requestAnimationFrame(tick); }
    btn.addEventListener("pointerenter", () => { if (!motionOK()) return; hovering = true; start(); });
    btn.addEventListener("pointermove", e => {
      if (!motionOK()) return;
      const r = btn.getBoundingClientRect();
      tx = (e.clientX - r.left - r.width / 2) * 0.14;
      ty = (e.clientY - r.top - r.height / 2) * 0.22 - 2;
      hovering = true;
      start();
    });
    btn.addEventListener("pointerleave", () => { hovering = false; tx = 0; ty = 0; start(); });
    btn.addEventListener("pointerdown", () => { if (!motionOK()) return; pressed = true; start(); });
    window.addEventListener("pointerup", () => { if (pressed) { pressed = false; start(); } }, { passive: true });
  });
})();

/* 4 — Tilt: photo frames respond to the cursor in 3D */
(function tiltFrames() {
  document.querySelectorAll(".portrait-frame, .split-visual .frame").forEach(frame => {
    let raf = null, trx = 0, try_ = 0, crx = 0, cry = 0, lift = 0, clift = 0, hovering = false;
    function tick() {
      crx += (trx - crx) * 0.12;
      cry += (try_ - cry) * 0.12;
      clift += (lift - clift) * 0.12;
      frame.style.transform =
        `perspective(950px) translateY(${clift.toFixed(2)}px) rotateX(${crx.toFixed(3)}deg) rotateY(${cry.toFixed(3)}deg)`;
      if (hovering || Math.abs(crx) > 0.02 || Math.abs(cry) > 0.02 || Math.abs(clift) > 0.15) {
        raf = requestAnimationFrame(tick);
      } else {
        frame.style.transform = "";
        raf = null;
      }
    }
    function start() { if (!raf) raf = requestAnimationFrame(tick); }
    frame.addEventListener("pointerenter", () => { if (!motionOK()) return; hovering = true; lift = -5; start(); });
    frame.addEventListener("pointermove", e => {
      if (!motionOK()) return;
      const r = frame.getBoundingClientRect();
      try_ = ((e.clientX - r.left) / r.width - 0.5) * 5;
      trx = (0.5 - (e.clientY - r.top) / r.height) * 5;
      hovering = true;
      start();
    });
    frame.addEventListener("pointerleave", () => { hovering = false; trx = 0; try_ = 0; lift = 0; start(); });
  });
})();

/* 5 — Gentle scroll parallax on the hero (desktop) */
(function heroParallax() {
  const visual = document.querySelector(".hero-visual");
  const bg = document.querySelector(".hero .hero-bg, .page-hero .hero-bg");
  if (!visual && !bg) return;
  let ticking = false;
  function update() {
    ticking = false;
    if (!motionOK()) return;
    const y = window.scrollY;
    if (y > window.innerHeight * 1.4) return;
    if (visual && !visual.matches(":hover")) {
      visual.style.transform = `translateY(${(y * -0.06).toFixed(1)}px)`;
    }
    if (bg) bg.style.transform = `translateY(${(y * 0.1).toFixed(1)}px)`;
  }
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
})();

/* Highlight current page in nav */
const here = (location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/");
document.querySelectorAll(".nav-links a:not(.btn)").forEach(a => {
  const href = (a.getAttribute("href") || "").replace(/\/$/, "") || "/";
  if (href === here) a.classList.add("active");
});

/* Forms submit to HubSpot (portal 22023986).
   Consult/book form + Website Contact, built in HubSpot with
   notifications to every portal user. On any failure the visitor sees
   HubSpot's real error message instead of a fake success. */
const HS_PORTAL = "22023986";
const HS_FORMS = {
  join: "2b288535-f430-41df-aea1-2c15d800d311",     // Consult / book request
  contact: "520f79d5-f010-4465-8a88-56b22f41ab0d"   // Website Contact
};

function hsCookie() {
  const m = document.cookie.match(/hubspotutk=([^;]+)/);
  return m ? m[1] : undefined;
}

/* Keep HubSpot's non-HubSpot-forms collector off these forms so the only
   record is the real HubSpot form submission (which sends notifications). */
document.querySelectorAll("form.contact-form").forEach(f => f.setAttribute("data-hs-cf-bound", "true"));

function hsShowError(form, msg) {
  let el = form.querySelector(".form-error");
  if (!el) {
    el = document.createElement("p");
    el.className = "form-error";
    el.setAttribute("role", "alert");
    form.appendChild(el);
  }
  el.textContent = "Sorry, that didn't go through: " + msg + " Please try again.";
}

function hsSubmit(guid, fields, form, successHtml) {
  /* pageUri is deliberately NOT sent: HubSpot returns 200 but silently drops
     every v3 submission whose context.pageUri is on katchapmanrn.com
     (verified 2026-10-20). pageName + hutk still give page and visitor context. */
  const body = {
    fields: fields,
    context: {
      pageName: document.title,
      hutk: hsCookie()
    }
  };
  if (!body.context.hutk) delete body.context.hutk; // API rejects an empty hutk
  const btn = form.querySelector("[type=submit]");
  if (btn) btn.disabled = true;
  // Portal 22023986 is NA (api-eu1 answers PORTAL_NOT_KNOWN), so api.hsforms.com is correct.
  fetch("https://api.hsforms.com/submissions/v3/integration/submit/" + HS_PORTAL + "/" + guid, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => r.text().then(t => {
    let data = {};
    try { data = t ? JSON.parse(t) : {}; } catch (_) { data = {}; }
    if (!r.ok || data.status === "error") {
      const detail = (data.errors && data.errors.length && data.errors.map(e => e.message).join(" ")) ||
        data.message || ("HubSpot error " + r.status + ".");
      if (window.console) console.error("HubSpot form submit failed", r.status, t);
      throw new Error(detail);
    }
    const ok = document.createElement("div");
    ok.className = "form-success";
    ok.innerHTML = successHtml;
    form.replaceWith(ok);
    ok.scrollIntoView({ block: "center", behavior: "smooth" });
  })).catch(err => {
    if (btn) btn.disabled = false;
    hsShowError(form, (err && err.message) || "Network error.");
  });
}

const joinFormEl = document.getElementById("join");
if (joinFormEl) {
  joinFormEl.addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(joinFormEl);
    const fields = [
      { objectTypeId: "0-1", name: "firstname", value: fd.get("name") || "" },
      { objectTypeId: "0-1", name: "email", value: fd.get("email") || "" },
      { objectTypeId: "0-1", name: "phone", value: fd.get("phone") || "" },
      { objectTypeId: "0-1", name: "beauty_event_host_interest", value: fd.get("beauty_event") ? "true" : "false" }
    ];
    hsSubmit(HS_FORMS.join, fields, joinFormEl,
      "<strong>Request received.</strong> Kat will be in touch to book your visit.");
  });
}

const contactFormEl = document.querySelector("form.contact-form:not(#join)");
if (contactFormEl && contactFormEl.querySelector("[name=message]")) {
  contactFormEl.addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(contactFormEl);
    const fields = [
      { objectTypeId: "0-1", name: "firstname", value: fd.get("name") || "" },
      { objectTypeId: "0-1", name: "email", value: fd.get("email") || "" },
      { objectTypeId: "0-1", name: "phone", value: fd.get("phone") || "" },
      /* consult_opt_in is not a HubSpot contact property; sending it made the
         API reject the whole submission (400). Carry the answer in message. */
      { objectTypeId: "0-1", name: "message", value: (fd.get("message") || "") +
          "\n\nWants a free consultation: " + (fd.get("consult_opt_in") ? "Yes" : "No") }
    ];
    hsSubmit(HS_FORMS.contact, fields, contactFormEl,
      "<strong>Message sent.</strong> Kat reads every message and will get back to you soon.");
  });
}

/* Legacy fallback: thank-you states when returning from the native
   (non-JS) submission path. */
const params = new URLSearchParams(location.search);
if (params.get("joined") === "1" && joinFormEl) {
  const ok = document.createElement("div");
  ok.className = "form-success";
  ok.innerHTML = "<strong>Request received.</strong> Kat will be in touch to book your visit.";
  joinFormEl.replaceWith(ok);
  ok.scrollIntoView({ block: "center" });
}
if (params.get("sent") === "1" && contactFormEl) {
  const ok = document.createElement("div");
  ok.className = "form-success";
  ok.innerHTML = "<strong>Message sent.</strong> Kat reads every message and will get back to you soon.";
  contactFormEl.replaceWith(ok);
}

/* Launch strip leads every public page. Measure it so the fixed nav
   sits underneath instead of covering the offer. */
(function () {
  var strip = document.querySelector(".launch-strip");
  if (!strip) {
    strip = document.createElement("aside");
    strip.className = "launch-strip";
    strip.setAttribute("aria-label", "Launch pricing");
    strip.innerHTML = '<div class="wrap launch-strip-inner"><p class="launch-strip-text">Launch pricing: 30% off all treatments through Dec 31.</p><a class="launch-strip-cta" data-book target="_blank" rel="noopener" href="' + SITE_CONFIG.bookingUrl + '">Book now</a></div>';
    document.body.prepend(strip);
  }
  var sync = function () {
    document.documentElement.style.setProperty("--launch-strip-h", strip.offsetHeight + "px");
  };
  sync();
  window.addEventListener("resize", sync);
})();

/* Ensure Mobile & Concierge appears in the Services dropdown and footer
   on pages that don't have it statically yet. */
document.querySelectorAll(".nav-links .dropdown").forEach(d => {
  if (!d.querySelector('a[href="/mobile-botox-lake-norman"]')) {
    const li = document.createElement("li");
    li.innerHTML = '<a href="/mobile-botox-lake-norman">Mobile &amp; Concierge</a>';
    d.appendChild(li);
  }
});
document.querySelectorAll(".site-footer h4").forEach(h => {
  if (h.textContent.trim() === "Treatments") {
    const ul = h.nextElementSibling;
    if (ul && !ul.querySelector('a[href="/mobile-botox-lake-norman"]')) {
      const li = document.createElement("li");
      li.innerHTML = '<a href="/mobile-botox-lake-norman">Mobile &amp; Concierge</a>';
      ul.appendChild(li);
    }
  }
});
/* HubSpot click tracking: call / text / book (portal 22023986).
   Each tap is logged as a HubSpot page view of /track/call, /track/text or /track/book,
   so counts show in HubSpot Traffic analytics > Pages with no extra HubSpot setup. */
(function () {
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = (a.getAttribute("href") || "").toLowerCase();
    var type =
      href.indexOf("tel:") === 0 ? "call" :
      href.indexOf("sms:") === 0 ? "text" :
      (a.hasAttribute("data-book") || href.indexOf("meetings.hubspot.com") !== -1) ? "book" :
      null;
    if (!type) return;
    var back = location.pathname;
    var _hsq = (window._hsq = window._hsq || []);
    _hsq.push(["setPath", "/track/" + type]);
    _hsq.push(["trackPageView"]);
    _hsq.push(["setPath", back]);
  }, true);
})();
