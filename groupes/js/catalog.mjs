export const PAGE_SIZE = 12;

export function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0
  }).format(n);
}

export function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(String(iso))) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function categoryLabel(type) {
  if (type === 'sud') return 'Forfait sud';
  if (type === 'cruise') return 'Croisière';
  return 'Voyage';
}

export function categoryPath(type) {
  if (type === 'sud') return 'forfaits-sud/';
  if (type === 'cruise') return 'croisieres/';
  return 'voyages/';
}

export function providerOf(group) {
  if (!group) return '';
  if (group.type === 'cruise') return group.compagnie || group.navire || '';
  if (group.type === 'voyage') return group.country || '';
  return group.hotel || '';
}

export function providerLabel(type) {
  if (type === 'cruise') return 'Compagnie de croisières';
  if (type === 'voyage') return 'Pays';
  return 'Hôtel';
}

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function filterGroups(groups, filters = {}) {
  const search = fold(filters.search);
  const destination = fold(filters.destination);
  const provider = fold(filters.provider);
  const dateFrom = filters.dateFrom || '';
  const dateTo = filters.dateTo || '';
  const priceMin = filters.priceMin === '' || filters.priceMin == null ? null : Number(filters.priceMin);
  const priceMax = filters.priceMax === '' || filters.priceMax == null ? null : Number(filters.priceMax);
  return (groups || []).filter((group) => {
    const price = Number(group.prixAppel);
    const hay = fold([
      group.title,
      group.destination,
      group.country,
      group.region,
      group.hotel,
      group.navire,
      group.compagnie
    ].join(' '));
    if (search && !hay.includes(search)) return false;
    if (destination && fold(group.destination) !== destination) return false;
    if (provider && fold(providerOf(group)) !== provider) return false;
    if (dateFrom && (!group.dateDepart || group.dateDepart < dateFrom)) return false;
    if (dateTo && (!group.dateDepart || group.dateDepart > dateTo)) return false;
    if (priceMin != null && Number.isFinite(priceMin) && (!(price > 0) || price < priceMin)) return false;
    if (priceMax != null && Number.isFinite(priceMax) && (!(price > 0) || price > priceMax)) return false;
    return true;
  });
}

export function sortGroups(groups, sort = 'agence') {
  const list = [...(groups || [])];
  const price = (group) => {
    const n = Number(group.prixAppel);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  list.sort((a, b) => {
    if (sort === 'date-asc') return String(a.dateDepart || '9999').localeCompare(String(b.dateDepart || '9999'));
    if (sort === 'date-desc') return String(b.dateDepart || '').localeCompare(String(a.dateDepart || ''));
    if (sort === 'prix-asc') return (price(a) ?? Infinity) - (price(b) ?? Infinity);
    if (sort === 'prix-desc') return (price(b) ?? -1) - (price(a) ?? -1);
    if (sort === 'titre') return String(a.title || '').localeCompare(String(b.title || ''), 'fr', { sensitivity: 'base' });
    return (Number(a.ordre) || 0) - (Number(b.ordre) || 0);
  });
  return list;
}

export function paginate(items, page = 1, pageSize = PAGE_SIZE) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  const start = (current - 1) * pageSize;
  return {
    page: current,
    pages,
    total,
    items: items.slice(start, start + pageSize)
  };
}

function setParam(params, key, value) {
  params.set(key, value == null ? '' : String(value));
}

export function buildSudSearchUrl(fields) {
  const params = new URLSearchParams();
  setParam(params, 'gateway_dep', fields.gateway || '');
  setParam(params, 'dest_dep', fields.destination || '');
  ['all_inclusive', 'no_hotel', 'star'].forEach((key) => setParam(params, key, ''));
  const date = String(fields.date || '').replace(/-/g, '');
  setParam(params, 'date_dep', date);
  setParam(params, 'flex', '');
  setParam(params, 'duration', fields.duration || '');
  ['price_max', 'beach', 'golf', 'casino', 'adults_only', 'family', 'weddings', 'spa', 'kitchenette'].forEach((key) => setParam(params, key, ''));
  setParam(params, 'searchtype', 'PA');
  setParam(params, 'language', 'fr');
  setParam(params, 'code_ag', 'VAS');
  setParam(params, 'alias', 'BY4');
  setParam(params, 'tour_to_display', '');
  setParam(params, 'nb_rooms', '1');
  setParam(params, 'direct_flight', '');
  setParam(params, 'max_wait', '');
  setParam(params, 'nb_adult', fields.adults || '2');
  setParam(params, 'nb_child', fields.children || '0');
  String(fields.childAges || '')
    .split(/[,;\s]+/)
    .filter(Boolean)
    .forEach((age, index) => setParam(params, `non_adult${index + 1}`, age));
  return `https://vas1.sax.softvoyage.com/cgi-bin/handler.cgi?${params.toString()}`;
}

export function buildFlightSearchUrl(fields) {
  const params = new URLSearchParams();
  setParam(params, 'preferedClass', fields.cabin || 'Y');
  setParam(params, 'trip', fields.trip || 'roundtrip');
  setParam(params, 'adults', fields.adults || '2');
  setParam(params, 'plCode', 'VAS605');
  setParam(params, 'lang', 'fr');
  setParam(params, 'nearbyAirports', 'on');
  params.append('leg[]', `${fields.from || ''};${fields.to || ''};${fields.depart || ''}`);
  if ((fields.trip || 'roundtrip') !== 'oneway') {
    params.append('leg[]', `${fields.to || ''};${fields.from || ''};${fields.returnDate || ''}`);
  }
  return `https://bookingac.trvlbooking.ca/flights/search?${params.toString()}`;
}

export function buildCruiseSearchUrl(fields) {
  const iso = fields.date || '';
  let us = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split('-');
    us = `${month}/${day}/${year}`;
  }
  const params = new URLSearchParams();
  setParam(params, 'plCode', 'VAS605');
  setParam(params, 'LANG', 'fr_CA');
  setParam(params, 'b2c_cruise_dep', fields.port || '');
  setParam(params, 'b2c_cruise_dest', fields.destination || '');
  setParam(params, 'b2c_cruise_date_dep', iso);
  setParam(params, 'b2c_cruise_search_vendor_ids', fields.vendor || '');
  setParam(params, 'b2c_cruise_search_duration_min', fields.duration || '0');
  setParam(params, 'cruise_agence', '605');
  setParam(params, 'nb_adult', fields.adults || '2');
  setParam(params, 'b2c', 'cruise');
  setParam(params, 'dep', fields.port || '');
  setParam(params, 'dest', fields.destination || '');
  setParam(params, 'date_dep', iso);
  setParam(params, 'search_vendor_ids', fields.vendor || '');
  setParam(params, 'search_duration_min', fields.duration || '0');
  setParam(params, 'search[start_date]', us);
  if (fields.vendor) setParam(params, 'search[vendor_ids][0]', fields.vendor);
  setParam(params, 'search[duration_min]', fields.duration || '0');
  return `https://cruisepowered.com/continue.asp?${params.toString()}`;
}

export function buildCarSearchUrl(fields) {
  const us = (iso) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
    const [year, month, day] = iso.split('-');
    return `${month}/${day}/${year}`;
  };
  const params = new URLSearchParams();
  setParam(params, 'pickupLocation', fields.location || '');
  setParam(params, 'pickupDate', us(fields.pickup));
  setParam(params, 'dropoffDate', us(fields.dropoff));
  setParam(params, 'plCode', 'VAS605');
  setParam(params, 'lang', 'fr');
  return `https://bookingac.trvlbooking.ca/cars/search?${params.toString()}`;
}
