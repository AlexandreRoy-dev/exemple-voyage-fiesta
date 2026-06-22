#!/usr/bin/env node
/**
 * Migrate records: forfaits_voyage (old) → Voyage (new custom object)
 *
 * Env:
 *   GHL_API_KEY
 *   GHL_LOCATION_ID
 *   GHL_SOURCE_SCHEMA_KEY  default: custom_objects.forfaits_voyage
 *   GHL_TARGET_SCHEMA_KEY  required for --apply (e.g. custom_objects.voyage)
 *
 * Usage:
 *   node scripts/migrate-ghl-forfaits.mjs           # dry-run → imports/migration-preview.json
 *   node scripts/migrate-ghl-forfaits.mjs --apply   # create records in target object
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VOYAGES_SCHEMA_KEY,
  formatPropertiesForGhlApi,
  loadVoyagesFieldKeysFromSchema
} from './ghl-voyages-fields.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const IMPORTS = resolve(ROOT, 'imports');
const API_BASE = 'https://services.leadconnectorhq.com';
const PAGE_LIMIT = 100;

const APPLY = process.argv.includes('--apply');

/** sub_dest / destination1 slug → option `destination` du nouvel objet */
const DESTINATION_MAP = {
  punta_cana: 'Punta Cana',
  'punta cana': 'Punta Cana',
  roatan: 'Roatan',
  cozumel: 'Cozumel',
  jamaïque: 'Montego Bay',
  jamaique: 'Montego Bay',
  'montego bay': 'Montego Bay',
  panama: 'Panama',
  bahamas: 'Panama',
  freeport: 'Freeport',
  'saint-martin': 'Saint-Martin',
  'st martin': 'Saint-Martin',
  'playa del carmen': 'Playa del Carmen',
  cancun: 'Cancún',
  'riviera maya': 'Riviera Maya'
};

const REGION_MAP = {
  sud: 'sud',
  SUD: 'sud',
  europe: 'europe',
  EUROPE: 'europe',
  canada: 'canada',
  CANADA: 'canada',
  usa: 'usa',
  USA: 'usa',
  circuit: 'circuit',
  CIRCUIT: 'circuit',
  croisiere: 'croisiere',
  croisière: 'croisiere',
  'CROISIÈRE': 'croisiere'
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env: ${name}`);
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

function unwrap(value) {
  if (value === undefined || value === null || value === '') return value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const inner = value.value ?? value.amount ?? value.number ?? value.val;
    if (inner !== undefined && inner !== null && inner !== '') return inner;
  }
  return value;
}

function optionalNumber(value) {
  value = unwrap(value);
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(/\s/g, '').replace(/\$/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function optionalString(value) {
  value = unwrap(value);
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s || null;
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function resolveDestination(old) {
  const sub = normalizeKey(pick(old, 'sub_dest', 'subDest', 'sub_destination', 'city'));
  const dest = normalizeKey(pick(old, 'destination1', 'destination', 'dest_destination'));
  const raw = sub || dest;
  if (DESTINATION_MAP[raw]) return DESTINATION_MAP[raw];
  if (DESTINATION_MAP[dest]) return DESTINATION_MAP[dest];
  const label = pick(old, 'sub_dest', 'subDest') || pick(old, 'destination1', 'destination');
  return label ? String(label).trim() : null;
}

function resolveRegion(old) {
  const tag = pick(old, 'dest_tag', 'destTag', 'region');
  if (!tag) return 'sud';
  const key = normalizeKey(tag);
  return REGION_MAP[tag] || REGION_MAP[key] || String(tag).trim().toLowerCase();
}

function toSeoTags(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.filter(Boolean).join(' ');
  return String(value).trim() || null;
}

function deriveChildPrices(old, prixDouble) {
  const warnings = [];
  let first212 = optionalNumber(pick(old, 'price_child_2_12', 'priceChild212'));
  let second212 = null;
  const occ1 = optionalNumber(pick(old, 'price_occ_double_1_child', 'priceOccDouble1Child'));
  const occ2 = optionalNumber(pick(old, 'price_occ_double_2_child', 'priceOccDouble2Child'));

  if (first212 === null && occ1 !== null && prixDouble !== null) {
    const derived = Math.round((occ1 - 2 * prixDouble) * 100) / 100;
    if (derived > 0) {
      first212 = derived;
      warnings.push(`prix_1er_enfant_2_12 dérivé de price_occ_double_1_child (${occ1} - 2×${prixDouble})`);
    } else {
      warnings.push(`price_occ_double_1_child (${occ1}) ne permet pas de dériver l'enfant — vérifier manuellement`);
    }
  }

  if (occ2 !== null && prixDouble !== null && first212 !== null) {
    const derived2 = Math.round((occ2 - 2 * prixDouble - first212) * 100) / 100;
    if (derived2 > 0) {
      second212 = derived2;
      warnings.push(`prix_2e_enfant_2_12 dérivé de price_occ_double_2_child`);
    }
  }

  return {
    prix_1er_enfant_2_12: first212,
    prix_2e_enfant_2_12: second212,
    prix_1er_enfant_13_17: optionalNumber(pick(old, 'price_child_13_17', 'priceChild1317')),
    prix_enfant_2_moins: null,
    warnings
  };
}

