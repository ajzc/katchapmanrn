/**
 * Local browser check. External analytics hosts are blocked so this does not
 * send hits to Google, HubSpot, or Meta. It does not prove Events Manager delivery.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blocked = [
  "*googletagmanager.com*",
  "*google-analytics.com*",
  "*doubleclick.net*",
  "*hubspot.com*",
  "*hs-scripts.com*",
  "*hsforms.com*",
  "*hs-analytics.net*",
  "*hscollectedforms.net*",
  "*hs-banner.com*",
  "*usemessages.com*",
  "*hsappstatic.net*",
  "*facebook.net*",
  "*facebook.com*",
  "*cloudflareinsights.com*",
  "*fonts.googleapis.com*",
  "*fonts.gstatic.com*",
];

function startServer() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      let name = decodeURIComponent(url.pathname);
      if (name.endsWith("/")) name += "index.html";
      const file = path.normalize(path.join(root, name));
      if (!file.startsWith(root)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("missing");
          return;
        }
        res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  let id = 0;
  const pending = new Map();
  const requests = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Network.requestWillBeSent") requests.push(msg.params.request.url);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  function send(method, params = {}) {
    const msgId = ++id;
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  return { ws, send, requests };
}

async function main() {
  const server = await startServer();
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const debugPort = 9334;
  const chrome = spawn("google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=/tmp/kcrn-measure-chrome`,
    "about:blank",
  ], { stdio: "ignore" });
  const failures = [];
  function check(cond, message) {
    if (!cond) failures.push(message);
  }
  try {
    let version;
    for (let i = 0; i < 40; i++) {
      try {
        version = await fetch(`http://127.0.0.1:${debugPort}/json/version`).then((r) => r.json());
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!version) throw new Error("Chrome DevTools did not start");
    const browser = await connect(version.webSocketDebuggerUrl);
    const target = await browser.send("Target.createTarget", { url: "about:blank" });
    const list = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((r) => r.json());
    const page = list.find((item) => item.id === target.targetId);
    const session = await connect(page.webSocketDebuggerUrl);
    await session.send("Network.enable");
    await session.send("Network.setBlockedURLs", { urls: blocked });
    await session.send("Page.enable");
    await session.send("Runtime.enable");

    async function evaluate(expression) {
      const result = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    }
    async function waitFor(expression) {
      const start = Date.now();
      while (Date.now() - start < 8000) {
        const result = await session.send("Runtime.evaluate", { expression, returnByValue: true });
        if (!result.exceptionDetails && result.result && result.result.value) return;
        await new Promise((r) => setTimeout(r, 40));
      }
      throw new Error("Timed out waiting for " + expression);
    }
    async function go(pathname) {
      await session.send("Page.navigate", { url: origin + pathname });
      await waitFor("!!(document.getElementById('kcrn-measure-allow') || document.getElementById('kcrn-measure-reopen'))");
    }

    const dirty = "/botox-huntersville.html?utm_campaign=lip-filler&email=patient@example.com&gclid=CLICKID&fbclid=FB123";
    await go(dirty);
    const search = await evaluate("location.search");
    check(search.includes("utm_campaign=lip-filler"), "safe utm should stay on the url");
    check(!search.includes("email="), "email query should be stripped before tags");
    check(search.includes("gclid=CLICKID"), "click id should stay for attribution");
    check(search.includes("fbclid=FB123"), "fbclid should stay for attribution");
    check(await evaluate("document.getElementById('kcrn-measure-decline').textContent") === "Keep measurement off", "humanized decline label");
    check(await evaluate("document.querySelector('.measure-banner p:last-of-type').textContent.indexOf('Submitted contact form details go to HubSpot') !== -1"), "banner states form details go to HubSpot");
    check(await evaluate("document.documentElement.dataset.measurementMeta") === "unconfigured", "meta dataset should be unconfigured");
    check(await evaluate("!document.getElementById('kcrn-ga') && !document.getElementById('hs-script-loader') && !document.querySelector('script[src*=\"facebook\"]')"), "tags should not load before consent");
    const earlyAds = session.requests.filter((url) => /facebook|googletagmanager|google-analytics|hs-scripts|hubspot/i.test(url));
    check(earlyAds.length === 0, "ads hosts were requested before consent: " + earlyAds.join(", "));

    await evaluate("document.getElementById('kcrn-measure-allow').click()");
    await waitFor("!!document.getElementById('kcrn-ga') && !!document.getElementById('hs-script-loader')");
    check(await evaluate("!document.querySelector('script[src*=\"facebook\"]')"), "Meta should stay unloaded without a pixel id");
    check(!session.requests.some((url) => /facebook|fbevents/i.test(url)), "a Meta request was made without a pixel id");
    const layer = await evaluate("JSON.stringify((window.dataLayer||[]).map(item => Array.from(item)))");
    check(layer.includes("page_view"), "GA page_view should be queued");
    check(layer.includes("/botox-huntersville"), "GA should record the real page path");
    check(!layer.includes("patient@"), "GA queue included an email query value");

    await evaluate(`document.addEventListener('click', (event) => {
      const a = event.target.closest && event.target.closest('a[href]');
      if (a && (a.hasAttribute('data-book') || String(a.href).indexOf('meetings.hubspot.com') !== -1)) event.preventDefault();
    }, true); true`);
    await evaluate("document.querySelector('a[data-book]').click()");
    const afterSiteBook = await evaluate("JSON.stringify((window.dataLayer||[]).map(item => Array.from(item)))");
    check(!afterSiteBook.includes("booking_completed"), "same-site book control must not be a completed booking");
    check(!afterSiteBook.includes("/track/book"), "same-site book control must not add a synthetic page view");
    const bookHref = await evaluate("document.querySelector('a[data-book]').href");
    check(bookHref.endsWith("/book"), "book controls open the same-site scheduler");
    await evaluate(`var ext = document.createElement('a'); ext.href = 'https://meetings.hubspot.com/ajchapman20/book-a-visit-kat-chapman-rn'; ext.id = 'ext-book'; document.body.appendChild(ext); ext.click(); true`);
    const hsq = await evaluate("JSON.stringify(window._hsq||[])");
    check(hsq.includes("/track/book"), "direct scheduler link still records book intent");

    await go("/contact.html");
    await evaluate(`window.__mode = 'fail'; window.__bodies = []; window.fetch = function (url, opts) {
      var body = opts && opts.body ? String(opts.body) : '';
      if (String(url).indexOf('hsforms') !== -1) window.__bodies.push(body);
      if (window.__mode === 'fail') return Promise.resolve({ ok: false, status: 400, text: function () { return Promise.resolve(JSON.stringify({ status: 'error', message: 'SENSITIVE_ERROR_TEXT' })); } });
      return Promise.resolve({ ok: true, text: function () { return Promise.resolve('{}'); } });
    }; true`);
    await evaluate(`document.querySelector('[name=name]').value = 'Test Person';
      document.querySelector('[name=email]').value = 'qa-measurement@example.com';
      document.querySelector('[name=phone]').value = '7045550100';
      document.querySelector('[name=message]').value = 'lip filler appointment on 2026-12-01';
      document.querySelector('form.contact-form').requestSubmit(); true`);
    await waitFor("!!document.querySelector('.form-error')");
    let contactLayer = await evaluate("JSON.stringify((window.dataLayer||[]).map(item => Array.from(item)))");
    check(contactLayer.includes("form_submit_failed"), "failed form should emit form_submit_failed");
    check(!contactLayer.includes("generate_lead"), "failed form must not emit a lead");
    check(!contactLayer.includes("qa-measurement@example.com"), "failed form leaked email to GA");
    check(!contactLayer.includes("SENSITIVE_ERROR_TEXT"), "HubSpot error text leaked to GA");
    await evaluate("window.__mode = 'ok'");
    await evaluate("document.querySelector('form.contact-form').requestSubmit()");
    await waitFor("!!document.querySelector('.form-success')");
    contactLayer = await evaluate("JSON.stringify((window.dataLayer||[]).map(item => Array.from(item)))");
    const posted = await evaluate("window.__bodies.join('\\n')");
    check(posted.includes("qa-measurement@example.com"), "HubSpot form body should keep the submitted email");
    check(posted.includes("lip filler appointment"), "HubSpot form body should keep the message");
    check(contactLayer.includes("generate_lead"), "successful form should emit one lead");
    check(!contactLayer.includes("qa-measurement@example.com"), "lead event leaked email");
    check(!contactLayer.includes("lip filler"), "lead event leaked message text");
    await evaluate("localStorage.setItem('kcrn_measure_consent','denied')");
    await go("/contact.html");
    check(await evaluate("!document.getElementById('kcrn-ga')"), "refusing measurement must not load GA");
    await evaluate(`window.__bodies = []; window.fetch = function (url, opts) {
      if (String(url).indexOf('hsforms') !== -1) window.__bodies.push(String(opts && opts.body || ''));
      return Promise.resolve({ ok: true, text: function () { return Promise.resolve('{}'); } });
    }; true`);
    await evaluate(`document.querySelector('[name=name]').value = 'Test Person';
      document.querySelector('[name=email]').value = 'refused-measurement@example.com';
      document.querySelector('[name=message]').value = 'message while measurement is off';
      document.querySelector('form.contact-form').requestSubmit(); true`);
    await waitFor("!!document.querySelector('.form-success')");
    const refusedBody = await evaluate("window.__bodies.join('\\n')");
    const refusedLayer = await evaluate("JSON.stringify((window.dataLayer||[]).map(item => Array.from(item)))");
    check(refusedBody.includes("refused-measurement@example.com"), "form must reach HubSpot when measurement is off");
    check(!refusedLayer.includes("generate_lead"), "refused measurement must not emit a lead");
    check(!refusedLayer.includes("refused-measurement@example.com"), "refused form email must not reach GA");

    await session.send("Page.addScriptToEvaluateOnNewDocument", {
      source: "try{localStorage.setItem('kcrn_measure_consent','denied')}catch(e){}",
    });
    await go("/about.html");
    check(await evaluate("!document.getElementById('kcrn-ga')"), "denied consent should not load GA");
    check(await evaluate("!!document.getElementById('kcrn-measure-reopen')"), "denied visitors need a way back to the choice");
    await evaluate("document.getElementById('kcrn-measure-reopen').click()");
    await evaluate("document.getElementById('kcrn-measure-allow').click()");
    await waitFor("!!document.getElementById('kcrn-ga')");

    for (const page of ["/index.html", "/404.html", "/pricing.html", "/book.html"]) {
      await go(page);
      check(await evaluate("document.documentElement.dataset.measurementMeta") === "unconfigured", page + " meta status");
      check(await evaluate("!!document.querySelector('script[src*=\"script.js\"]')"), page + " shared script");
    }
    check(await evaluate("!!document.querySelector('.meetings-iframe-container')"), "booking page should embed the scheduler");
    check(await evaluate("!!document.getElementById('kcrn-meetings-embed')"), "official meetings embed script should load");
    check(await evaluate("document.querySelector('.book-fallback a').href.indexOf('meetings.hubspot.com') !== -1"), "direct scheduler fallback remains");
  } finally {
    chrome.kill("SIGKILL");
    server.close();
  }
  if (failures.length) {
    console.error(failures.map((item) => "- " + item).join("\n"));
    process.exit(1);
  }
  console.log("browser check passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
