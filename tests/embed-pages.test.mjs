import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
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

test('agent pages hide their header and footer only while embedded and post the main height', () => {
  const css = read('agents/agents.css');
  for (const selector of ['.vf-header', '.vf-footer', '.vf-atmosphere']) {
    assert.match(css, new RegExp(`html\\.embed(?:-mode)? ${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,220}display: none !important`));
  }
  const embed = read('agents/embed.js');
  assert.match(embed, /type: 'voyage-fiesta-resize'/);
  assert.match(embed, /querySelector\('main'\)/);
  assert.match(embed, /getBoundingClientRect\(\)/);
  assert.match(embed, /new ResizeObserver\(notifyParentHeight\)\.observe\(main\)/);
  assert.match(embed, /key === 'ref' \|\| key === 'ghl_user' \|\| key\.indexOf\('utm_'\) === 0/);
  assert.doesNotMatch(embed, /scrollHeight/);
  assert.doesNotMatch(embed, /codesurmesure\.ca|agentsexternesfiesta\.ca/);

  const root = new URL('../agents/', import.meta.url);
  const pages = readdirSync(root).filter((name) => {
    const full = join(root.pathname, name);
    if (name === 'index.html') return true;
    try { return statSync(full).isDirectory(); } catch { return false; }
  });
  assert.ok(pages.includes('eric-lacasse'), 'eric-lacasse page is published');
  for (const name of pages) {
    const path = name === 'index.html' ? 'agents/index.html' : `agents/${name}/index.html`;
    const html = read(path);
    assert.match(html, /<html lang="fr">/);
    assert.match(html, /<header class="vf-header">/);
    assert.match(html, /<footer class="vf-footer">/);
    assert.match(html, /window\.self !== window\.top/);
    assert.match(html, /classList\.add\('embed', 'embed-mode'\)/);
    assert.match(html, /html\.embed \.vf-header/);
    assert.match(html, /html\.embed \.vf-footer/);
    assert.match(html, /<script src="\/agents\/embed\.js\?v=1"><\/script>/);
    assert.doesNotMatch(html, /codesurmesure\.ca|agentsexternesfiesta\.ca/);
  }

  const eric = read('agents/eric-lacasse/index.html');
  assert.match(eric, /ref=eric-lacasse/);
  assert.match(eric, /ghl_user=fG599Arfh45eLVOMCMLh/);
});

test('groupes embed height follows main so a shorter page can shrink the iframe', () => {
  const app = read('groupes/js/app.mjs');
  assert.match(app, /function contentHeight\(\)/);
  assert.match(app, /document\.querySelector\('main'\)/);
  assert.match(app, /getBoundingClientRect\(\)/);
  assert.match(app, /new ResizeObserver\(notifyHeight\)\.observe\(main\)/);
  assert.match(app, /type: 'voyage-fiesta-resize'/);
  assert.doesNotMatch(app, /scrollHeight/);
  assert.match(read('groupes/css/groupes.css'), /html\.embed body,\s*html\.embed-mode body\s*\{[^}]*overflow: hidden/);
});

test('group detail links stay on id and slug', () => {
  const app = read('groupes/js/app.mjs');
  assert.match(app, /groupe\/\?id=\$\{encodeURIComponent\(group\.id\)\}&slug=\$\{encodeURIComponent\(group\.slug \|\| ''\)\}/);
});
