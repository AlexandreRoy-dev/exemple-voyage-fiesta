import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { syncAtrium } from './sync.mjs';

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'atrium-api.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const API_KEY = 'atrium-test-key-do-not-leak';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

test('sync reads the local fixture and writes public JSON without the key', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'atrium-fixture-'));
  const output = join(dir, 'groupes.json');
  const catalog = await syncAtrium({
    apiKey: API_KEY,
    fixture: fixturePath,
    output,
    generatedAt: '2026-10-21T12:00:00.000Z'
  });
  const written = readFileSync(output, 'utf8');
  assert.equal(written.includes(API_KEY), false);
  assert.equal(catalog.counts.total, catalog.groups.length);
  assert.ok(catalog.groups.some((group) => group.id === 661));
});

test('sync calls Atrium with the Api-Key header and never writes it', async () => {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push({ path: req.url, key: req.headers['api-key'] });
    const route = {
      '/groupes/list': fixture.groupes,
      '/hotel/list': fixture.hotels,
      '/cruise/navire': fixture.navires,
      '/cruise/compagnie': fixture.compagnies,
      '/cruise/photo': { status: 'success', data: [] },
      '/cruise/cabine': { status: 'success', data: [] },
      '/cruise/pont': { status: 'success', data: [] }
    }[req.url];
    if (!route) {
      res.writeHead(404);
      res.end('{}');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(route));
  });
  const port = await listen(server);
  const dir = mkdtempSync(join(tmpdir(), 'atrium-http-'));
  const output = join(dir, 'groupes.json');
  try {
    const catalog = await syncAtrium({
      apiKey: API_KEY,
      apiBase: `http://127.0.0.1:${port}`,
      output,
      generatedAt: '2026-10-21T12:00:00.000Z'
    });
    assert.deepEqual(seen.map((call) => call.path).sort(), [
      '/cruise/cabine',
      '/cruise/compagnie',
      '/cruise/navire',
      '/cruise/photo',
      '/cruise/pont',
      '/groupes/list',
      '/hotel/list'
    ]);
    assert.ok(seen.every((call) => call.key === API_KEY));
    const written = readFileSync(output, 'utf8');
    assert.equal(written.includes(API_KEY), false);
    assert.equal(catalog.groups.some((group) => group.title.includes('retiré')), false);
  } finally {
    server.close();
  }
});
