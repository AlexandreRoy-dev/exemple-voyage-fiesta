import { decodeEntities } from './text.mjs';
/**
 * Map Groupe Atrium v3 payloads to a public catalog.
 * Only whitelisted fields are copied. Secrets and unknown keys are dropped.
 */

const INACTIVE = new Set([
  'inactif',
  'inactive',
  'archive',
  'archiv',
  'archivé',
  'brouillon',
  'draft',
  'annule',
  'annulé',
  'cancelled',
  'canceled',
  'supprime',
  'supprimé'
]);

export function slugify(value) {
  const base = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'groupe';
}

export function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    return value;
  }
  return undefined;
}

export function asNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function asList(value) {
  if (value === undefined || value === null || value === '' || value === 0 || value === '0') return [];
  if (Array.isArray(value)) return value.flatMap((item) => asList(item));
  if (typeof value === 'object') {
    const label = pick(value, 'label', 'nom', 'titre', 'name', 'texte', 'fr', 'description_fr');
    return label ? [String(label).trim()] : [];
  }
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n|•|·|\u2022/)
    .map((part) => part.replace(/^[-*\s]+/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function asType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['sud', 'forfait', 'forfait-sud', 'forfaitsud', 'sun'].includes(raw)) return 'sud';
  if (['cruise', 'croisiere', 'croisière', 'croisieres', 'croisières'].includes(raw)) return 'cruise';
  if (['voyage', 'voyages', 'circuit', 'circuits'].includes(raw)) return 'voyage';
  return raw || 'voyage';
}

function isoDate(value) {
  const str = String(value || '').trim();
  if (!str) return '';
  const iso = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const slash = str.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (slash) {
    return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
  }
  return '';
}

function indexBy(list, key) {
  const map = new Map();
  for (const item of list || []) {
    const id = item?.[key];
    if (id === undefined || id === null || id === '') continue;
    map.set(String(id), item);
  }
  return map;
}

function normName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function indexShips(list) {
  const byId = new Map();
  const byName = new Map();
  for (const item of list || []) {
    const id = pick(item, 'id_navire', 'id');
    if (id !== undefined && id !== null && id !== '') byId.set(String(id), item);
    const name = normName(pick(item, 'nom', 'navire_nom', 'name'));
    if (name && !byName.has(name)) byName.set(name, item);
  }
  return { byId, byName };
}

function indexMedia(list, folder) {
  const byShip = new Map();
  for (const item of list || []) {
    if (!item || typeof item !== 'object') continue;
    const id = pick(item, 'id_navire', 'navire_id');
    if (id === undefined || id === null || id === '') continue;
    const key = String(id);
    if (!byShip.has(key)) byShip.set(key, []);
    byShip.get(key).push({ ...item, folder });
  }
  return byShip;
}

const IMAGE_HOST = 'https://vascoinc.com';
const MAX_IMAGES = 30;
const MEDIA_KEYS = [
  'list_image', 'list_photo', 'images', 'photos', 'alts_img', 'galerie',
  'medias', 'liste_photos', 'list_img', 'list_visuel', 'visuels'
];

function padId(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.trunc(n)).padStart(8, '0');
}

function hotelCdnUrl(hotelId, photoId) {
  const hotel = padId(hotelId);
  const photo = padId(photoId);
  if (!hotel || !photo) return '';
  return `${IMAGE_HOST}/upimg/hotel/hotel_${hotel}_${photo}.jpg`;
}

