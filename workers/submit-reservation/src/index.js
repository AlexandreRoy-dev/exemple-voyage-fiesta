/**
 * Cloudflare Worker — soumission réservation → GHL Contacts API
 *
 * Secrets (wrangler secret put):
 *   GHL_API_KEY          Private Integration token (contacts.write)
 *   GHL_LOCATION_ID      Sub-account location ID
 *
 * Optional vars:
 *   GHL_CONTACT_TAG      Tag appliqué (défaut: reservation-site)
 *   ALLOWED_ORIGINS      CSV d'origines CORS (défaut: *)
 *   CUSTOM_FIELD_MAP     JSON { "depot": "fieldId", ... } optionnel
 *
 * Deploy:
 *   cd workers/submit-reservation
 *   npx wrangler secret put GHL_API_KEY
 *   npx wrangler secret put GHL_LOCATION_ID
 *   npx wrangler deploy
 */
const GHL_API = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

function corsHeaders(origin, allowedOrigins) {
  const allow = !allowedOrigins || allowedOrigins === '*' || allowedOrigins.split(',').map(s => s.trim()).includes(origin)
    ? (origin || '*')
    : allowedOrigins.split(',')[0].trim();
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });
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

  // Extra passenger fields if present
  for (let i = 1; i <= 5; i++) {
    const prenom = payload[`p${i}_prenom`];
    const nom = payload[`p${i}_nom`];
    if (!prenom && !nom && i > 1) continue;
    if (i === 1 && !payload.p1_genre && !payload.p1_dob) continue;
    const bits = [
      prenom || (i === 1 ? payload.p1_prenom : ''),
      nom || (i === 1 ? payload.p1_nom : ''),
      payload[`p${i}_genre`],
      payload[`p${i}_dob`],
      payload[`p${i}_phone`]
    ].filter(Boolean);
    if (bits.length) lines.push(`Passager ${i}: ${bits.join(' | ')}`);
  }

  return lines.join('\n');
}

function buildContactBody(payload, locationId, tag, fieldMap) {
  const firstName = pick(payload, 'p1_prenom', 'full_name', 'contact_prenom');
  const lastName = pick(payload, 'p1_nom', 'last_name', 'contact_nom');
  const email = pick(payload, 'p1_email', 'email', 'contact_email');
  const phone = pick(payload, 'p1_phone', 'phone', 'contact_phone');

  const body = {
    locationId,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: [firstName, lastName].filter(Boolean).join(' ') || undefined,
    email: email || undefined,
    phone: phone || undefined,
    address1: pick(payload, 'address') || undefined,
    city: pick(payload, 'city') || undefined,
    postalCode: pick(payload, 'postal_code') || undefined,
    source: 'Site réservation chambre',
    tags: tag ? [tag] : ['reservation-site'],
    notes: buildNotes(payload) || undefined
  };

  const customFields = [];
  if (fieldMap && typeof fieldMap === 'object') {
    for (const [payloadKey, fieldId] of Object.entries(fieldMap)) {
      const value = payload[payloadKey];
      if (value === undefined || value === null || value === '') continue;
      customFields.push({ id: String(fieldId), field_value: String(value) });
    }
  }
  if (customFields.length) body.customFields = customFields;

  // Strip undefined
  Object.keys(body).forEach((k) => {
    if (body[k] === undefined) delete body[k];
  });

  return body;
}

async function upsertContact(apiKey, body) {
  // Prefer upsert when email/phone present
  const url = `${GHL_API}/contacts/upsert`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: GHL_VERSION,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = { raw: text };
  }

  if (!res.ok) {
    // Fallback: plain create
    if (res.status === 404 || res.status === 405) {
      return createContact(apiKey, body);
    }
    const msg = data?.message || data?.msg || data?.error || text || res.statusText;
    const err = new Error(msg || `GHL error ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

async function createContact(apiKey, body) {
  const res = await fetch(`${GHL_API}/contacts/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: GHL_VERSION,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
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
    err.data = data;
    throw err;
  }
  return data;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS || '*');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Method not allowed' }, 405, cors);
    }

    const apiKey = env.GHL_API_KEY;
    const locationId = env.GHL_LOCATION_ID;
    if (!apiKey || !locationId) {
      return jsonResponse({
        ok: false,
        error: 'Worker non configuré (GHL_API_KEY / GHL_LOCATION_ID).'
      }, 500, cors);
    }

    let input;
    try {
      input = await request.json();
    } catch (_) {
      return jsonResponse({ ok: false, error: 'JSON invalide' }, 400, cors);
    }

    const payload = input?.payload || input;
    if (!payload || typeof payload !== 'object') {
      return jsonResponse({ ok: false, error: 'payload manquant' }, 400, cors);
    }

    const email = pick(payload, 'p1_email', 'email', 'contact_email');
    const phone = pick(payload, 'p1_phone', 'phone', 'contact_phone');
    if (!email && !phone) {
      return jsonResponse({ ok: false, error: 'Courriel ou téléphone requis' }, 400, cors);
    }

    let fieldMap = null;
    if (env.CUSTOM_FIELD_MAP) {
      try {
        fieldMap = JSON.parse(env.CUSTOM_FIELD_MAP);
      } catch (_) {
        fieldMap = null;
      }
    }

    try {
      const body = buildContactBody(
        payload,
        locationId,
        env.GHL_CONTACT_TAG || 'reservation-site',
        fieldMap
      );
      const result = await upsertContact(apiKey, body);
      return jsonResponse({
        ok: true,
        contactId: result?.contact?.id || result?.id || null
      }, 200, cors);
    } catch (err) {
      return jsonResponse({
        ok: false,
        error: err.message || 'Échec création contact GHL',
        status: err.status || 500
      }, err.status && err.status < 600 ? err.status : 502, cors);
    }
  }
};
