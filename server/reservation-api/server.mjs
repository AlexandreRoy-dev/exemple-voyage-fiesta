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
/** Tag Distinct — trigger workflow « Demande de prix » dans GHL */
const GHL_PRICE_REQUEST_TAG = process.env.GHL_PRICE_REQUEST_TAG || 'demande-prix';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
/** Staff inboxes. GHL Internal Notification cannot merge custom/LARGE_TEXT fields. */
const INTERNAL_NOTIFY_EMAILS = (process.env.INTERNAL_NOTIFY_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const GHL_EMAIL_FROM = process.env.GHL_EMAIL_FROM || 'info@promo.voyagefiesta.com';

/**
 * Payload keys → GHL contact custom field keys (without contact. prefix).
 * Field keys verified against location V90iyFBbBrCg3tpctRjc (2026-07).
 */
const CUSTOM_FIELD_KEYS = {
  depot: 'depot',
  depot_total: 'depot_total',
  depot_pers: 'depot_pers',
  depot_par_personne: 'depot_pers',
  nombre_passagers: 'nombre_de_passagers',
  nombre_de_passagers: 'nombre_de_passagers',
  nombre_personnes: 'nombre_personnes',
  nombre_adultes: 'nombre_adultes',
  nombre_enfants: 'nombre_denfants',
  nombre_enfants_2_12: 'nombre_denfants',
  forfait_slug: 'forfait_slug',
  forfait_name: 'nom_du_forfait',
  nom_du_forfait: 'nom_du_forfait',
  occupation: 'occupation',
  sommaire: 'sommaire',
  notes: 'notes',
  final_payment_date: 'date_de_paiement',
  date_de_paiement: 'date_de_paiement',
  paiement_final: 'paiement_final',
  assurance_medicale: 'possedez_vous_une_assurance_voyage_medicale',
  passeport_valide:
    'est_ce_que_votre_passeport_est_valide_pour_plus_de_6_mois_apres_la_date_de_votre_retour',
  assurance_annulation: 'desirez_vous_une_assurance_voyage_annulation',
  payment_responsible: 'nom_complet_de_la_personne_qui_debourse_pour_le_voyage',
  infopassager:
    'souhaitez_vous_inscrire_les_informations_des_passagers_maintenants',
  p1_genre: 'passager_principal_genre',
  p2_prenom: 'passager_2_prenom_tel_que_sur_le_passeport',
  p2_nom: 'passager_2_nom_tel_que_sur_le_passeport',
  p2_genre: 'passager_2_genre',
  p2_dob: 'passager_2_date_de_naissance',
  p2_phone: 'passager_2_telephone',
  p3_prenom: 'passager_3_prenom_tel_que_sur_le_passeport',
  p3_nom: 'passager_3_nom_tel_que_sur_le_passeport',
  p3_genre: 'passager_3_genre',
  p3_dob: 'passager_3_date_de_naissance',
  p4_prenom: 'passager_4_prenom_tel_que_sur_le_passeport',
  p4_nom: 'passager_4_nom_tel_que_sur_le_passeport',
  p4_genre: 'passager_4_genre',
  p4_dob: 'passager_4_date_de_naissance',
  p5_prenom: 'passager_5_prenom',
  p5_nom: 'passager_5_nom',
  p5_genre: 'passager_5_genre',
  p5_dob: 'passager_5_date_de_naissance',
  prix_total: 'prix_total',
  taxes_total: 'taxes_total',
  prix_total_avant_taxe: 'prix_total_avant_taxe'
};

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

function isPreSaleRequest(payload) {
  const type = String(payload?.request_type || payload?.type || '').toLowerCase().trim();
  return type === 'demande_prevente' || type === 'prevente' || type === 'pre_vente';
}

function isPriceRequest(payload) {
  const type = String(payload?.request_type || payload?.type || '').toLowerCase().trim();
  return type === 'demande_prix' || type === 'price_request';
}

function resolveContactTag(payload) {
  if (isPriceRequest(payload)) {
    return pick(payload, 'contact_tag') || GHL_PRICE_REQUEST_TAG;
  }
  return GHL_CONTACT_TAG;
}

/** Process tags only. Owner routing is assignedTo, never a conseiller tag. */
function resolveContactTags(payload) {
  const primary = resolveContactTag(payload);
  return primary ? [primary] : [];
}

let productsCache = { at: 0, products: [] };

async function lookupOwnerIdBySlug(slug) {
  const key = String(slug || '').trim();
  if (!key) return '';
  const now = Date.now();
  if (now - productsCache.at > 5 * 60 * 1000) {
    const url = process.env.PRODUCTS_JSON_URL || 'https://aubaineexpress.voyagefiesta.ca/products.json';
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${now}`);
    if (!res.ok) throw new Error(`products.json HTTP ${res.status}`);
    const data = await res.json();
    productsCache = { at: now, products: Array.isArray(data?.products) ? data.products : [] };
  }
  const product = productsCache.products.find((p) => String(p?.slug || '') === key);
  return String(product?.ownerId || product?.owner?.id || '').trim();
}

async function resolveAssignedUserId(payload) {
  try {
    const fromVoyage = await lookupOwnerIdBySlug(pick(payload, 'forfait_slug'));
    if (fromVoyage) return fromVoyage;
  } catch (err) {
    console.warn('[reservation] owner lookup failed', err.message);
  }
  return pick(payload, 'agent_id', 'owner_id', 'conseiller_id', 'assigned_to');
}

function extractAssignedUserId(contact) {
  if (!contact || typeof contact !== 'object') return '';
  const raw = contact.assignedTo ?? contact.assigned_to ?? '';
  if (raw && typeof raw === 'object') {
    return String(raw.id || raw.userId || raw.value || '').trim();
  }
  return String(raw || '').trim();
}

async function ghlGetContact(contactId) {
  if (!contactId) return null;
  const res = await fetch(`${GHL_API}/contacts/${encodeURIComponent(contactId)}`, {
    headers: ghlHeaders()
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.contact || data || null;
}

async function ghlFindExistingContact({ email, phone }) {
  const urls = [];
  if (email) {
    urls.push(
      `${GHL_API}/contacts/search/duplicate?locationId=${encodeURIComponent(GHL_LOCATION_ID)}&email=${encodeURIComponent(email)}`
    );
  }
  if (phone) {
    urls.push(
      `${GHL_API}/contacts/search/duplicate?locationId=${encodeURIComponent(GHL_LOCATION_ID)}&number=${encodeURIComponent(phone)}`
    );
  }
  for (const url of urls) {
    const res = await fetch(url, { headers: ghlHeaders() });
    if (!res.ok) continue;
    const data = await res.json().catch(() => null);
    const found = data?.contact || data?.contacts?.[0];
    if (!found?.id) continue;
    if (extractAssignedUserId(found)) return found;
    return (await ghlGetContact(found.id)) || found;
  }
  return null;
}

function ghlHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${GHL_API_KEY}`,
    Version: GHL_VERSION,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'voyage-fiesta-reservation/1.0',
    ...extra
  };
}

function normalizeGender(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'homme' || v === 'masculin' || v === 'm' || v === 'male') return 'Masculin';
  if (v === 'femme' || v === 'féminin' || v === 'feminin' || v === 'f' || v === 'female') {
    return 'Féminin';
  }
  if (v === 'autre' || v === 'other') return 'Autre';
  return String(value).trim();
}

