import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { analyzeCatalog, bindGroupeFields } from './ghl-groupes-fields.mjs';
import { dryRunEnabled, fingerprint, groupPageUrl, groupProperties, onlyIdSet, photoUploadEnabled, pushGroupes } from './push-ghl.mjs';

const schema = {
  fields: [
    { key: 'custom_objects.groupes.grp_atrium', label: 'Atrium ID', type: 'TEXT' },
    { key: 'custom_objects.groupes.slug', label: 'Slug', type: 'TEXT' },
    { key: 'custom_objects.groupes.type_groupe', label: 'Type de groupe', type: 'SINGLE_OPTIONS', options: ['Sud', 'Croisière', 'Voyage', 'Mariage'] },
    { key: 'custom_objects.groupes.statut_synchro', label: 'Statut synchro', type: 'SINGLE_OPTIONS', options: ['actif', 'archivé'] },
    { key: 'custom_objects.groupes.lien_page', label: 'Lien de la page', type: 'TEXT' },
    { key: 'custom_objects.groupes.description', label: 'Notes internes', type: 'TEXT' },
    { key: 'custom_objects.groupes.texte_groupe', label: 'Description du groupe', type: 'LARGE_TEXT' },
    { key: 'custom_objects.groupes.photo_file', label: 'Photo principale', type: 'FILE_UPLOAD' },
    { key: 'custom_objects.groupes.photo_url', label: 'URL photo principale', type: 'TEXT' },
    { key: 'custom_objects.groupes.destination', label: 'Destination', type: 'TEXT' },
    { key: 'custom_objects.groupes.titre', label: 'Titre du groupe', type: 'TEXT' }
  ]
};

function catalog() {
  return {
    generatedAt: '2026-10-24T00:00:00.000Z',
    groups: [
      {
        id: 661,
        type: 'sud',
        slug: 'noel-au-costa-rica-tout-inclus',
        title: 'Noël au Costa Rica',
        destination: 'Liberia',
        country: 'Costa Rica',
        description: 'Semaine au soleil',
        image: 'https://cdn.example/661.jpg',
        prixAppel: 2959,
        hotel: 'Riu'
      },
      {
        id: 6,
        type: 'cruise',
        slug: 'caraibes',
        title: 'Caraïbes',
        destination: 'Miami',
        image: '',
        navire: 'MSC',
        description: ''
      }
    ]
  };
}

function mockFetch({ records = [], uploadStatus = 200, createStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || 'GET';
    calls.push({ url, method, body: options.body, form: options.body instanceof FormData });
    const send = (status, payload) => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(payload),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      headers: { get: () => '' }
    });
    if (String(url).includes('/objects/custom_objects.groupes?')) return send(200, schema);
    if (String(url).includes('/records/search')) return send(200, { records, total: records.length });
    if (String(url).includes('/medias/upload-file')) return send(uploadStatus, uploadStatus === 200 ? { url: 'https://files.example/661.jpg' } : { message: 'no upload' });
    if (String(url).startsWith('https://cdn.example/')) return send(200, {});
    if (method === 'POST' && String(url).endsWith('/records')) {
      return send(createStatus, createStatus === 200 ? { record: { id: 'rec-new' } } : { message: 'Missing required properties to create Groupe – titre' });
    }
    if (method === 'PUT') return send(200, { record: { id: 'rec-put' } });
    return send(404, { message: 'unexpected' });
  };
  return { fetchImpl, calls };
}

test('dry run is the default and a shared DRY_RUN=0 does not go live', () => {
  assert.equal(dryRunEnabled({}), true);
  assert.equal(dryRunEnabled({ DRY_RUN: '0' }), true);
  assert.equal(dryRunEnabled({ DRY_RUN: '1' }), true);
  assert.equal(dryRunEnabled({ GHL_GROUPE_DRY_RUN: '0' }), false);
  assert.equal(dryRunEnabled({ DRY_RUN: '1', GHL_GROUPE_DRY_RUN: '0' }), true);
});

