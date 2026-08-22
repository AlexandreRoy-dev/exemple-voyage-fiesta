#!/usr/bin/env node
/**
 * Sync GoHighLevel Custom Object records → products.json
 * Mirrors GHL file uploads to assets/forfaits/ for public GitHub Pages hosting.
 *
 * Required env vars:
 * GHL_API_KEY (PIT: custom objects + users.readonly)
 * GHL_LOCATION_ID
 * GHL_OBJECT_SCHEMA_KEY (e.g. custom_objects.voyages)
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickVoyagesUnwrapped, pickRecordName, formatAeroportLabel } from './ghl-voyages-fields.mjs';
import { writeSharePages } from './share-pages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT = resolve(ROOT, 'products.json');
const AGENTS_OUTPUT = resolve(ROOT, 'agents.json');
const IMAGES_DIR = resolve(ROOT, 'assets', 'forfaits');
const MANIFEST_PATH = resolve(IMAGES_DIR, '.manifest.json');
const API_BASE = 'https://services.leadconnectorhq.com';
const PAGE_LIMIT = 100;

const VISIBLE_STATES = new Set(['actif', 'pre_vente', 'complet_sold_out', 'vendu']);

function requireEnv(name) {
 const value = process.env[name];
 if (!value) {
 console.error(`Missing required environment variable: ${name}`);
 process.exit(1);
 }
 return value;
}

function payloadWithoutUpdatedAt(data) {
 const { updatedAt, ...rest } = data || {};
 return rest;
}

/** Skip rewriting JSON when only updatedAt would change — avoids no-op bot commits. */
function writeJsonIfChanged(filePath, nextPayload) {
 const nextBody = JSON.stringify(nextPayload, null, 2) + '\n';
 if (existsSync(filePath)) {
  try {
   const previous = JSON.parse(readFileSync(filePath, 'utf8'));
   if (
    JSON.stringify(payloadWithoutUpdatedAt(previous)) ===
    JSON.stringify(payloadWithoutUpdatedAt(nextPayload))
   ) {
    console.log(`Unchanged (except updatedAt) — kept ${filePath}`);
    return false;
   }
  } catch {
   // Rewrite if the existing file is unreadable.
  }
 }
 writeFileSync(filePath, nextBody, 'utf8');
 return true;
}

function pick(props, ...keys) {
 for (const key of keys) {
 const val = props[key];
 if (val !== undefined && val !== null && val !== '') return val;
 }
 return undefined;
}

function pickProp(props, logicalKey, ...legacyKeys) {
 const voyagesVal = pickVoyagesUnwrapped(props, logicalKey);
 if (voyagesVal !== undefined && voyagesVal !== null && voyagesVal !== '') return voyagesVal;
 return pick(props, logicalKey, ...legacyKeys);
}

function pickUnwrapped(props, ...keys) {
 for (const key of keys) {
  const val = unwrapFieldValue(props[key]);
  if (val !== undefined && val !== null && val !== '') {
   const text = String(val).trim();
   if (text) return text;
  }
 }
 return '';
}

const PLACEHOLDER_PRODUCT_NAMES = new Set([
 'forfait sans nom',
 'forfait',
 'sans nom',
 'untitled',
 'sans titre'
]);

function isPlaceholderProductName(name) {
 const normalized = String(name || '').trim().toLowerCase();
 return !normalized || PLACEHOLDER_PRODUCT_NAMES.has(normalized);
}

/** Nom affiché — déballage GHL + repli sub_dest / destination. */
function resolveProductName(props) {
 const name = pickUnwrapped(
  props,
  'name',
  'title',
  'forfait_name',
  'hotel_name',
  'nom',
  'nom_du_forfait',
  'forfaits'
 );
 if (!isPlaceholderProductName(name)) return name;

 const subDest = pickUnwrapped(props, 'sub_dest', 'subDest', 'sub_destination', 'city');
 if (subDest) return subDest;

 const dest = pickUnwrapped(props, 'destination1', 'destination', 'dest_destination');
 if (dest) return dest;

 return '';
}

function isFallbackSlug(slug) {
 const s = String(slug || '').trim().toLowerCase();
 return /^forfait(?:-sans-nom)?(?:-\d+)?$/.test(s)
  || /^object(?:-object)?(?:-\d+)?$/.test(s);
}