function resolveImageRef(value, folder) {
  if (value == null) return '';
  let raw = String(value).trim();
  if (!raw || raw === '0' || raw === 'null') return '';
  if (/^https?:\/\//i.test(raw)) {
    if (/\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(raw) || /\/upimg\//i.test(raw) || /vascoinc\.com/i.test(raw)) return raw;
    return '';
  }
  if (raw.startsWith('//')) return `https:${raw}`;
  raw = raw.replace(/^\/+/, '');
  if (raw.startsWith('upimg/')) return `${IMAGE_HOST}/${raw}`;
  if (/^(hotel|bateau|cabine|pont|groupenew)\//i.test(raw)) return `${IMAGE_HOST}/upimg/${raw}`;
  if (/^hotel_\d{4,8}_\d{4,8}\.(jpe?g|png|webp)$/i.test(raw)) return `${IMAGE_HOST}/upimg/hotel/${raw}`;
  if (/^\d{5,8}_\d+_[A-Za-z0-9]+\.(jpe?g|png|webp)$/i.test(raw)) return `${IMAGE_HOST}/upimg/groupenew/${raw}`;
  if (/^\d+_[A-Za-z0-9_-]*\.(jpe?g|png|webp)$/i.test(raw)) {
    return `${IMAGE_HOST}/upimg/${folder || 'bateau'}/${raw}`;
  }
  return '';
}

function photoIdOf(item) {
  if (!item || typeof item !== 'object') return null;
  return asNumber(pick(item, 'id_photo', 'id_image', 'photo_id', 'id_img'));
}

function isPrincipal(item) {
  if (!item || typeof item !== 'object') return false;
  const flag = pick(item, 'principale', 'principal', 'main', 'is_main', 'cover');
  return flag === true || flag === 1 || flag === '1' || flag === 'true';
}

function pushImage(list, url, alt) {
  const clean = String(url || '').trim();
  if (!clean || list.length >= MAX_IMAGES || list.some((item) => item.url === clean)) return;
  list.push({ url: clean, alt: String(alt || '').replace(/\s+/g, ' ').trim() });
}

function imagesFromValue(value, folder, hotelId, list, alt = '') {
  if (value == null || value === '') return;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    const url = resolveImageRef(text, folder)
      || (hotelId && /^\d+$/.test(text) ? hotelCdnUrl(hotelId, text) : '');
    pushImage(list, url, alt);
    return;
  }
  if (Array.isArray(value)) {
    const ordered = [...value].sort((a, b) => Number(isPrincipal(b)) - Number(isPrincipal(a)));
    for (const item of ordered) imagesFromValue(item, folder, hotelId, list, alt);
    return;
  }
  if (typeof value !== 'object') return;
  const file = pick(value, 'url', 'image', 'src', 'lien', 'fichier', 'file', 'path', 'nom_fichier', 'url_img', 'url_img_main', 'photo', 'img', 'visuel', 'lien_img', 'url_photo');
  const id = photoIdOf(value);
  const itemAlt = pick(value, 'alt', 'titre', 'titre_fr', 'legende') || alt;
  const url = resolveImageRef(file, folder) || (hotelId && id ? hotelCdnUrl(hotelId, id) : '');
  pushImage(list, url, itemAlt);
}

function scanNamedMedia(record, folder, hotelId, list) {
  if (!record || typeof record !== 'object') return;
  for (const [key, value] of Object.entries(record)) {
    if (MEDIA_KEYS.includes(key)) continue;
    if (!/photo|image|img|fichier|visuel|galerie|media/i.test(key)) continue;
    if (/description|secret|texte/i.test(key)) continue;
    imagesFromValue(value, folder, hotelId, list);
  }
}

function mapImages(group, hotel, ship, extra = []) {
  const urls = [];
  const hotelId = pick(hotel, 'id_hotel', 'id') || pick(group, 'id_hotel');
  imagesFromValue(pick(group, 'image', 'image_principale', 'url_img', 'photo', 'fichier', 'url_img_main'), 'groupenew', hotelId, urls);
  for (const key of MEDIA_KEYS) imagesFromValue(group?.[key], 'groupenew', hotelId, urls);
  scanNamedMedia(group, 'groupenew', hotelId, urls);
  imagesFromValue(pick(hotel, 'url_img', 'image', 'photo', 'url_img_main', 'fichier'), 'hotel', hotelId, urls);
  for (const key of MEDIA_KEYS) imagesFromValue(hotel?.[key], 'hotel', hotelId, urls);
  scanNamedMedia(hotel, 'hotel', hotelId, urls);
  imagesFromValue(pick(ship, 'url_img_main', 'image', 'photo', 'fichier'), 'bateau', null, urls);
  for (const key of MEDIA_KEYS) imagesFromValue(ship?.[key], 'bateau', null, urls);
  scanNamedMedia(ship, 'bateau', null, urls);
  const orderedExtra = [...extra].sort((a, b) => Number(isPrincipal(b)) - Number(isPrincipal(a)));
  for (const item of orderedExtra) imagesFromValue(item, item?.folder || 'bateau', null, urls);
  return urls;
}

function mapRates(group) {
  const rows = Array.isArray(group?.list_prix) ? group.list_prix : [];
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const price = asNumber(pick(row, 'prix', 'price', 'tarif', 'montant', 'prix_appel'));
      const previous = asNumber(pick(row, 'prix_ancien', 'prix_old', 'prix_regulier', 'old_price'));
      const category = String(pick(row, 'categorie', 'nom', 'titre', 'libelle', 'label', 'occupation') || '').trim();
      const availability = String(pick(row, 'disponibilite', 'places', 'inventory', 'statut') || '').trim();
      if (!category && price == null) return null;
      return {
        categorie: category || 'Tarif',
        prix: price,
        prixAncien: previous,
        disponibilite: availability
      };
    })
    .filter(Boolean);
}