test('photo upload and the id subset stay off unless asked', () => {
  assert.equal(photoUploadEnabled({}), false);
  assert.equal(photoUploadEnabled({ GHL_GROUPE_UPLOAD_PHOTO: '0' }), false);
  assert.equal(photoUploadEnabled({ GHL_GROUPE_UPLOAD_PHOTO: '1' }), true);
  assert.equal(onlyIdSet(null), null);
  assert.equal(onlyIdSet(''), null);
  assert.deepEqual([...onlyIdSet('661, 6,')], ['661', '6']);
});

test('the group page keeps id and slug', () => {
  assert.equal(
    groupPageUrl({ id: 661, slug: 'noel-au-costa-rica-tout-inclus' }),
    'https://aubaineexpress.voyagefiesta.ca/groupes/groupe/?id=661&slug=noel-au-costa-rica-tout-inclus'
  );
});

test('a live schema is matched by field key before the label', () => {
  const live = {
    fields: [
      { fieldKey: 'custom_objects.groupes.notes', label: 'Atrium ID', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.atrium_id', name: 'ID Atrium (ne pas modifier)', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.titre', name: 'Titre du groupe', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.slug', name: 'Identifiant URL', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.lien_page', name: 'Page publique', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.prix_appel', name: 'Prix affiché', dataType: 'NUMERICAL' },
      { fieldKey: 'custom_objects.groupes.type_groupe', name: 'Catégorie', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.statut_synchro', name: 'État', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.description_groupe', name: 'Texte long', dataType: 'LARGE_TEXT' },
      { fieldKey: 'custom_objects.groupes.date_expiration', name: 'Expire le', dataType: 'DATE' },
      { fieldKey: 'custom_objects.groupes.derniere_synchro', name: 'Synchronisé le', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.compagnie_aerienne', name: 'Compagnie aérienne', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.vols_detail', name: 'Vols détaillés', dataType: 'LARGE_TEXT' },
      { fieldKey: 'custom_objects.groupes.tarifs_detail', name: 'Tarifs détaillés', dataType: 'LARGE_TEXT' },
      { fieldKey: 'custom_objects.groupes.galerie_urls', name: 'Galerie', dataType: 'LARGE_TEXT' },
      { fieldKey: 'custom_objects.groupes.photo_principale_url', name: 'Visuel', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.hotel_chaine', name: 'Enseigne', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.aeroport_depart', name: 'Départ vol', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.programme', name: 'Jour par jour', dataType: 'LARGE_TEXT' },
      { fieldKey: 'custom_objects.groupes.devise', name: 'Monnaie', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.nombre_photos', name: 'Photos (nombre)', dataType: 'NUMERICAL' },
      { fieldKey: 'custom_objects.groupes.navire_annee', name: 'Année', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.navire_passagers', name: 'Capacité', dataType: 'NUMERICAL' },
      { fieldKey: 'custom_objects.groupes.description', name: 'Notes internes', dataType: 'TEXT' }
    ]
  };
  const binding = bindGroupeFields(live);
  for (const name of [
    'atrium_id', 'titre', 'slug', 'lien_page', 'prix_appel', 'type_groupe', 'statut_synchro',
    'description_groupe', 'date_expiration', 'derniere_synchro', 'compagnie_aerienne', 'vols_detail',
    'tarifs_detail', 'galerie_urls', 'photo_principale_url', 'hotel_chaine', 'aeroport_depart',
    'programme', 'devise', 'nombre_photos', 'navire_annee', 'navire_passagers'
  ]) {
    assert.equal(binding.bound[name].key, name, name);
  }
  assert.equal(binding.unmapped.some((field) => field.key === 'description'), true);
  assert.equal(binding.unmapped.some((field) => field.key === 'notes'), true);

  const props = groupProperties({
    id: 661,
    type: 'sud',
    slug: 'noel',
    title: 'Noël',
    image: 'https://cdn.example/661.jpg',
    images: [{ url: 'https://cdn.example/661.jpg' }, { url: 'https://cdn.example/662.jpg' }],
    prixAppel: 2959,
    devise: 'CAD',
    description: 'Semaine',
    hotelDetail: { chaine: 'RIU' },
    navireDetail: { annee: '2019', passagers: 6334 },
    vols: [{ compagnie: 'WestJet', numero: 'WS2700', depart: 'Montréal (YUL)', arrivee: 'Liberia (LIR)', dateDepart: '2026-12-21', heureDepart: '09:10' }],
    tarifs: [{ categorie: 'Adulte', prix: 2959, prixAncien: 3505, disponibilite: '10 places' }],
    itineraire: [{ titre: 'Jour 1', description: 'Arrivée' }]
  }, binding, { syncedAt: '2026-10-24T00:00:00.000Z' });
  assert.equal(props.atrium_id, '661');
  assert.equal(props.titre, 'Noël');
  assert.equal(props.prix_appel, 2959);
  assert.equal(props.compagnie_aerienne, 'WestJet');
  assert.match(props.vols_detail, /WestJet \| WS2700 \| Montréal \(YUL\)/);
  assert.match(props.tarifs_detail, /Adulte \| 2959 \| 3505 \| 10 places/);
  assert.match(props.galerie_urls, /662\.jpg/);
  assert.equal(props.photo_principale_url, 'https://cdn.example/661.jpg');
  assert.equal(props.hotel_chaine, 'RIU');
  assert.equal(props.aeroport_depart, 'Montréal (YUL)');
  assert.match(props.programme, /Jour 1: Arrivée/);
  assert.equal(props.devise, 'CAD');
  assert.equal(props.nombre_photos, 2);
  assert.equal(props.navire_annee, '2019');
  assert.equal(props.navire_passagers, 6334);
  assert.equal(props.description, undefined);
  assert.equal(props.notes, undefined);
  assert.equal(props['custom_objects.groupes.titre'], undefined);
  const later = groupProperties({
    id: 661,
    type: 'sud',
    slug: 'noel',
    title: 'Noël',
    image: 'https://cdn.example/661.jpg',
    images: [{ url: 'https://cdn.example/661.jpg' }, { url: 'https://cdn.example/662.jpg' }],
    prixAppel: 2959,
    devise: 'CAD',
    description: 'Semaine',
    hotelDetail: { chaine: 'RIU' },
    navireDetail: { annee: '2019', passagers: 6334 },
    vols: [{ compagnie: 'WestJet', numero: 'WS2700', depart: 'Montréal (YUL)', arrivee: 'Liberia (LIR)', dateDepart: '2026-12-21', heureDepart: '09:10' }],
    tarifs: [{ categorie: 'Adulte', prix: 2959, prixAncien: 3505, disponibilite: '10 places' }],
    itineraire: [{ titre: 'Jour 1', description: 'Arrivée' }]
  }, binding, { syncedAt: '2026-10-25T03:00:00.000Z' });
  assert.equal(fingerprint(props), fingerprint(later));
  assert.notEqual(props.derniere_synchro, later.derniere_synchro);
});

test('monetary prix_appel and prix_ancien use the GHL default currency', () => {
  const binding = bindGroupeFields({
    fields: [
      { fieldKey: 'custom_objects.groupes.prix_appel', name: 'Prix affiché', dataType: 'MONETARY' },
      { fieldKey: 'custom_objects.groupes.prix_ancien', name: 'Ancien prix', dataType: 'MONETORY' },
      { fieldKey: 'custom_objects.groupes.nombre_photos', name: 'Photos', dataType: 'NUMERICAL' },
      { fieldKey: 'custom_objects.groupes.titre', name: 'Titre', dataType: 'TEXT' }
    ]
  });
  const props = groupProperties({
    id: 1,
    title: 'Test',
    prixAppel: '2 959,50',
    prixAncien: 3505,
    devise: 'USD',
    images: [{ url: 'https://cdn.example/a.jpg' }, { url: 'https://cdn.example/b.jpg' }]
  }, binding, {});
  assert.deepEqual(props.prix_appel, { currency: 'default', value: 2959.5 });
  assert.deepEqual(props.prix_ancien, { currency: 'default', value: 3505 });
  assert.equal(props.nombre_photos, 2);
  assert.equal(props.titre, 'Test');
  assert.equal(Object.keys(props).some((key) => key.includes('.')), false);
});

test('a live run stops before any write when atrium_id or titre is unbound', async () => {
  const partial = {
    fields: [
      { fieldKey: 'custom_objects.groupes.slug', name: 'Slug public', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.destination', name: 'Destination', dataType: 'TEXT' }
    ]
  };
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    const send = (status, payload) => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(payload),
      headers: { get: () => '' }
    });
    if (String(url).includes('/objects/custom_objects.groupes?')) return send(200, partial);
    if (String(url).includes('/records/search')) return send(200, { records: [], total: 0 });
    if ((options.method || 'GET') === 'POST' && String(url).endsWith('/records')) return send(200, { record: { id: 'rec-new' } });
    if (options.method === 'PUT') return send(200, { record: { id: 'rec-put' } });
    return send(404, {});
  };
  await assert.rejects(
    () => pushGroupes({
      catalog: catalog(),
      apiKey: 'pit-test',
      locationId: 'loc',
      dryRun: false,
      fetchImpl,
      throttleMs: 0
    }),
    /atrium_id, titre/
  );
  assert.equal(calls.some((call) => call.method === 'POST' || call.method === 'PUT'), false);
});

test('schema labels win, including description_groupe, and the reserved description key is not a target', () => {
  const binding = bindGroupeFields(schema);
  assert.equal(binding.bound.atrium_id.key, 'grp_atrium');
  assert.equal(binding.bound.description_groupe.key, 'texte_groupe');
  assert.equal(binding.bound.photo_principale.type, 'FILE_UPLOAD');
  assert.equal(Object.values(binding.bound).some((field) => field.key === 'description'), false);
});

test('DRY_RUN updates by atrium_id and does not create a duplicate or upload a file', async () => {
  const { fetchImpl, calls } = mockFetch({
    records: [
      { id: 'rec-661', properties: { 'custom_objects.groupes.grp_atrium': '661' } },
      { id: 'rec-661-b', properties: { 'custom_objects.groupes.grp_atrium': '661' } },
      { id: 'rec-old', properties: { 'custom_objects.groupes.grp_atrium': '999', 'custom_objects.groupes.statut_synchro': 'actif' } }
    ]
  });
  const summary = await pushGroupes({
    catalog: catalog(),
    apiKey: 'pit-test',
    locationId: 'loc',
    dryRun: true,
    fetchImpl,
    throttleMs: 0,
    syncedAt: '2026-10-24T00:00:00.000Z'
  });
  assert.deepEqual(summary.created, ['6']);
  assert.deepEqual(summary.updated, ['661']);
  assert.deepEqual(summary.archived, ['999']);
  assert.equal(summary.duplicates.length, 1);
  assert.equal(calls.some((call) => call.method === 'POST' && call.url.endsWith('/records')), false);
  assert.equal(calls.some((call) => call.method === 'PUT'), false);
  assert.equal(calls.some((call) => String(call.url).includes('/medias/upload-file')), false);
  assert.equal(calls.some((call) => call.method === 'DELETE'), false);
});

test('a live upsert writes the bound description field once and archives without deleting', async () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'ghl-groupes-'));
  const statePath = join(stateDir, 'state.json');
  const seen = { records: [
    { id: 'rec-661', properties: { 'custom_objects.groupes.grp_atrium': '661' } },
    { id: 'rec-old', properties: { 'custom_objects.groupes.grp_atrium': '999', 'custom_objects.groupes.statut_synchro': 'actif' } }
  ] };
  const { fetchImpl, calls } = mockFetch({ get records() { return seen.records; } });
  const first = await pushGroupes({
    catalog: catalog(),
    apiKey: 'pit-test',
    locationId: 'loc',
    dryRun: false,
    fetchImpl,
    statePath,
    throttleMs: 0,
    syncedAt: '2026-10-24T00:00:00.000Z'
  });
  assert.deepEqual(first.created, ['6']);
  assert.deepEqual(first.updated, ['661']);
  assert.deepEqual(first.archived, ['999']);
  const create = calls.find((call) => call.method === 'POST' && String(call.url).endsWith('/records'));
  const createdBody = JSON.parse(create.body);
  const createdProps = createdBody.properties;
  assert.equal(createdBody.locationId, 'loc');
  assert.equal(String(create.url).includes('?'), false);
  assert.equal(createdProps.texte_groupe, undefined);
  assert.equal(createdProps.titre, 'Caraïbes');
  assert.equal(createdProps.grp_atrium, '6');
  assert.equal(createdProps['custom_objects.groupes.titre'], undefined);
  const cruise = catalog().groups[1];
  assert.equal(cruise.description, '');
  const sudWrites = calls.filter((call) => call.method === 'PUT' && String(call.url).includes('/rec-661?'));
  assert.equal(sudWrites.length, 1);
  assert.match(String(sudWrites[0].url), /\/rec-661\?locationId=loc$/);
  const sudBody = JSON.parse(sudWrites[0].body);
  assert.equal(sudBody.locationId, undefined);
  const sudProps = sudBody.properties;
  assert.equal(sudProps.texte_groupe, 'Semaine au soleil');
  assert.equal(sudProps.description, undefined);
  assert.equal(sudProps.grp_atrium, '661');
  assert.equal(sudProps.titre, 'Noël au Costa Rica');
  assert.equal(sudProps.photo_file, undefined);
  assert.equal(sudProps.photo_url, 'https://cdn.example/661.jpg');
  assert.equal(sudProps.lien_page, groupPageUrl(catalog().groups[0]));
  assert.equal(calls.some((call) => String(call.url).includes('/medias/upload-file')), false);
  const archive = calls.find((call) => call.method === 'PUT' && String(call.url).includes('/rec-old?'));
  assert.match(String(archive.url), /\/rec-old\?locationId=loc$/);
  const archiveBody = JSON.parse(archive.body);
  assert.equal(archiveBody.locationId, undefined);
  assert.deepEqual(archiveBody.properties, { statut_synchro: 'archivé' });
  assert.equal(calls.some((call) => call.method === 'DELETE'), false);
  const saved = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(saved.hashes['661'].length, 64);

  calls.length = 0;
  delete saved.photos;
  writeFileSync(statePath, `${JSON.stringify(saved)}\n`);
  seen.records.splice(0, seen.records.length,
    { id: 'rec-661', properties: { grp_atrium: '661', 'custom_objects.groupes.photo_principale_url': 'https://cdn.example/661.jpg' } },
    { id: 'rec-6', properties: { 'custom_objects.groupes.grp_atrium': '6' } },
    { id: 'rec-old', properties: { statut_synchro: 'archivé', 'custom_objects.groupes.grp_atrium': '999' } }
  );
  const second = await pushGroupes({
    catalog: catalog(),
    apiKey: 'pit-test',
    locationId: 'loc',
    dryRun: false,
    fetchImpl,
    statePath,
    throttleMs: 0,
    syncedAt: '2026-10-25T03:00:00.000Z'
  });
  assert.deepEqual(second.created, []);
  assert.deepEqual(second.updated, []);
  assert.deepEqual(second.archived, []);
  assert.ok(second.unchanged.includes('661'));
  assert.ok(second.unchanged.includes('6'));
  assert.equal(calls.some((call) => String(call.url).includes('/medias/upload-file')), false);
  assert.equal(calls.some((call) => call.method === 'PUT' || (call.method === 'POST' && String(call.url).endsWith('/records'))), false);
});

