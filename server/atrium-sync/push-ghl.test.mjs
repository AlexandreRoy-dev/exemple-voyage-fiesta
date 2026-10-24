import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { analyzeCatalog, bindGroupeFields } from './ghl-groupes-fields.mjs';
import { dryRunEnabled, groupPageUrl, pushGroupes } from './push-ghl.mjs';

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
    { key: 'custom_objects.groupes.destination', label: 'Destination', type: 'TEXT' }
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

function mockFetch({ records = [], uploadStatus = 200 } = {}) {
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
    if (method === 'POST' && String(url).endsWith('/records')) return send(200, { record: { id: 'rec-new' } });
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

test('the group page keeps id and slug', () => {
  assert.equal(
    groupPageUrl({ id: 661, slug: 'noel-au-costa-rica-tout-inclus' }),
    'https://aubaineexpress.voyagefiesta.ca/groupes/groupe/?id=661&slug=noel-au-costa-rica-tout-inclus'
  );
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
  const createdProps = JSON.parse(create.body);
  assert.equal(createdProps.properties['custom_objects.groupes.texte_groupe'], undefined);
  const cruise = catalog().groups[1];
  assert.equal(cruise.description, '');
  const sudUpdate = calls.find((call) => call.method === 'PUT' && String(call.url).endsWith('/rec-661'));
  const sudProps = JSON.parse(sudUpdate.body).properties;
  assert.equal(sudProps['custom_objects.groupes.texte_groupe'], 'Semaine au soleil');
  assert.equal(sudProps['custom_objects.groupes.description'], undefined);
  assert.equal(sudProps['custom_objects.groupes.grp_atrium'], '661');
  assert.equal(sudProps['custom_objects.groupes.photo_file'], 'https://files.example/661.jpg');
  assert.equal(sudProps['custom_objects.groupes.lien_page'], groupPageUrl(catalog().groups[0]));
  const archive = calls.find((call) => call.method === 'PUT' && String(call.url).endsWith('/rec-old'));
  assert.deepEqual(JSON.parse(archive.body).properties, { 'custom_objects.groupes.statut_synchro': 'archivé' });
  assert.equal(calls.some((call) => call.method === 'DELETE'), false);

  calls.length = 0;
  seen.records.splice(0, seen.records.length,
    { id: 'rec-661', properties: { 'custom_objects.groupes.grp_atrium': '661' } },
    { id: 'rec-6', properties: { 'custom_objects.groupes.grp_atrium': '6' } },
    { id: 'rec-old', properties: { 'custom_objects.groupes.grp_atrium': '999', 'custom_objects.groupes.statut_synchro': 'archivé' } }
  );
  const second = await pushGroupes({
    catalog: catalog(),
    apiKey: 'pit-test',
    locationId: 'loc',
    dryRun: false,
    fetchImpl,
    statePath,
    throttleMs: 0,
    syncedAt: '2026-10-24T00:00:00.000Z'
  });
  assert.deepEqual(second.created, []);
  assert.deepEqual(second.updated, []);
  assert.ok(second.unchanged.includes('661'));
  assert.ok(second.unchanged.includes('6'));
  assert.equal(calls.some((call) => call.method === 'PUT' || (call.method === 'POST' && !String(call.url).includes('/search'))), false);
  assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).hashes['661'].length, 64);
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