function mapDates(group) {
  const rows = Array.isArray(group?.list_date) ? group.list_date : [];
  const dates = rows
    .map((row) => {
      const date = isoDate(pick(row, 'date_depart', 'date', 'depart'));
      if (!date) return null;
      return {
        date,
        label: String(pick(row, 'date_desc', 'label', 'description') || '').trim()
      };
    })
    .filter(Boolean);
  const primary = isoDate(group?.date_depart);
  if (primary && !dates.some((item) => item.date === primary)) {
    dates.unshift({ date: primary, label: '' });
  }
  dates.sort((a, b) => a.date.localeCompare(b.date));
  return dates;
}

function mapFlights(group) {
  const rows = Array.isArray(group?.list_vol) ? group.list_vol : [];
  return rows
    .map((row) => ({
      sens: String(pick(row, 'aller_retour', 'sens') || '').trim(),
      compagnie: String(pick(row, 'compagnie_aerienne', 'compagnie') || '').trim(),
      numero: String(pick(row, 'numero_vol', 'numero') || '').trim(),
      depart: String(pick(row, 'aeroport_depart') || '').trim(),
      arrivee: String(pick(row, 'aeroport_arrivee') || '').trim(),
      dateDepart: isoDate(row?.date_depart),
      heureDepart: String(row?.heure_depart || '').trim(),
      dateArrivee: isoDate(row?.date_arrivee),
      heureArrivee: String(row?.heure_arrivee || '').trim()
    }))
    .filter((row) => row.depart || row.arrivee || row.numero);
}

const ITINERARY_SKIP = new Set([
  'titre', 'title', 'nom', 'libelle', 'label', 'description', 'texte', 'description_fr',
  'heure_arrivee', 'heure_depart', 'arrivee', 'depart', 'arrival', 'departure',
  'jour', 'ordre', 'day', 'id', 'id_groupe_iti', 'id_iti'
]);

function extraPlace(row) {
  for (const [key, value] of Object.entries(row)) {
    if (ITINERARY_SKIP.has(key) || key.startsWith('id')) continue;
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (text.length < 2 || text.length > 60) continue;
    if (/[<>]/.test(text)) continue;
    if (/arriv|d[ée]part|\d{1,2}:\d{2}/i.test(text)) continue;
    if (!/[A-Za-zÀ-ÿ]{2,}/.test(text)) continue;
    return text;
  }
  return '';
}