test('a failed create does not upload a photo', async () => {
  const { fetchImpl, calls } = mockFetch({ records: [], createStatus: 400 });
  await assert.rejects(
    () => pushGroupes({
      catalog: {
        groups: [{
          id: 6,
          type: 'cruise',
          slug: 'caraibes',
          title: 'Caraïbes',
          image: 'https://cdn.example/6.jpg',
          description: 'Mer'
        }]
      },
      apiKey: 'pit-test',
      locationId: 'loc',
      dryRun: false,
      uploadPhoto: true,
      fetchImpl,
      throttleMs: 0,
      syncedAt: '2026-10-24T00:00:00.000Z'
    }),
    /GHL 400/
  );
  const create = calls.find((call) => call.method === 'POST' && String(call.url).endsWith('/records'));
  assert.equal(JSON.parse(create.body).properties.titre, 'Caraïbes');
  assert.equal(calls.some((call) => String(call.url).includes('/medias/upload-file')), false);
  assert.equal(calls.some((call) => String(call.url).startsWith('https://cdn.example/')), false);
});

test('the photo is uploaded only after a successful create', async () => {
  const { fetchImpl, calls } = mockFetch({ records: [] });
  const summary = await pushGroupes({
    catalog: {
      groups: [{
        id: 6,
        type: 'cruise',
        slug: 'caraibes',
        title: 'Caraïbes',
        image: 'https://cdn.example/6.jpg',
        description: 'Mer'
      }]
    },
    apiKey: 'pit-test',
    locationId: 'loc',
    dryRun: false,
    uploadPhoto: true,
    fetchImpl,
    throttleMs: 0,
    syncedAt: '2026-10-24T00:00:00.000Z'
  });
  assert.deepEqual(summary.created, ['6']);
  const steps = calls.map((call) => {
    if (String(call.url).includes('/medias/upload-file')) return 'upload';
    if (call.method === 'POST' && String(call.url).endsWith('/records')) return 'create';
    if (call.method === 'PUT') return 'photo';
    return '';
  }).filter(Boolean);
  assert.deepEqual(steps, ['create', 'upload', 'photo']);
  assert.equal(JSON.parse(calls.find((call) => call.method === 'POST' && String(call.url).endsWith('/records')).body).properties.photo_file, undefined);
  const photoPut = calls.find((call) => call.method === 'PUT');
  assert.match(String(photoPut.url), /\/rec-new\?locationId=loc$/);
  const photoBody = JSON.parse(photoPut.body);
  assert.equal(photoBody.locationId, undefined);
  assert.deepEqual(photoBody.properties, { photo_file: 'https://files.example/661.jpg' });
});