function normalizeAssuranceMedicale(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'oui' || v.startsWith('oui')) return 'Oui';
  if (v === 'non' || v.includes('soumission') || v.includes('désire') || v.includes('desire')) {
    return 'Non, je désire une soumission';
  }
  return String(value).trim();
}

function normalizeAssuranceAnnulation(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'oui' || v.startsWith('oui')) return 'Oui ($)';
  if (v === 'non') return 'Non';
  return String(value).trim();
}

function normalizeEnfants(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^aucun$/i.test(raw) || raw === '0') return 'aucun';
  const n = Number(raw);
  if (Number.isFinite(n)) {
    if (n <= 0) return 'aucun';
    if (n >= 4) return '4';
    return String(n);
  }
  return raw;
}

function normalizePassagerCount(value) {
  const n = Number(String(value || '').trim());
  if (!Number.isFinite(n)) return String(value || '').trim();
  const clamped = Math.min(5, Math.max(1, Math.round(n)));
  return String(clamped);
}

/** Prefer French DD/MM/YYYY → ISO for GHL DATE fields. */
function normalizeDateFr(value) {
  const str = String(value || '').trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const slash = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (slash) {
    return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
  }
  const folded = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const months = {
    janvier: '01',
    fevrier: '02',
    mars: '03',
    avril: '04',
    mai: '05',
    juin: '06',
    juillet: '07',
    aout: '08',
    septembre: '09',
    octobre: '10',
    novembre: '11',
    decembre: '12'
  };
  const longFr = folded.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
  if (longFr && months[longFr[2]]) {
    return `${longFr[3]}-${months[longFr[2]]}-${longFr[1].padStart(2, '0')}`;
  }
  return '';
}

