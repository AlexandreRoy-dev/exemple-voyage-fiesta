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

test('builds public vascoinc URLs from hotel photo ids and cruise filenames', () => {
  const catalog = mapCatalog({
    groupes: [
      {
        id_groupe: 6,
        type: 'sud',
        status: 'actif',
        titre: 'Samana, Bahia Principe',
        id_hotel: 287,
        date_depart: '2026-10-26',
        prix_appel: 2569
      },
      {
        id_groupe: 584,
        type: 'cruise',
        status: 'actif',
        titre: 'Croisière en Europe',
        navire_nom: 'Norwegian Viva',
        compagnie_cruise: 'Norwegian Cruise Line',
        date_depart: '2027-08-15'
      },
      {
        id_groupe: 723,
        type: 'voyage',
        status: 'actif',
        titre: 'Yoga au Nicaragua',
        date_depart: '2027-01-10',
        list_image: [{ fichier: '00000723_3411_Qnf8ejco.jpeg', titre_fr: 'Groupe au départ' }]
      }
    ],
    hotels: [{
      id_hotel: 287,
      nom: 'Bahia Principe Grand El Portillo',
      list_photo: [
        { id_photo: 2546, titre_fr: 'Plage' },
        { id_photo: 2560, principale: 1, titre_fr: 'Piscine' }
      ]
    }],
    navires: [{ id_navire: 55, nom: 'Norwegian Viva', id_compagnie: 9 }],
    compagnies: [{ id_compagnie: 9, nom_fr: 'Norwegian Cruise Line' }],
    photos: [{ id_navire: 55, id_photo: 5914, principale: true, image: '5914_Bateau.jpg', titre_fr: 'Le navire' }],
    cabines: [{ id_navire: 55, image: '7448_IB.jpg', titre_fr: 'Cabine intérieure' }],
    ponts: [{ id_navire: 55, image: '4722_Deck5.jpg' }]
  }, { generatedAt: '2026-10-21T12:00:00.000Z' });

  const hotel = catalog.groups.find((group) => group.id === 6);
  assert.equal(hotel.image, 'https://vascoinc.com/upimg/hotel/hotel_00000287_00002560.jpg');
  assert.equal(hotel.images[1].url, 'https://vascoinc.com/upimg/hotel/hotel_00000287_00002546.jpg');
  assert.equal(hotel.images[0].alt, 'Piscine');

  const cruise = catalog.groups.find((group) => group.id === 584);
  assert.equal(cruise.navireId, 55);
  assert.equal(cruise.image, 'https://vascoinc.com/upimg/bateau/5914_Bateau.jpg');
  assert.ok(cruise.images.some((image) => image.url === 'https://vascoinc.com/upimg/cabine/7448_IB.jpg'));
  assert.ok(cruise.images.some((image) => image.url === 'https://vascoinc.com/upimg/pont/4722_Deck5.jpg'));

  const voyage = catalog.groups.find((group) => group.id === 723);
  assert.equal(voyage.image, 'https://vascoinc.com/upimg/groupenew/00000723_3411_Qnf8ejco.jpeg');
});
