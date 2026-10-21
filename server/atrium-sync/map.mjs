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

function imageUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return String(pick(value, 'url', 'image', 'src', 'lien', 'url_img', 'url_img_main') || '').trim();
}

function mapImages(group, hotel, ship) {
  const raw = []
    .concat(group?.list_image || [])
    .concat(group?.images || [])
    .concat(hotel?.list_image || [])
    .concat(hotel?.images || [])
    .concat(hotel?.alts_img || [])
    .concat(ship?.alts_img || [])
    .concat(ship?.list_photo || []);
  const urls = [];
  const push = (url, alt) => {
    const clean = String(url || '').trim();
    if (!clean || urls.some((item) => item.url === clean)) return;
    urls.push({ url: clean, alt: String(alt || '').trim() });
  };
  push(imageUrl(pick(group, 'image', 'image_principale', 'url_img', 'photo')));
  push(imageUrl(pick(hotel, 'url_img', 'image', 'photo', 'url_img_main')));
  push(imageUrl(pick(ship, 'url_img_main', 'image')));
  for (const item of raw) {
    if (typeof item === 'string') push(item);
    else push(imageUrl(item), pick(item, 'alt', 'titre', 'titre_fr', 'legende'));
  }
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

function mapItinerary(group) {
  const rows = Array.isArray(group?.list_iti) ? group.list_iti : [];
  return rows
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null;
      const titre = String(pick(row, 'titre', 'nom', 'ville', 'jour', 'title') || '').trim();
      const description = String(pick(row, 'description', 'texte', 'description_fr') || '').trim();
      if (!titre && !description) return null;
      return { ordre: index + 1, titre, description };
    })
    .filter(Boolean);
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
    if (typeof value === 'string' && value.trim() && value.trim() !== '0') {
      if (key.startsWith('description') || key.startsWith('cote_') || key === 'nom_compagnie') continue;
      if (value.length > 80) continue;
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
    services: asList(pick(hotel, 'services', 'caracteristiques', 'equipements', 'amenities')),
    image: imageUrl(pick(hotel, 'url_img', 'image', 'photo', 'url_img_main'))
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
    image: imageUrl(pick(ship, 'url_img_main', 'image')),
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
  const ship = lookups.ships.get(String(pick(group, 'id_navire') || '')) || null;
  const line = lookups.lines.get(String(pick(group, 'id_compagnie', 'id_compagnie_cruise') || ship?.id_compagnie || '')) || null;
  const title = String(pick(group, 'titre', 'nom', 'nom_groupe', 'titre_fr', 'name') || '').trim();
  if (!title) return null;
  const dates = mapDates(group);
  const images = mapImages(group, hotel, ship);
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
    navireId: ship?.id_navire ?? null,
    compagnie: lineName,
    pointsForts: asList(pick(group, 'points_forts', 'pointsForts', 'texte_points', 'highlights')),
    inclusions: asList(pick(group, 'inclusions', 'texte_inclusions', 'inclus')),
    exclusions: asList(pick(group, 'exclusions', 'texte_exclusions', 'exclus')),
    services: asList(pick(group, 'services', 'services_compris', 'services_inclus')),
    description: String(pick(group, 'description', 'description_fr', 'texte') || '').trim(),
    tarifs: mapRates(group),
    vols: mapFlights(group),
    itineraire: mapItinerary(group),
    ordre: asNumber(pick(group, 'ordre', 'position', 'tri')) ?? index,
    hotelDetail: mappedHotel && (mappedHotel.nom || mappedHotel.description) ? mappedHotel : null,
    navireDetail: ship || lineName ? mapShip(ship, line) : (shipName ? { id: null, nom: shipName, compagnie: lineName, description: '', image: '', passagers: null, equipage: null, tonnage: null, annee: '', cote: null, services: [] } : null)
  };
}

export function mapCatalog(input, { generatedAt = new Date().toISOString() } = {}) {
  const groupes = Array.isArray(input?.groupes) ? input.groupes : [];
  const hotels = Array.isArray(input?.hotels) ? input.hotels : [];
  const ships = Array.isArray(input?.navires) ? input.navires : Array.isArray(input?.ships) ? input.ships : [];
  const lines = Array.isArray(input?.compagnies) ? input.compagnies : Array.isArray(input?.lines) ? input.lines : [];
  const lookups = {
    hotels: indexBy(hotels, 'id_hotel'),
    ships: indexBy(ships, 'id_navire'),
    lines: indexBy(lines, 'id_compagnie')
  };
  const groups = groupes
    .map((group, index) => mapGroup(group, index, lookups))
    .filter(Boolean);
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
