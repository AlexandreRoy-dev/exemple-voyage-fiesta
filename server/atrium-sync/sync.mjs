/**
 * Pull Groupe Atrium v3 (read only) and write a public groupes.json.
 *
 * Env (never commit the key):
 *   ATRIUM_API_KEY     required unless ATRIUM_FIXTURE is set
 *   ATRIUM_API_BASE    default https://api.groupeatrium.com/v3
 *   ATRIUM_OUTPUT      file to write (default: reservation-api/groupes.json,
 *                      or ../groupes.json when server.mjs sits next to this folder)
 *   ATRIUM_FIXTURE     local JSON instead of the network (tests)
 *
 * The key is read from the environment, atrium-sync/.env, the parent .env
 * (VPS layout), or ../reservation-api/.env. It is never written to the JSON.
 */
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapCatalog, assertPublicCatalog } from './map.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ENDPOINTS = [
  ['groupes', '/groupes/list'],
  ['hotels', '/hotel/list'],
  ['navires', '/cruise/navire'],
  ['compagnies', '/cruise/compagnie']
];

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

function unwrap(payload, label) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`${label}: réponse vide`);
  }
  if (payload.status && payload.status !== 'success') {
    throw new Error(`${label}: ${payload.message || payload.status}`);
  }
  const data = payload.data ?? payload;
  if (!Array.isArray(data)) {
    throw new Error(`${label}: data n'est pas une liste`);
  }
  return data;
}

async function fetchList(apiBase, apiKey, path, fetchImpl) {
  const url = `${apiBase.replace(/\/$/, '')}${path}`;
  const response = await fetchImpl(url, {
    headers: {
      'Api-Key': apiKey,
      Accept: 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  const json = await response.json();
  return unwrap(json, path);
}

export async function syncAtrium({
  apiKey = '',
  apiBase = 'https://api.groupeatrium.com/v3',
  output,
  fixture = '',
  fetchImpl = globalThis.fetch,
  generatedAt
} = {}) {
  if (!output) throw new Error('ATRIUM_OUTPUT manquant');
  let raw;
  if (fixture) {
    raw = JSON.parse(readFileSync(fixture, 'utf8'));
    raw = {
      groupes: unwrap(raw.groupes ?? raw, 'groupes'),
      hotels: unwrap(raw.hotels ?? { status: 'success', data: [] }, 'hotels'),
      navires: unwrap(raw.navires ?? { status: 'success', data: [] }, 'navires'),
      compagnies: unwrap(raw.compagnies ?? { status: 'success', data: [] }, 'compagnies')
    };
  } else {
    if (!apiKey) throw new Error('ATRIUM_API_KEY manquant');
    raw = {};
    for (const [key, path] of ENDPOINTS) {
      raw[key] = await fetchList(apiBase, apiKey, path, fetchImpl);
    }
  }
  const catalog = assertPublicCatalog(mapCatalog(raw, { generatedAt }), [apiKey].filter(Boolean));
  mkdirSync(dirname(output), { recursive: true });
  const tmp = `${output}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(catalog)}\n`, 'utf8');
  renameSync(tmp, output);
  return catalog;
}

function defaultOutputPath() {
  const parent = join(__dirname, '..');
  if (existsSync(join(parent, 'server.mjs'))) return join(parent, 'groupes.json');
  return join(parent, 'reservation-api', 'groupes.json');
}

async function main() {
  loadEnvFile();
  const output = process.env.ATRIUM_OUTPUT || defaultOutputPath();
  const catalog = await syncAtrium({
    apiKey: process.env.ATRIUM_API_KEY || '',
    apiBase: process.env.ATRIUM_API_BASE || 'https://api.groupeatrium.com/v3',
    output,
    fixture: process.env.ATRIUM_FIXTURE || ''
  });
  console.log(`[atrium-sync] ${catalog.counts.total} groupes -> ${output}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`[atrium-sync] ${error.message}`);
    process.exit(1);
  });
}