test('a subset run leaves records outside the list alone', async () => {
  const { fetchImpl, calls } = mockFetch({
    records: [
      { id: 'rec-661', properties: { 'custom_objects.groupes.grp_atrium': '661' } },
      { id: 'rec-old', properties: { 'custom_objects.groupes.grp_atrium': '999', 'custom_objects.groupes.statut_synchro': 'actif' } }
    ]
  });
  const summary = await pushGroupes({
    catalog: catalog(),
    apiKey: 'pit-test',
    locationId: 'loc id',
    dryRun: false,
    onlyIds: '661, 6',
    fetchImpl,
    throttleMs: 0,
    syncedAt: '2026-10-24T00:00:00.000Z'
  });
  assert.deepEqual(summary.onlyIds, ['661', '6']);
  assert.deepEqual(summary.updated, ['661']);
  assert.deepEqual(summary.created, ['6']);
  assert.deepEqual(summary.archived, []);
  assert.equal(calls.some((call) => String(call.url).includes('rec-old')), false);
  assert.equal(calls.some((call) => String(call.url).includes('/medias/upload-file')), false);
  const put = calls.find((call) => call.method === 'PUT');
  assert.match(String(put.url), /\/rec-661\?locationId=loc%20id$/);
  assert.equal(JSON.parse(put.body).locationId, undefined);
  const create = calls.find((call) => call.method === 'POST' && String(call.url).endsWith('/records'));
  assert.equal(JSON.parse(create.body).locationId, 'loc id');
  assert.equal(String(create.url).includes('?'), false);
});

