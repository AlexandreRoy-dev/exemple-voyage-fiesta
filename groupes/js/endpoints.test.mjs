import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_API_BASES, apiBases, apiUrls, fetchFirst } from './endpoints.mjs';

const [PRIMARY, LEGACY] = DEFAULT_API_BASES;

function fake(script) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, method: init?.method || 'GET', signal: !!init?.signal });
    const step = script[calls.length - 1];
    if (step instanceof Error) throw step;
    return { ok: step >= 200 && step < 300, status: step };
  };
  return { fn, calls };
}

test('api.voyagefiesta.ca is first, the current host is the fallback', () => {
  assert.equal(PRIMARY, 'https://api.voyagefiesta.ca/voyage-fiesta-reservation/');
  assert.match(LEGACY, /^https:\/\/dashboard\./);
  assert.deepEqual(apiUrls('groupes.json', {}), [`${PRIMARY}groupes.json`, `${LEGACY}groupes.json`]);
  assert.deepEqual(apiBases({ apiBases: ['https://x.example/a'] }), ['https://x.example/a/']);
});

test('GET uses the primary when it answers', async () => {
  const f = fake([200]);
  const res = await fetchFirst(apiUrls('groupes.json', {}), {}, { fetchFn: f.fn });
  assert.equal(res.status, 200);
  assert.deepEqual(f.calls.map((c) => c.url), [`${PRIMARY}groupes.json`]);
  assert.equal(f.calls[0].signal, true);
});

test('GET falls back on a DNS or network error, and on a bad status', async () => {
  const a = fake([new TypeError('Failed to fetch'), 200]);
  assert.equal((await fetchFirst(apiUrls('groupes.json', {}), {}, { fetchFn: a.fn })).status, 200);
  assert.equal(a.calls[1].url, `${LEGACY}groupes.json`);
  const b = fake([404, 200]);
  assert.equal((await fetchFirst(apiUrls('groupes.json', {}), {}, { fetchFn: b.fn })).status, 200);
});

test('GET falls back after the timeout', async () => {
  const calls = [];
  const fn = (url, init) => {
    calls.push(url);
    if (calls.length === 1) {
      return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    }
    return Promise.resolve({ ok: true, status: 200 });
  };
  const res = await fetchFirst(apiUrls('', {}), {}, { fetchFn: fn, timeoutMs: 20 });
  assert.equal(res.status, 200);
  assert.deepEqual(calls, apiUrls('', {}));
});

test('POST retries only when the app never saw the request', async () => {
  const net = fake([new TypeError('Failed to fetch'), 200]);
  await fetchFirst(apiUrls('', {}), { method: 'POST' }, { fetchFn: net.fn });
  assert.equal(net.calls.length, 2);
  assert.equal(net.calls[0].signal, false);
  const notFound = fake([502, 200]);
  await fetchFirst(apiUrls('', {}), { method: 'POST' }, { fetchFn: notFound.fn });
  assert.equal(notFound.calls.length, 2);
  for (const status of [400, 500, 504]) {
    const f = fake([status, 200]);
    const res = await fetchFirst(apiUrls('', {}), { method: 'POST' }, { fetchFn: f.fn });
    assert.equal(res.status, status);
    assert.equal(f.calls.length, 1);
  }
});

test('the last error is thrown when every base fails', async () => {
  const f = fake([new TypeError('a'), new TypeError('b')]);
  await assert.rejects(fetchFirst(apiUrls('', {}), {}, { fetchFn: f.fn }), /b/);
});
