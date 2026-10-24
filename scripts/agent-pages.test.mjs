import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { writeQuickformPages } from './quickform-pages.mjs';
import {
  buildAgentPageHtml,
  buildTeamPageHtml,
  isHiddenAgent,
  publicStaff,
  writeAgentPages
} from './agent-pages.mjs';

const staff = [
  {
    id: 'agency1',
    name: 'Agence Voyages Fiesta  et Mariage Sud',
    slug: 'agence-voyages-fiesta-et-mariage-sud',
    email: 'info@promo.voyagefiesta.com',
    phone: '+15145550100'
  },
  {
    id: 'rabais1',
    name: 'Divison Rabais Voyage',
    slug: 'divison-rabais-voyage',
    email: 'rabais@voyagefiesta.com',
    phone: ''
  },
  {
    id: 'lbhu1234',
    name: 'Patrick Girard',
    slug: 'patrick-girard-lbhu',
    email: 'patrick.lbhu@voyagefiesta.com',
    phone: '+15145550111'
  },
  {
    id: 'anny1234',
    name: 'Anny Blondeau',
    slug: 'anny-blondeau',
    email: 'anny@voyagefiesta.com',
    phone: ''
  }
];

const products = [{
  slug: 'punta-cana',
  name: 'Punta Cana',
  active: 'actif',
  country: 'République dominicaine',
  departureDate: '2027-03-01',
  price: 1358,
  img: 'assets/forfaits/punta.jpg'
}, {
  slug: 'sans-prix',
  name: 'Forfait sans prix publié',
  active: 'actif',
  country: 'Mexique',
  departureDate: '2027-04-01',
  price: null
}];

const groups = [{
  id: 11,
  type: 'sud',
  slug: 'sud-exemple',
  title: 'Sud exemple',
  country: 'Cuba',
  dateDepart: '2027-02-01',
  prixAppel: 999,
  image: 'https://example.com/sud.jpg'
}, {
  id: 12,
  type: 'cruise',
  slug: 'cruise-exemple',
  title: 'Croisière exemple',
  country: 'Caraïbes',
  dateDepart: '2027-06-01',
  prixAppel: 0
}];

test('default hidden accounts stay off the team, both Patrick pages stay available', () => {
  const visible = publicStaff(staff, {});
  const slugs = visible.map((agent) => agent.slug);
  assert.equal(slugs.includes('agence-voyages-fiesta-et-mariage-sud'), false);
  assert.equal(slugs.includes('divison-rabais-voyage'), false);
  assert.equal(slugs.includes('patrick-girard-lbhu'), true);
  assert.equal(isHiddenAgent(staff[2], { lbhu1234: { hidden: true } }), true);
  assert.equal(isHiddenAgent(staff[0], { agency1: { hidden: false } }), false);
});

test('phone override, empty biography, and agent links on the cards', () => {
  const [anny] = publicStaff([staff[3]], {
    anny1234: {
      phone: '514-555-0199',
      title: 'Conseillère',
      languages: ['Français', 'Anglais'],
      specialties: 'Sud, Croisières'
    }
  });
  const html = buildAgentPageHtml(anny, { products, groups });
  assert.match(html, /514-555-0199/);
  assert.match(html, /Conseillère/);
  assert.match(html, /Français/);
  assert.match(html, /Croisières/);
  assert.equal(html.includes('Présentation'), false);
  assert.match(html, /href="\/product\.html\?slug=punta-cana&amp;ref=anny-blondeau&amp;ghl_user=anny1234"/);
  assert.match(html, /src="\/assets\/forfaits\/punta\.jpg"/);
  assert.match(html, /Veuillez nous contacter/);
  assert.match(html, /name="destination"/);
  assert.match(html, /name="terms_and_conditions"/);
  assert.match(html, /window\.AGENT_PAGE = \{ id: "anny1234"/);
  assert.match(readFileSync(new URL('../agent-form.js', import.meta.url), 'utf8'), /agent_slug: agent\.slug/);
  assert.equal(html.includes('—'), false);
  assert.equal(html.includes('–'), false);
  const team = buildTeamPageHtml(publicStaff(staff, {}));
  assert.match(team, /Notre équipe/);
  assert.match(team, /patrick-girard-lbhu/);
  assert.equal(team.includes('divison-rabais-voyage'), false);
});

test('quickform pages redirect to the agent page and keep the query string', () => {
  const root = mkdtempSync(join(tmpdir(), 'vf-agents-'));
  const people = writeAgentPages({
    staff,
    products,
    groups,
    extra: {},
    root
  });
  assert.equal(people.length, 2);
  const page = readFileSync(join(root, 'agents', 'anny-blondeau', 'index.html'), 'utf8');
  assert.match(page, /Me contacter/);
  assert.equal(readFileSync(join(root, 'agents', 'patrick-girard-lbhu', 'index.html'), 'utf8').includes('Patrick Girard'), true);

  const previous = process.cwd();
  process.chdir(root);
  try {
    writeQuickformPages(staff, {
      dir: join(root, 'quickform'),
      publicSlugs: new Set(people.map((agent) => agent.slug))
    });
  } finally {
    process.chdir(previous);
  }
  const redirect = readFileSync(join(root, 'quickform', 'anny-blondeau.html'), 'utf8');
  const hiddenRedirect = readFileSync(join(root, 'quickform', 'divison-rabais-voyage.html'), 'utf8');
  assert.match(redirect, /location\.search/);
  assert.match(redirect, /\/agents\/anny-blondeau\//);
  assert.match(hiddenRedirect, /\/agents\//);
  assert.equal(hiddenRedirect.includes('/agents/divison-rabais-voyage/'), false);
});