test('text longer than 11900 characters is capped before the fingerprint', () => {
  const binding = bindGroupeFields({
    fields: [
      { fieldKey: 'custom_objects.groupes.programme', name: 'Programme', dataType: 'LARGE_TEXT' },
      { fieldKey: 'custom_objects.groupes.itineraire', name: 'Itinéraire', dataType: 'LARGE_TEXT' },
      { fieldKey: 'custom_objects.groupes.titre', name: 'Titre', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.derniere_synchro', name: 'Synchronisé le', dataType: 'TEXT' },
      { fieldKey: 'custom_objects.groupes.nombre_photos', name: 'Nombre de photos', dataType: 'NUMERICAL' },
      { fieldKey: 'custom_objects.groupes.prix_appel', name: "Prix d'appel", dataType: 'MONETARY' }
    ]
  });
  const day = 'é'.repeat(16688);
  const group = {
    id: 271,
    title: 'Court',
    prixAppel: 2959,
    images: [{ url: 'https://cdn.example/a.jpg' }, { url: 'https://cdn.example/b.jpg' }],
    itineraire: [{ titre: day }]
  };
  const props = groupProperties(group, binding, { syncedAt: '2026-10-24T00:00:00.000Z' });
  assert.equal(props.titre, 'Court');
  assert.equal(props.programme.length, 11901);
  assert.equal(props.itineraire.length, 11901);
  assert.equal(props.programme.endsWith('…'), true);
  assert.equal(props.programme.slice(0, 11900), 'é'.repeat(11900));
  assert.equal(props.nombre_photos, 2);
  assert.deepEqual(props.prix_appel, { currency: 'default', value: 2959 });
  const later = groupProperties(group, binding, { syncedAt: '2026-10-25T03:00:00.000Z' });
  assert.equal(fingerprint(props), fingerprint(later));
  assert.notEqual(fingerprint(props), fingerprint({ programme: day }));
  const exact = groupProperties({ id: 1, title: 'x'.repeat(11900), itineraire: [] }, binding, {});
  assert.equal(exact.titre, 'x'.repeat(11900));
});

function pagedFetch(records, { total = records.length, pageSize = 100, createStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || 'GET';
    calls.push({ url: String(url), method, body: options.body });
    const send = (status, payload) => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(payload),
      headers: { get: () => '' }
    });
    if (String(url).includes('/objects/custom_objects.groupes?')) return send(200, schema);
    if (String(url).includes('/records/search')) {
      const body = options.body ? JSON.parse(options.body) : {};
      const start = (Number(body.page || 1) - 1) * pageSize;
      return send(200, { records: records.slice(start, start + pageSize), total, traceId: 'trace' });
    }
    if (method === 'POST' && String(url).endsWith('/records')) {
      return send(createStatus, createStatus === 200 ? { record: { id: 'rec-new' } } : { message: 'rejected' });
    }
    if (method === 'PUT') return send(200, { record: { id: 'rec-put' } });
    return send(404, {});
  };
  return { fetchImpl, calls };
}

