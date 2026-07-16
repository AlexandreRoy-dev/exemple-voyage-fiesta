#!/usr/bin/env node
/**
 * Export Voyages CSV for GHL manual import.
 *
 * Sources (first found):
 *   imports/migration-preview.json
 *   or live GHL source object (GHL_API_KEY + GHL_SOURCE_SCHEMA_KEY)
 *
 * Outputs:
 *   imports/voyages-import.csv       — map columns to GHL field labels at import
 *   imports/voyages-photos.csv       — photo URLs for manual upload (CSV import skips files)
 *
 * Usage:
 *   node scripts/export-voyages-csv.mjs
 *   node scripts/export-voyages-csv.mjs --from-api
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeAeroportOption,
  normalizeFournisseurOption,
  normalizeStatutOption,
  normalizeTransporteurOption,
  normalizeTypeForfaitOption,
  mapLogicalToVoyagesProperties
} from './ghl-voyages-fields.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const IMPORTS = resolve(ROOT, 'imports');
const PREVIEW_PATH = resolve(IMPORTS, 'migration-preview.json');
const SCHEMA_PATH = resolve(IMPORTS, 'ghl-schema-target.json');
const PRODUCTS_PATH = resolve(ROOT, 'products.json');
const FROM_API = process.argv.includes('--from-api');
const API_BASE = 'https://services.leadconnectorhq.com';

/** CSV column: [header label for GHL import, logical key or getter] */
const CSV_COLUMNS = [
  ['name', 'name'],
  ['Statut', 'statut'],
  ['Inventaire', 'inventaire'],
  ['Destination', 'destination'],
  ['Pays', 'pays'],
  ['Date de départ', 'date_depart'],
  ['Durée (nuits)', 'duree_nuits'],
  ['Fin promo top chrono', 'date_fin_promo'],
  ['Date paiement final', 'date_paiement_final'],
  ['Aéroport de départ', 'aeroport_depart'],
  ['Aéroport de retour', 'aeroport_retour'],
  ['Étoiles', 'etoiles'],
  ['Catégorie de chambre', 'categorie_chambre'],
  ['Type de forfait', 'type_forfait'],
  ['Description_Hôtel', 'description_hotel'],
  ['critères', 'criteres'],
  ['Fournisseur', 'fournisseur'],
  ['Transporteur', 'transporteur'],
  ['Prix occ. double', 'prix_occ_double'],
  ['Prix occ. simple', 'prix_occ_simple'],
  ['Prix occ. triple', 'prix_occ_triple'],
  ['Prix occ. quad', 'prix_occ_quad'],
  ['Enfant 2 ans et moins', 'prix_enfant_2_moins'],
  ['1er enfant 2-12 ans', 'prix_1er_enfant_2_12'],
  ['2e enfant 2-12 ans', 'prix_2e_enfant_2_12'],
  ['1er enfant 13-17 ans', 'prix_1er_enfant_13_17'],
  ['2e enfant 13-17 ans', 'prix_2e_enfant_13_17'],
  ['Taxes et frais aériens ($ / pers.)', 'taxes_par_personne'],
  ['Rabais Aubaines Express', 'rabais'],
  ['Dépôt requis ($ / pers.)', 'depot_par_personne'],
  ['Vol aller numéro', 'vol_aller_numero'],
  ['Vol aller - heure départ', 'vol_aller_heure_depart'],
  ['Vol aller - heure d\'arrivée', 'vol_aller_heure_arrivee'],
  ['Vol retour - numéro', 'vol_retour_numero'],
  ['Vol retour - heure départ', 'vol_retour_heure_depart'],
  ['Vol retour - heure d\'arrivée', 'vol_retour_heure_arrivee'],
  ['Lien fiche fournisseur', 'lien_fiche_fournisseur']
];

const CRITERIA_CSV_MAP = {
  directement_sur_la_plage: 'sur_la_plage',
  sur_la_plage: 'sur_la_plage'
};

function escapeCsv(value) {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function unwrap(value) {
  if (value === undefined || value === null || value === '') return value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const inner = value.value ?? value.amount ?? value.number ?? value.val;
    if (inner !== undefined && inner !== null && inner !== '') return inner;
  }
  return value;
}

function formatMoney(value) {
  value = unwrap(value);
  if (value === undefined || value === null || value === '') return '';
  const n = Number(String(value).replace(/\s/g, '').replace(/\$/g, '').replace(',', '.'));
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '';
}

function formatDate(value) {
  value = unwrap(value);
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).trim();
  return d.toISOString().slice(0, 10);
}

function formatCriteria(value) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  const mapped = items
    .map(item => CRITERIA_CSV_MAP[String(item).trim()] || null)
    .filter(Boolean);
  return mapped.join('|');
}

function extractPhotoUrls(value) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.map(item => (typeof item === 'object' ? item.url : item)).filter(Boolean);
}

function formatCell(logicalKey, value, props) {
  switch (logicalKey) {
    case 'name':
      return props.name || '';
    case 'statut':
      return normalizeStatutOption(value) || 'actif';
    case 'aeroport_depart':
      return normalizeAeroportOption(value) || String(value || '').trim();
    case 'aeroport_retour':
      return String(value || '').trim();
    case 'fournisseur':
      return normalizeFournisseurOption(value) || String(value || '').trim();
    case 'transporteur':
      return normalizeTransporteurOption(value) || String(value || '').trim();
    case 'type_forfait':
      return normalizeTypeForfaitOption(value) || String(value || '').trim();
    case 'date_depart':
    case 'date_fin_promo':
    case 'date_paiement_final':
      return formatDate(value);
    case 'criteres':
      return formatCriteria(value);
    case 'prix_occ_double':
    case 'prix_occ_simple':
    case 'prix_occ_triple':
    case 'prix_occ_quad':
    case 'prix_enfant_2_moins':
    case 'prix_1er_enfant_2_12':
    case 'prix_2e_enfant_2_12':
    case 'prix_1er_enfant_13_17':
    case 'prix_2e_enfant_13_17':
    case 'taxes_par_personne':
    case 'rabais':
    case 'depot_par_personne':
      return formatMoney(value);
    case 'description_hotel':
      return String(value || '').replace(/\r\n/g, '\n').trim();
    default:
      return value === undefined || value === null ? '' : String(value).trim();
  }
}