function resolveRecordName(record, props) {
 return pickRecordName(record, props) || resolveProductName(props) || 'Forfait sans nom';
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

/**
 * GHL is the source of truth for aubaineexpress.voyagefiesta.ca.
 * Keep previous values only when GHL omits a field (null/empty).
 * Never block a non-null GHL taxesAmount (old half-tax lock caused stuck prices).
 */
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

 // Trust GHL whenever taxes are present; only retain previous if GHL left it empty.
 if (merged.taxesAmount == null && previous.taxesAmount != null) {
 merged.taxesAmount = previous.taxesAmount;
 }

 if (!merged.img && previous.img) merged.img = previous.img;
 if (!merged.imgRoom && previous.imgRoom) merged.imgRoom = previous.imgRoom;
 if (!merged.imgExtra && previous.imgExtra) merged.imgExtra = previous.imgExtra;
 if ((!Array.isArray(merged.images) || merged.images.length === 0) && Array.isArray(previous.images) && previous.images.length) {
 merged.images = previous.images;
 }

 return clearLegacyTaxOccFields(merged);
}

function resolveTaxesAmountPerPerson(props) {
 return optionalTaxAmount(
 pickProp(props, 'taxes_par_personne', 'taxes_amount', 'taxesAmount')
 );
}

/** Moyenne $ / pers. pour occupations famille (composantes enfant du nouvel objet Voyage). */
function computeOccupationPerPersonPrices(props) {
 const avg = (total, people) => {
 if (!Number.isFinite(total) || people <= 0) return null;
 return Math.round((total / people) * 100) / 100;
 };

 const prixDouble = optionalPrice(
 pickProp(props, 'prix_occ_double', 'price', 'price_occ_double', 'prix')
 );
 const prixSimple = optionalPrice(pickProp(props, 'prix_occ_simple', 'price_occ_simple', 'priceOccSimple'));
 const prixTriple = optionalPrice(pickProp(props, 'prix_occ_triple', 'price_occ_triple', 'priceOccTriple'));
 const prixQuad = optionalPrice(pickProp(props, 'prix_occ_quad', 'price_occ_quad', 'priceOccQuad'));
 const enfant1 = optionalPrice(
 pickProp(props, 'prix_1er_enfant_2_12', 'price_child_2_12', 'priceChild212')
 );
 const enfant2 = optionalPrice(pickProp(props, 'prix_2e_enfant_2_12'));
 const enfant1317_1 = optionalPrice(
 pickProp(props, 'prix_1er_enfant_13_17', 'price_child_13_17', 'priceChild1317')
 );
 const enfant1317_2 = optionalPrice(pickProp(props, 'prix_2e_enfant_13_17'));

 let priceOccDouble1Child = optionalPrice(
 pick(props, 'price_occ_double_1_child', 'priceOccDouble1Child', 'price_double_1_child')
 );
 let priceOccDouble2Child = optionalPrice(
 pick(props, 'price_occ_double_2_child', 'priceOccDouble2Child', 'price_double_2_child')
 );
 let priceOccSimple1Child = optionalPrice(
 pick(props, 'price_occ_simple_1_child', 'priceOccSimple1Child', 'price_simple_1_child')
 );
 let priceOccDouble1Child1317 = optionalPrice(
 pick(props, 'price_occ_double_1_child_13_17', 'priceOccDouble1Child1317')
 );
 let priceOccDouble2Child1317 = optionalPrice(
 pick(props, 'price_occ_double_2_child_13_17', 'priceOccDouble2Child1317')
 );
 let priceOccSimple1Child1317 = optionalPrice(
 pick(props, 'price_occ_simple_1_child_13_17', 'priceOccSimple1Child1317')
 );

 // Tarifs enfant unitaires → le site compose adulte + nb enfants; ne pas générer les occ. « + enfant ».
 const hasChildUnitPricing = enfant1 !== null || enfant1317_1 !== null;
 if (!hasChildUnitPricing) {
 if (priceOccDouble1Child === null && prixDouble !== null && enfant1 !== null) {
 priceOccDouble1Child = avg(2 * prixDouble + enfant1, 3);
 }
 if (priceOccDouble2Child === null && prixDouble !== null && enfant1 !== null && enfant2 !== null) {
 priceOccDouble2Child = avg(2 * prixDouble + enfant1 + enfant2, 4);
 }
 if (priceOccSimple1Child === null && prixSimple !== null && enfant1 !== null) {
 priceOccSimple1Child = avg(prixSimple + enfant1, 2);
 }
 if (priceOccDouble1Child1317 === null && prixDouble !== null && enfant1317_1 !== null) {
 priceOccDouble1Child1317 = avg(2 * prixDouble + enfant1317_1, 3);
 }
 if (priceOccDouble2Child1317 === null && prixDouble !== null && enfant1317_1 !== null && enfant1317_2 !== null) {
 priceOccDouble2Child1317 = avg(2 * prixDouble + enfant1317_1 + enfant1317_2, 4);
 }
 if (priceOccSimple1Child1317 === null && prixSimple !== null && enfant1317_1 !== null) {
 priceOccSimple1Child1317 = avg(prixSimple + enfant1317_1, 2);
 }
 }

 return {
 prixDouble,
 prixSimple,
 prixTriple,
 prixQuad,
 priceOccDouble1Child,
 priceOccDouble2Child,
 priceOccSimple1Child,
 priceOccDouble1Child1317,
 priceOccDouble2Child1317,
 priceOccSimple1Child1317,
 priceChild212: enfant1,
 priceChild1317: enfant1317_1,
 priceChild2Minus: optionalPrice(pickProp(props, 'prix_enfant_2_moins'))
 };
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

/** Native GHL Owner on custom object records → first user id. */
function extractOwnerId(record, props = {}) {
 const candidates = [
  record?.owners,
  record?.owner,
  props?.owners,
  props?.owner,
  props?.assignedTo,
  props?.assigned_to
 ];
 for (const c of candidates) {
  if (c === undefined || c === null || c === '') continue;
  if (Array.isArray(c) && c.length) {
   const first = c[0];
   if (typeof first === 'string' && first.trim()) return first.trim();
   if (first && typeof first === 'object') {
    const id = String(first.id || first.userId || first.value || '').trim();
    if (id) return id;
   }
   continue;
  }
  if (typeof c === 'string' && c.trim()) return c.trim();
  if (typeof c === 'object') {
   const id = String(c.id || c.userId || c.value || '').trim();
   if (id) return id;
  }
 }
 return '';
}

async function fetchGhlUser(apiKey, userId) {
 const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
  method: 'GET',
  headers: {
   Authorization: `Bearer ${apiKey}`,
   Accept: 'application/json',
   Version: '2021-07-28'
  }
 });
 if (!res.ok) {
  const text = await res.text();
  console.warn(` users/${userId}: HTTP ${res.status} — ${text.slice(0, 180)}`);
  return null;
 }
 const data = await res.json();
 return data.user || data;
}