test('search follows the record searchAfter until the reported total', async () => {
  const records = Array.from({ length: 150 }, (_, index) => ({
    id: `rec-${index}`,
    searchAfter: [`sa-${index}`],
    properties: { 'custom_objects.groupes.grp_atrium': String(index === 120 ? 661 : 5000 + index) }
  }));
  const { fetchImpl, calls } = pagedFetch(records);
  const summary = await pushGroupes({
    catalog: catalog(),
    apiKey: 'pit-test',
    locationId: 'loc',
    dryRun: false,
    onlyIds: '661,6',
    fetchImpl,
    throttleMs: 0,
    syncedAt: '2026-10-24T00:00:00.000Z'
  });
  const searches = calls.filter((call) => call.url.includes('/records/search'));
  assert.equal(searches.length, 2);
  const second = JSON.parse(searches[1].body);
  assert.equal(second.page, 2);
  assert.deepEqual(second.searchAfter, ['sa-99']);
  assert.equal(calls.filter((call) => call.url.includes('/records/search')).length, 2);
  assert.deepEqual(summary.updated, ['661']);
  assert.deepEqual(summary.created, ['6']);
  assert.deepEqual(summary.archived, []);
});

test('a short record read aborts before any create', async () => {
  const records = Array.from({ length: 100 }, (_, index) => ({
    id: `rec-${index}`,
    properties: { grp_atrium: String(8000 + index) }
  }));
  const { fetchImpl, calls } = pagedFetch(records, { total: 150 });
  await assert.rejects(
    () => pushGroupes({
      catalog: catalog(),
      apiKey: 'pit-test',
      locationId: 'loc',
      dryRun: false,
      fetchImpl,
      throttleMs: 0
    }),
    /100\/150/
  );
  assert.equal(calls.some((call) => call.method === 'POST' && call.url.endsWith('/records')), false);
  assert.equal(calls.some((call) => call.method === 'PUT'), false);
});