function mapItinerary(group) {
  const rows = Array.isArray(group?.list_iti) ? group.list_iti : [];
  return rows
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;
      const titre = String(pick(row, 'titre', 'title', 'nom', 'libelle', 'label') || '').trim();
      const lieu = String(pick(
        row,
        'port', 'nom_port', 'port_nom', 'escale', 'nom_escale', 'ville', 'ville_escale',
        'city', 'destination', 'location', 'lieu', 'nom_ville'
      ) || '').trim() || extraPlace(row);
      const description = String(pick(row, 'description', 'texte', 'description_fr') || '').trim();
      const arrivee = String(pick(row, 'heure_arrivee', 'arrivee', 'arrival') || '').trim();
      const depart = String(pick(row, 'heure_depart', 'depart', 'departure') || '').trim();
      const rawOrder = asNumber(pick(row, 'jour', 'ordre', 'day'));
      const ordre = rawOrder && rawOrder > 0 ? rawOrder : index + 1;
      if (!titre && !description && !lieu && !arrivee && !depart) return null;
      return { ordre, titre, lieu, description, arrivee, depart };
    })
    .filter(Boolean);
}

function isServiceLabel(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > 80) return false;
  if (/^(null|undefined|n\/a|n\.a\.|na|none|aucun|true|false|oui|non|yes|no|0|1|-|—)$/i.test(text)) return false;
  if (/^\d{4}-\d{2}-\d{2}\b/.test(text)) return false;
  if (/^(19|20)\d{2}$/.test(text)) return false;
  if (/^-?\d+([.,]\d+)?\s*\$?$/.test(text)) return false;
  if (/^\d{1,2}\s*[:hH]/.test(text)) return false;
  const letters = text.match(/[A-Za-zÀ-ÿ]/g);
  if (!letters || letters.length < 3) return false;
  if (letters.length / text.replace(/\s/g, '').length < 0.45) return false;
  return true;
}

function equipmentLabels(record) {
  if (!record || typeof record !== 'object') return [];
  const skip = new Set([
    'id_navire', 'id_compagnie', 'id_hotel', 'nom', 'nom_fr', 'nom_en', 'nom_compagnie',
    'description_fr', 'description_en', 'description', 'url_img_main', 'alts_img', 'list_video',
    'list_photo', 'logo', 'site_web'
  ]);
  const labels = [];
  for (const [key, value] of Object.entries(record)) {
    if (skip.has(key) || key.endsWith('_en')) continue;
    if (/^(id_|date_|nb_|cote_|prix|url_|annee|langue|pays|voltage|tonnage|chantier|registre)/i.test(key)) continue;
    if (typeof value === 'string' && isServiceLabel(value)) {
      if (key.startsWith('description') || key.startsWith('cote_') || key === 'nom_compagnie') continue;
      labels.push(value.trim());
    }
  }
  return [...new Set(labels)];
}

function mapHotel(hotel) {
  if (!hotel) return null;
  const id = pick(hotel, 'id_hotel', 'id');
  const nom = String(pick(hotel, 'nom', 'nom_hotel', 'name', 'titre') || '').trim();
  if (!nom && (id === undefined || id === null)) return null;
  return {
    id: id == null ? null : Number(id) || id,
    nom,
    description: String(pick(hotel, 'description_fr', 'description', 'texte') || '').trim(),
    destination: String(pick(hotel, 'destination', 'ville', 'city') || '').trim(),
    chaine: String(pick(hotel, 'chaine', 'chaîne', 'chain', 'marque') || '').trim(),
    etoiles: asNumber(pick(hotel, 'etoiles', 'étoiles', 'classification', 'stars')),
    services: asList(pick(hotel, 'services', 'caracteristiques', 'equipements', 'amenities')).filter(isServiceLabel),
    image: resolveImageRef(pick(hotel, 'url_img', 'image', 'photo', 'url_img_main', 'fichier'), 'hotel')
  };
}

