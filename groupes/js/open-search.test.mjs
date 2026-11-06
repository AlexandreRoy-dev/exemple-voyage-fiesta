import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSudSearchUrl } from './catalog.mjs';
import { openSearchResult } from './open-search.mjs';

const SUD_URL = 'https://vas1.sax.softvoyage.com/cgi-bin/handler.cgi?code_ag=VAS';

function fakeView({ framed = false, openResult = null, topOpenResult = null, topThrows = false } = {}) {
  const clicks = [];
  const messages = [];
  const opens = [];
  const view = {
    document: {
      body: { appendChild() {} },
      createElement() {
        const el = {
          href: '',
          target: '',
          rel: '',
          click() { clicks.push({ href: el.href, target: el.target }); },
          remove() {}
        };
        return el;
      }
    },
    location: { assign() { opens.push({ where: 'assign' }); } },
    open(url, target) {
      opens.push({ where: 'self', url, target });
      return openResult;
    }
  };
  view.self = view;
  if (framed) {
    view.top = {
      open(url, target) {
        opens.push({ where: 'top', url, target });
        if (topThrows) throw new Error('cross-origin');
        return topOpenResult;
      }
    };
    view.parent = {
      postMessage(data) { messages.push(data); }
    };
  } else {
    view.top = view;
    view.parent = view;
  }
  return { view, clicks, messages, opens };
}

test('the Forfaits SUD defaults produce a real Softvoyage search URL', () => {
  const url = new URL(buildSudSearchUrl({
    gateway: 'YUL',
    destination: '174,27',
    date: '',
    duration: '7DAYS',
    adults: '2',
    children: '0',
    childAges: ''
  }));
  assert.equal(url.hostname, 'vas1.sax.softvoyage.com');
  assert.equal(url.pathname, '/cgi-bin/handler.cgi');
  assert.equal(url.searchParams.get('gateway_dep'), 'YUL');
  assert.equal(url.searchParams.get('dest_dep'), '174,27');
  assert.equal(url.searchParams.get('duration'), '7DAYS');
  assert.equal(url.searchParams.get('nb_adult'), '2');
  assert.equal(url.searchParams.get('nb_child'), '0');
  assert.equal(url.searchParams.get('code_ag'), 'VAS');
  assert.equal(url.searchParams.get('alias'), 'BY4');
  assert.equal(url.searchParams.get('language'), 'fr');
  assert.equal(openSearchResult(url.href, fakeView({ openResult: {} }).view), 'blank');
});

test('outside an iframe, search opens a new tab and does not navigate away', () => {
  const { view, opens, clicks } = fakeView({ openResult: { opener: {} } });
  assert.equal(openSearchResult(SUD_URL, view), 'blank');
  assert.deepEqual(opens, [{ where: 'self', url: SUD_URL, target: '_blank' }]);
  assert.equal(clicks.length, 0);
});

test('inside an iframe, search uses the top window when it can open a tab', () => {
  const { view, opens, clicks, messages } = fakeView({ framed: true, topOpenResult: {} });
  assert.equal(openSearchResult(SUD_URL, view), 'top-blank');
  assert.deepEqual(opens, [{ where: 'top', url: SUD_URL, target: '_blank' }]);
  assert.equal(clicks.length, 0);
  assert.equal(messages.length, 0);
});

test('inside an iframe, a blocked popup falls back to target=_top', () => {
  const { view, clicks, messages } = fakeView({ framed: true, topOpenResult: null });
  assert.equal(openSearchResult(SUD_URL, view), 'top-link');
  assert.deepEqual(clicks, [{ href: SUD_URL, target: '_top' }]);
  assert.deepEqual(messages, [{ type: 'voyage-fiesta-navigate', url: SUD_URL }]);
});

test('a cross-origin top window still falls back to target=_top', () => {
  const { view, clicks } = fakeView({ framed: true, topThrows: true });
  assert.equal(openSearchResult(SUD_URL, view), 'top-link');
  assert.equal(clicks[0].target, '_top');
  assert.equal(clicks[0].href, SUD_URL);
});

test('a blocked new tab outside the iframe still follows the link', () => {
  const { view, clicks } = fakeView({ openResult: null });
  assert.equal(openSearchResult(SUD_URL, view), 'blank-link');
  assert.deepEqual(clicks, [{ href: SUD_URL, target: '_blank' }]);
});

test('a non-http url is ignored', () => {
  const bag = fakeView({ openResult: {} });
  assert.equal(openSearchResult('javascript:alert(1)', bag.view), 'invalid');
  assert.equal(bag.opens.length, 0);
  assert.equal(bag.clicks.length, 0);
});
