import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VOYAGES_FIELDS,
  applySchemaBindings,
  formatAeroportLabel,
  normalizeAeroportOption,
  readVoyageExtras
} from './ghl-voyages-fields.mjs';

test('Québec airport key is quebec_yqb, and the old qubec_yqb key still displays', () => {
  assert.equal(normalizeAeroportOption('Québec (YQB)'), 'quebec_yqb');
  assert.equal(normalizeAeroportOption('qubec_yqb'), 'quebec_yqb');
  assert.equal(normalizeAeroportOption('quebec_yqb'), 'quebec_yqb');
  assert.equal(formatAeroportLabel('quebec_yqb'), 'Québec (YQB)');
  assert.equal(formatAeroportLabel('qubec_yqb'), 'Québec (YQB)');
  assert.equal(normalizeAeroportOption('Montréal (YUL)'), 'montral_yul');
});

test('schema labels override the fallback field keys', { concurrency: false }, () => {
  const snapshot = {
    categorie: VOYAGES_FIELDS.categorie,
    navire: VOYAGES_FIELDS.navire
  };
  try {
    const bound = applySchemaBindings({
      fields: [
        { fieldKey: 'custom_objects.voyages.cat_voyage_live', label: 'Catégorie du voyage' },
        { key: 'custom_objects.voyages.navire_live', name: 'Navire' }
      ]
    });
    assert.equal(bound >= 2, true);
    assert.equal(VOYAGES_FIELDS.categorie, 'cat_voyage_live');
    assert.equal(VOYAGES_FIELDS.navire, 'navire_live');
  } finally {
    VOYAGES_FIELDS.categorie = snapshot.categorie;
    VOYAGES_FIELDS.navire = snapshot.navire;
  }
});

test('category decides the section and empty fields stay out', () => {
  const cruise = readVoyageExtras({
    categorie_du_voyage: 'Croisière',
    compagnie: 'MSC',
    navire: 'Virtuosa',
    port_dembarquement: '',
    itinraire: 'Miami, Cozumel'
  });
  assert.equal(cruise.voyageCategory, 'croisiere');
  assert.equal(cruise.voyageCategoryLabel, 'Croisière');
  assert.deepEqual(cruise.cruise, {
    company: 'MSC',
    ship: 'Virtuosa',
    itinerary: 'Miami, Cozumel'
  });
  assert.equal(cruise.circuit, null);
  assert.equal(cruise.wedding, null);

  const sud = readVoyageExtras({
    categorie_du_voyage: 'Forfait Sud',
    compagnie: 'MSC',
    navire: 'Virtuosa'
  });
  assert.equal(sud.voyageCategory, 'sud');
  assert.equal(sud.cruise, null);

  const wedding = readVoyageExtras({
    categorie_du_voyage: { label: 'Mariage' },
    noms_des_maris: 'Alex et Sam',
    date_mariage: '',
    lieu_crmonie: 'Varadero'
  });
  assert.equal(wedding.voyageCategory, 'mariage');
  assert.deepEqual(wedding.wedding, { names: 'Alex et Sam', venue: 'Varadero' });
});