function reserveAgentSlug(base, userId, usedSlugs) {
 let slug = base || slugify(String(userId || '').slice(0, 8)) || 'agent';
 if (!usedSlugs.has(slug)) {
  usedSlugs.add(slug);
  return slug;
 }
 const suffix = slugify(String(userId || '').slice(-4)) || String(userId || '').slice(-4).toLowerCase();
 slug = `${base}-${suffix}`;
 let n = 2;
 while (usedSlugs.has(slug)) {
  slug = `${base}-${suffix || n}-${n}`;
  n += 1;
 }
 usedSlugs.add(slug);
 return slug;
}

function buildOwnerProfile(user, userId, usedSlugs) {
 const first = String(user?.firstName || user?.first_name || '').trim();
 const last = String(user?.lastName || user?.last_name || '').trim();
 const nameFromParts = [first, last].filter(Boolean).join(' ');
 const name = nameFromParts
  || String(user?.name || user?.fullName || user?.email || '').trim()
  || userId;
 const base = slugify(nameFromParts) || slugify(name) || '';
 const slug = reserveAgentSlug(base, userId, usedSlugs);
 return {
  id: userId,
  name,
  email: String(user?.email || '').trim(),
  phone: String(user?.phone || user?.phoneNumber || user?.mobilePhone || '').trim(),
  slug
 };
}

/**
 * Resolve Owner → GHL user profile (cached per sync run).
 * Requires PIT scope users.readonly.
 */
