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

test('embed mode hides the shared header, nav and footer', () => {
  const css = read('groupes/css/groupes.css') + read('site-chrome.css') + read('embed.js');
  for (const selector of ['.vf-site-header', '.vf-site-footer', '.site-header', '.site-footer', '#nav-principale']) {
    assert.match(css, new RegExp(`html\\.embed(?:-mode)? ${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,180}display: none !important`));
  }
  const app = read('groupes/js/app.mjs');
  assert.match(app, /embedOn\(\) \? '' : `/);
  assert.match(app, /classList\.add\('embed', 'embed-mode'\)/);
  for (const path of [
    'groupes/index.html',
    'groupes/forfaits-sud/index.html',
    'groupes/croisieres/index.html',
    'groupes/voyages/index.html',
    'groupes/mariages/index.html',
    'groupes/groupe/index.html'
  ]) {
    const html = read(path);
    assert.match(html, /classList\.add\('embed', 'embed-mode'\)/);
    assert.match(html, /html\.embed #nav-principale/);
  }
});

test('the Accueil paste snippet is full width and locked to the Aubaines origin', () => {
  const doc = read('docs/iframes.md');
  assert.match(doc, /class="vf-plein-auto"/);
  assert.match(doc, /src="https:\/\/aubaineexpress\.voyagefiesta\.ca\/groupes\/"/);
  assert.match(doc, /event\.origin !== 'https:\/\/aubaineexpress\.voyagefiesta\.ca'/);
  assert.match(doc, /voyage-fiesta-resize/);
  assert.doesNotMatch(doc, /codesurmesure\.ca/);
  const app = read('groupes/js/app.mjs');
  const home = app.slice(app.indexOf('function renderHome'), app.indexOf('function readFilters'));
  assert.match(home, /Votre prochaine évasion commence ici/);
  assert.match(home, /Voyagez vers<br>l’essentiel/);
  assert.match(home, /Des expériences uniques, des souvenirs inoubliables\./);
  assert.match(home, /Découvrir nos offres/);
  assert.match(home, /Voyage en toute sérénité/);
  assert.match(home, /Meilleurs prix garantis/);
  assert.match(home, /Conseillers à votre écoute/);
  assert.match(home, /Des expériences sur mesure/);
  assert.match(app, /openSearchResult\(url\)/);
  assert.doesNotMatch(home, /codesurmesure\.ca/);
});

test('group detail links stay on id and slug', () => {
  const app = read('groupes/js/app.mjs');
  assert.match(app, /groupe\/\?id=\$\{encodeURIComponent\(group\.id\)\}&slug=\$\{encodeURIComponent\(group\.slug \|\| ''\)\}/);
});
