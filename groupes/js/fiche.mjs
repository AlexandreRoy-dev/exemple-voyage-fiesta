import { formatDate } from './catalog.mjs';
import { plainText } from './richtext.mjs';

function tidy(value) {
  return plainText(value).replace(/\s+/g, ' ').trim();
}

/** Texte public: retire le vide, null, N/A, une date brute, un montant nul ou un nombre seul. */
export function isPublicText(value) {
  const text = tidy(value);
  if (!text) return false;
  if (/^(null|undefined|n\/a|n\.a\.|na|none|aucun|-|—)$/i.test(text)) return false;
  if (/^\d{4}-\d{2}-\d{2}\b/.test(text)) return false;
  if (/^-?\d+([.,]\d+)?\s*\$?$/.test(text)) return false;
  if (/^0+([.,]0+)?\s*\$/.test(text)) return false;
  return true;
}

/**
 * Nom de service lisible. Écarte dates, nombres, booléens, codes et valeurs
 * surtout numériques (110/220 V, 294.00). Un mot comme WIFI ou Spa reste.
 */
export function isReadableService(value) {
  const text = tidy(value);
  if (text.length < 2 || text.length > 80) return false;
  if (!isPublicText(text)) return false;
  if (/^(true|false|oui|non|yes|no|0|1)$/i.test(text)) return false;
  if (/^(19|20)\d{2}$/.test(text)) return false;
  if (/^\d{1,2}\s*[:hH]/.test(text)) return false;
  const letters = text.match(/[A-Za-zÀ-ÿ]/g);
  if (!letters || letters.length < 3) return false;
  const compact = text.replace(/\s/g, '');
  if (letters.length / compact.length < 0.45) return false;
  return true;
}