function copyFileField(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return value;
}

function mapOldRecordToNew(oldProps, meta = {}) {
  const warnings = [];
  const old = oldProps || {};
  const name = pick(old, 'name', 'title', 'forfait_name') || 'Forfait sans nom';
  const prixDouble = optionalNumber(pick(old, 'price', 'prix', 'price_occ_double'));
  const child = deriveChildPrices(old, prixDouble);

  const destination = resolveDestination(old);
  if (!destination) warnings.push('destination non résolue — à corriger dans GHL');

  const taxes = optionalNumber(pick(old, 'taxes_amount', 'taxesAmount'));
  if (taxes === null) {
    const legacyDouble = optionalNumber(pick(old, 'taxes_occ_double', 'taxesOccDouble'));
    if (legacyDouble !== null) {
      warnings.push(`taxes_amount absent — legacy taxes_occ_double=${legacyDouble} (vérifier si $/pers. ou total)`);
    }
  }

  const properties = {
    name,
    statut: optionalString(pick(old, 'state', 'status', 'statut')) || 'actif',
    inventaire: optionalNumber(pick(old, 'inventory', 'stock', 'inventaire')) ?? 0,
    identifiant_url: optionalString(pick(old, 'slug', 'identifiant_url')),
    lien_fiche_fournisseur: optionalString(pick(old, 'forfait_link', 'forfaitLink', 'lien_fiche_fournisseur')),
    destination,
    region_promo: resolveRegion(old),
    pays: optionalString(pick(old, 'country', 'pays')),
    date_depart: pick(old, 'departure_date', 'departureDate', 'date_depart'),
    duree_nuits: optionalNumber(pick(old, 'duration_nights', 'durationNights', 'duree_nuits')) ?? 7,
    date_fin_promo: pick(old, 'end_date', 'endDate', 'date_fin_promo'),
    date_paiement_final: pick(old, 'final_payment_date', 'finalPaymentDate', 'date_paiement_final'),
    aeroport_depart: optionalString(pick(old, 'departure_airport', 'departureAirport', 'aeroport_depart')),
    aeroport_retour: optionalString(pick(old, 'return_airport', 'aeroport_retour')),
    etoiles: optionalNumber(pick(old, 'stars', 'star_rating', 'etoiles')),
    categorie_chambre: optionalString(pick(old, 'room_category', 'roomCategory', 'categorie_chambre')),
    type_forfait: optionalString(pick(old, 'package_type', 'packageType', 'type_forfait')),
    description_hotel: optionalString(pick(old, 'hotel_description', 'hotelDescription', 'description_hotel')),
    criteres: pick(old, 'criteria', 'criteres') || undefined,
    tags_seo: toSeoTags(pick(old, 'seo_tags', 'seoTags', 'tags_seo')),
    fournisseur: optionalString(pick(old, 'supplier', 'fournisseur')),
    transporteur: optionalString(pick(old, 'carrier', 'transporteur')),
    prix_occ_double: prixDouble,
    prix_occ_simple: optionalNumber(pick(old, 'price_occ_simple', 'priceOccSimple', 'prix_occ_simple')),
    prix_occ_triple: optionalNumber(pick(old, 'price_occ_triple', 'priceOccTriple', 'prix_occ_triple')),
    prix_occ_quad: optionalNumber(pick(old, 'price_occ_quad', 'priceOccQuad', 'prix_occ_quad')),
    prix_enfant_2_moins: child.prix_enfant_2_moins,
    prix_1er_enfant_2_12: child.prix_1er_enfant_2_12,
    prix_2e_enfant_2_12: child.prix_2e_enfant_2_12,
    prix_1er_enfant_13_17: child.prix_1er_enfant_13_17,
    prix_2e_enfant_13_17: optionalNumber(pick(old, 'prix_2e_enfant_13_17')),
    taxes_par_personne: taxes,
    rabais: optionalNumber(pick(old, 'discount_amount', 'discountAmount', 'rabais')),
    depot_par_personne: optionalNumber(pick(old, 'deposit_amount', 'depositAmount', 'depot_par_personne')),
    financement_mensuel: optionalNumber(
      pick(old, 'financing_monthly', 'financingMonthly', 'financement_mensuel')
    ),
    vol_aller_numero: optionalString(
      pick(old, 'vol_aller_numero', 'flight_out_number', 'flight_out_numero')
    ),
    vol_aller_heure_depart: optionalString(
      pick(old, 'vol_aller_heure_depart', 'flight_out_depart_time')
    ),
    vol_aller_heure_arrivee: optionalString(
      pick(old, 'vol_aller_heure_arrivee', 'flight_out_arrive_time')
    ),
    vol_retour_numero: optionalString(
      pick(old, 'vol_retour_numero', 'flight_return_number', 'flight_return_numero')
    ),
    vol_retour_heure_depart: optionalString(
      pick(old, 'vol_retour_heure_depart', 'flight_return_depart_time')
    ),
    vol_retour_heure_arrivee: optionalString(
      pick(old, 'vol_retour_heure_arrivee', 'flight_return_arrive_time')
    ),
    photo_principale: copyFileField(pick(old, 'img', 'image', 'photo_principale')),
    // Ancien img_room (photo chambre) → photo_extra sur le nouvel objet
    photo_extra: copyFileField(
      pick(old, 'img_room', 'imgRoom', 'photo_chambre')
      || pick(old, 'img_extra', 'imgExtra', 'photo_extra')
    ),
    galerie_photos: copyFileField(pick(old, 'img_gallery', 'gallery', 'galerie_photos'))
  };

  for (const w of child.warnings) warnings.push(w);

  const cleaned = {};
  for (const [key, val] of Object.entries(properties)) {
    if (val !== undefined && val !== null && val !== '') cleaned[key] = val;
  }

  return {
    sourceId: meta.sourceId,
    sourceName: name,
    properties: cleaned,
    warnings
  };
}

