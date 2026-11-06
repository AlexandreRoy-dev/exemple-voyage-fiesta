import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = '/opt/cursor/artifacts';
mkdirSync(outDir, { recursive: true });

const types = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path.replace(/^\/+/, '')));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch (_) {
      res.writeHead(404);
      res.end('missing');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  const waiters = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result || {});
      return;
    }
    for (const waiter of [...waiters]) {
      if (waiter.match(msg)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(msg);
      }
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  return {
    ready,
    send(method, params = {}) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    wait(match, timeout = 8000) {
      return new Promise((resolve, reject) => {
        const waiter = { match, resolve };
        waiters.push(waiter);
        setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error('timeout'));
        }, timeout);
      });
    },
    close() { ws.close(); }
  };
}

async function launchChrome() {
  const port = 9300 + Math.floor(Math.random() * 200);
  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/chrome-accueil-hero-${port}`,
    '--lang=fr-CA',
    '--window-size=1440,1000',
    'about:blank'
  ], { stdio: 'ignore' });
  const deadline = Date.now() + 10000;
  let version;
  while (Date.now() < deadline) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      break;
    } catch (_) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  if (!version) throw new Error('Chrome DevTools did not start');
  return { chrome, port, browser: version.webSocketDebuggerUrl };
}

async function openTab(port) {
  const url = `http://127.0.0.1:${port}/json/new?about:blank`;
  let response = await fetch(url, { method: 'PUT' });
  if (!response.ok) response = await fetch(url);
  if (!response.ok) throw new Error(`unable to open a tab (${response.status})`);
  return response.json();
}