async function resolveOwnerProfile(apiKey, record, props, cache, usedSlugs) {
 const ownerId = extractOwnerId(record, props);
 if (!ownerId) return null;
 if (cache.has(ownerId)) return cache.get(ownerId);
 const user = await fetchGhlUser(apiKey, ownerId);
 const profile = buildOwnerProfile(user || {}, ownerId, usedSlugs);
 cache.set(ownerId, profile);
 return profile;
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

function buildAutoSlugBase(name, departureDateIso) {
 const namePart = normalizeSlug(name) || 'forfait';
 if (!departureDateIso) return namePart;
 const d = new Date(departureDateIso);
 if (Number.isNaN(d.getTime())) return namePart;
 return `${namePart}-${d.toISOString().slice(0, 10)}`;
}

/** Slug canonique : nom (ou sub_dest) + date de départ YYYY-MM-DD. */
function buildAutoSlugFromProps(props, departureDateIso, recordId = '') {
 let name = resolveProductName(props);
 if (isPlaceholderProductName(name) && recordId) {
  name = `forfait-${recordId.slice(-8).toLowerCase()}`;
 }
 if (isPlaceholderProductName(name)) name = 'forfait';
 return buildAutoSlugBase(name, departureDateIso);
}

function reserveUniqueSlug(raw, used, { fromName = false } = {}) {
 let base = fromName
  ? normalizeSlug(raw)
  : (normalizeExplicitSlug(raw) || normalizeSlug(raw));
 if (!base) base = 'forfait';
 let candidate = base;
 let suffix = 2;
 while (used.has(candidate.toLowerCase())) {
  candidate = `${base}-${suffix}`;
  suffix += 1;
 }
 used.add(candidate.toLowerCase());
 return candidate;
}

/** Slug URL stable par enregistrement GHL; nom + date_depart; suffixe -2 si collision. */
function assignSlugs(records, previousSlugById = {}) {
 const used = new Set();
 const assignments = new Map();

 const sorted = [...records].sort((a, b) => {
  const propsA = a.properties || a.fields || a;
  const propsB = b.properties || b.fields || b;
  const idA = getRecordId(a, propsA);
  const idB = getRecordId(b, propsB);
  if (idA && idB) return idA.localeCompare(idB);
  const nameA = resolveProductName(propsA) || '';
  const nameB = resolveProductName(propsB) || '';
  return nameA.localeCompare(nameB, 'fr');
 });

 for (const record of sorted) {
  const props = record.properties || record.fields || record;
  const recordId = getRecordId(record, props);
  const departureDate = normalizeDateField(
   pickProp(props, 'date_depart', 'departure_date', 'departureDate', 'date_de_depart', 'dateDepart')
  );
  const mapKey = recordId || `__name__:${normalizeSlug(resolveProductName(props) || 'unknown')}`;
  const ideal = buildAutoSlugFromProps(props, departureDate, recordId);
  const previous = recordId ? previousSlugById[recordId] : '';

  if (previous && !isFallbackSlug(previous) && previous.toLowerCase() === ideal.toLowerCase()) {
   assignments.set(mapKey, reserveUniqueSlug(previous, used));
   continue;
  }

  if (previous && !isFallbackSlug(previous) && isFallbackSlug(ideal)) {
   assignments.set(mapKey, reserveUniqueSlug(previous, used));
   continue;
  }

  assignments.set(mapKey, reserveUniqueSlug(ideal, used, { fromName: true }));
 }

 return assignments;
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

 if (s === 'inactif' || s === 'inactive') return 'inactif';
 if (s === 'actif' || s === 'active') return 'actif';
 // GHL option keys strip accents (Prévente → prvente), same as montral / europen
 if (
  s === 'pre_vente'
  || s === 'pre-vente'
  || s === 'prevente'
  || s === 'prvente'
  || s === 'pr_vente'
 ) return 'pre_vente';
 if (s === 'brouillon' || s === 'draft') return 'brouillon';
 if (s === 'complet_sold_out' || s === 'complet-sold-out') return 'complet_sold_out';
 if (s === 'vendu' || s === 'vendue') return 'vendu';
 if (s === 'archiv' || s === 'archive' || s === 'archivé' || s === 'archivé') return 'archiv';

 if (/^vendu|vendue/.test(s)) return 'vendu';

 if (/sold\s*out|complet\s*\(|complet.*sold|épuisé|epuise/.test(s)) return 'complet_sold_out';
 if (/^complet$|complet\s*-/.test(s)) return 'complet_sold_out';
 // [eé]? : GHL « Prévente » → prvente (accented letter dropped, not é→e)
 if (/pr[eé]?[\s_-]?vente|pre[\s_]?sale/.test(s)) return 'pre_vente';
 if (/brouillon|draft/.test(s)) return 'brouillon';
 if (/archiv|archive/.test(s)) return 'archiv';
 // Word-boundary: avoid matching « actif » inside « inactif »
 if (/(^|[^a-z])(inactif|inactive)([^a-z]|$)/.test(` ${s} `)) return 'inactif';
 if (/(^|[^a-z])(actif|active|publié|publie)([^a-z]|$)/.test(` ${s} `)) return 'actif';

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
 console.log(` Mirrored image: ${relativePath}`);
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

async function mirrorGalleryImages({ apiKey, slug, uploadValue, manifest, fieldPrefix = 'gallery' }) {
 const paths = [];
 const items = normalizeUploadList(uploadValue);
 for (let i = 0; i < items.length; i++) {
 const path = await mirrorImageField({
 apiKey,
 slug,
 field: `${fieldPrefix}-${i + 1}`,
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

function extractIataCode(value) {
 const raw = String(value || '').trim();
 if (!raw) return '';
 const paren = raw.match(/\(([A-Za-z]{3})\)\s*$/);
 if (paren) return paren[1].toUpperCase();
 const slug = raw.toLowerCase().replace(/\s+/g, '_').match(/_([a-z]{3})$/);
 if (slug) return slug[1].toUpperCase();
 if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
 return '';
}

function sameAirportLabel(a, b) {
 const left = String(a || '').trim();
 const right = String(b || '').trim();
 if (!left || !right) return false;
 const codeA = extractIataCode(left);
 const codeB = extractIataCode(right);
 if (codeA && codeB) return codeA === codeB;
 return left.toLowerCase() === right.toLowerCase();
}

function preferAirportEndpoint(current, preferred) {
 const cur = String(current || '').trim();
 const pref = String(preferred || '').trim();
 if (!pref) return cur;
 if (!cur) return pref;
 if (sameAirportLabel(cur, pref)) {
  return extractIataCode(pref) && !extractIataCode(cur) ? pref : (extractIataCode(cur) ? cur : pref);
 }
 if (extractIataCode(pref) && !extractIataCode(cur)) return pref;
 return cur;
}

/** GHL aeroport_retour = destination airport; enrich city with IATA when possible. */
function resolveDestAirportLabel(destLabel, returnAirport, homeLabel) {
 const destCity = String(destLabel || '').trim();
 const ret = String(returnAirport || '').trim();
 const home = String(homeLabel || '').trim();
 if (ret && (!home || !sameAirportLabel(ret, home))) {
  const code = extractIataCode(ret);
  if (/\([A-Za-z]{3}\)\s*$/.test(ret)) return ret;
  if (code && destCity && !extractIataCode(destCity)) return `${destCity} (${code})`;
  return ret || destCity;
 }
 return destCity;
}

function mapFlights(props, context = {}) {
 const {
 departureDate = '',
 returnDate = '',
 departureAirport = '',
 returnAirport = '',
 subDest = '',
 destination = ''
 } = context;

 const flights = {
 out: mapFlightLeg(props, 'flight_out', {
 from: 'vol_aller_depart',
 departDate: 'vol_aller_date',
 departTime: 'vol_aller_heure_depart',
 to: 'vol_aller_arrivee',
 arriveDate: 'vol_aller_date_arrivee',
 arriveTime: 'vol_aller__heure_darrive',
 number: 'vol_aller_numero'
 }),
 return: mapFlightLeg(props, 'flight_return', {
 from: 'vol_retour_depart',
 departDate: 'vol_retour_date',
 departTime: 'vol_retour_heure_depart',
 to: 'vol_retour_arrivee',
 arriveDate: 'vol_retour_date_arrivee',
 arriveTime: 'vol_retour__heure_darrive',
 number: 'vol_retour_numero'
 }),
 airlineLogo: pickText(props, 'flight_airline_logo', 'vol_compagnie_logo') || ''
 };

 const outNumber = pickProp(props, 'vol_aller_numero');
 const outTime = pickProp(props, 'vol_aller_heure_depart');
 const outArriveTime = pickProp(
  props,
  'vol_aller_heure_arrivee',
  'vol_aller__heure_darrive',
  'vol_aller__heure_darrivee',
  'vol_aller_heure_arrivee',
  'flight_out_arrive_time'
 );
 const retNumber = pickProp(props, 'vol_retour_numero');
 const retTime = pickProp(props, 'vol_retour_heure_depart');
 const retArriveTime = pickProp(
  props,
  'vol_retour_heure_arrivee',
  'vol_retour__heure_darrive',
  'vol_retour__heure_darrivee',
  'vol_retour_heure_arrivee',
  'flight_return_arrive_time'
 );
 if (outNumber) flights.out.number = String(outNumber).trim();
 if (outTime) flights.out.departTime = String(outTime).trim();
 if (outArriveTime) flights.out.arriveTime = String(outArriveTime).trim();
 if (retNumber) flights.return.number = String(retNumber).trim();
 if (retTime) flights.return.departTime = String(retTime).trim();
 if (retArriveTime) flights.return.arriveTime = String(retArriveTime).trim();

 const destLabel = subDest || destination;
 const homeLabel = departureAirport || '';
 const destAirportLabel = resolveDestAirportLabel(destLabel, returnAirport, homeLabel);

 flights.out.from = preferAirportEndpoint(formatAeroportLabel(flights.out.from), homeLabel);
 if (!flights.out.departDate && departureDate) flights.out.departDate = departureDate;
 flights.out.to = preferAirportEndpoint(formatAeroportLabel(flights.out.to), destAirportLabel);
 if (!flights.out.arriveDate && (flights.out.departDate || departureDate)) {
 flights.out.arriveDate = flights.out.departDate || departureDate;
 }

 flights.return.from = preferAirportEndpoint(formatAeroportLabel(flights.return.from), destAirportLabel);
 if (!flights.return.departDate && returnDate) flights.return.departDate = returnDate;
 // Arrivée retour = maison (GHL aeroport_retour = destination, pas la maison)
 const retTo = formatAeroportLabel(flights.return.to);
 if (!retTo || sameAirportLabel(retTo, destAirportLabel) || sameAirportLabel(retTo, destLabel) || sameAirportLabel(retTo, returnAirport)) {
  flights.return.to = homeLabel || retTo;
 } else {
  flights.return.to = preferAirportEndpoint(retTo, homeLabel);
 }
 if (!flights.return.arriveDate && (flights.return.departDate || returnDate)) {
 flights.return.arriveDate = flights.return.departDate || returnDate;
 }

 return flights;
}

async function mapRecord(record, apiKey, manifest, slug) {
 const props = record.properties || record.fields || record;
 let state = normalizeState(pickProp(props, 'statut', 'state', 'status'));
 const inventoryRaw = toNumber(pickProp(props, 'inventaire', 'inventory', 'stock'), 0);
 // inactif stays hidden — do not remap to complet_sold_out
 const active = state;
 const occ = computeOccupationPerPersonPrices(props);

 const name = resolveRecordName(record, props);
 const destinationLabel = pickProp(props, 'destination', 'destination1', 'dest_destination') || '';
 const subDest = pick(props, 'sub_dest', 'subDest', 'sub_destination', 'city') || destinationLabel;
 const durationNights = toNumber(
 pickProp(props, 'duree_nuits', 'duration_nights', 'durationNights'),
 7
 );
 const departureDate = normalizeDateField(
 pickProp(props, 'date_depart', 'departure_date', 'departureDate', 'date_de_depart', 'dateDepart')
 );
 const resolvedSlug = slug
  ? (normalizeExplicitSlug(slug) || normalizeSlug(slug))
  : buildAutoSlugFromProps(props, departureDate, getRecordId(record, props));
 const explicitGhlSlug = pick(props, 'identifiant_url', 'slug');
 const productSlug = explicitGhlSlug && !isFallbackSlug(explicitGhlSlug)
  ? (normalizeExplicitSlug(explicitGhlSlug) || normalizeSlug(explicitGhlSlug))
  : resolvedSlug;
 const destination1 = normalizeDestination1(destinationLabel || subDest);

 const criteria = toStringArray(pickProp(props, 'criteres', 'criteria', 'tags'));
 const seoTags = toStringArray(pick(props, 'tags_seo', 'seo_tags', 'seoTags', 'seo'));

 let endDate = normalizeDateField(
 pickProp(props, 'date_fin_promo', 'end_date', 'endDate', 'top_chrono_end')
 );
 const returnDate = normalizeDateField(pick(props, 'return_date', 'returnDate', 'date_retour'))
 || deriveReturnDateIso(departureDate, durationNights);

 const country = pickProp(props, 'pays', 'country') || '';
 const supplier = pickProp(props, 'fournisseur', 'supplier') || '';
 const carrier = pickProp(props, 'transporteur', 'carrier') || '';
 const location = pick(props, 'location', 'address', 'adresse') || buildLocationText(subDest, country);

 const imgUpload = pickProp(props, 'photo_principale', 'img', 'image', 'main_image', 'photo');
 // photos_extra is a multi-file GHL field (room + extras, etc.)
 const imgExtraUpload = pickProp(
 props,
 'photo_extra',
 'photos_extra',
 'img_extra',
 'imgExtra',
 'extra_image',
 'photo_chambre',
 'img_room',
 'imgRoom'
 );
 const imgGalleryUpload = pick(props, 'galerie_photos', 'img_gallery', 'gallery', 'photos', 'images');
 const taxFields = applyTaxFields(props);
 const rawDepartureAirport = pickProp(
 props,
 'aeroport_depart',
 'departure_airport',
 'departureAirport',
 'airport'
 ) || '';
 const rawReturnAirport = pickProp(props, 'aeroport_retour', 'return_airport') || '';
 const departureAirport = formatAeroportLabel(rawDepartureAirport);
 const returnAirport = formatAeroportLabel(rawReturnAirport) || departureAirport;

 const img = await mirrorImageField({
 apiKey,
 slug: resolvedSlug,
 field: 'img',
 uploadValue: imgUpload,
 urlOverride: pick(props, 'img_url', 'image_url'),
 manifest
 });
 const extraPaths = await mirrorGalleryImages({
 apiKey,
 slug: resolvedSlug,
 uploadValue: imgExtraUpload,
 manifest,
 fieldPrefix: 'extra'
 });
 // Legacy single override URL → append if not already mirrored
 const extraUrlOverride = pick(props, 'img_extra_url');
 if (extraUrlOverride) {
 const overridePath = await mirrorImageField({
 apiKey,
 slug: resolvedSlug,
 field: 'extra-url',
 uploadValue: null,
 urlOverride: extraUrlOverride,
 manifest
 });
 if (overridePath && !extraPaths.includes(overridePath)) extraPaths.push(overridePath);
 }
 const imgExtra = extraPaths[0] || '';
 const imgRoom = extraPaths[1] || extraPaths[0] || '';
 const galleryPaths = await mirrorGalleryImages({
 apiKey,
 slug: resolvedSlug,
 uploadValue: imgGalleryUpload,
 manifest
 });
 const images = uniqueImagePaths([img], extraPaths, galleryPaths);

 return {
 id: record.id || pick(props, 'id') || resolvedSlug,
 slug: productSlug,
 name,
 state,
 active,
 destTag: pick(props, 'region_promo', 'dest_tag', 'destTag', 'region') || '',
 subDest,
 destination1,
 destination: destination1,
 country,
 location,
 stars: normalizeStars(pickProp(props, 'etoiles', 'stars', 'star_rating'), 0),
 supplier,
 carrier,
 durationNights,
 roomCategory: pickProp(props, 'categorie_chambre', 'room_category', 'roomCategory', 'chambre') || '',
 criteria,
 inventory: state === 'complet_sold_out' || state === 'vendu'
 ? 0
 : toNumber(pickProp(props, 'inventaire', 'inventory', 'stock'), 0),
 price: toNumber(occ.prixDouble ?? pickProp(props, 'prix_occ_double', 'price', 'prix'), 0),
 priceOccSimple: occ.prixSimple,
 priceOccTriple: occ.prixTriple,
 priceOccDouble1Child: occ.priceOccDouble1Child,
 priceOccDouble2Child: occ.priceOccDouble2Child,
 priceOccDouble1Child1317: occ.priceOccDouble1Child1317,
 priceOccDouble2Child1317: occ.priceOccDouble2Child1317,
 priceOccSimple1Child: occ.priceOccSimple1Child,
 priceOccSimple1Child1317: occ.priceOccSimple1Child1317,
 priceOccQuad: occ.prixQuad,
 priceAutres: optionalPrice(pick(props, 'price_autres', 'priceAutres', 'price_occ_autres')),
 ...taxFields,
 discountAmount: optionalPrice(pickProp(props, 'rabais', 'discount_amount', 'discountAmount')),
 financingMonthly: optionalPrice(
 pick(props, 'financement_mensuel', 'financing_monthly', 'financingMonthly')
 ),
 depositAmount: optionalPrice(
 pickProp(props, 'depot_par_personne', 'deposit_amount', 'depositAmount')
 ),
 finalPaymentDate: normalizeDateField(
 pickProp(props, 'date_paiement_final', 'final_payment_date', 'finalPaymentDate')
 ),
 returnDate,
 priceChild212: occ.priceChild212,
 priceChild1317: occ.priceChild1317,
 priceChild2Minus: occ.priceChild2Minus,
 taxChild212: optionalPrice(pick(props, 'tax_child_2_12', 'taxChild212')),
 taxChild1317: optionalPrice(pick(props, 'tax_child_13_17', 'taxChild1317')),
 packageType: pickProp(props, 'type_forfait', 'package_type', 'packageType', 'forfait_type') || '',
 promotion: pickProp(props, 'promotion') || '',
 hotelDescription: pickText(
 props,
 'description_hotel',
 'hotel_description',
 'hotelDescription'
 ) || String(pickProp(props, 'description_hotel') || '').trim(),
 forfaitLink: normalizeExternalUrl(
 pickProp(props, 'lien_fiche_fournisseur', 'forfait_link', 'forfaitLink')
 ),
 endDate,
 departureDate,
 departureAirport,
 returnAirport,
 flights: mapFlights(props, {
 departureDate,
 returnDate,
 departureAirport,
 returnAirport,
 subDest,
 destination: destinationLabel || subDest
 }),
 img,
 imgRoom: imgRoom || imgExtra || img,
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
 const ownerCache = new Map();
 const usedAgentSlugs = new Set();

 for (const record of records) {
 const props = record.properties || record.fields || record;
 const recordId = getRecordId(record, props);
 const name = resolveRecordName(record, props);
 const mapKey = recordId || `__name__:${normalizeSlug(name)}`;
 const slug = slugAssignments.get(mapKey) || normalizeSlug(name);
 const owner = await resolveOwnerProfile(apiKey, record, props, ownerCache, usedAgentSlugs);
 const rawProduct = await mapRecord(record, apiKey, manifest, slug);
 if (owner) {
  rawProduct.ownerId = owner.id;
  rawProduct.owner = { ...owner };
 } else {
  rawProduct.ownerId = null;
  rawProduct.owner = null;
 }
 const product = mergeSyncOverrides(rawProduct, previousProductsById[recordId]);
 // Preserve owner after merge (previous products may lack owner fields)
 if (owner) {
  product.ownerId = owner.id;
  product.owner = { ...owner };
 } else {
  product.ownerId = null;
  product.owner = null;
 }
 if (VISIBLE_STATES.has(product.state)) {
 products.push(product);
 } else {
 const rawStatut = pickProp(props, 'statut', 'state', 'status');
 console.warn(
  ` skip "${product.name || name}" (${product.slug || slug}) — state="${product.state}"`
  + ` (raw statut=${JSON.stringify(rawStatut)})`
 );
 }
 }

 products.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
 saveManifest(manifest);

 const agents = [...ownerCache.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
 const agentsPayload = {
  updatedAt: new Date().toISOString(),
  source: 'ghl',
  locationId,
  agents
 };
 if (writeJsonIfChanged(AGENTS_OUTPUT, agentsPayload)) {
  console.log(`Wrote ${agents.length} agent(s) to ${AGENTS_OUTPUT}`);
 }

 const payload = {
 updatedAt: new Date().toISOString(),
 source: 'ghl',
 schemaKey,
 locationId,
 products
 };

 if (writeJsonIfChanged(OUTPUT, payload)) {
  console.log(`Wrote ${products.length} product(s) to ${OUTPUT}`);
 }
 console.log(` actif: ${products.filter(p => p.active === 'actif').length}`);
 console.log(` pre_vente: ${products.filter(p => p.active === 'pre_vente').length}`);
 console.log(` complet_sold_out: ${products.filter(p => p.active === 'complet_sold_out').length}`);
 console.log(` with owner: ${products.filter(p => p.ownerId).length}`);

 writeSharePages(products);
}

/** Répare products.json local — slugs nom-date, sans forfait-sans-nom-* */
function repairProductsJsonSlugs() {
 if (!existsSync(OUTPUT)) {
  console.error(`Missing ${OUTPUT}`);
  process.exit(1);
 }

 const data = JSON.parse(readFileSync(OUTPUT, 'utf8'));
 const products = data.products || [];
 const used = new Set();
 const sorted = [...products].sort((a, b) => String(a.id || a.slug).localeCompare(String(b.id || b.slug)));
 let changed = 0;

 for (const product of sorted) {
  const props = {
   name: product.name,
   sub_dest: product.subDest,
   subDest: product.subDest,
   destination1: product.destination1 ?? product.destination,
   destination: product.destination,
   departure_date: product.departureDate,
   id: product.id
  };
  const departureDate = normalizeDateField(product.departureDate);
  const ideal = buildAutoSlugFromProps(props, departureDate, product.id || '');
  const previous = product.slug || '';
  let nextSlug;

  if (previous && !isFallbackSlug(previous) && previous.toLowerCase() === ideal.toLowerCase()) {
   nextSlug = reserveUniqueSlug(previous, used);
  } else {
   nextSlug = reserveUniqueSlug(ideal, used, { fromName: true });
  }

  if (previous !== nextSlug) {
   console.log(`  ${previous || '(vide)'} → ${nextSlug}`);
   product.slug = nextSlug;
   changed += 1;
  }
 }

 data.products = sorted;
 data.updatedAt = new Date().toISOString();
 writeFileSync(OUTPUT, JSON.stringify(data, null, 2) + '\n', 'utf8');
 console.log(`Repaired ${changed} slug(s) in ${OUTPUT}`);
 writeSharePages(sorted);
}

if (process.argv.includes('--repair-slugs')) {
 repairProductsJsonSlugs();
} else {
 main().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
 });
}
