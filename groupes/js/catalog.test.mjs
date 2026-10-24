import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  filterGroups,
  sortGroups,
  paginate,
  categoryPath,
  buildSudSearchUrl,
  buildFlightSearchUrl,
  buildCruiseSearchUrl,
  buildCarSearchUrl
} from './catalog.mjs';

const catalog = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'groupes.json'), 'utf8'));

test('filters, sort and pagination follow the agency listing rules', () => {
  const sud = catalog.groups.filter((group) => group.type === 'sud');
  const liberia = filterGroups(sud, { destination: 'Liberia' });
  assert.ok(liberia.length >= 1);
  assert.ok(liberia.every((group) => group.destination === 'Liberia'));

  const priced = filterGroups(sud, { priceMin: 2000, priceMax: 2700 });
  assert.ok(priced.every((group) => group.prixAppel >= 2000 && group.prixAppel <= 2700));

  const dated = filterGroups(sud, { dateFrom: '2026-12-01', dateTo: '2026-12-31' });
  assert.ok(dated.every((group) => group.dateDepart >= '2026-12-01' && group.dateDepart <= '2026-12-31'));

  const byAgency = sortGroups(sud, 'agence');
  assert.ok(byAgency[0].ordre <= byAgency[1].ordre);
  const byPrice = sortGroups(sud, 'prix-asc');
  assert.ok(byPrice[0].prixAppel <= byPrice[byPrice.length - 1].prixAppel);

  const page = paginate(byAgency, 2, 12);
  assert.equal(page.page, 2);
  assert.equal(page.items.length, sud.length - 12);
});

test('search links use the Fiesta supplier codes', () => {
  const sud = new URL(buildSudSearchUrl({
    gateway: 'YUL',
    destination: '90',
    date: '2026-12-21',
    duration: '7',
    adults: '2',
    children: '1',
    childAges: '8'
  }));
  assert.equal(sud.hostname, 'vas1.sax.softvoyage.com');
  assert.equal(sud.searchParams.get('code_ag'), 'VAS');
  assert.equal(sud.searchParams.get('alias'), 'BY4');
  assert.equal(sud.searchParams.get('gateway_dep'), 'YUL');
  assert.equal(sud.searchParams.get('date_dep'), '20261221');
  assert.equal(sud.searchParams.get('non_adult1'), '8');

  const flight = new URL(buildFlightSearchUrl({
    from: 'YUL',
    to: 'CUN',
    depart: '2026-12-21',
    returnDate: '2026-12-28',
    cabin: 'Y',
    trip: 'roundtrip',
    adults: '2'
  }));
  assert.equal(flight.hostname, 'bookingac.trvlbooking.ca');
  assert.equal(flight.searchParams.get('plCode'), 'VAS605');
  assert.equal(flight.searchParams.getAll('leg[]')[0], 'YUL;CUN;2026-12-21');

  const cruise = new URL(buildCruiseSearchUrl({
    port: '24',
    destination: '1',
    date: '2026-12-21',
    vendor: '70',
    duration: '7',
    adults: '2'
  }));
  assert.equal(cruise.hostname, 'cruisepowered.com');
  assert.equal(cruise.searchParams.get('plCode'), 'VAS605');
  assert.equal(cruise.searchParams.get('cruise_agence'), '605');
  assert.equal(cruise.searchParams.get('search[start_date]'), '12/21/2026');

  const car = new URL(buildCarSearchUrl({
    location: '4090',
    pickup: '2026-12-21',
    dropoff: '2026-12-28'
  }));
  assert.equal(car.searchParams.get('plCode'), 'VAS605');
  assert.equal(car.searchParams.get('pickupDate'), '12/21/2026');
});

test('mariage keeps its category path and the group detail URL shape stays id plus slug', () => {
  assert.equal(categoryPath('mariage'), 'mariages/');
  assert.equal(categoryPath('sud'), 'forfaits-sud/');
  const sample = catalog.groups[0];
  const href = `/groupes/groupe/?id=${sample.id}&slug=${encodeURIComponent(sample.slug)}`;
  assert.match(href, /\/groupes\/groupe\/\?id=\d+&slug=/);
});