export function readableServices(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    if (!isReadableService(item)) continue;
    const text = tidy(item);
    const key = text.toLocaleLowerCase('fr');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export function publicList(items) {
  return (items || []).map(tidy).filter(isPublicText);
}

/** Année de mise en service affichable. 1970 et les dates sentinelles restent cachées. */
export function shipYear(value) {
  const year = Number(String(value || '').slice(0, 4));
  const max = new Date().getFullYear() + 1;
  if (!Number.isFinite(year) || year < 1990 || year > max) return '';
  return String(year);
}

export function publicDate(iso) {
  const text = formatDate(iso);
  if (!text) return '';
  const year = Number(String(iso).slice(0, 4));
  if (!Number.isFinite(year) || year < 1990) return '';
  return text;
}

export function isGenericRateLabel(value) {
  const text = tidy(value);
  if (!text) return true;
  if (/^tarif$/i.test(text)) return true;
  if (/^option\s*\d+$/i.test(text)) return true;
  if (/^cat(égorie|egorie)?\s*\d+$/i.test(text)) return true;
  return false;
}

/** Rangées dont le libellé est un vrai nom (cabine, occupation, date). */
export function visibleRates(rows) {
  return (rows || []).filter((row) => row && !isGenericRateLabel(row.categorie));
}

function formatClock(hour, minute) {
  const h = Number(hour);
  const m = Number(minute || 0);
  if (!Number.isFinite(h)) return '';
  if (!m) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

function readClock(chunk) {
  if (chunk == null || chunk === '') return '';
  const match = String(chunk).match(/(\d{1,2})\s*(?:[:hH])\s*(\d{2})?/);
  if (!match) return '';
  return formatClock(match[1], match[2] || '0');
}

function timesFromText(value) {
  const src = tidy(value);
  const arrivee = src.match(/arriv[ée]e\s*:?\s*(\d{1,2}\s*(?:[:hH])\s*\d{0,2})/i);
  const depart = src.match(/d[ée]part\s*:?\s*(\d{1,2}\s*(?:[:hH])\s*\d{0,2})/i);
  return {
    arrivee: arrivee ? readClock(arrivee[1]) : '',
    depart: depart ? readClock(depart[1]) : ''
  };
}

function cleanPlace(value) {
  const text = tidy(value);
  if (!text || text.length > 80) return '';
  if (/^(jour\s*\d+|arrivée|arrivee|départ|depart)\b/i.test(text)) return '';
  if (/^\d{1,2}\s*[:hH]/.test(text)) return '';
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(text)) return '';
  return text;
}

export function placeOf(step) {
  if (!step || typeof step !== 'object') return '';
  const direct = cleanPlace(step.lieu) || cleanPlace(step.port) || cleanPlace(step.ville);
  if (direct) return direct;
  const titre = tidy(step.titre);
  const at = titre.match(/\bà\s+([^,]+)$/i);
  if (at) {
    const found = cleanPlace(at[1]);
    if (found) return found;
  }
  return cleanPlace(titre);
}

/** Lignes client. Tableau vide = masquer toute la section Itinéraire. */
export function itineraryLines(steps) {
  const lines = [];
  (steps || []).forEach((step, index) => {
    const place = placeOf(step);
    if (!place) return;
    const parsed = timesFromText(`${step?.description || ''} ${step?.titre || ''}`);
    const arrivee = readClock(step?.arrivee) || parsed.arrivee;
    const depart = readClock(step?.depart) || parsed.depart;
    const jour = Number(step?.ordre) > 0 ? Number(step.ordre) : index + 1;
    const bits = [`Jour ${jour} : ${place}`];
    if (arrivee) bits.push(`arrivée ${arrivee}`);
    if (depart) bits.push(`départ ${depart}`);
    lines.push(bits.join(', '));
  });
  return lines;
}

export function copyLeadParams(target, source, agent) {
  const out = new URLSearchParams(target);
  const from = source instanceof URLSearchParams ? source : new URLSearchParams(source || '');
  for (const [key, value] of from) {
    if (!value) continue;
    if (key === 'ref' || key === 'ghl_user' || key.startsWith('utm_')) {
      if (!out.has(key)) out.set(key, value);
    }
  }
  if (agent?.slug) out.set('ref', agent.slug);
  if (agent?.id) out.set('ghl_user', String(agent.id));
  return out;
}

export function groupLinks(group, { source = '', agent = null, embed = false } = {}) {
  const params = new URLSearchParams();
  params.set('id', String(group.id));
  if (group.slug) params.set('slug', group.slug);
  const merged = copyLeadParams(params, source, agent);
  if (embed) merged.set('embed', '1');
  const detail = `/groupes/groupe/?${merged.toString()}`;
  return { detail, reserve: `${detail}#form-fiche` };
}

export function demandePayload(group, fields, { dryRun = false, agent = null, pageUrl = '' } = {}) {
  const name = String(fields.full_name || '').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const email = String(fields.email || '').trim();
  const phone = String(fields.phone || '').trim();
  const payload = {
    request_type: 'demande_groupe',
    dry_run: dryRun ? true : undefined,
    groupe_id: String(group.id),
    id_groupe: String(group.id),
    groupe_titre: group.title,
    groupe_type: group.type || '',
    forfait_name: group.title,
    nom_du_forfait: group.title,
    destination: group.destination || '',
    country: group.country || '',
    departure_date: group.dateDepart || '',
    duration_nights: group.dureeNuits != null ? String(group.dureeNuits) : '',
    duration_label: [group.dureeJours ? `${group.dureeJours} jours` : '', group.dureeNuits ? `${group.dureeNuits} nuits` : ''].filter(Boolean).join(', '),
    prix_appel: group.prixAppel != null ? String(group.prixAppel) : '',
    hotel: group.hotel || '',
    navire: group.navire || '',
    compagnie: group.compagnie || '',
    provider: fields.provider || '',
    groupe_url: pageUrl,
    full_name: name,
    p1_prenom: parts[0] || '',
    p1_nom: parts.slice(1).join(' '),
    email,
    p1_email: email,
    phone,
    p1_phone: phone,
    nombre_adultes: String(fields.adults ?? ''),
    nombre_enfants: String(fields.children ?? ''),
    message: String(fields.message || '').trim(),
    terms_and_conditions: 'true'
  };
  if (agent) {
    payload.agent_slug = agent.slug;
    payload.agent_id = agent.id;
    payload.conseiller_name = agent.name;
    payload.conseiller_email = agent.email || '';
    payload.conseiller_phone = agent.phone || '';
  }
  Object.keys(payload).forEach((key) => { if (payload[key] === undefined) delete payload[key]; });
  return payload;
}
