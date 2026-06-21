#!/usr/bin/env node
/**
 * Export GHL custom object schema(s) to imports/ghl-schema-*.json
 *
 * Env:
 *   GHL_API_KEY
 *   GHL_LOCATION_ID
 *   GHL_SOURCE_SCHEMA_KEY  (optional, default: custom_objects.forfaits_voyage)
 *   GHL_TARGET_SCHEMA_KEY  (optional, e.g. custom_objects.voyage)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const IMPORTS = resolve(ROOT, 'imports');
const API_BASE = 'https://services.leadconnectorhq.com';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return value;
}

async function fetchSchema({ apiKey, locationId, schemaKey }) {
  const url = `${API_BASE}/objects/${encodeURIComponent(schemaKey)}?locationId=${encodeURIComponent(locationId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      Version: '2021-07-28'
    }
  });
  if (!res.ok) {
    throw new Error(`Schema ${schemaKey} → ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function summarizeFields(schema) {
  const fields = schema.fields || schema.object?.fields || [];
  return fields.map(f => ({
    key: f.fieldKey || f.key,
    label: f.label || f.name,
    type: f.dataType || f.type,
    required: Boolean(f.required),
    options: (f.options || f.picklistOptions || []).map(o => o.value ?? o.key ?? o.label ?? o)
  }));
}

async function exportOne(credentials, schemaKey, filename) {
  console.log(`Fetching schema ${schemaKey}...`);
  const schema = await fetchSchema({ ...credentials, schemaKey });
  const summary = {
    schemaKey,
    label: schema.label || schema.object?.label,
    id: schema.id || schema.object?.id,
    fields: summarizeFields(schema)
  };
  const path = resolve(IMPORTS, filename);
  writeFileSync(path, JSON.stringify(summary, null, 2) + '\n', 'utf8');
  console.log(`  → ${path} (${summary.fields.length} field(s))`);
  return summary;
}

async function main() {
  mkdirSync(IMPORTS, { recursive: true });
  const apiKey = requireEnv('GHL_API_KEY');
  const locationId = requireEnv('GHL_LOCATION_ID');
  const credentials = { apiKey, locationId };

  const sourceKey = process.env.GHL_SOURCE_SCHEMA_KEY || 'custom_objects.forfaits_voyage';
  await exportOne(credentials, sourceKey, 'ghl-schema-source.json');

  const targetKey = process.env.GHL_TARGET_SCHEMA_KEY;
  if (targetKey) {
    await exportOne(credentials, targetKey, 'ghl-schema-target.json');
  } else {
    console.log('Skip target schema (set GHL_TARGET_SCHEMA_KEY to export Voyage).');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
