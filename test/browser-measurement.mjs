import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = 8765;
const debugPort = 9222;
const pageUrl = `http://127.0.0.1:${port}/botox-huntersville.html?utm_term=botox&utm_source=instagram&gclid=abcDEF12345&email=kate%40example.com`;
const blocked = [
  "googletagmanager.com",
  "google-analytics.com",
  "analytics.google.com",
  "googleadservices.com",
  "doubleclick.net",
  "facebook.net",
  "facebook.com/tr",
  "hs-scripts.com",
  "hs-analytics.net",
  "hs-banner.com",
  "hubspot.com"
];

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
  cwd: root,
  stdio: "ignore"
});
const chrome = spawn("google-chrome", [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  `--remote-debugging-port=${debugPort}`,
  "--user-data-dir=/tmp/kcrn-chrome-profile",
  "--window-size=1280,900",
  "about:blank"
], { stdio: "ignore" });

const requests = [];
let ws;
let msgId = 0;
const pending = new Map();

function fail(message) {
  throw new Error(message);
}

async function waitForPort() {
  const start = Date.now();
  while (Date.now() - start < 15000) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (res.ok) return;
    } catch (_) {}
    await new Promise(function (resolve) { setTimeout(resolve, 100); });
  }
  fail("Chrome did not open a debugging port");
}