/** Long French date for email merge tags (GHL DATE fields render in English). */
function formatFrenchLongDate(value) {
  const iso = normalizeDateFr(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(value || '').trim();
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(dt);
}

function normalizeFieldValue(fieldKey, value) {
  if (value === undefined || value === null || value === '') return '';
  const str = String(value).trim();
  if (!str) return '';

  if (fieldKey.includes('genre')) return normalizeGender(str);
  if (fieldKey === 'possedez_vous_une_assurance_voyage_medicale') {
    return normalizeAssuranceMedicale(str);
  }
  if (fieldKey === 'desirez_vous_une_assurance_voyage_annulation') {
    return normalizeAssuranceAnnulation(str);
  }
  if (fieldKey === 'nombre_denfants') return normalizeEnfants(str);
  if (fieldKey === 'nombre_de_passagers') return normalizePassagerCount(str);
  if (fieldKey.includes('date') || fieldKey === 'date_de_paiement') {
    return normalizeDateFr(str);
  }

  // Monetary / numerical: strip $ and spaces
  if (
    fieldKey === 'depot' ||
    fieldKey === 'depot_total' ||
    fieldKey === 'depot_pers' ||
    fieldKey.includes('prix') ||
    fieldKey.includes('taxes')
  ) {
    const num = str.replace(/[^\d.,-]/g, '').replace(',', '.');
    return num || str;
  }

  return str;
}

function answerOf(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '—';
}

function qa(question, ...values) {
  return `${question}\n→ ${answerOf(...values)}`;
}

const TERMS_LABEL =
  'J’ai lu et j’accepte les termes et conditions du document 001-554 et je confirme que toutes les informations fournies sont exactes.';

function termsCheckboxState(payload) {
  const raw = payload?.terms_and_conditions;
  if (raw === true || raw === 1) return 'checked';
  const v = String(raw || '').trim().toLowerCase();
  if (['true', '1', 'oui', 'on', 'yes', 'accepte', 'accepté'].includes(v)) {
    return 'checked';
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'terms_and_conditions')) {
    return 'unchecked';
  }
  return '';
}

function hasRoomFormAnswers(payload) {
  return (
    Object.prototype.hasOwnProperty.call(payload, 'assurance_medicale')
    || Object.prototype.hasOwnProperty.call(payload, 'terms_and_conditions')
    || Object.prototype.hasOwnProperty.call(payload, 'p1_dob')
    || Object.prototype.hasOwnProperty.call(payload, 'passeport_valide')
  );
}

function collectKidEntries(payload) {
  const kids = [];
  for (let i = 1; i <= 8; i++) {
    const prenom = payload[`kid_${i}_prenom`];
    const nom = payload[`kid_${i}_nom`];
    const dob = payload[`kid_${i}_dob`];
    if (!prenom && !nom && !dob) continue;
    kids.push({ index: i, prenom, nom, dob });
  }
  if (kids.length) return kids;

  const blob = String(payload.notes || '');
  const re = /Enfant\s+(\d+)\s*:\s*([^\n|]+?)(?:\s*\|\s*(\d{1,2}\/\d{1,2}\/\d{4}))?/g;
  let match;
  while ((match = re.exec(blob))) {
    const nameParts = String(match[2] || '').trim().split(/\s+/).filter(Boolean);
    kids.push({
      index: Number(match[1]) || kids.length + 1,
      prenom: nameParts[0] || '',
      nom: nameParts.slice(1).join(' '),
      dob: match[3] || ''
    });
  }
  return kids;
}