test('a failed create saves the state of records already written', async () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'ghl-groupes-'));
  const statePath = join(stateDir, 'state.json');
  let creates = 0;
  const createBodies = [];
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || 'GET';
    const send = (status, payload) => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(payload),
      headers: { get: () => '' }
    });
    if (String(url).includes('/objects/custom_objects.groupes?')) return send(200, schema);
    if (String(url).includes('/records/search')) return send(200, { records: [], total: 0 });
    if (method === 'POST' && String(url).endsWith('/records')) {
      creates += 1;
      createBodies.push(JSON.parse(options.body));
      if (creates === 1) return send(200, { record: { id: 'rec-1' } });
      return send(400, { message: 'rejected' });
    }
    return send(404, {});
  };
  await assert.rejects(
    () => pushGroupes({
      catalog: {
        groups: [
          { id: 1, type: 'sud', slug: 'un', title: 'Un', description: 'court' },
          { id: 2, type: 'sud', slug: 'deux', title: 'Deux', description: 'x'.repeat(13000) }
        ]
      },
      apiKey: 'pit-test',
      locationId: 'loc',
      dryRun: false,
      fetchImpl,
      statePath,
      throttleMs: 0,
      syncedAt: '2026-10-24T00:00:00.000Z'
    }),
    /GHL 400/
  );
  const saved = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(saved.hashes['1'].length, 64);
  assert.equal(saved.ids['1'], 'rec-1');
  assert.equal(saved.hashes['2'], undefined);
  assert.equal(createBodies[1].properties.texte_groupe.length, 11901);
  assert.equal(createBodies[1].properties.texte_groupe.endsWith('…'), true);
});

test('the local catalog has sud, cruise and voyage groups and no mariage rows', () => {
  const groups = JSON.parse(readFileSync(new URL('../../groupes/data/groupes.json', import.meta.url), 'utf8')).groups;
  const analysis = analyzeCatalog(groups);
  assert.equal(analysis.sud.count, 14);
  assert.equal(analysis.cruise.count, 13);
  assert.equal(analysis.voyage.count, 8);
  assert.equal(analysis.mariage, undefined);
  assert.equal(analysis.sud.hotel, 14);
  assert.equal(analysis.cruise.navire, 13);
  assert.equal(analysis.voyage.itineraire, 8);
  assert.ok(analysis.voyage.description > 0);
});