function mapShip(ship, line) {
  if (!ship && !line) return null;
  const nom = String(pick(ship, 'nom', 'navire_nom') || '').trim();
  if (!ship && !nom) return null;
  const services = equipmentLabels(ship);
  return {
    id: ship?.id_navire == null ? null : Number(ship.id_navire) || ship.id_navire,
    nom,
    compagnie: String(pick(ship, 'nom_compagnie') || pick(line, 'nom_fr', 'nom') || '').trim(),
    description: String(pick(ship, 'description_titre_fr', 'description_fr', 'description') || pick(line, 'description_fr') || '').trim(),
    image: resolveImageRef(pick(ship, 'url_img_main', 'image', 'fichier'), 'bateau'),
    passagers: asNumber(ship?.nb_passager),
    equipage: asNumber(ship?.nb_equipage),
    tonnage: asNumber(ship?.tonnage),
    annee: isoDate(ship?.date_lancement).slice(0, 4),
    cote: asNumber(ship?.cote_ensemble),
    services
  };
}

function isInactive(group) {
  const status = String(pick(group, 'status', 'statut', 'etat') || '').trim().toLowerCase();
  if (INACTIVE.has(status)) return true;
  return false;
}

function mapGroup(group, index, lookups) {
  if (!group || typeof group !== 'object' || isInactive(group)) return null;
  const id = pick(group, 'id_groupe', 'id');
  if (id === undefined || id === null || id === '') return null;
  const hotel = lookups.hotels.get(String(pick(group, 'id_hotel') || '')) || null;
  const shipId = pick(group, 'id_navire', 'id_bateau', 'navire_id', 'id_ship');
  const shipNameRaw = pick(group, 'navire_nom', 'nom_navire', 'bateau');
  const ship = lookups.ships.byId.get(String(shipId || ''))
    || lookups.ships.byName.get(normName(shipNameRaw))
    || null;
  const line = lookups.lines.get(String(pick(group, 'id_compagnie', 'id_compagnie_cruise') || ship?.id_compagnie || '')) || null;
  const title = String(pick(group, 'titre', 'nom', 'nom_groupe', 'titre_fr', 'name') || '').trim();
  if (!title) return null;
  const dates = mapDates(group);
  const shipKey = String(pick(ship, 'id_navire', 'id') || shipId || '');
  const extraMedia = []
    .concat(lookups.photos.get(shipKey) || [])
    .concat(lookups.cabines.get(shipKey) || [])
    .concat(lookups.ponts.get(shipKey) || []);
  const images = mapImages(group, hotel, ship, extraMedia);
  const type = asType(pick(group, 'type', 'type_groupe', 'categorie'));
  const hotelName = String(pick(group, 'nom_hotel') || hotel?.nom || pick(mapHotel(hotel) || {}, 'nom') || '').trim();
  const shipName = String(pick(group, 'navire_nom') || ship?.nom || '').trim();
  const lineName = String(pick(group, 'compagnie_cruise', 'compagnie') || ship?.nom_compagnie || pick(line, 'nom_fr', 'nom') || '').trim();
  const price = asNumber(pick(group, 'prix_appel', 'prix', 'price'));
  const previous = asNumber(pick(group, 'prix_old_appel', 'prix_ancien', 'prix_old'));
  const days = asNumber(pick(group, 'nb_jours', 'duree_jours', 'jours', 'duree'));
  const nights = asNumber(pick(group, 'nb_nuits', 'duree_nuits', 'nuits'));
  const mappedHotel = mapHotel(hotel);
  if (mappedHotel && !mappedHotel.nom) mappedHotel.nom = hotelName;
  return {
    id: Number(id) || id,
    type,
    slug: String(pick(group, 'slug') || slugify(title)),
    title,
    destination: String(pick(group, 'destination', 'ville', 'ville_destination', 'nom_destination') || mappedHotel?.destination || '').trim(),
    country: String(pick(group, 'pays', 'country', 'nom_pays') || '').trim(),
    region: String(pick(group, 'region', 'region_nom') || '').trim(),
    dateDepart: isoDate(group.date_depart) || dates[0]?.date || '',
    dateExpire: isoDate(group.date_expire),
    dates,
    dureeJours: days,
    dureeNuits: nights,
    prixAppel: price,
    prixAncien: previous,
    devise: 'CAD',
    image: images[0]?.url || '',
    images,
    hotel: hotelName,
    hotelId: mappedHotel?.id ?? null,
    navire: shipName,
    navireId: pick(ship, 'id_navire', 'id') ?? null,
    compagnie: lineName,
    pointsForts: asList(pick(group, 'points_forts', 'pointsForts', 'texte_points', 'highlights')),
    inclusions: asList(pick(group, 'inclusions', 'texte_inclusions', 'inclus')),
    exclusions: asList(pick(group, 'exclusions', 'texte_exclusions', 'exclus')),
    services: asList(pick(group, 'services', 'services_compris', 'services_inclus')).filter(isServiceLabel),
    description: String(pick(group, 'description', 'description_fr', 'texte') || '').trim(),
    tarifs: mapRates(group),
    vols: mapFlights(group),
    itineraire: mapItinerary(group),
    ordre: asNumber(pick(group, 'ordre', 'position', 'tri')) ?? index,
    hotelDetail: mappedHotel && (mappedHotel.nom || mappedHotel.description) ? mappedHotel : null,
    navireDetail: ship || lineName ? mapShip(ship, line) : (shipName ? { id: null, nom: shipName, compagnie: lineName, description: '', image: '', passagers: null, equipage: null, tonnage: null, annee: '', cote: null, services: [] } : null)
  };
}