function buildNotes(payload) {
  const lines = [];
  const addSection = (title, rows) => {
    const filled = (rows || []).filter(Boolean);
    if (!filled.length) return;
    if (lines.length) lines.push('');
    lines.push(`— ${title} —`);
    filled.forEach((row) => lines.push(row));
  };

  const forfaitName = answerOf(payload.forfait_name, payload.nom_du_forfait);
  if (isPreSaleRequest(payload)) {
    lines.push(forfaitName && forfaitName !== '—'
      ? `Type: Intérêt pré-vente (aucun dépôt) — ${forfaitName}`
      : 'Type: Intérêt pré-vente (aucun dépôt)');
  } else if (isPriceRequest(payload)) {
    lines.push(forfaitName && forfaitName !== '—'
      ? `Type: Demande de prix (tarif non publié) — ${forfaitName}`
      : 'Type: Demande de prix (tarif non publié)');
  } else {
    lines.push(forfaitName && forfaitName !== '—'
      ? `Type: Réservation — ${forfaitName}`
      : 'Type: Réservation');
  }

  addSection('Forfait', [
    qa('Forfait', payload.forfait_name, payload.nom_du_forfait),
    qa('Occupation', payload.occupation),
    qa('Adultes', payload.nombre_adultes),
    qa('Enfants', payload.nombre_enfants_2_12, payload.nombre_enfants),
    qa('Nombre de passagers', payload.nombre_passagers, payload.nombre_personnes),
    qa('Destination', payload.destination, payload.sub_destination),
    qa('Pays', payload.country),
    qa('Date de départ', payload.departure_date),
    qa('Date de retour', payload.return_date),
    qa('Aéroport de départ', payload.departure_airport),
    qa('Aéroport à destination', payload.return_airport),
    qa('Durée', payload.duration_nights ? `${payload.duration_nights} nuits` : ''),
    qa('Catégorie de chambre', payload.room_category),
    qa('Fournisseur', payload.supplier),
    qa('Transporteur', payload.carrier),
    qa('Promotion', payload.promotion),
    isPriceRequest(payload) || isPreSaleRequest(payload)
      ? ''
      : qa('Dépôt', payload.depot, payload.depot_total),
    qa('Date de paiement final', payload.paiement_final, payload.final_payment_date)
  ].filter((row) => row && !row.endsWith('\n→ —')));

  const roomForm = hasRoomFormAnswers(payload);

  addSection('Voyageur principal', [
    qa('Prénom', payload.p1_prenom, payload.contact_prenom, payload.full_name),
    qa('Nom de famille', payload.p1_nom, payload.contact_nom),
    qa('Date de naissance', payload.p1_dob, payload.date_of_birth),
    qa('Courriel', payload.p1_email, payload.email, payload.contact_email),
    qa('Téléphone', payload.p1_phone, payload.phone, payload.contact_phone),
    roomForm ? qa('Adresse', payload.address) : '',
    roomForm ? qa('Adresse 2 (optionnel)', payload.address2) : '',
    roomForm ? qa('Ville', payload.city) : '',
    roomForm ? qa('Province', payload.province, payload.state) : '',
    roomForm ? qa('Code postal', payload.postal_code) : '',
    roomForm ? qa('Adresse de la carte de crédit', payload.credit_card_address) : ''
  ]);

  for (let i = 2; i <= 5; i++) {
    const prenom = payload[`p${i}_prenom`];
    const nom = payload[`p${i}_nom`];
    const dob = payload[`p${i}_dob`];
    const genre = payload[`p${i}_genre`];
    const phone = payload[`p${i}_phone`];
    if (!prenom && !nom && !dob && !genre && !phone) continue;
    addSection(`Voyageur ${i}`, [
      qa('Prénom', prenom),
      qa('Nom de famille', nom),
      qa('Date de naissance', dob),
      genre ? qa('Genre', genre) : '',
      phone ? qa('Téléphone', phone) : ''
    ]);
  }

  const kids = collectKidEntries(payload);
  const kidCount = Math.max(
    kids.length,
    Number(payload.nombre_enfants || payload.nombre_enfants_2_12 || 0) || 0
  );
  if (roomForm || kids.length) {
    for (let i = 1; i <= kidCount; i++) {
      const kid = kids.find((item) => item.index === i) || kids[i - 1] || {};
      addSection(`Enfant ${i}`, [
        qa('Prénom', kid.prenom),
        qa('Nom de famille', kid.nom),
        qa('Date de naissance', kid.dob)
      ]);
    }
  }

  if (roomForm) {
    addSection('Assurances et documents', [
      qa(
        'Tous les voyageurs sont-ils couverts par une assurance voyage incluant les soins médicaux d’urgence ?',
        payload.assurance_medicale
      ),
      qa(
        'Le passeport de chaque voyageur est-il valide au moins 6 mois après la date de retour prévue ?',
        payload.passeport_valide
      ),
      qa('Désirez-vous une assurance voyage Annulation ?', payload.assurance_annulation)
    ]);

    addSection('Notes du formulaire', [
      qa(
        'Si vous avez un conseiller Voyages Fiesta veuillez inscrire son nom',
        payload.conseiller_voyage
      ),
      qa(
        'Notes ou demandes particulières',
        payload.notes_extra,
        /Enfant\s+\d+\s*:/i.test(String(payload.notes || '')) ? '' : payload.notes
      )
    ]);
  }

  const termsState = termsCheckboxState(payload);
  if (termsState || (!isPriceRequest(payload) && !isPreSaleRequest(payload))) {
    addSection('Termes et conditions', [
      qa(
        TERMS_LABEL,
        termsState === 'checked'
          ? 'Oui — case cochée'
          : termsState === 'unchecked'
            ? 'Non — case non cochée'
            : 'Non communiqué'
      )
    ]);
  }

  addSection('Conseiller', [
    qa('Conseiller assigné', payload.conseiller_name, payload.agent_slug),
    qa('Courriel conseiller', payload.conseiller_email),
    qa('Téléphone conseiller', payload.conseiller_phone)
  ].filter((row) => row && !row.endsWith('\n→ —')));

  if (payload.sommaire) {
    addSection('Sommaire', String(payload.sommaire).trim().split(/\r?\n/));
  }

  return lines.join('\n');
}

