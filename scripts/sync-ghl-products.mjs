#!/usr/bin/env node
/**
 * Sync GoHighLevel Custom Object records → products.json
 *
 * Required env vars:
 *   GHL_API_KEY
 *   GHL_LOCATION_ID
 *   GHL_OBJECT_SCHEMA_KEY  (e.g. custom_objects.forfaits_voyage)
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT = resolve(ROOT, 'products.json');
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

function toStringArray(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
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

function normalizeState(raw) {
  if (!raw) return 'brouillon';
  return String(raw).toLowerCase().trim();
}

function mapRecord(record) {
  const props = record.properties || record.fields || record;
  const state = normalizeState(pick(props, 'state', 'status'));
  const active = state;

  const name = pick(props, 'name', 'title', 'forfait_name') || 'Forfait sans nom';
  const slug = pick(props, 'slug') || slugify(name);
  const subDest = pick(props, 'sub_dest', 'subDest', 'sub_destination', 'city') || '';
  const destination = pick(props, 'destination', 'dest_destination') || subDest;

  const criteria = toStringArray(pick(props, 'criteria', 'criteres', 'tags'));
  const seoTags = toStringArray(pick(props, 'seo_tags', 'seoTags', 'seo'));

  let endDate = pick(props, 'end_date', 'endDate', 'top_chrono_end');
  if (endDate && typeof endDate === 'number') {
    endDate = new Date(endDate).toISOString();
  } else if (endDate) {
    const parsed = new Date(endDate);
    endDate = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return {
    id: record.id || pick(props, 'id') || slug,
    slug,
    name,
    state,
    active,
    destTag: pick(props, 'dest_tag', 'destTag', 'region') || '',
    subDest,
    destination,
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
    departureAirport: pick(props, 'departure_airport', 'departureAirport', 'airport') || 'Montréal (YUL)',
    img: pick(props, 'img', 'image', 'main_image', 'photo') || '',
    imgRoom: pick(props, 'img_room', 'imgRoom', 'room_image') || '',
    imgExtra: pick(props, 'img_extra', 'imgExtra', 'extra_image') || '',
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
      /* paginate by page number when cursor absent */
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

  const products = records
    .map(mapRecord)
    .filter(p => VISIBLE_STATES.has(p.state))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

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
