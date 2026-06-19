#!/usr/bin/env node
/**
 * Sync GoHighLevel Custom Object records → products.json
 * Mirrors GHL file uploads to assets/forfaits/ for public GitHub Pages hosting.
 *
 * Required env vars:
 *   GHL_API_KEY
 *   GHL_LOCATION_ID
 *   GHL_OBJECT_SCHEMA_KEY  (e.g. custom_objects.forfaits_voyage)
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT = resolve(ROOT, 'products.json');
const IMAGES_DIR = resolve(ROOT, 'assets', 'forfaits');
const MANIFEST_PATH = resolve(IMAGES_DIR, '.manifest.json');
const API_BASE = 'https://services.leadconnectorhq.com';
const PAGE_LIMIT = 100;

const VISIBLE_STATES = new Set(['actif', 'complet_sold_out']);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function pick(props, ...keys) {
  for (const key of keys) {
    const val = props[key];
    if (val !== undefined && val !== null && val !== '') return val;
  }
  return undefined;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDateField(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (item === undefined || item === null || item === '') return '';
        if (typeof item === 'object') {
          return item.value ?? item.key ?? item.id ?? item.label ?? item.name ?? '';
        }
        return String(item);
      })
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return toStringArray(parsed);
      } catch (_) {
        /* fall through */
      }
    }
    return trimmed.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function rawStateValue(raw) {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw === 'object') {
    return raw.value ?? raw.key ?? raw.id ?? raw.label ?? raw.name ?? '';
  }
  return String(raw);
}

/** Map GHL dropdown labels/keys → site state values */
function normalizeState(raw) {
  const s = rawStateValue(raw).toLowerCase().trim();
  if (!s) return 'brouillon';

  if (s === 'actif' || s === 'active') return 'actif';
  if (s === 'brouillon' || s === 'draft') return 'brouillon';
  if (s === 'complet_sold_out' || s === 'complet-sold-out') return 'complet_sold_out';
  if (s === 'archiv' || s === 'archive' || s === 'archivé' || s === 'archivé') return 'archiv';

  if (/sold\s*out|complet\s*\(|complet.*sold|épuisé|epuise/.test(s)) return 'complet_sold_out';
  if (/^complet$|complet\s*-/.test(s)) return 'complet_sold_out';
  if (/brouillon|draft/.test(s)) return 'brouillon';
  if (/archiv|archive/.test(s)) return 'archiv';
  if (/actif|active|publié|publie/.test(s)) return 'actif';

  return s.replace(/[^a-z0-9]+/g, '_');
}

function resolveMediaUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = resolveMediaUrl(item);
      if (url) return url;
    }
    return '';
  }
  if (typeof value === 'object' && typeof value.url === 'string') {
    return value.url.trim();
  }
  return '';
}

function extractFileMeta(value) {
  if (Array.isArray(value) && value[0] && typeof value[0] === 'object') {
    return value[0].meta || {};
  }
  if (value && typeof value === 'object' && value.meta) {
    return value.meta;
  }
  return {};
}

