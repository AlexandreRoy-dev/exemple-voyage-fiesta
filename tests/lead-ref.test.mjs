import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../lead-ref.js', import.meta.url), 'utf8');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map
  };
}

function load(search, storage = memoryStorage()) {
  const window = { location: { search }, localStorage: storage };
  vm.runInNewContext(source, { window, URLSearchParams, Date, JSON });
  return { api: window.VFLeadRef, storage };
}

const link = '?ref=kevin-watier&ghl_user=CMV5ZlTlfOJI5lzM1Rw5&utm_source=facebook&utm_medium=page&utm_campaign=fb-2026-10-22';

test('captures the link and attaches it to any later payload', () => {
  const { storage } = load(link);
  const { api } = load('', storage); // next page, no params
  const out = api.attach({ email: 'a@b.c' });
  assert.equal(out.email, 'a@b.c');
  assert.equal(out.lead_ref, 'kevin-watier');
  assert.equal(out.lead_ghl_user, 'CMV5ZlTlfOJI5lzM1Rw5');
  assert.equal(out.lead_utm_campaign, 'fb-2026-10-22');
});

test('no link: payload unchanged', () => {
  const { api } = load('?agent=eric-lacasse');
  assert.deepEqual(Object.keys(api.attach({ a: 1 })), ['a']);
});

test('drops invalid values and expires after 30 days', () => {
  const { api, storage } = load('?ref=<script>&ghl_user=bad id');
  assert.equal(api.get(), null);
  load(link, storage);
  const saved = JSON.parse(storage.getItem('vf_lead_ref'));
  saved.savedAt = Date.now() - 31 * 24 * 60 * 60 * 1000;
  storage.setItem('vf_lead_ref', JSON.stringify(saved));
  assert.equal(load('', storage).api.get(), null);
});

test('a newer link replaces the older one; agency link without agent keeps ref only', () => {
  const { storage } = load(link);
  const { api } = load('?ref=eric-lacasse', storage);
  const out = api.attach({});
  assert.equal(out.lead_ref, 'eric-lacasse');
  assert.equal(out.lead_ghl_user, undefined);
});

test('works without localStorage (private mode)', () => {
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() {} };
  const { api } = load(link, broken);
  assert.equal(api.attach({}).lead_ref, 'kevin-watier');
});