function stripEmpty(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

async function ghlSearchRecords({ apiKey, locationId, schemaKey, page, searchAfter }) {
  const url = `${API_BASE}/objects/${encodeURIComponent(schemaKey)}/records/search`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: '2021-07-28'
    },
    body: JSON.stringify({ locationId, page, pageLimit: PAGE_LIMIT, ...(searchAfter ? { searchAfter } : {}) })
  });
  if (!res.ok) throw new Error(`Search ${schemaKey} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchAllRecords(credentials, schemaKey) {
  const all = [];
  let page = 1;
  let searchAfter;
  let total = Infinity;
  while (all.length < total) {
    const data = await ghlSearchRecords({ ...credentials, schemaKey, page, searchAfter });
    const records = data.records || data.data || [];
    total = data.total ?? records.length;
    all.push(...records);
    if (records.length < PAGE_LIMIT || all.length >= total) break;
    searchAfter = data.searchAfter || data.nextSearchAfter;
    page += 1;
    if (!searchAfter) break;
  }
  return all;
}

async function createRecord({ apiKey, locationId, schemaKey, properties }) {
  const url = `${API_BASE}/objects/${encodeURIComponent(schemaKey)}/records`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: '2021-07-28'
    },
    body: JSON.stringify({ locationId, properties: stripEmpty(properties) })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Create record → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

function loadTargetFieldKeys() {
  const path = resolve(IMPORTS, 'ghl-schema-target.json');
  if (!existsSync(path)) return null;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  return loadVoyagesFieldKeysFromSchema(data);
}

function validateMappedProperties(ghlProps, targetKeys) {
  const warnings = [];
  if (!targetKeys) return warnings;
  for (const key of Object.keys(ghlProps)) {
    if (key === 'name') continue;
    if (!targetKeys.has(key) && !targetKeys.has(`${VOYAGES_SCHEMA_KEY}.${key}`)) {
      warnings.push(`Key "${key}" absente du schéma cible GHL`);
    }
  }
  return warnings;
}

async function main() {
  mkdirSync(IMPORTS, { recursive: true });
  const apiKey = requireEnv('GHL_API_KEY');
  const locationId = requireEnv('GHL_LOCATION_ID');
  const sourceKey = process.env.GHL_SOURCE_SCHEMA_KEY || 'custom_objects.forfaits_voyage';
  const targetKey = process.env.GHL_TARGET_SCHEMA_KEY;

  if (APPLY && !targetKey) {
    console.error('--apply requires GHL_TARGET_SCHEMA_KEY');
    process.exit(1);
  }

  console.log(`Mode: ${APPLY ? 'APPLY (write to GHL)' : 'DRY-RUN (preview only)'}`);
  console.log(`Source: ${sourceKey}`);

  const credentials = { apiKey, locationId };
  const records = await fetchAllRecords(credentials, sourceKey);
  console.log(`Fetched ${records.length} record(s) from source.`);

  const targetKeys = loadTargetFieldKeys();
  if (targetKeys) {
    console.log(`Target schema loaded (${targetKeys.size} fields).`);
  }

  const preview = {
    migratedAt: new Date().toISOString(),
    sourceSchemaKey: sourceKey,
    targetSchemaKey: targetKey || null,
    mode: APPLY ? 'apply' : 'dry-run',
    records: []
  };

  let created = 0;
  for (const record of records) {
    const props = record.properties || record.fields || record;
    const mapped = mapOldRecordToNew(props, { sourceId: record.id });
    const ghlProperties = formatPropertiesForGhlApi(mapped.properties);
    mapped.ghlProperties = ghlProperties;
    mapped.warnings.push(...validateMappedProperties(ghlProperties, targetKeys));

    if (APPLY && targetKey) {
      try {
        const result = await createRecord({
          apiKey,
          locationId,
          schemaKey: targetKey,
          properties: ghlProperties
        });
        mapped.targetRecordId = result.record?.id || result.id;
        created += 1;
        console.log(`  ✓ ${mapped.sourceName} → ${mapped.targetRecordId}`);
      } catch (err) {
        mapped.error = String(err.message || err);
        console.error(`  ✗ ${mapped.sourceName}: ${mapped.error}`);
      }
    }

    preview.records.push(mapped);
  }

  const outPath = resolve(IMPORTS, 'migration-preview.json');
  writeFileSync(outPath, JSON.stringify(preview, null, 2) + '\n', 'utf8');
  console.log(`\nPreview: ${outPath}`);
  console.log(`  ${preview.records.length} forfait(s), ${preview.records.filter(r => r.warnings?.length).length} avec avertissements`);

  if (APPLY) {
    console.log(`  Created: ${created}/${records.length}`);
  } else {
    console.log('\nDry-run only. To create records:');
    console.log('  node scripts/migrate-ghl-forfaits.mjs --apply');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