function buildCustomFields(payload) {
  const byKey = new Map();

  const put = (fieldKey, rawValue) => {
    if (!fieldKey) return;
    const value = normalizeFieldValue(fieldKey, rawValue);
    if (value === '') return;
    byKey.set(fieldKey, value);
  };

  for (const [payloadKey, fieldKey] of Object.entries(CUSTOM_FIELD_KEYS)) {
    if (payload[payloadKey] !== undefined && payload[payloadKey] !== null && payload[payloadKey] !== '') {
      put(fieldKey, payload[payloadKey]);
    }
  }

  // Aliases / derived values
  if (!byKey.has('depot_total') && payload.depot) put('depot_total', payload.depot);
  if (!byKey.has('depot') && payload.depot_total) put('depot', payload.depot_total);
  if (!byKey.has('nombre_personnes') && payload.nombre_passagers) {
    put('nombre_personnes', payload.nombre_passagers);
  }
  if (!byKey.has('nombre_de_passagers') && payload.nombre_personnes) {
    put('nombre_de_passagers', payload.nombre_personnes);
  }

  // French text date for confirmation emails (DATE fields render as English in GHL)
  const paymentRaw =
    payload.paiement_final ||
    payload.final_payment_date ||
    payload.date_de_paiement ||
    '';
  if (paymentRaw) {
    put('paiement_final', formatFrenchLongDate(paymentRaw));
  }

  // Full formulaire note. `notes` is the legacy field; Internal Notifications
  // do not merge it. Use LARGE_TEXT `note_reservation_interne` instead.
  const noteText = buildNotes(payload);
  if (noteText) {
    put('notes', noteText);
    put('note_reservation_interne', noteText);
  }

  return [...byKey.entries()].map(([key, field_value]) => ({ key, field_value }));
}

function buildContactBody(payload, assignedUserId) {
  const firstName = pick(payload, 'p1_prenom', 'full_name', 'contact_prenom');
  const lastName = pick(payload, 'p1_nom', 'last_name', 'contact_nom');
  const email = pick(payload, 'p1_email', 'email', 'contact_email');
  const phone = pick(payload, 'p1_phone', 'phone', 'contact_phone');
  const priceRequest = isPriceRequest(payload);

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
    source: priceRequest ? 'Site demande de prix' : 'Site réservation chambre'
  };
  if (assignedUserId) body.assignedTo = assignedUserId;

  const customFields = buildCustomFields(payload);
  if (customFields.length) body.customFields = customFields;

  Object.keys(body).forEach((k) => {
    if (body[k] === undefined) delete body[k];
  });
  return body;
}

