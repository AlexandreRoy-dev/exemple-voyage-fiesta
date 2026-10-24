import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

test('each embed page keeps the query string and opens the matching listing', () => {
  const pages = {
    'embed/index.html': "params.set('embed', 'sections')",
    'embed/aubaines/index.html': "location.replace('/?' + params.toString())",
    'embed/sud/index.html': "location.replace('/groupes/forfaits-sud/?' + params.toString())",
    'embed/croisieres/index.html': "location.replace('/groupes/croisieres/?' + params.toString())",
    'embed/voyages/index.html': "location.replace('/groupes/voyages/?' + params.toString())",
    'embed/mariages/index.html': "location.replace('/groupes/mariages/?' + params.toString())"
  };
  for (const [path, snippet] of Object.entries(pages)) {
    const html = read(path);
    assert.match(html, /params\.delete\('embed'\)/);
    assert.match(html, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(read('embed/aubaines/index.html'), /params\.set\('embed', '1'\)/);
  assert.doesNotMatch(read('embed/index.html'), /params\.set\('embed', '1'\)/);
});

test('the paste guide lists one main embed and one embed per category', () => {
  const doc = read('docs/iframes.md');
  for (const src of [
    'https://aubaineexpress.voyagefiesta.ca/embed/',
    'https://aubaineexpress.voyagefiesta.ca/embed/aubaines/',
    'https://aubaineexpress.voyagefiesta.ca/embed/sud/',
    'https://aubaineexpress.voyagefiesta.ca/embed/croisieres/',
    'https://aubaineexpress.voyagefiesta.ca/embed/voyages/',
    'https://aubaineexpress.voyagefiesta.ca/embed/mariages/'
  ]) {
    assert.ok(doc.includes(src), src);
  }
  assert.match(doc, /voyage-fiesta-resize/);
  assert.match(doc, /\/groupes\/groupe\/\?id=<id>&slug=<slug>/);
});

test('group detail links stay on id and slug', () => {
  const app = read('groupes/js/app.mjs');
  assert.match(app, /groupe\/\?id=\$\{encodeURIComponent\(group\.id\)\}&slug=\$\{encodeURIComponent\(group\.slug \|\| ''\)\}/);
});
