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

function unwrapFieldValue(value) {
  if (value === undefined || value === null || value === '') return value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const inner = value.value ?? value.amount ?? value.number ?? value.val;
    if (inner !== undefined && inner !== null && inner !== '') return inner;
  }
  return value;
}

function normalizeExternalUrl(value) {
  if (value === undefined || value === null || value === '') return null;
  const url = String(value).trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^\/\//.test(url)) return 'https:' + url;
  return 'https://' + url;
}

function optionalPrice(value) {
  value = unwrapFieldValue(value);
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/\s/g, '').replace(/\$/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function optionalTaxAmount(value) {
  value = unwrapFieldValue(value);
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/\s/g, '').replace(/\$/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** GHL met parfois le prix double+1 enfant dans price_occ_simple_1_child. */
function normalizeOccupationPriceFields(product) {
  const p = { ...product };
  const doublePrice = optionalPrice(p.price);
  const double1 = optionalPrice(p.priceOccDouble1Child);
  const simple1 = optionalPrice(p.priceOccSimple1Child);

  if (double1 === null && simple1 !== null && doublePrice !== null && simple1 > doublePrice) {
    p.priceOccDouble1Child = simple1;
    p.priceOccSimple1Child = null;
  }

  return p;
}

const LEGACY_TAX_OCC_KEYS = [
  'taxesOccDouble',
  'taxesOccDouble1Child',
  'taxesOccDouble2Child',
  'taxesOccSimple',
  'taxesOccSimple1Child',
  'taxesOccTriple',
  'taxesOccQuad',
  'taxesOccAutres'
];

function clearLegacyTaxOccFields(product) {
  if (product.taxesAmount == null) return product;
  const cleared = { ...product };
  for (const key of LEGACY_TAX_OCC_KEYS) cleared[key] = null;
  return cleared;
}

const OCCUPATION_PRICE_KEYS = [
  'priceOccSimple',
  'priceOccTriple',
  'priceOccDouble1Child',
  'priceOccDouble2Child',
  'priceOccSimple1Child',
  'priceOccQuad',
  'priceAutres'
];

/** Conserve les champs corrigés localement quand GHL envoie null ou un taux erroné. */
function mergeSyncOverrides(product, previous) {
  if (!previous) {
    return clearLegacyTaxOccFields(normalizeOccupationPriceFields(product));
  }

  let merged = normalizeOccupationPriceFields({ ...product });

  for (const key of OCCUPATION_PRICE_KEYS) {
    if (merged[key] == null && previous[key] != null) {
      merged[key] = previous[key];
    }
  }

  const syncedTax = merged.taxesAmount;
  const prevTax = previous.taxesAmount;
  if (prevTax != null) {
    if (syncedTax == null) {
      merged.taxesAmount = prevTax;
    } else if (Math.abs(syncedTax - prevTax) >= 0.01) {
      if (Math.abs(syncedTax * 2 - prevTax) < 0.01) merged.taxesAmount = prevTax;
      else if (Math.abs(syncedTax - prevTax * 2) < 0.01) merged.taxesAmount = prevTax;
    }
  }

  return clearLegacyTaxOccFields(merged);
}

function resolveTaxesAmountPerPerson(props) {
  const direct = optionalTaxAmount(pick(props, 'taxes_amount', 'taxesAmount'));
  if (direct !== null) return direct;

  const doubleLegacy = optionalPrice(pick(props, 'taxes_occ_double', 'taxesOccDouble'));
  if (doubleLegacy !== null) return Math.round(doubleLegacy / 2 * 100) / 100;

  return null;
}

/** taxes_amount ($/pers.) prime — legacy taxes_occ_* ignorés quand présent. */
function applyTaxFields(props) {
  const taxesAmount = resolveTaxesAmountPerPerson(props);
  const legacy = taxesAmount === null
    ? {
        taxesOccDouble: optionalPrice(pick(props, 'taxes_occ_double', 'taxesOccDouble')),
        taxesOccDouble1Child: optionalPrice(
          pick(props, 'taxes_occ_double_1_child', 'taxesOccDouble1Child')
        ),
        taxesOccDouble2Child: optionalPrice(
          pick(props, 'taxes_occ_double_2_child', 'taxesOccDouble2Child')
        ),
        taxesOccSimple: optionalPrice(pick(props, 'taxes_occ_simple', 'taxesOccSimple')),
        taxesOccSimple1Child: optionalPrice(
          pick(props, 'taxes_occ_simple_1_child', 'taxesOccSimple1Child')
        ),
        taxesOccTriple: optionalPrice(pick(props, 'taxes_occ_triple', 'taxesOccTriple')),
        taxesOccQuad: optionalPrice(pick(props, 'taxes_occ_quad', 'taxesOccQuad')),
        taxesOccAutres: optionalPrice(pick(props, 'taxes_occ_autres', 'taxesOccAutres'))
      }
    : {
        taxesOccDouble: null,
        taxesOccDouble1Child: null,
        taxesOccDouble2Child: null,
        taxesOccSimple: null,
        taxesOccSimple1Child: null,
        taxesOccTriple: null,
        taxesOccQuad: null,
        taxesOccAutres: null
      };

  return { taxesAmount, ...legacy };
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStars(value, fallback = 0) {
  const raw = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n * 2) / 2;
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

function deriveReturnDateIso(departureDateIso, durationNights) {
  if (!departureDateIso || durationNights === undefined || durationNights === null) return null;
  const nights = Number(durationNights);
  if (!Number.isFinite(nights) || nights <= 0) return null;
  const d = new Date(departureDateIso);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + nights);
  return d.toISOString();
}

function buildLocationText(subDest, country) {
  return [subDest, country].filter(Boolean).join(', ') || '';
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

function normalizeExplicitSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSlug(value, fallback = 'forfait') {
  const slug = slugify(value);
  return slug || fallback;
}

function getRecordId(record, props) {
  return String(record.id || pick(props, 'id') || '').trim();
}

function loadPreviousSlugById() {
  try {
    if (!existsSync(OUTPUT)) return {};
    const data = JSON.parse(readFileSync(OUTPUT, 'utf8'));
    const map = {};
    for (const product of data.products || []) {
      if (product.id && product.slug) map[product.id] = product.slug;
    }
    return map;
  } catch {
    return {};
  }
}

function loadPreviousProductsById() {
  try {
    if (!existsSync(OUTPUT)) return {};
    const data = JSON.parse(readFileSync(OUTPUT, 'utf8'));
    const map = {};
    for (const product of data.products || []) {
      if (product.id) map[product.id] = product;
    }
    return map;
  } catch {
    return {};
  }
}

/** Slug URL stable par enregistrement GHL; dérivé du nom si absent, suffixe -2, -3 si collision. */
function assignSlugs(records, previousSlugById = {}) {
  const used = new Set();
  const assignments = new Map();

  const sorted = [...records].sort((a, b) => {
    const propsA = a.properties || a.fields || a;
    const propsB = b.properties || b.fields || b;
    const idA = getRecordId(a, propsA);
    const idB = getRecordId(b, propsB);
    if (idA && idB) return idA.localeCompare(idB);
    const nameA = pick(propsA, 'name', 'title', 'forfait_name') || '';
    const nameB = pick(propsB, 'name', 'title', 'forfait_name') || '';
    return nameA.localeCompare(nameB, 'fr');
  });

  const reserveSlug = (raw, { fromName = false } = {}) => {
    let base = fromName
      ? normalizeSlug(raw)
      : (normalizeExplicitSlug(raw) || normalizeSlug(raw));
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  };

  for (const record of sorted) {
    const props = record.properties || record.fields || record;
    const recordId = getRecordId(record, props);
    const name = pick(props, 'name', 'title', 'forfait_name') || 'Forfait sans nom';
    const departureDate = normalizeDateField(
      pick(props, 'departure_date', 'departureDate', 'date_de_depart', 'dateDepart')
    );
    const mapKey = recordId || `__name__:${normalizeSlug(name)}`;

    if (recordId && previousSlugById[recordId]) {
      assignments.set(mapKey, reserveSlug(previousSlugById[recordId]));
      continue;
    }

    assignments.set(mapKey, reserveSlug(buildAutoSlugBase(name, departureDate)));
  }

  return assignments;
}

function buildAutoSlugBase(name, departureDateIso) {
  const namePart = normalizeSlug(name) || 'forfait';
  if (!departureDateIso) return namePart;
  const d = new Date(departureDateIso);
  if (Number.isNaN(d.getTime())) return namePart;
  return `${namePart}-${d.toISOString().slice(0, 10)}`;
}

/** Correct known GHL destination slug typos → canonical value */
function normalizeDestination1(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  const key = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (key === 'jamaque') return 'jamaïque';
  return raw;
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

function normalizeUploadList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {
        /* fall through */
      }
    }
    return trimmed.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  }
  return [value];
}

async function mirrorGalleryImages({ apiKey, slug, uploadValue, manifest }) {
  const paths = [];
  const items = normalizeUploadList(uploadValue);
  for (let i = 0; i < items.length; i++) {
    const path = await mirrorImageField({
      apiKey,
      slug,
      field: `gallery-${i + 1}`,
      uploadValue: items[i],
      manifest
    });
    if (path && !paths.includes(path)) paths.push(path);
  }
  return paths;
}

function uniqueImagePaths(...groups) {
  const seen = new Set();
  const list = [];
  for (const group of groups) {
    const items = Array.isArray(group) ? group : [group];
    for (const item of items) {
      if (item && !seen.has(item)) {
        seen.add(item);
        list.push(item);
      }
    }
  }
  return list;
}

function pickText(props, ...keys) {
  const val = pick(props, ...keys);
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

function pickFlightDate(props, ...keys) {
  const raw = pick(props, ...keys);
  if (!raw) return '';
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? String(raw).trim() : parsed.toISOString();
}

function mapFlightLeg(props, prefix, aliases = {}) {
  return {
    from: pickText(props, `${prefix}_from`, aliases.from) || '',
    departDate: pickFlightDate(props, `${prefix}_depart_date`, aliases.departDate) || '',
    departTime: pickText(props, `${prefix}_depart_time`, aliases.departTime) || '',
    to: pickText(props, `${prefix}_to`, aliases.to) || '',
    arriveDate: pickFlightDate(props, `${prefix}_arrive_date`, aliases.arriveDate) || '',
    arriveTime: pickText(props, `${prefix}_arrive_time`, aliases.arriveTime) || '',
    number: pickText(props, `${prefix}_number`, aliases.number) || ''
  };
}

function mapFlights(props) {
  return {
    out: mapFlightLeg(props, 'flight_out', {
      from: 'vol_aller_depart',
      departDate: 'vol_aller_date_depart',
      departTime: 'vol_aller_heure_depart',
      to: 'vol_aller_arrivee',
      arriveDate: 'vol_aller_date_arrivee',
      arriveTime: 'vol_aller_heure_arrivee',
      number: 'vol_aller_numero'
    }),
    return: mapFlightLeg(props, 'flight_return', {
      from: 'vol_retour_depart',
      departDate: 'vol_retour_date_depart',
      departTime: 'vol_retour_heure_depart',
      to: 'vol_retour_arrivee',
      arriveDate: 'vol_retour_date_arrivee',
      arriveTime: 'vol_retour_heure_arrivee',
      number: 'vol_retour_numero'
    }),
    airlineLogo: pickText(props, 'flight_airline_logo', 'vol_compagnie_logo') || ''
  };
}

async function mapRecord(record, apiKey, manifest, slug) {
  const props = record.properties || record.fields || record;
  const state = normalizeState(pick(props, 'state', 'status'));
  const active = state;

  const name = pick(props, 'name', 'title', 'forfait_name') || 'Forfait sans nom';
  const subDest = pick(props, 'sub_dest', 'subDest', 'sub_destination', 'city') || '';
  const durationNights = toNumber(pick(props, 'duration_nights', 'durationNights'), 7);
  const departureDate = normalizeDateField(
    pick(props, 'departure_date', 'departureDate', 'date_de_depart', 'dateDepart')
  );
  const resolvedSlug = slug
    ? (normalizeExplicitSlug(slug) || normalizeSlug(slug))
    : buildAutoSlugBase(name, departureDate);
  const destination1 = normalizeDestination1(
    pick(props, 'destination1', 'destination', 'dest_destination') || subDest
  );

  const criteria = toStringArray(pick(props, 'criteria', 'criteres', 'tags'));
  const seoTags = toStringArray(pick(props, 'seo_tags', 'seoTags', 'seo'));

  let endDate = normalizeDateField(pick(props, 'end_date', 'endDate', 'top_chrono_end'));
  const returnDate = normalizeDateField(pick(props, 'return_date', 'returnDate', 'date_retour'))
    || deriveReturnDateIso(departureDate, durationNights);

  const country = pick(props, 'country', 'pays') || '';
  const supplier = pick(props, 'supplier', 'fournisseur') || '';
  const carrier = pick(props, 'carrier', 'transporteur') || '';
  const location = pick(props, 'location', 'address', 'adresse') || buildLocationText(subDest, country);

  const imgUpload = pick(props, 'img', 'image', 'main_image', 'photo');
  const imgRoomUpload = pick(props, 'img_room', 'imgRoom', 'room_image');
  const imgExtraUpload = pick(props, 'img_extra', 'imgExtra', 'extra_image');

  const img = await mirrorImageField({
    apiKey,
    slug: resolvedSlug,
    field: 'img',
    uploadValue: imgUpload,
    urlOverride: pick(props, 'img_url', 'image_url'),
    manifest
  });
  const imgRoom = await mirrorImageField({
    apiKey,
    slug: resolvedSlug,
    field: 'room',
    uploadValue: imgRoomUpload,
    urlOverride: pick(props, 'img_room_url'),
    manifest
  });
  const imgExtra = await mirrorImageField({
    apiKey,
    slug: resolvedSlug,
    field: 'extra',
    uploadValue: imgExtraUpload,
    urlOverride: pick(props, 'img_extra_url'),
    manifest
  });
  const imgGalleryUpload = pick(props, 'img_gallery', 'gallery', 'photos', 'images');
  const galleryPaths = await mirrorGalleryImages({
    apiKey,
    slug: resolvedSlug,
    uploadValue: imgGalleryUpload,
    manifest
  });
  const images = uniqueImagePaths([img], [imgRoom], [imgExtra], galleryPaths);
  const taxFields = applyTaxFields(props);

  return {
    id: record.id || pick(props, 'id') || resolvedSlug,
    slug: resolvedSlug,
    name,
    state,
    active,
    destTag: pick(props, 'dest_tag', 'destTag', 'region') || '',
    subDest,
    destination1,
    destination: destination1,
    country,
    location,
    stars: normalizeStars(pick(props, 'stars', 'star_rating'), 0),
    supplier,
    carrier,
    durationNights,
    roomCategory: pick(props, 'room_category', 'roomCategory', 'chambre') || '',
    criteria,
    inventory: state === 'complet_sold_out' ? 0 : toNumber(pick(props, 'inventory', 'stock'), 0),
    price: toNumber(pick(props, 'price', 'prix', 'price_occ_double'), 0),
    priceOccSimple: optionalPrice(pick(props, 'price_occ_simple', 'priceOccSimple')),
    priceOccTriple: optionalPrice(pick(props, 'price_occ_triple', 'priceOccTriple')),
    priceOccDouble1Child: optionalPrice(
      pick(props, 'price_occ_double_1_child', 'priceOccDouble1Child', 'price_double_1_child')
    ),
    priceOccDouble2Child: optionalPrice(
      pick(props, 'price_occ_double_2_child', 'priceOccDouble2Child', 'price_double_2_child')
    ),
    priceOccSimple1Child: optionalPrice(
      pick(props, 'price_occ_simple_1_child', 'priceOccSimple1Child', 'price_simple_1_child')
    ),
    priceOccQuad: optionalPrice(pick(props, 'price_occ_quad', 'priceOccQuad')),
    priceAutres: optionalPrice(pick(props, 'price_autres', 'priceAutres', 'price_occ_autres')),
    ...taxFields,
    discountAmount: optionalPrice(pick(props, 'discount_amount', 'discountAmount', 'rabais')),
    financingMonthly: optionalPrice(
      pick(props, 'financement_mensuel', 'financing_monthly', 'financingMonthly')
    ),
    depositAmount: optionalPrice(pick(props, 'deposit_amount', 'depositAmount')),
    finalPaymentDate: normalizeDateField(
      pick(props, 'final_payment_date', 'finalPaymentDate', 'date_paiement_final')
    ),
    returnDate,
    priceChild212: optionalPrice(pick(props, 'price_child_2_12', 'priceChild212', 'price_child_2_12_ans')),
    priceChild1317: optionalPrice(pick(props, 'price_child_13_17', 'priceChild1317', 'price_child_13_17_ans')),
    taxChild212: optionalPrice(pick(props, 'tax_child_2_12', 'taxChild212', 'tax_child_2_12_ans')),
    taxChild1317: optionalPrice(pick(props, 'tax_child_13_17', 'taxChild1317', 'tax_child_13_17_ans')),
    packageType: pick(props, 'package_type', 'packageType', 'forfait_type') || '',
    hotelDescription: pickText(props, 'hotel_description', 'hotelDescription', 'description_hotel'),
    forfaitLink: normalizeExternalUrl(pick(props, 'forfait_link', 'forfaitLink')),
    endDate,
    departureDate,
    departureAirport: pick(props, 'departure_airport', 'departureAirport', 'airport') || '',
    flights: mapFlights(props),
    img,
    imgRoom: imgRoom || img,
    imgExtra: imgExtra || img,
    images,
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
  const previousSlugById = loadPreviousSlugById();
  const previousProductsById = loadPreviousProductsById();
  const slugAssignments = assignSlugs(records, previousSlugById);
  const products = [];

  for (const record of records) {
    const props = record.properties || record.fields || record;
    const recordId = getRecordId(record, props);
    const name = pick(props, 'name', 'title', 'forfait_name') || 'Forfait sans nom';
    const mapKey = recordId || `__name__:${normalizeSlug(name)}`;
    const slug = slugAssignments.get(mapKey) || normalizeSlug(name);
    const rawProduct = await mapRecord(record, apiKey, manifest, slug);
    const product = mergeSyncOverrides(rawProduct, previousProductsById[recordId]);
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