async function ghlAddNote(contactId, bodyText) {
  if (!contactId || !bodyText) return;
  const res = await fetch(`${GHL_API}/contacts/${contactId}/notes`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify({ body: bodyText })
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn('[reservation] note failed', res.status, text.slice(0, 300));
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function noteEmailHtml(noteText) {
  return `<pre style="margin:0;white-space:pre-wrap;font-family:verdana,geneva,sans-serif;font-size:14px;line-height:1.5;">${escapeHtml(noteText)}</pre>`;
}

async function ghlFindContactIdByEmail(email) {
  const url = `${GHL_API}/contacts/search/duplicate?locationId=${encodeURIComponent(GHL_LOCATION_ID)}&email=${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers: ghlHeaders() });
  if (!res.ok) return '';
  const data = await res.json().catch(() => null);
  return data?.contact?.id || data?.contacts?.[0]?.id || '';
}

async function ghlEnsureNotifyContact(email) {
  const existing = await ghlFindContactIdByEmail(email);
  if (existing) return existing;
  const res = await fetch(`${GHL_API}/contacts/`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify({
      locationId: GHL_LOCATION_ID,
      email,
      firstName: 'Notification',
      lastName: 'Interne',
      source: 'Notification interne reservation',
      tags: ['equipe-interne']
    })
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }
  if (!res.ok) {
    console.warn('[reservation] notify contact create failed', res.status, text.slice(0, 300));
    return '';
  }
  return data?.contact?.id || data?.id || '';
}

async function ghlSendInternalNoteEmail({ noteText, subject }) {
  if (!noteText || !INTERNAL_NOTIFY_EMAILS.length) return { sent: [] };
  const html = noteEmailHtml(noteText);
  const sent = [];
  for (const email of INTERNAL_NOTIFY_EMAILS) {
    try {
      const notifyContactId = await ghlEnsureNotifyContact(email);
      if (!notifyContactId) continue;
      const res = await fetch(`${GHL_API}/conversations/messages`, {
        method: 'POST',
        headers: ghlHeaders({ Version: '2021-04-15' }),
        body: JSON.stringify({
          type: 'Email',
          contactId: notifyContactId,
          emailFrom: GHL_EMAIL_FROM,
          emailTo: email,
          subject,
          html,
          message: noteText
        })
      });
      const text = await res.text();
      if (!res.ok) {
        console.warn('[reservation] internal email failed', email, res.status, text.slice(0, 300));
        continue;
      }
      sent.push(email);
      console.log('[reservation] internal email sent', email);
    } catch (err) {
      console.warn('[reservation] internal email error', email, err.message);
    }
  }
  return { sent };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ghlRemoveTag(contactId, tag) {
  if (!contactId || !tag) return;
  const res = await fetch(`${GHL_API}/contacts/${contactId}/tags`, {
    method: 'DELETE',
    headers: ghlHeaders(),
    body: JSON.stringify({ tags: [tag] })
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn('[reservation] tag remove failed', res.status, text.slice(0, 300));
  }
}

/**
 * Remove then re-add so GHL "Contact Tag" workflows fire (including upserts
 * on an existing contact that already has the tag). Wait after DELETE so
 * GHL cannot apply the remove after the add.
 */
async function ghlApplyTag(contactId, tag) {
  if (!contactId || !tag) return { tagsAdded: [] };

  await ghlRemoveTag(contactId, tag);
  await sleep(900);

  const res = await fetch(`${GHL_API}/contacts/${contactId}/tags`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify({ tags: [tag] })
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = { raw: text };
  }
  if (!res.ok) {
    console.warn('[reservation] tag failed', res.status, text.slice(0, 300));
    return { tagsAdded: [], error: data };
  }
  return data;
}

async function ghlApplyTags(contactId, tags) {
  const list = [...new Set((tags || []).map((t) => String(t || '').trim()).filter(Boolean))];
  const tagsAdded = [];
  for (const tag of list) {
    const result = await ghlApplyTag(contactId, tag);
    if (result?.tagsAdded?.length) tagsAdded.push(...result.tagsAdded);
    else tagsAdded.push(tag);
  }
  return { tagsAdded };
}

async function ghlAssignContact(contactId, userId) {
  if (!contactId || !userId) return;
  const res = await fetch(`${GHL_API}/contacts/${contactId}`, {
    method: 'PUT',
    headers: ghlHeaders(),
    body: JSON.stringify({ assignedTo: userId })
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn('[reservation] assign failed', res.status, text.slice(0, 300));
  }
}

async function ghlUpsertContact(body) {
  let res = await fetch(`${GHL_API}/contacts/upsert`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify(body)
  });

  if (res.status === 404 || res.status === 405) {
    res = await fetch(`${GHL_API}/contacts/`, {
      method: 'POST',
      headers: ghlHeaders(),
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

  let pathname = '/';
  try {
    const host = String(req.headers.host || 'localhost').replace(/[/\\]/g, '') || 'localhost';
    pathname = new URL(req.url || '/', `http://${host}`).pathname;
  } catch (_) {
    pathname = String(req.url || '/').split('?')[0] || '/';
  }
  const url = { pathname };

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    return sendJson(res, 200, {
      ok: true,
      service: 'voyage-fiesta-reservation',
      configured: Boolean(GHL_API_KEY && GHL_LOCATION_ID),
      tag: GHL_CONTACT_TAG
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
      const voyageOwnerId = await resolveAssignedUserId(payload);
      const existing = await ghlFindExistingContact({ email, phone });
      const existingAssignedTo = extractAssignedUserId(existing);
      // Never steal a contact already owned by another agent.
      const assignOwner = Boolean(voyageOwnerId) && !existingAssignedTo;
      const body = buildContactBody(payload, assignOwner ? voyageOwnerId : '');
      const noteText = buildNotes(payload);
      const result = await ghlUpsertContact(body);
      const contactId = result?.contact?.id || result?.id || null;
      const tags = resolveContactTags(payload);

      let assignedTo = existingAssignedTo;
      if (contactId && !assignedTo) {
        assignedTo = extractAssignedUserId(result?.contact) || extractAssignedUserId(await ghlGetContact(contactId));
      }
      if (contactId && voyageOwnerId && !assignedTo) {
        await ghlAssignContact(contactId, voyageOwnerId);
        assignedTo = voyageOwnerId;
        console.log('[reservation] assigned voyage owner', contactId, voyageOwnerId);
      } else if (contactId && existingAssignedTo && voyageOwnerId && existingAssignedTo !== voyageOwnerId) {
        console.log('[reservation] kept existing assignee', contactId, existingAssignedTo);
      }

      let tagsAdded = [];
      if (contactId && tags.length) {
        const tagResult = await ghlApplyTags(contactId, tags);
        tagsAdded = tagResult?.tagsAdded || tags;
        console.log('[reservation] tagged', contactId, tagsAdded.join(','));
        if (noteText) await ghlAddNote(contactId, noteText);
      } else if (!contactId) {
        console.warn('[reservation] upsert returned no contact id; tags skipped');
      }

      let notifyEmails = [];
      if (noteText && INTERNAL_NOTIFY_EMAILS.length) {
        const who = [pick(payload, 'p1_prenom', 'full_name'), pick(payload, 'p1_nom', 'last_name')]
          .filter(Boolean)
          .join(' ');
        const forfait = pick(payload, 'forfait_name', 'nom_du_forfait');
        const subject = ['Nouvelle reservation', who, forfait].filter(Boolean).join(' — ');
        const notify = await ghlSendInternalNoteEmail({ noteText, subject });
        notifyEmails = notify.sent;
      }

      return sendJson(res, 200, {
        ok: true,
        contactId,
        tag: tags[0] || null,
        tags,
        assignedTo: assignedTo || null,
        requestType: isPriceRequest(payload) ? 'demande_prix' : 'reservation',
        tagsAdded,
        notifyEmails,
        customFieldCount: Array.isArray(body.customFields) ? body.customFields.length : 0
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