function isPublicHttpUrl(url) {
  return Boolean(url && /^https?:\/\//i.test(url));
}

function isGhlPrivateUrl(url) {
  return /msgsndr-private\.storage\.googleapis\.com|highlevel-private.*\.storage\.googleapis\.com/i.test(url || '');
}

function fileExtension(sourceUrl, meta) {
  const fromMeta = String(meta?.extension || '').replace(/^\./, '').toLowerCase();
  if (fromMeta && /^[a-z0-9]+$/i.test(fromMeta)) return fromMeta;
  const fromUrl = (sourceUrl.match(/\.([a-z0-9]{2,5})(?:\?|$)/i) || [])[1];
  if (fromUrl) return fromUrl.toLowerCase();
  return 'jpg';
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return {};
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (_) {
    return {};
  }
}

function saveManifest(manifest) {
  mkdirSync(IMAGES_DIR, { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

async function downloadGhlFile(apiKey, sourceUrl) {
  const attempts = [
    { Authorization: `Bearer ${apiKey}`, Accept: '*/*' },
    { Accept: '*/*' }
  ];

  let lastError = '';
  for (const headers of attempts) {
    const res = await fetch(sourceUrl, { headers, redirect: 'follow' });
    if (res.ok) {
      return Buffer.from(await res.arrayBuffer());
    }
    lastError = `${res.status} ${res.statusText}`;
  }
  throw new Error(`Download failed (${lastError})`);
}

async function mirrorImageField({ apiKey, slug, field, uploadValue, urlOverride, manifest }) {
  const override = typeof urlOverride === 'string' ? urlOverride.trim() : '';
  if (override && isPublicHttpUrl(override) && !isGhlPrivateUrl(override)) {
    return override;
  }

  const sourceUrl = resolveMediaUrl(uploadValue);
  if (!sourceUrl) return '';

  if (isPublicHttpUrl(sourceUrl) && !isGhlPrivateUrl(sourceUrl)) {
    return sourceUrl;
  }

  if (!isGhlPrivateUrl(sourceUrl)) {
    return sourceUrl;
  }

  const meta = extractFileMeta(uploadValue);
  const ext = fileExtension(sourceUrl, meta);
  const relativePath = `assets/forfaits/${slug}-${field}.${ext}`;
  const absolutePath = resolve(ROOT, relativePath);
  const sourceHash = createHash('sha256').update(sourceUrl).digest('hex');

  if (manifest[relativePath] === sourceHash && existsSync(absolutePath)) {
    return relativePath;
  }

  mkdirSync(IMAGES_DIR, { recursive: true });
  const bytes = await downloadGhlFile(apiKey, sourceUrl);
  writeFileSync(absolutePath, bytes);
  manifest[relativePath] = sourceHash;
  console.log(`  Mirrored image: ${relativePath}`);
  return relativePath;
}

async function mapRecord(record, apiKey, manifest) {
  const props = record.properties || record.fields || record;
  const state = normalizeState(pick(props, 'state', 'status'));
  const active = state;

  const name = pick(props, 'name', 'title', 'forfait_name') || 'Forfait sans nom';
  const slug = pick(props, 'slug') || slugify(name);
  const subDest = pick(props, 'sub_dest', 'subDest', 'sub_destination', 'city') || '';
  const destination1 = pick(props, 'destination1', 'destination', 'dest_destination') || subDest;

  const criteria = toStringArray(pick(props, 'criteria', 'criteres', 'tags'));
  const seoTags = toStringArray(pick(props, 'seo_tags', 'seoTags', 'seo'));

  let endDate = normalizeDateField(pick(props, 'end_date', 'endDate', 'top_chrono_end'));
  const departureDate = normalizeDateField(
    pick(props, 'departure_date', 'departureDate', 'date_de_depart', 'dateDepart')
  );

  const imgUpload = pick(props, 'img', 'image', 'main_image', 'photo');
  const imgRoomUpload = pick(props, 'img_room', 'imgRoom', 'room_image');
  const imgExtraUpload = pick(props, 'img_extra', 'imgExtra', 'extra_image');

  const img = await mirrorImageField({
    apiKey,
    slug,
    field: 'img',
    uploadValue: imgUpload,
    urlOverride: pick(props, 'img_url', 'image_url'),
    manifest
  });
  const imgRoom = await mirrorImageField({
    apiKey,
    slug,
    field: 'room',
    uploadValue: imgRoomUpload,
    urlOverride: pick(props, 'img_room_url'),
    manifest
  });
  const imgExtra = await mirrorImageField({
    apiKey,
    slug,
    field: 'extra',
    uploadValue: imgExtraUpload,
    urlOverride: pick(props, 'img_extra_url'),
    manifest
  });

  return {
    id: record.id || pick(props, 'id') || slug,
    slug,
    name,
    state,
    active,
    destTag: pick(props, 'dest_tag', 'destTag', 'region') || '',
    subDest,
    destination1,
    destination: destination1,
    country: pick(props, 'country', 'pays') || '',
    location: pick(props, 'location', 'address', 'adresse') || '',
    stars: toNumber(pick(props, 'stars', 'star_rating'), 0),
    supplier: pick(props, 'supplier', 'fournisseur') || '',
    carrier: pick(props, 'carrier', 'transporteur') || '',
    durationNights: toNumber(pick(props, 'duration_nights', 'durationNights'), 7),
    roomCategory: pick(props, 'room_category', 'roomCategory', 'chambre') || '',
    criteria,
    inventory: state === 'complet_sold_out' ? 0 : toNumber(pick(props, 'inventory', 'stock'), 0),
    price: toNumber(pick(props, 'price', 'prix'), 0),
    packageType: pick(props, 'package_type', 'packageType', 'forfait_type') || '',
    endDate,
    departureDate,
    departureAirport: pick(props, 'departure_airport', 'departureAirport', 'airport') || 'Montréal (YUL)',
    img,
    imgRoom: imgRoom || img,
    imgExtra: imgExtra || img,
    seoTags
  };
}

async function ghlSearchRecords({ apiKey, locationId, schemaKey, page, searchAfter }) {
  const url = `${API_BASE}/objects/${encodeURIComponent(schemaKey)}/records/search`;
  const body = {
    locationId,
    page,
    pageLimit: PAGE_LIMIT
  };
  if (searchAfter) body.searchAfter = searchAfter;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: '2021-07-28'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL API ${res.status}: ${text}`);
  }

  return res.json();
}

async function fetchAllRecords(credentials) {
  const all = [];
  let page = 1;
  let searchAfter = undefined;
  let total = Infinity;

  while (all.length < total) {
    const data = await ghlSearchRecords({ ...credentials, page, searchAfter });
    const records = data.records || data.data || [];
    total = data.total ?? records.length;
    all.push(...records);

    if (records.length < PAGE_LIMIT || all.length >= total) break;

    searchAfter = data.searchAfter || data.nextSearchAfter;
    page += 1;

    if (!searchAfter && records.length === PAGE_LIMIT) {
      continue;
    }
    if (!searchAfter) break;
  }

  return all;
}

async function main() {
  const apiKey = requireEnv('GHL_API_KEY');
  const locationId = requireEnv('GHL_LOCATION_ID');
  const schemaKey = requireEnv('GHL_OBJECT_SCHEMA_KEY');

  console.log(`Fetching records from ${schemaKey}...`);
  const records = await fetchAllRecords({ apiKey, locationId, schemaKey });
  console.log(`Fetched ${records.length} raw record(s).`);

  const manifest = loadManifest();
  const products = [];

  for (const record of records) {
    const product = await mapRecord(record, apiKey, manifest);
    if (VISIBLE_STATES.has(product.state)) {
      products.push(product);
    }
  }

  products.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  saveManifest(manifest);

  const payload = {
    updatedAt: new Date().toISOString(),
    source: 'ghl',
    schemaKey,
    locationId,
    products
  };

  writeFileSync(OUTPUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${products.length} product(s) to ${OUTPUT}`);
  console.log(`  actif: ${products.filter(p => p.active === 'actif').length}`);
  console.log(`  complet_sold_out: ${products.filter(p => p.active === 'complet_sold_out').length}`);
}

main().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