async function withPage(port, run) {
  const created = await openTab(port);
  const page = cdp(created.webSocketDebuggerUrl);
  await page.ready;
  try {
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    });
    return await run(page);
  } finally {
    page.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${created.id}`, { method: 'GET' }).catch(() => {});
  }
}

async function goto(page, url) {
  const loaded = page.wait((msg) => msg.method === 'Page.loadEventFired');
  await page.send('Page.navigate', { url });
  await loaded;
}

async function evalJson(page, expression) {
  const result = await page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'evaluate failed');
  }
  return result.result?.value;
}

const OPEN_STUB = `
window.__opened = [];
window.open = function (url, target) {
  window.__opened.push({ url: String(url), target: String(target || '') });
  return { closed: false };
};
`;

const FALLBACK_STUB = `
window.open = function () { return null; };
HTMLAnchorElement.prototype.click = function () {
  const bag = window.top;
  bag.__clicks = bag.__clicks || [];
  bag.__clicks.push({ href: this.href, target: this.target });
};
`;

const READ_FORM = `(() => {
  const form = document.getElementById('panel-sud');
  if (!form) return { error: 'form missing' };
  const label = (id) => {
    const el = document.getElementById(id);
    if (!el) return '';
    if (el.selectedOptions && el.selectedOptions[0]) return el.selectedOptions[0].textContent.trim();
    return el.value;
  };
  return {
    h1: document.querySelector('h1')?.innerText || '',
    eyebrow: document.querySelector('.hero .eyebrow')?.textContent || '',
    cta: document.querySelector('.hero .btn')?.textContent || '',
    gateway: label('sud-gateway'),
    destination: label('sud-dest'),
    duration: label('sud-duration'),
    adults: document.getElementById('sud-adults')?.value || '',
    children: document.getElementById('sud-children')?.value || '',
    button: form.querySelector('[type="submit"]')?.innerText || ''
  };
})()`;

async function shot(page, file) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
  const path = join(outDir, file);
  const fs = await import('node:fs');
  fs.writeFileSync(path, Buffer.from(data, 'base64'));
  return path;
}

const server = await startServer();
const { port: httpPort } = server.address();
const base = `http://127.0.0.1:${httpPort}`;
const { chrome, port } = await launchChrome();
const proof = [];

try {
  await withPage(port, async (page) => {
    await goto(page, 'https://aubaineexpress.voyagefiesta.ca/groupes/?embed=1');
    await evalJson(page, `new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        if (document.querySelector('.hero h1') || Date.now() - started > 8000) resolve(true);
        else setTimeout(tick, 100);
      };
      tick();
    })`);
    const path = await shot(page, 'accueil-hero-before.png');
    proof.push(`before screenshot: ${path}`);
  });

  await withPage(port, async (page) => {
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: OPEN_STUB });
    await goto(page, `${base}/groupes/?fixture=1&embed=1`);
    const ready = await evalJson(page, `new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        const gateway = document.getElementById('sud-gateway');
        if (gateway && gateway.value === 'YUL' && document.getElementById('sud-dest')?.value) resolve(true);
        else if (Date.now() - started > 8000) resolve(false);
        else setTimeout(tick, 50);
      };
      tick();
    })`);
    assert.equal(ready, true, 'Forfaits SUD form did not finish loading');
    const fields = await evalJson(page, READ_FORM);
    proof.push(`visible defaults: ${JSON.stringify(fields)}`);
    assert.match(fields.h1, /Voyagez vers/);
    assert.match(fields.h1, /essentiel/);
    assert.equal(fields.gateway, 'Montréal');
    assert.equal(fields.destination, 'Tout Sud');
    assert.equal(fields.duration, '7 jours');
    assert.equal(fields.adults, '2');
    assert.equal(fields.children, '0');
    assert.match(fields.button, /Rechercher un forfait sud/);
    const agesHidden = await evalJson(page, `document.getElementById('sud-ages-wrap').hidden === true && getComputedStyle(document.getElementById('sud-ages-wrap')).display === 'none'`);
    assert.equal(agesHidden, true, 'child ages stay hidden when no children are selected');
    const cta = await evalJson(page, `document.querySelector('.hero .btn').getAttribute('href')`);
    assert.match(cta, /forfaits-sud\//);
    const switched = await evalJson(page, `(() => {
      document.getElementById('tab-vols').click();
      const volsOpen = document.getElementById('panel-vols').hidden === false && document.getElementById('panel-sud').hidden === true;
      document.getElementById('tab-sud').click();
      const sudOpen = document.getElementById('panel-sud').hidden === false && document.getElementById('panel-vols').hidden === true;
      return volsOpen && sudOpen;
    })()`);
    assert.equal(switched, true, 'search tabs did not switch panels');
    const path = await shot(page, 'accueil-hero-after.png');
    proof.push(`after screenshot: ${path}`);
    const opened = await evalJson(page, `(() => {
      document.getElementById('panel-sud').requestSubmit();
      return window.__opened;
    })()`);
    assert.ok(opened?.length, 'submitting Forfaits SUD did not open a URL');
    const url = new URL(opened[0].url);
    proof.push(`top-level submit target=${opened[0].target} url=${url.href}`);
    assert.equal(opened[0].target, '_blank');
    assert.equal(url.hostname, 'vas1.sax.softvoyage.com');
    assert.equal(url.searchParams.get('gateway_dep'), 'YUL');
    assert.equal(url.searchParams.get('duration'), '7DAYS');
    assert.equal(url.searchParams.get('nb_adult'), '2');
    assert.equal(url.searchParams.get('nb_child'), '0');
    assert.equal(url.searchParams.get('code_ag'), 'VAS');
    assert.equal(url.searchParams.get('alias'), 'BY4');
    assert.ok(url.searchParams.get('dest_dep'), 'destination code missing');
    assert.equal(url.searchParams.get('language'), 'fr');
  });

  await withPage(port, async (page) => {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true
    });
    await goto(page, `${base}/groupes/?fixture=1&embed=1`);
    await evalJson(page, `new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        if (document.querySelector('.hero h1') || Date.now() - started > 8000) resolve(true);
        else setTimeout(tick, 80);
      };
      tick();
    })`);
    const path = await shot(page, 'accueil-hero-after-mobile.png');
    proof.push(`mobile screenshot: ${path}`);
  });

  const parent = `${base}/tests/hero-search-parent.html?child=${encodeURIComponent(`${base}/groupes/?fixture=1&embed=1`)}`;
  await withPage(port, async (page) => {
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: FALLBACK_STUB });
    await goto(page, parent);
    const clicks = await evalJson(page, `new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        const frame = document.getElementById('accueil');
        const child = frame && frame.contentWindow;
        const form = child && child.document.getElementById('panel-sud');
        const gateway = child && child.document.getElementById('sud-gateway');
        if (form && gateway && gateway.value === 'YUL') {
          form.requestSubmit();
          resolve(window.__clicks || []);
        } else if (Date.now() - started > 8000) resolve({ error: 'iframe form missing' });
        else setTimeout(tick, 50);
      };
      tick();
    })`);
    assert.ok(Array.isArray(clicks), JSON.stringify(clicks));
    assert.ok(clicks.length, 'iframe submit produced no navigation');
    const url = new URL(clicks[0].href);
    proof.push(`iframe fallback target=${clicks[0].target} url=${url.href}`);
    assert.equal(clicks[0].target, '_top');
    assert.equal(url.hostname, 'vas1.sax.softvoyage.com');
    assert.equal(url.searchParams.get('code_ag'), 'VAS');
    assert.equal(url.searchParams.get('gateway_dep'), 'YUL');
    assert.equal(url.searchParams.get('duration'), '7DAYS');
  });
} finally {
  chrome.kill('SIGKILL');
  server.close();
}

const log = proof.join('\n');
const { writeFileSync } = await import('node:fs');
writeFileSync(join(outDir, 'accueil-search-proof.txt'), log + '\n');
console.log(log);
