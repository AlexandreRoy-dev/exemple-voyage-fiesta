import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../agent-resolve.js', import.meta.url), 'utf8');

function load(search = '', stored = null) {
  const window = {
    location: { search },
    VFLeadRef: stored ? { get: () => stored } : undefined
  };
  vm.runInNewContext(source, { window, URLSearchParams, URL, fetch, Array, Promise });
  return window.VFAgent;
}

const staff = [
  { id: 'userEric1234', slug: 'eric-lacasse', name: 'Éric Lacasse', email: 'eric@voyagefiesta.com', phone: '+15145550100' },
  { id: 'userKevin123', slug: 'kevin-watier', name: 'Kevin Watier', email: 'kevin@voyagefiesta.com', phone: '' },
  { id: 'patrickOne01', slug: 'patrick-girard', name: 'Patrick Girard', email: 'p1@voyagefiesta.com', phone: '5145550101' },
  { id: 'patrickLbh01', slug: 'patrick-girard-lbhu', name: 'Patrick Girard', email: 'p2@voyagefiesta.com', phone: '5145550102', photo: 'https://cdn.example/p2.jpg' }
];

test('ghl_user wins over a different ref slug', () => {
  const api = load('?ref=eric-lacasse&ghl_user=userKevin123');
  const agent = api.resolve(staff, api.readHint(undefined));
  assert.equal(agent.slug, 'kevin-watier');
  assert.equal(agent.id, 'userKevin123');
});

test('unknown ghl_user falls back to a known ref, then to nothing', () => {
  const api = load();
  assert.equal(api.resolve(staff, { ghlUser: 'missingUser1', ref: 'eric-lacasse' }).slug, 'eric-lacasse');
  assert.equal(api.resolve(staff, { ghlUser: 'missingUser1', ref: 'personne-inconnue' }), null);
  assert.equal(api.resolve(staff, { ghlUser: '', ref: '' }), null);
});

test('memory is used when the URL has no advisor', () => {
  const api = load('', { ref: 'patrick-girard-lbhu', ghl_user: 'patrickLbh01' });
  const agent = api.resolve(staff, api.readHint(''));
  assert.equal(agent.slug, 'patrick-girard-lbhu');
  assert.equal(agent.photo, 'https://cdn.example/p2.jpg');
});

test('a URL hint replaces the stored advisor', () => {
  const api = load('?ref=eric-lacasse', { ref: 'kevin-watier', ghl_user: 'userKevin123' });
  const agent = api.resolve(staff, api.readHint('?ref=eric-lacasse'));
  assert.equal(agent.slug, 'eric-lacasse');
});

test('card shows the initial or the photo, and the contact button uses the first name', () => {
  const api = load();
  const eric = api.resolve(staff, { ghlUser: '', ref: 'eric-lacasse' });
  const html = api.cardHtml(eric, { voyage: 'RIU <Flamingos>' });
  assert.match(html, /Votre conseiller\(ère\)/);
  assert.match(html, /vf-agent__initial[^>]*>É</);
  assert.match(html, /href="tel:\+15145550100"/);
  assert.match(html, /href="mailto:eric@voyagefiesta.com"/);
  assert.match(html, /Contacter Éric/);
  assert.match(html, /Voyage: RIU &lt;Flamingos&gt;/);
  assert.doesNotMatch(html, /[—–]|[\u{1F300}-\u{1FAFF}]/u);

  const patrick = api.resolve(staff, { ghlUser: 'patrickLbh01', ref: '' });
  const photoHtml = api.cardHtml(patrick);
  assert.match(photoHtml, /src="https:\/\/cdn\.example\/p2\.jpg"/);
  assert.doesNotMatch(photoHtml, /vf-agent__initial/);
  assert.equal(api.cardHtml(null), '');
});

test('share URL keeps the resolved advisor and drops an unknown one', () => {
  const api = load();
  const agent = api.resolve(staff, { ghlUser: 'userKevin123', ref: 'kevin-watier' });
  const url = api.shareUrl('https://aubaineexpress.voyagefiesta.ca/share/riu.html', agent, {
    utm_source: 'facebook',
    utm_medium: 'page',
    utm_campaign: 'fb-2026-10-22'
  });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('ref'), 'kevin-watier');
  assert.equal(parsed.searchParams.get('ghl_user'), 'userKevin123');
  assert.equal(parsed.searchParams.get('utm_campaign'), 'fb-2026-10-22');
  const plain = api.shareUrl('https://aubaineexpress.voyagefiesta.ca/product.html?slug=riu', null);
  assert.equal(new URL(plain).search, '?slug=riu');
});