const URL_KEYS = new Set(['url', 'image', 'src', 'fallback', 'logo', 'site_web']);

/** Décode les entités HTML (même doublement encodées) dans toutes les chaînes du groupe. */
export function decodeDeep(value, key = '') {
  if (typeof value === 'string') return URL_KEYS.has(key) ? value : decodeEntities(value);
  if (Array.isArray(value)) return value.map((item) => decodeDeep(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeDeep(v, k)]));
  }
  return value;
}

export function mapCatalog(input, { generatedAt = new Date().toISOString() } = {}) {
  const groupes = Array.isArray(input?.groupes) ? input.groupes : [];
  const hotels = Array.isArray(input?.hotels) ? input.hotels : [];
  const ships = Array.isArray(input?.navires) ? input.navires : Array.isArray(input?.ships) ? input.ships : [];
  const lines = Array.isArray(input?.compagnies) ? input.compagnies : Array.isArray(input?.lines) ? input.lines : [];
  const lookups = {
    hotels: indexBy(hotels, 'id_hotel'),
    ships: indexShips(ships),
    lines: indexBy(lines, 'id_compagnie'),
    photos: indexMedia(input?.photos, 'bateau'),
    cabines: indexMedia(input?.cabines, 'cabine'),
    ponts: indexMedia(input?.ponts, 'pont')
  };
  const groups = groupes
    .map((group, index) => mapGroup(group, index, lookups))
    .filter(Boolean)
    .map((group) => decodeDeep(group));
  const counts = {
    sud: groups.filter((group) => group.type === 'sud').length,
    cruise: groups.filter((group) => group.type === 'cruise').length,
    voyage: groups.filter((group) => group.type === 'voyage').length,
    total: groups.length
  };
  return {
    generatedAt,
    source: 'atrium-v3',
    counts,
    groups
  };
}

export function assertPublicCatalog(catalog, forbidden = []) {
  const serialized = JSON.stringify(catalog);
  for (const secret of forbidden) {
    if (secret && serialized.includes(secret)) {
      throw new Error('Le catalogue public contient une valeur interdite.');
    }
  }
  return catalog;
}