function loadTaxFallbackByName() {
  if (!existsSync(PRODUCTS_PATH)) return {};
  const data = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));
  const map = {};
  for (const p of data.products || []) {
    if (p.name && p.taxesAmount != null) map[p.name] = p.taxesAmount;
  }
  return map;
}

function enrichProperties(props, taxFallbackByName) {
  const out = { ...props };
  if ((out.taxes_par_personne === undefined || out.taxes_par_personne === null || out.taxes_par_personne === '')
    && taxFallbackByName[out.name] != null) {
    out.taxes_par_personne = taxFallbackByName[out.name];
  }
  if (!out.photo_extra && out.photo_chambre) {
    out.photo_extra = out.photo_chambre;
  }
  return out;
}

function rowToCsvCells(props) {
  return CSV_COLUMNS.map(([, logicalKey]) => formatCell(logicalKey, props[logicalKey], props));
}

function buildImportCsv(records) {
  const taxFallback = loadTaxFallbackByName();
  const header = CSV_COLUMNS.map(([label]) => escapeCsv(label)).join(',');
  const rows = records.map(record => {
    const props = enrichProperties(record.properties || record, taxFallback);
    return rowToCsvCells(props).map(escapeCsv).join(',');
  });
  return [header, ...rows].join('\n') + '\n';
}

function buildPhotosCsv(records) {
  const header = 'name,Photo principale (URL),Photos extra (URL — 1re photo),Photos extra (URL — 2e photo),Notes';
  const rows = records.map(record => {
    const props = record.properties || record;
    const name = props.name || record.sourceName || '';
    const main = extractPhotoUrls(props.photo_principale);
    const extra = extractPhotoUrls(props.photo_extra || props.photo_chambre);
    const notes = [];
    if (!main.length) notes.push('Pas de photo principale dans source');
    if (extra.length > 1) notes.push('GHL Photos extra = 1 fichier — uploader la 2e manuellement ou ignorer');
    return [
      escapeCsv(name),
      escapeCsv(main[0] || ''),
      escapeCsv(extra[0] || ''),
      escapeCsv(extra[1] || ''),
      escapeCsv(notes.join('; '))
    ].join(',');
  });
  return [header, ...rows].join('\n') + '\n';
}

async function fetchSourceRecords() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  const schemaKey = process.env.GHL_SOURCE_SCHEMA_KEY || 'custom_objects.forfaits_voyage';
  if (!apiKey || !locationId) throw new Error('GHL_API_KEY and GHL_LOCATION_ID required for --from-api');

  const all = [];
  let page = 1;
  let searchAfter;
  let total = Infinity;
  while (all.length < total) {
    const res = await fetch(`${API_BASE}/objects/${encodeURIComponent(schemaKey)}/records/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Version: '2021-07-28'
      },
      body: JSON.stringify({ locationId, page, pageLimit: 100, ...(searchAfter ? { searchAfter } : {}) })
    });
    if (!res.ok) throw new Error(`GHL search → ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const records = data.records || data.data || [];
    total = data.total ?? records.length;
    all.push(...records.map(r => ({ sourceName: r.properties?.name, properties: r.properties })));
    if (records.length < 100 || all.length >= total) break;
    searchAfter = data.searchAfter || data.nextSearchAfter;
    page += 1;
    if (!searchAfter) break;
  }
  return all;
}

function loadPreviewRecords() {
  if (!existsSync(PREVIEW_PATH)) {
    throw new Error(`Missing ${PREVIEW_PATH} — run migration dry-run first or use --from-api`);
  }
  return JSON.parse(readFileSync(PREVIEW_PATH, 'utf8')).records || [];
}

async function main() {
  mkdirSync(IMPORTS, { recursive: true });
  const records = FROM_API ? await fetchSourceRecords() : loadPreviewRecords();
  if (!records.length) {
    console.error('No records to export.');
    process.exit(1);
  }

  const importPath = resolve(IMPORTS, 'voyages-import.csv');
  const photosPath = resolve(IMPORTS, 'voyages-photos.csv');
  writeFileSync(importPath, buildImportCsv(records), 'utf8');
  writeFileSync(photosPath, buildPhotosCsv(records), 'utf8');

  console.log(`Exported ${records.length} voyage(s):`);
  console.log(`  ${importPath}`);
  console.log(`  ${photosPath}`);
  console.log('\nPhotos: GHL CSV import does not attach file uploads. Use voyages-photos.csv to upload manually in GHL after import.');
  if (existsSync(SCHEMA_PATH)) {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    const opts = (key) => (schema.fields || []).find(f => f.key?.endsWith(key))?.options || [];
    console.log('\nDropdown options in GHL today:');
    console.log(`  Fournisseur: ${opts('.fournisseur').join(', ') || '(none)'}`);
    console.log(`  Transporteur: ${opts('.transporteur').join(', ') || '(none)'}`);
    console.log(`  Aéroport départ: ${opts('.aroport_de_dpart').join(', ') || '(none)'}`);
    console.log(`  critères: ${opts('.critres').join(', ') || '(none)'}`);
    console.log('Add missing options in GHL before import if CSV values are rejected.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