function send(method, params) {
  const id = ++msgId;
  return new Promise(function (resolve, reject) {
    pending.set(id, { resolve: resolve, reject: reject });
    ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression: expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) fail(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function waitFor(expression) {
  const start = Date.now();
  while (Date.now() - start < 8000) {
    if (await evaluate(expression)) return;
    await new Promise(function (resolve) { setTimeout(resolve, 100); });
  }
  fail("Timed out waiting for " + expression + " url=" + await evaluate("location.href") + " error=" + await evaluate("document.documentElement.getAttribute('data-kcrn-error')"));
}

function hits(list) {
  return list.filter(function (url) {
    return blocked.some(function (host) { return url.includes(host); });
  });
}

async function shot(name) {
  const dir = "/opt/cursor/artifacts";
  await mkdir(dir, { recursive: true });
  const image = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(dir, name), Buffer.from(image.data, "base64"));
}

try {
  await waitForPort();
  const opened = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(pageUrl)}`, { method: "PUT" });
  const tab = await opened.json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(function (resolve, reject) {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  ws.addEventListener("message", function (event) {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
      return;
    }
    if (message.method === "Network.requestWillBeSent") requests.push(message.params.request.url);
  });
  await send("Network.enable");
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: pageUrl });
  await waitFor("!!document.getElementById('kcrn-measure-banner')");
  const before = await evaluate(`(() => ({
    banner: document.getElementById('kcrn-measure-banner').innerText,
    accept: !!document.querySelector('#kcrn-measure-banner .kcrn-accept'),
    reject: !!document.querySelector('#kcrn-measure-banner .kcrn-reject'),
    ga: !!document.querySelector('script[src*="googletagmanager"]'),
    hs: !!document.getElementById('hs-script-loader'),
    meta: !!document.getElementById('kcrn-meta-frame'),
    dataLayer: !!window.dataLayer,
    status: document.documentElement.dataset.kcrnMeta + '|' + document.documentElement.dataset.kcrnGoogleAds + '|' + document.documentElement.dataset.kcrnBookingCompleted,
    book: document.querySelector('a[data-book]').href
  }))()`);
  if (!before.banner.includes("Measurement stays off until you choose.")) fail("banner copy missing: " + before.banner);
  if (!before.accept || !before.reject) fail("consent buttons missing");
  if (before.ga || before.hs || before.meta || before.dataLayer) fail("tags loaded before consent " + JSON.stringify(before));
  if (before.status !== "unconfigured|unconfigured|embed_hook_only") fail("status " + before.status);
  if (before.book.includes("gclid") || before.book.toLowerCase().includes("botox")) fail("book url decorated early " + before.book);
  const early = hits(requests);
  if (early.length) fail("measurement requests before consent: " + early.join("\n"));
  await shot("measurement-banner.png");

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const mobile = await evaluate(`(() => {
    const banner = document.getElementById('kcrn-measure-banner');
    const rect = banner.getBoundingClientRect();
    const accept = banner.querySelector('.kcrn-accept').getBoundingClientRect();
    const reject = banner.querySelector('.kcrn-reject').getBoundingClientRect();
    return { width: rect.width, top: rect.top, accept: accept.width, reject: reject.width, vw: innerWidth };
  })()`);
  if (mobile.vw !== 390 || mobile.width < 280 || mobile.accept < 40 || mobile.reject < 40) fail("mobile banner " + JSON.stringify(mobile));
  await shot("measurement-banner-mobile.png");
  await send("Emulation.clearDeviceMetricsOverride");

  await evaluate("document.querySelector('#kcrn-measure-banner .kcrn-reject').click()");
  await waitFor("!!document.getElementById('kcrn-measure-chip')");
  await send("Page.reload");
  await waitFor("!!document.getElementById('kcrn-measure-chip') && !document.getElementById('kcrn-measure-banner')");
  const denied = await evaluate(`(() => ({
    ga: !!document.querySelector('script[src*="googletagmanager"]'),
    cookie: document.cookie.includes('kcrn_consent=denied')
  }))()`);
  if (denied.ga || !denied.cookie) fail("denial did not persist " + JSON.stringify(denied));

  await evaluate("document.getElementById('kcrn-measure-chip').click()");
  await waitFor("!!document.querySelector('#kcrn-measure-banner .kcrn-accept')");
  const reopened = await evaluate("document.getElementById('kcrn-measure-banner').innerText");
  if (!reopened.includes("Measurement is off.")) fail("reopen copy " + reopened);
  await evaluate("document.querySelector('#kcrn-measure-banner .kcrn-accept').click()");
  await waitFor("!!document.getElementById('kcrn-ga4')");
  const accepted = await evaluate(`(() => {
    const rows = Array.from(window.dataLayer || []).map(item => Array.from(item).map(value => value instanceof Date ? 'date' : value));
    return {
      rows: rows,
      ga: document.getElementById('kcrn-ga4').src,
      hs: !!document.getElementById('hs-script-loader'),
      meta: !!document.getElementById('kcrn-meta-frame'),
      title: document.title
    };
  })()`);
  const flat = JSON.stringify(accepted.rows);
  if (accepted.ga !== "https://www.googletagmanager.com/gtag/js?id=G-0BX0PK6GZP") fail("ga src " + accepted.ga);
  if (!accepted.hs || accepted.meta) fail("hubspot/meta after accept " + JSON.stringify({ hs: accepted.hs, meta: accepted.meta }));
  if ((flat.match(/"page_view"/g) || []).length !== 1) fail("pageview count " + flat);
  if (!flat.includes("https://katchapmanrn.com/service?utm_source=instagram&gclid=abcDEF12345")) fail("location missing " + flat);
  if (flat.toLowerCase().includes("botox") || flat.includes("kate@") || flat.includes("704") || flat.includes("fbclid")) fail("dirty hit " + flat);
  if (!flat.includes("Kat Chapman RN")) fail("title missing " + flat);
  if (flat.includes(accepted.title)) fail("raw title sent " + accepted.title);
  const config = accepted.rows.find(function (row) { return row[0] === "config"; });
  if (!config || config[2].send_page_view !== false || config[2].allow_google_signals !== false) fail("config " + JSON.stringify(config));

  await evaluate(`document.addEventListener('click', function (event) {
    const link = event.target.closest && event.target.closest('a[data-book]');
    if (link) event.preventDefault();
  }, false)`);
  const beforeBook = await evaluate("document.querySelector('a[data-book]').href");
  await evaluate("document.querySelector('a[data-book]').click()");
  const afterClick = await evaluate(`(() => {
    const rows = Array.from(window.dataLayer || []).map(item => Array.from(item).map(value => value instanceof Date ? 'date' : value));
    return { rows: rows, book: document.querySelector('a[data-book]').href };
  })()`);
  const clicked = JSON.stringify(afterClick.rows);
  if (!clicked.includes('"booking_start"') || clicked.includes('"booking_completed"') || clicked.includes('"Schedule"')) fail("book click " + clicked);
  if (!afterClick.book.includes("gclid=abcDEF12345") || afterClick.book.toLowerCase().includes("botox") || afterClick.book.includes("kate@")) fail("decorated book url " + afterClick.book);
  if (beforeBook.includes("gclid")) fail("book url changed before the granted click");

  await evaluate("window.KCRNMeasurement.trackFormSuccess('contact')");
  await evaluate("window.KCRNMeasurement.trackFormSuccess({email:'kate@example.com', message:'lip filler'})");
  await evaluate("window.KCRNMeasurement.trackFormSuccess('contact')");
  const leads = await evaluate(`JSON.stringify(Array.from(window.dataLayer).map(item => Array.from(item)))`);
  if ((leads.match(/"generate_lead"/g) || []).length !== 1 || leads.includes("kate@") || leads.toLowerCase().includes("filler")) fail("lead " + leads);

  const countBeforeRevoke = await evaluate("window.dataLayer.length");
  await evaluate("document.getElementById('kcrn-measure-chip').click()");
  await evaluate("document.querySelector('#kcrn-measure-banner .kcrn-reject').click()");
  await evaluate("document.querySelector('a[data-book]').click()");
  const afterRevoke = await evaluate(`(() => ({
    length: window.dataLayer.length,
    cookie: document.cookie.includes('kcrn_consent=denied'),
    flat: JSON.stringify(Array.from(window.dataLayer).map(item => Array.from(item)))
  }))()`);
  if (!afterRevoke.cookie) fail("revoke cookie missing");
  if ((afterRevoke.flat.match(/"booking_start"/g) || []).length !== 1) fail("revoke did not stop the click " + afterRevoke.flat);
  if (afterRevoke.length < countBeforeRevoke) fail("unexpected dataLayer shrink");

  await evaluate("new Promise(function (resolve) { setTimeout(resolve, 1500); })");
  const resources = await evaluate("performance.getEntriesByType('resource').map(function (entry) { return entry.name; })");
  const leaked = resources.filter(function (url) {
    const lower = url.toLowerCase();
    const googleOrMeta = lower.includes("google") || lower.includes("facebook") || lower.includes("doubleclick");
    if (lower.includes("kate") || lower.includes("utm_term") || lower.includes("email=")) return true;
    if (googleOrMeta && (lower.includes("botox") || lower.includes("lip-filler") || lower.includes("704"))) return true;
    return false;
  });
  if (leaked.length) fail("resource leaked page context " + leaked.join("\n"));
  const collects = resources.filter(function (url) {
    return url.includes("google-analytics.com") || url.includes("/g/collect") || url.includes("facebook.com/tr") || url.includes("track.hubspot.com");
  });

  const hubspotBanners = await evaluate(`(() => Array.from(document.querySelectorAll('#hs-eu-cookie-confirmation, #hs-banner-parent, [id*="hs-eu"], [id*="hs-banner"]')).map(node => ({
    id: node.id,
    display: getComputedStyle(node).display,
    text: (node.innerText || '').slice(0, 120)
  })))()`);
  const visibleBanner = hubspotBanners.filter(function (node) { return node.display !== "none" && node.text; });
  if (visibleBanner.length) fail("HubSpot showed a second banner " + JSON.stringify(visibleBanner));

  const report = {
    earlyRequests: early,
    measurementRequestsAfterAccept: hits(requests),
    collects: collects,
    mobile: mobile,
    pageViews: 1,
    bookingStart: 1,
    bookingCompleted: 0,
    generateLead: 1
  };
  await mkdir("/tmp", { recursive: true });
  await writeFile("/tmp/kcrn-browser-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (ws) ws.close();
  chrome.kill("SIGKILL");
  server.kill("SIGKILL");
}
