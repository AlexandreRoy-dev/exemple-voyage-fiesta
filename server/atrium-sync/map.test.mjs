import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapCatalog, slugify } from './map.mjs';

const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'atrium-api.json'), 'utf8'));

test('slugify strips accents and punctuation', () => {
  assert.equal(slugify('Noël au Costa Rica, tout inclus'), 'noel-au-costa-rica-tout-inclus');
});

test('maps the openapi fixture into a public catalog', () => {
  const catalog = mapCatalog({
    groupes: fixture.groupes.data,
    hotels: fixture.hotels.data,
    navires: fixture.navires.data,
    compagnies: fixture.compagnies.data
  }, { generatedAt: '2026-10-21T12:00:00.000Z' });

  assert.equal(catalog.source, 'atrium-v3');
  assert.equal(catalog.groups.some((group) => group.id === 9999), false);
  assert.ok(catalog.counts.sud >= 12);
  assert.ok(catalog.counts.cruise >= 12);
  assert.ok(catalog.counts.voyage >= 8);

  const costa = catalog.groups.find((group) => group.id === 661);
  assert.equal(costa.type, 'sud');
  assert.equal(costa.destination, 'Liberia');
  assert.equal(costa.country, 'Costa Rica');
  assert.equal(costa.dateDepart, '2026-12-21');
  assert.equal(costa.prixAppel, 2959);
  assert.equal(costa.hotel, 'Riu Guanacaste');
  assert.equal(costa.hotelDetail.chaine, 'RIU');
  assert.equal(costa.hotelDetail.etoiles, 4.5);
  assert.ok(costa.pointsForts.length >= 1);
  assert.ok(costa.inclusions.includes('Transferts aéroport et hôtel'));
  assert.equal(costa.tarifs[0].disponibilite, '10 places');
  assert.equal(costa.vols[0].numero, 'WS2700');
  assert.ok(costa.images.length >= 1);

  const cruise = catalog.groups.find((group) => group.id === 801);
  assert.equal(cruise.type, 'cruise');
  assert.equal(cruise.navire, 'MSC Virtuosa');
  assert.equal(cruise.compagnie, 'MSC Croisières');
  assert.equal(cruise.navireDetail.passagers, 6334);
  assert.ok(cruise.navireDetail.services.includes('Internet'));

  const dumped = JSON.stringify(catalog);
  assert.equal(dumped.includes('do-not-publish'), false);
  assert.equal(dumped.includes('ATRIUM'), false);
  assert.equal(dumped.includes('Api-Key'), false);
});
