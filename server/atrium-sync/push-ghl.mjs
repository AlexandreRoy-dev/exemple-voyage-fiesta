/**
 * Upsert the public group catalog into the existing custom_objects.groupes.
 * Does not create the object. Does not delete records. Same atrium_id updates
 * the first record and never inserts a second one.
 *
 * Live writes require GHL_GROUPE_DRY_RUN=0. DRY_RUN=1 also stays dry.
 * The default, including an empty variable, is dry.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROUPES_SCHEMA_KEY, analyzeCatalog, bindGroupeFields, foldLabel } from './ghl-groupes-fields.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = 'https://services.leadconnectorhq.com';
const PAGE_LIMIT = 100;

function loadEnvFile() {
  const candidates = [
    join(__dirname, '.env'),
    join(__dirname, '..', '.env'),
    join(__dirname, '..', 'reservation-api', '.env')
  ];
  for (const envPath of candidates) {
    let text = '';
    try {
      text = readFileSync(envPath, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eq = trimmed.indexOf('=');
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

export function dryRunEnabled(env = process.env) {
  if (['1', 'true', 'yes', 'on'].includes(String(env.DRY_RUN || '').trim().toLowerCase())) return true;
  const flag = env.GHL_GROUPE_DRY_RUN;
  if (flag == null || String(flag).trim() === '') return true;
  return !['0', 'false', 'no', 'off'].includes(String(flag).trim().toLowerCase());
}

function hashPayload(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isSyncStamp(key) {
  const plain = String(key || '').split('.').pop();
  if (!plain || plain === 'statut_synchro') return false;
  if (plain === 'derniere_synchro') return true;
  if (/timestamp/i.test(plain)) return true;
  if (/synchro/i.test(plain)) return true;
  return /^(synced_at|updated_at|created_at)$/i.test(plain);
}

export function fingerprint(properties) {
  const stable = {};
  for (const [key, value] of Object.entries(properties || {})) {
    const plain = String(key).split('.').pop();
    if (isSyncStamp(plain)) continue;
    stable[plain] = value;
  }
  return hashPayload(stable);
}

function isMoneyType(type) {
  const kind = String(type || '').toUpperCase();
  return kind.includes('MONET') || kind.includes('CURRENCY');
}

function moneyValue(raw) {
  const n = typeof raw === 'number'
    ? raw
    : Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return { currency: 'CAD', value: Math.round(n * 100) / 100 };
}

function lines(items, render) {
  return (items || []).map(render).filter(Boolean).join('\n');
}

function optionValue(field, raw, aliases = []) {
  const options = Array.isArray(field?.options) ? field.options : [];
  if (!options.length || raw == null || raw === '') return raw;
  const wanted = new Set([raw, ...aliases].map((item) => foldLabel(item)).filter(Boolean));
  for (const option of options) {
    const label = typeof option === 'string' ? option : (option.label || option.name || option.value || option.key || '');
    const key = typeof option === 'string' ? option : (option.key || option.value || label);
    if (wanted.has(foldLabel(label)) || wanted.has(foldLabel(key))) return key;
  }
  return raw;
}

function typeLabel(type) {
  if (type === 'cruise') return 'Croisière';
  if (type === 'voyage') return 'Voyage';
  if (type === 'mariage') return 'Mariage';
  if (type === 'sud') return 'Sud';
  return type || '';
}

export function groupPageUrl(group, origin = 'https://aubaineexpress.voyagefiesta.ca') {
  const base = String(origin || 'https://aubaineexpress.voyagefiesta.ca').replace(/\/$/, '');
  const id = encodeURIComponent(group.id);
  const slug = encodeURIComponent(group.slug || '');
  return `${base}/groupes/groupe/?id=${id}&slug=${slug}`;
}

export function groupProperties(group, binding, { origin, syncedAt, photo } = {}) {
  const values = {
    atrium_id: String(group.id),
    slug: group.slug || '',
    type_groupe: optionValue(binding.bound.type_groupe, typeLabel(group.type), [
      group.type,
      group.type === 'sud' ? 'Forfait Sud' : '',
      group.type === 'cruise' ? 'Croisière' : '',
      group.type === 'voyage' ? 'Voyage / circuit' : ''
    ]),
    statut_synchro: 'actif',
    lien_page: groupPageUrl(group, origin),
    destination: group.destination || '',
    pays: group.country || '',
    region: group.region || '',
    date_depart: group.dateDepart || '',
    date_expiration: group.dateExpire || '',
    autres_dates: lines(group.dates, (item) => [item.date, item.label].filter(Boolean).join(' ')),
    description_groupe: group.description || '',
    derniere_synchro: syncedAt || '',
    titre: group.title || '',
    hotel: group.hotel || '',
    hotel_etoiles: group.hotelDetail?.etoiles ?? '',
    chaine: group.hotelDetail?.chaine || '',
    hotel_description: group.hotelDetail?.description || '',
    compagnie: group.compagnie || '',
    navire: group.navire || '',
    navire_description: group.navireDetail?.description || '',
    itineraire: lines(group.itineraire, (item) => [item.titre, item.description].filter(Boolean).join(': ')),
    duree_jours: group.dureeJours ?? '',
    duree_nuits: group.dureeNuits ?? '',
    points_forts: lines(group.pointsForts, (item) => item),
    inclusions: lines(group.inclusions, (item) => item),
    prix_appel: group.prixAppel ?? '',
    prix_ancien: group.prixAncien ?? '',
    tarifs: lines(group.tarifs, (item) => [item.categorie, item.prix, item.disponibilite].filter((part) => part != null && part !== '').join(' | ')),
    vols: lines(group.vols, (item) => [item.sens, item.numero, item.depart, item.arrivee, item.dateDepart].filter(Boolean).join(' ')),
    photo_principale: photo?.uploadedUrl || '',
    photo_url: group.image || '',
    photos: lines(group.images, (item) => item.url || item),
    compagnie_aerienne: [...new Set((group.vols || []).map((item) => item.compagnie).filter(Boolean))].join(', '),
    vols_detail: lines(group.vols, (item) => [item.sens, item.compagnie, item.numero, item.depart, item.arrivee, item.dateDepart, item.heureDepart, item.dateArrivee, item.heureArrivee].filter(Boolean).join(' | ')),
    tarifs_detail: lines(group.tarifs, (item) => [item.categorie, item.prix, item.prixAncien, item.disponibilite].filter((part) => part != null && part !== '').join(' | ')),
    galerie_urls: lines(group.images, (item) => item.url || item),
    photo_principale_url: group.image || '',
    hotel_chaine: group.hotelDetail?.chaine || '',
    aeroport_depart: (group.vols || []).map((item) => item.depart).find(Boolean) || '',
    programme: lines(group.itineraire, (item) => [item.titre, item.description].filter(Boolean).join(': ')),
    devise: group.devise || '',
    nombre_photos: Array.isArray(group.images) ? group.images.length : '',
    navire_annee: group.navireDetail?.annee || '',
    navire_passagers: group.navireDetail?.passagers ?? ''
  };
  const properties = {};
  for (const [logical, field] of Object.entries(binding.bound)) {
    let value = values[logical];
    if (value == null || value === '') continue;
    if ((logical === 'prix_appel' || logical === 'prix_ancien') && isMoneyType(field.type)) {
      value = moneyValue(value);
      if (!value) continue;
    } else if (String(field.type).includes('NUM') && value !== '') {
      value = Number(value);
      if (Number.isNaN(value)) continue;
    }
    if (field.type.includes('OPTION') || field.type.includes('SELECT') || field.type.includes('RADIO')) {
      value = optionValue(field, value);
    }
    properties[field.key] = value;
  }
  for (const key of Object.keys(properties)) {
    if (String(key).split('.').pop() === 'description') {
      throw new Error('Le champ réservé description ne doit pas être écrit.');
    }
  }
  return properties;
}

function propsOf(record) {
  return record?.properties || record?.fields || {};
}

function propValue(props, key) {
  if (!props || !key) return '';
  const direct = props[key];
  if (direct != null && direct !== '') return direct;
  const prefixed = props[`${GROUPES_SCHEMA_KEY}.${key}`];
  if (prefixed != null && prefixed !== '') return prefixed;
  return '';
}

function atriumIdOf(record, binding) {
  const key = binding.bound.atrium_id?.key || 'atrium_id';
  return String(propValue(propsOf(record), key) || '').trim();
}

function statutOf(record, binding) {
  const key = binding.bound.statut_synchro?.key || 'statut_synchro';
  return String(propValue(propsOf(record), key) || '').trim().toLowerCase();
}

async function ghl(fetchImpl, apiKey, path, { method = 'GET', body } = {}) {
  const response = await fetchImpl(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      Version: '2021-07-28',
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(`GHL ${response.status} ${path}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function fetchSchema(fetchImpl, apiKey, locationId) {
  return ghl(fetchImpl, apiKey, `/objects/${encodeURIComponent(GROUPES_SCHEMA_KEY)}?locationId=${encodeURIComponent(locationId)}`);
}

async function fetchRecords(fetchImpl, apiKey, locationId) {
  const all = [];
  let page = 1;
  let searchAfter;
  let total = Infinity;
  while (all.length < total && page < 50) {
    const data = await ghl(fetchImpl, apiKey, `/objects/${encodeURIComponent(GROUPES_SCHEMA_KEY)}/records/search`, {
      method: 'POST',
      body: { locationId, page, pageLimit: PAGE_LIMIT, ...(searchAfter ? { searchAfter } : {}) }
    });
    const records = data?.records || data?.data || [];
    total = data?.total ?? records.length;
    all.push(...records);
    if (records.length < PAGE_LIMIT || all.length >= total) break;
    searchAfter = data.searchAfter || data.nextSearchAfter;
    page += 1;
    if (!searchAfter) break;
  }
  return all;
}

async function uploadPhoto({ fetchImpl, apiKey, locationId, imageUrl }) {
  const image = await fetchImpl(imageUrl);
  if (!image?.ok) throw new Error(`photo HTTP ${image?.status || 0}`);
  const bytes = Buffer.from(await image.arrayBuffer());
  const form = new FormData();
  const name = new URL(imageUrl).pathname.split('/').pop() || 'photo.jpg';
  form.append('file', new Blob([bytes]), name);
  form.append('locationId', locationId);
  const data = await ghl(fetchImpl, apiKey, '/medias/upload-file', { method: 'POST', body: form });
  return data?.url || data?.fileUrl || data?.absoluteFileUrl || data?.data?.url || '';
}

function readState(path) {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (!data || typeof data !== 'object') return { hashes: {}, photos: {} };
    data.hashes = data.hashes || {};
    data.photos = data.photos || {};
    return data;
  } catch {
    return { hashes: {}, photos: {} };
  }
}

export async function pushGroupes({
  catalog,
  apiKey = '',
  locationId = '',
  origin = 'https://aubaineexpress.voyagefiesta.ca',
  dryRun = true,
  statePath = '',
  fetchImpl = globalThis.fetch,
  throttleMs = 250,
  syncedAt = new Date().toISOString()
} = {}) {
  if (!dryRun && (!apiKey || !locationId)) throw new Error('GHL_API_KEY et GHL_LOCATION_ID requis hors DRY_RUN');
  const schema = dryRun && !apiKey
    ? null
    : await fetchSchema(fetchImpl, apiKey, locationId).catch((error) => {
      if (!dryRun) throw error;
      return null;
    });
  const binding = bindGroupeFields(schema);
  if (!dryRun) {
    const missing = ['atrium_id', 'titre'].filter((name) => !binding.bound[name]?.key);
    if (missing.length) {
      throw new Error(`Refus d'écrire dans GHL: champ non lié (${missing.join(', ')}).`);
    }
  }
  const records = apiKey ? await fetchRecords(fetchImpl, apiKey, locationId) : [];
  const byAtrium = new Map();
  for (const record of records) {
    const id = atriumIdOf(record, binding);
    if (!id) continue;
    if (!byAtrium.has(id)) byAtrium.set(id, []);
    byAtrium.get(id).push(record);
  }
  const state = statePath ? readState(statePath) : { hashes: {}, photos: {} };
  state.photos = state.photos || {};
  const summary = {
    dryRun,
    schemaCount: binding.schemaCount,
    usedFallback: binding.usedFallback,
    bound: Object.keys(binding.bound),
    unmapped: binding.unmapped,
    analysis: analyzeCatalog(catalog?.groups || []),
    created: [],
    updated: [],
    unchanged: [],
    archived: [],
    duplicates: [],
    photos: []
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let writes = 0;
  const pause = async () => {
    if (writes && throttleMs) await sleep(throttleMs);
    writes += 1;
  };

  const photoField = binding.bound.photo_principale;
  const photoIsFile = photoField && /FILE|UPLOAD|IMAGE|ATTACHMENT/.test(photoField.type);

  for (const group of catalog?.groups || []) {
    const atriumId = String(group.id);
    const existing = byAtrium.get(atriumId) || [];
    if (existing.length > 1) {
      summary.duplicates.push({ atriumId, ids: existing.map((record) => record.id).filter(Boolean) });
    }
    const properties = groupProperties(group, binding, { origin, syncedAt });
    const digest = fingerprint(properties);
    const current = existing[0];
    const source = String(group.image || '').trim();
    const urlKey = binding.bound.photo_principale_url?.key || 'photo_principale_url';
    const recordSource = current ? String(propValue(propsOf(current), urlKey) || '').trim() : '';
    const storedSource = recordSource || String(state.photos[atriumId] || '').trim();
    const photoChanged = Boolean(photoIsFile && source && source !== storedSource);
    const contentChanged = !current || state.hashes[atriumId] !== digest;
    if (current && !contentChanged && !photoChanged) {
      summary.unchanged.push(atriumId);
      summary.photos.push({ atriumId, mode: 'unchanged' });
      continue;
    }
    if (!current) summary.created.push(atriumId);
    else if (contentChanged) summary.updated.push(atriumId);

    let recordId = current?.id || '';
    if (!dryRun && (!current || contentChanged)) {
      await pause();
      if (!current) {
        const created = await ghl(fetchImpl, apiKey, `/objects/${encodeURIComponent(GROUPES_SCHEMA_KEY)}/records`, {
          method: 'POST',
          body: { locationId, properties }
        });
        recordId = created?.record?.id || created?.id || '';
        state.hashes[atriumId] = digest;
        state.ids = state.ids || {};
        state.ids[atriumId] = recordId;
      } else {
        await ghl(fetchImpl, apiKey, `/objects/${encodeURIComponent(GROUPES_SCHEMA_KEY)}/records/${encodeURIComponent(current.id)}`, {
          method: 'PUT',
          body: { locationId, properties }
        });
        state.hashes[atriumId] = digest;
        recordId = current.id;
      }
    }

    if (photoChanged) {
      if (dryRun) {
        summary.photos.push({ atriumId, mode: 'upload-dry' });
      } else if (!recordId) {
        summary.photos.push({ atriumId, mode: 'url', error: 'fiche sans id' });
      } else {
        try {
          const uploadedUrl = await uploadPhoto({ fetchImpl, apiKey, locationId, imageUrl: source });
          if (!uploadedUrl) throw new Error('photo sans URL');
          await pause();
          await ghl(fetchImpl, apiKey, `/objects/${encodeURIComponent(GROUPES_SCHEMA_KEY)}/records/${encodeURIComponent(recordId)}`, {
            method: 'PUT',
            body: { locationId, properties: { [photoField.key]: uploadedUrl } }
          });
          state.photos[atriumId] = source;
          summary.photos.push({ atriumId, mode: 'upload' });
        } catch (error) {
          summary.photos.push({ atriumId, mode: 'url', error: error.message });
        }
      }
    } else if (source) {
      summary.photos.push({ atriumId, mode: photoIsFile ? 'unchanged' : 'url' });
    }
  }

  const liveIds = new Set((catalog?.groups || []).map((group) => String(group.id)));
  for (const [atriumId, list] of byAtrium) {
    if (liveIds.has(atriumId)) continue;
    const current = list[0];
    if (foldLabel(statutOf(current, binding)).startsWith('archiv')) {
      summary.unchanged.push(atriumId);
      continue;
    }
    summary.archived.push(atriumId);
    if (!dryRun && binding.bound.statut_synchro && current?.id) {
      const field = binding.bound.statut_synchro;
      const value = optionValue(field, 'archivé');
      await pause();
      await ghl(fetchImpl, apiKey, `/objects/${encodeURIComponent(GROUPES_SCHEMA_KEY)}/records/${encodeURIComponent(current.id)}`, {
        method: 'PUT',
        body: {
          locationId,
          properties: { [field.key]: value }
        }
      });
    }
  }

  if (!dryRun && statePath) {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  }
  return summary;
}

async function main() {
  loadEnvFile();
  const catalogPath = process.env.ATRIUM_CATALOG || process.env.ATRIUM_OUTPUT || join(__dirname, '..', 'reservation-api', 'groupes.json');
  if (!existsSync(catalogPath)) throw new Error(`Catalogue introuvable: ${catalogPath}`);
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const dryRun = dryRunEnabled();
  const summary = await pushGroupes({
    catalog,
    apiKey: process.env.GHL_API_KEY || '',
    locationId: process.env.GHL_LOCATION_ID || '',
    origin: process.env.GROUPES_PUBLIC_ORIGIN || 'https://aubaineexpress.voyagefiesta.ca',
    dryRun,
    statePath: process.env.GHL_GROUPE_STATE || join(dirname(catalogPath), 'groupes-ghl-state.json'),
    throttleMs: Number(process.env.GHL_GROUPE_THROTTLE_MS || 250)
  });
  console.log(`[groupes-ghl] dry=${summary.dryRun} schema=${summary.schemaCount} liés=${summary.bound.length} créer=${summary.created.length} maj=${summary.updated.length} inchangés=${summary.unchanged.length} archivés=${summary.archived.length} doublons=${summary.duplicates.length}`);
  console.log(`[groupes-ghl] analyse ${JSON.stringify(summary.analysis)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`[groupes-ghl] ${error.message}`);
    process.exit(1);
  });
}
