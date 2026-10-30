import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const PRIMARY = 'https://api.voyagefiesta.ca/voyage-fiesta-reservation/';
const LEGACY = 'https://dashboard.codesurmesure.ca/voyage-fiesta-reservation/';

function loadConfig(fetchImpl) {
  const window = {};
  const ctx = { window, fetch: fetchImpl, AbortController, setTimeout, clearTimeout, URLSearchParams, location: { search: '', hostname: 'x' }, document: { querySelector: () => null, addEventListener() {} }, console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  try { vm.runInContext(read('config.js'), ctx); } catch (_) { /* later page code may need a real DOM */ }
  return window;
}

test('every file lists the same API bases, api.voyagefiesta.ca first', () => {
  for (const path of ['config.js', 'config-Jean-pc.js', 'groupes/config.js', 'groupes/js/endpoints.mjs', 'home-sections.js']) {
    const src = read(path);
    const a = src.indexOf(PRIMARY);
    const b = src.indexOf(LEGACY);
    assert.ok(a > -1 && b > a, `${path}: primary then fallback`);
  }
  const old = /dashboard\.codesurmesure\.ca\/voyage-fiesta-reservation/g;
  for (const path of ['quickform.js', 'site-chrome.js', 'agent-form.js', 'room-registration.js', 'groupes/js/app.mjs', 'groupes/js/images.mjs']) {
    assert.equal((read(path).match(old) || []).length, 0, `${path} has no hard coded host`);
  }
});

test('config.js VFApi: primary first, POST falls back only on a network error', async () => {
  const calls = [];
  const win = loadConfig(async (url, init) => {
    calls.push([url, init.method || 'GET']);
    if (url.startsWith(PRIMARY)) throw new TypeError('Failed to fetch');
    return { ok: true, status: 200 };
  });
  assert.equal(win.GHL_RESERVATION_API_URL, PRIMARY);
  assert.deepEqual([...win.VFApi.bases()], [PRIMARY, LEGACY]);
  const res = await win.VFApi.fetch('', { method: 'POST', body: '{}' });
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [[PRIMARY, 'POST'], [LEGACY, 'POST']]);
});

test('config.js VFApi: a POST the app rejected is not sent again', async () => {
  const calls = [];
  const win = loadConfig(async (url) => { calls.push(url); return { ok: false, status: 400 }; });
  const res = await win.VFApi.fetch('', { method: 'POST' });
  assert.equal(res.status, 400);
  assert.equal(calls.length, 1);
});

test('config.js VFApi: GET groupes.json falls back on a bad status', async () => {
  const calls = [];
  const win = loadConfig(async (url) => { calls.push(url); return { ok: calls.length > 1, status: calls.length > 1 ? 200 : 404 }; });
  const res = await win.VFApi.fetch('groupes.json', { cache: 'no-store' });
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [`${PRIMARY}groupes.json`, `${LEGACY}groupes.json`]);
});
