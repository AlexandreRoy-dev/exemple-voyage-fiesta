/**
 * Voyage Fiesta — reservation submit API (Node / Express)
 * Runs on the OVH VPS next to DuProprio syncs.
 *
 * Env (.env next to this file, NEVER commit):
 *   GHL_API_KEY=pit-...
 *   GHL_LOCATION_ID=V90iyFBbBrCg3tpctRjc
 *   PORT=3847
 *   ALLOWED_ORIGINS=https://aubaineexpress.voyagefiesta.ca,https://promofiesta.roymarketing.ca
 *   GHL_CONTACT_TAG=reservation-site
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GHL_API = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

function loadEnvFile() {
  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile();

const PORT = Number(process.env.PORT || 3847);
const GHL_API_KEY = process.env.GHL_API_KEY || '';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || '';
const GHL_CONTACT_TAG = process.env.GHL_CONTACT_TAG || 'reservation-site';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function pickCorsOrigin(reqOrigin) {
  if (ALLOWED_ORIGINS.includes('*')) return reqOrigin || '*';
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
  return ALLOWED_ORIGINS[0] || '*';
}

function setCors(res, req) {
  const origin = pickCorsOrigin(req.headers.origin || '');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data)
  });
  res.end(data);
}

function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function buildNotes(payload) {
  const lines = [];
  const add = (label, value) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      lines.push(`${label}: ${String(value).trim()}`);
    }
  };

  add('Dépôt', payload.depot);
  add('Nombre de passagers', payload.nombre_passagers);
  add('Infos passagers', payload.infopassager);
  add('Assurance médicale', payload.assurance_medicale);
  add('Passeport valide 6 mois', payload.passeport_valide);
  add('Assurance annulation', payload.assurance_annulation);
  add('Responsable paiement', payload.payment_responsible);
  add('Adresse', payload.address);
  add('Ville', payload.city);
  add('Code postal', payload.postal_code);

  if (payload.sommaire) {
    lines.push('', '— Sommaire —', String(payload.sommaire).trim());
  }
  if (payload.notes) {
    lines.push('', '— Notes —', String(payload.notes).trim());
  }

  for (let i = 1; i <= 5; i++) {
    const prenom = payload[`p${i}_prenom`];
    const nom = payload[`p${i}_nom`];
    const bits = [
      prenom,
      nom,
      payload[`p${i}_genre`],
      payload[`p${i}_dob`],
      payload[`p${i}_phone`]
    ].filter(Boolean);
    if (bits.length) lines.push(`Passager ${i}: ${bits.join(' | ')}`);
  }

  return lines.join('\n');
}

function buildContactBody(payload) {
  const firstName = pick(payload, 'p1_prenom', 'full_name', 'contact_prenom');
  const lastName = pick(payload, 'p1_nom', 'last_name', 'contact_nom');
  const email = pick(payload, 'p1_email', 'email', 'contact_email');
  const phone = pick(payload, 'p1_phone', 'phone', 'contact_phone');

  const body = {
    locationId: GHL_LOCATION_ID,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: [firstName, lastName].filter(Boolean).join(' ') || undefined,
    email: email || undefined,
    phone: phone || undefined,
    address1: pick(payload, 'address') || undefined,
    city: pick(payload, 'city') || undefined,
    postalCode: pick(payload, 'postal_code') || undefined,
    source: 'Site réservation chambre',
    tags: [GHL_CONTACT_TAG],
    notes: buildNotes(payload) || undefined
  };

  Object.keys(body).forEach((k) => {
    if (body[k] === undefined) delete body[k];
  });
  return body;
}

async function ghlUpsertContact(body) {
  let res = await fetch(`${GHL_API}/contacts/upsert`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      Version: GHL_VERSION,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (res.status === 404 || res.status === 405) {
    res = await fetch(`${GHL_API}/contacts/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        Version: GHL_VERSION,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data?.message || data?.msg || data?.error || text || res.statusText;
    const err = new Error(msg || `GHL error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCors(res, req);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    return sendJson(res, 200, {
      ok: true,
      service: 'voyage-fiesta-reservation',
      configured: Boolean(GHL_API_KEY && GHL_LOCATION_ID)
    });
  }

  if (req.method === 'POST' && (url.pathname === '/' || url.pathname === '/submit')) {
    if (!GHL_API_KEY || !GHL_LOCATION_ID) {
      return sendJson(res, 500, {
        ok: false,
        error: 'API non configurée (GHL_API_KEY / GHL_LOCATION_ID).'
      });
    }

    let input;
    try {
      input = await readBody(req);
    } catch (_) {
      return sendJson(res, 400, { ok: false, error: 'JSON invalide' });
    }

    const payload = input?.payload || input;
    if (!payload || typeof payload !== 'object') {
      return sendJson(res, 400, { ok: false, error: 'payload manquant' });
    }

    const email = pick(payload, 'p1_email', 'email', 'contact_email');
    const phone = pick(payload, 'p1_phone', 'phone', 'contact_phone');
    if (!email && !phone) {
      return sendJson(res, 400, { ok: false, error: 'Courriel ou téléphone requis' });
    }

    try {
      const body = buildContactBody(payload);
      const result = await ghlUpsertContact(body);
      return sendJson(res, 200, {
        ok: true,
        contactId: result?.contact?.id || result?.id || null
      });
    } catch (err) {
      console.error('[reservation]', err.message);
      return sendJson(res, err.status && err.status < 600 ? err.status : 502, {
        ok: false,
        error: err.message || 'Échec création contact GHL'
      });
    }
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[voyage-fiesta-reservation] listening on :${PORT}`);
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    console.warn('[voyage-fiesta-reservation] WARNING: missing GHL_API_KEY or GHL_LOCATION_ID');
  }
});
