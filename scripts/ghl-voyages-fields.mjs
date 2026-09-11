/**
 * Mapping champs logiques → clés réelles GHL (objet custom_objects.voyages).
 * GHL génère souvent des clés sans accents (départ → dpart, critères → critres).
 */

export const VOYAGES_SCHEMA_KEY = 'custom_objects.voyages';

/** Clé propriété API (suffixe après custom_objects.voyages.) */
export const VOYAGES_FIELDS = {
  statut: 'statut',
  inventaire: 'inventaire',
  lien_fiche_fournisseur: 'lien_fiche_fournisseur',
  destination: 'destination',
  pays: 'pays',
  date_depart: 'date_de_dpart',
  duree_nuits: 'dure_nuits',
  date_fin_promo: 'fin_promo_top_chrono',
  date_paiement_final: 'date_paiement_final',
  aeroport_depart: 'aroport_de_dpart',
  aeroport_retour: 'aroport_de_retour',
  etoiles: 'etoiles',
  categorie_chambre: 'catgorie_de_chambre',
  type_forfait: 'type_de_forfait',
  description_hotel: 'description_hotel',
  inclusions: 'inclusions',
  exclusions: 'exclusions',
  franchise_bagage: 'franchise_bagage',
  criteres: 'critres',
  fournisseur: 'fournisseur',
  transporteur: 'transporteur',
  prix_occ_double: 'prix_occ_double',
  prix_occ_simple: 'prix_occ_simple',
  prix_occ_triple: 'prix_occ_triple',
  prix_occ_quad: 'prix_occ_quad',
  prix_enfant_2_moins: 'enfant_2_ans_et_moins',
  prix_1er_enfant_2_12: '1er_enfant_212_ans',
  prix_2e_enfant_2_12: '2e_enfant_212_ans',
  prix_1er_enfant_13_17: '1er_enfant_1317_ans',
  prix_2e_enfant_13_17: '2e_enfant_1317_ans',
  taxes_par_personne: 'taxes_par_personne',
  rabais: 'rabais_aubaines_express',
  depot_par_personne: 'depot_par_personne',
  vol_aller_numero: 'vol_aller_numero',
  vol_aller_heure_depart: 'vol_aller_heure_dpart',
  /** Label GHL « Vol aller - heure d'arrivée » → clé tronquée (darrive, pas darrivee) */
  vol_aller_heure_arrivee: 'vol_aller__heure_darrive',
  vol_retour_numero: 'vol_retour_numero',
  vol_retour_heure_depart: 'vol_retour_heure_dpart',
  vol_retour_heure_arrivee: 'vol_retour__heure_darrive',
  photo_principale: 'photo_principale',
  photo_extra: 'photos_extra'
};

/** Nom affiché du voyage — objet Voyages utilise le champ `forfaits`, pas `name`. */
export function pickRecordName(record, props) {
  const p = props || record?.properties || record?.fields || record || {};
  const tryVal = (value) => {
    const val = unwrapGhlFieldValue(value);
    if (val !== undefined && val !== null && String(val).trim()) {
      return String(val).trim();
    }
    return '';
  };
  return (
    tryVal(record?.name)
    || tryVal(p.name)
    || tryVal(p.forfaits)
    || tryVal(p[`${VOYAGES_SCHEMA_KEY}.forfaits`])
    || tryVal(p.title)
    || tryVal(p.forfait_name)
    || ''
  );
}

export function fieldSuffix(fieldKey) {
  if (!fieldKey) return '';
  const parts = String(fieldKey).split('.');
  return parts[parts.length - 1];
}

export function loadVoyagesFieldKeysFromSchema(schemaJson) {
  const keys = new Set();
  for (const field of schemaJson.fields || []) {
    if (field.key) {
      keys.add(field.key);
      keys.add(fieldSuffix(field.key));
    }
  }
  return keys;
}

export function mapLogicalToVoyagesProperties(logicalProps) {
  const out = {};
  for (const [logicalKey, value] of Object.entries(logicalProps)) {
    if (logicalKey === 'name') {
      out.name = value;
      continue;
    }
    const ghlKey = VOYAGES_FIELDS[logicalKey];
    if (!ghlKey || value === undefined || value === null || value === '') continue;
    out[ghlKey] = value;
  }
  return out;
}

export function normalizeAeroportOption(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('montr') || s.includes('yul')) return 'montral_yul';
  if (s.includes('qu') && s.includes('yqb')) return 'qubec_yqb';
  return null;
}

/** Options GHL « Aéroport de retour » (aéroport à destination). */
export const AEROPORT_RETOUR_OPTIONS = [
  { key: 'antigua_anu', label: 'Antigua (ANU)', iata: 'ANU' },
  { key: 'aruba_aua', label: 'Aruba (AUA)', iata: 'AUA' },
  { key: 'bahamas_freeport_fpo', label: 'Bahamas, Freeport (FPO)', iata: 'FPO' },
  { key: 'bahamas_nassau_nas', label: 'Bahamas, Nassau (NAS)', iata: 'NAS' },
  { key: 'cancun_cun', label: 'Cancun (CUN)', iata: 'CUN' },
  { key: 'carthagene_ctg', label: 'Carthagène (CTG)', iata: 'CTG' },
  { key: 'cozumel_czm', label: 'Cozumel (CZM)', iata: 'CZM' },
  { key: 'fort_de_france_fdf', label: 'Fort de France (FDF)', iata: 'FDF' },
  { key: 'fort_lauderdale_fll', label: 'Fort Lauderdale (FLL)', iata: 'FLL' },
  { key: 'la_romana_lrm', label: 'La Romana (LRM)', iata: 'LRM' },
  { key: 'las_vegas_las', label: 'Las Vegas (LAS)', iata: 'LAS' },
  { key: 'liberia_lir', label: 'Liberia (LIR)', iata: 'LIR' },
  { key: 'los_cabos_sjd', label: 'Los Cabos (SJD)', iata: 'SJD' },
  { key: 'managua_mga', label: 'Managua (MGA)', iata: 'MGA' },
  { key: 'mazatlan_mzt', label: 'Mazatlan (MZT)', iata: 'MZT' },
  { key: 'miami_mia', label: 'Miami (MIA)', iata: 'MIA' },
  { key: 'montego_bay_mbj', label: 'Montego Bay (MBJ)', iata: 'MBJ' },
  { key: 'palma_de_majorque_pmi', label: 'Palma de Majorque (PMI)', iata: 'PMI' },
  { key: 'playa_blanca_rih', label: 'Playa Blanca (RIH)', iata: 'RIH' },
  { key: 'pointe_pitre_ptp', label: 'Pointe-à-Pitre (PTP)', iata: 'PTP' },
  { key: 'providenciales_pls', label: 'Providenciales (PLS)', iata: 'PLS' },
  { key: 'puerto_plata_pop', label: 'Puerto Plata (POP)', iata: 'POP' },
  { key: 'puerto_vallarta_pvr', label: 'Puerto Vallarta (PVR)', iata: 'PVR' },
  { key: 'punta_cana_puj', label: 'Punta Cana (PUJ)', iata: 'PUJ' },
  { key: 'samana_azs', label: 'Samana (AZS)', iata: 'AZS' },
  { key: 'san_salvador_sal', label: 'San Salvador (SAL)', iata: 'SAL' },
  { key: 'st_martin_sxm', label: 'St-Martin (SXM)', iata: 'SXM' },
  { key: 'ste_lucie_uvf', label: 'Ste-Lucie (UVF)', iata: 'UVF' },
  {
    key: 'toronto_yyz',
    label: 'Toronto (YYZ) — lorsqu’il y a une escale. Exemple: YUL → YYZ ensuite YYZ → CUN',
    iata: 'YYZ'
  },
  { key: 'tulum_tqo', label: 'Tulum (TQO)', iata: 'TQO' }
];

export function normalizeAeroportRetourOption(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const slug = raw.toLowerCase().replace(/\s+/g, '_');
  if (AEROPORT_RETOUR_OPTIONS.some((opt) => opt.key === slug)) return slug;
  const lower = raw.toLowerCase();
  if (lower.includes('cancun') || lower.includes('cancún')) return 'cancun_cun';
  if (lower.includes('freeport')) return 'bahamas_freeport_fpo';
  if (lower.includes('nassau')) return 'bahamas_nassau_nas';
  const code = extractIataFromAirportValue(raw);
  if (code === 'YUL') return null;
  const hit = AEROPORT_RETOUR_OPTIONS.find((opt) => opt.iata === code);
  return hit ? hit.key : null;
}

/** Clé option GHL → libellé affiché boutique */
export const AEROPORT_LABELS = {
  montral_yul: 'Montréal (YUL)',
  montreal_yul: 'Montréal (YUL)',
  qubec_yqb: 'Québec (YQB)',
  quebec_yqb: 'Québec (YQB)',
  ottawa_yow: 'Ottawa (YOW)',
  toronto_yyz: 'Toronto (YYZ)',
  halifax_yhz: 'Halifax (YHZ)',
  vancouver_yvr: 'Vancouver (YVR)',
  antigua_anu: 'Antigua (ANU)',
  aruba_aua: 'Aruba (AUA)',
  bahamas_freeport_fpo: 'Bahamas, Freeport (FPO)',
  bahamas_nassau_nas: 'Bahamas, Nassau (NAS)',
  cancun_cun: 'Cancun (CUN)',
  carthagene_ctg: 'Carthagène (CTG)',
  cozumel_czm: 'Cozumel (CZM)',
  fort_de_france_fdf: 'Fort de France (FDF)',
  fort_lauderdale_fll: 'Fort Lauderdale (FLL)',
  la_romana_lrm: 'La Romana (LRM)',
  las_vegas_las: 'Las Vegas (LAS)',
  liberia_lir: 'Liberia (LIR)',
  los_cabos_sjd: 'Los Cabos (SJD)',
  managua_mga: 'Managua (MGA)',
  mazatlan_mzt: 'Mazatlan (MZT)',
  miami_mia: 'Miami (MIA)',
  montego_bay_mbj: 'Montego Bay (MBJ)',
  palma_de_majorque_pmi: 'Palma de Majorque (PMI)',
  playa_blanca_rih: 'Playa Blanca (RIH)',
  pointe_pitre_ptp: 'Pointe-à-Pitre (PTP)',
  providenciales_pls: 'Providenciales (PLS)',
  puerto_plata_pop: 'Puerto Plata (POP)',
  puerto_vallarta_pvr: 'Puerto Vallarta (PVR)',
  punta_cana_puj: 'Punta Cana (PUJ)',
  samana_azs: 'Samana (AZS)',
  san_salvador_sal: 'San Salvador (SAL)',
  st_martin_sxm: 'St-Martin (SXM)',
  ste_lucie_uvf: 'Ste-Lucie (UVF)',
  tulum_tqo: 'Tulum (TQO)'
};

function extractIataFromAirportValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const paren = raw.match(/\(([A-Za-z]{3})\)/);
  if (paren) return paren[1].toUpperCase();
  const slug = raw.toLowerCase().replace(/\s+/g, '_').match(/_([a-z]{3})$/);
  if (slug) return slug[1].toUpperCase();
  if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
  return '';
}

function airportLookupCandidates(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return [value.key, value.label, value.value, value.name].filter(Boolean).map((part) => String(part).trim());
  }
  const raw = String(value ?? '').trim();
  return raw ? [raw] : [];
}

export function formatAeroportLabel(value) {
  const candidates = airportLookupCandidates(value);
  if (!candidates.length) return '';

  for (const candidate of candidates) {
    const suffix = candidate.includes('.') ? candidate.split('.').pop() : candidate;
    const key = String(suffix || '').toLowerCase().replace(/\s+/g, '_');
    if (AEROPORT_LABELS[key]) return AEROPORT_LABELS[key];
    if (AEROPORT_LABELS[candidate]) return AEROPORT_LABELS[candidate];
    if (AEROPORT_LABELS[suffix]) return AEROPORT_LABELS[suffix];
  }

  const joined = candidates.join(' ');
  const code = extractIataFromAirportValue(joined);
  if (code) {
    for (const label of Object.values(AEROPORT_LABELS)) {
      if (extractIataFromAirportValue(label) === code) return label;
    }
  }

  const short = joined.match(/^\s*([^()]+?\([A-Za-z]{3}\))/);
  if (short) return short[1].trim();
  return String(candidates[0] || '').trim();
}

/** Toronto (YYZ) in Aéroport de retour = escale, not the holiday destination. */
export function isConnectionReturnAirport(value) {
  const candidates = airportLookupCandidates(value).join(' ').toLowerCase();
  if (!candidates) return false;
  if (candidates.includes('toronto_yyz') || candidates.includes('toronto (yyz)')) return true;
  return extractIataFromAirportValue(candidates) === 'YYZ';
}

export function formatDestinationAirportLabel(value) {
  if (isConnectionReturnAirport(value)) return '';
  return formatAeroportLabel(value);
}

export function normalizeStatutOption(value) {
  const s = String(value || '').trim().toLowerCase();
  if (
    s === 'pre_vente'
    || s === 'pre-vente'
    || s === 'prevente'
    || s === 'prvente'
    || s === 'pr_vente'
    || /pr[eé]?[\s_-]?vente/.test(s)
  ) {
    // Prefer canonical key if the GHL option exists as pre_vente; else prvente (accent-stripped)
    return 'prvente';
  }
  if (s === 'actif') return 'actif';
  if (s === 'complet_sold_out' || s === 'complet' || s === 'inactif') return 'inactif';
  if (s === 'brouillon' || s === 'archiv') return 'inactif';
  if (s === 'vendu') return 'vendu';
  return 'actif';
}

export function normalizeFournisseurOption(value) {
  const s = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (s.includes('vacances_air_canada') || s.includes('vacances_air_canada')) return 'vacances_air_canada';
  if (s.includes('sunwing')) return 'sunwing';
  if (s.includes('transat')) return 'transat';
  if (s.includes('westjet')) return 'westjet';
  if (s.includes('air_canada') || s.includes('air canada')) return 'air_canada';
  return s || null;
}

export function normalizeTransporteurOption(value) {
  const s = String(value || '').trim().toLowerCase();
  if (s.includes('westjet')) return 'westjet';
  if (s.includes('air canada')) return 'air_canada';
  if (s.includes('transat')) return 'transat';
  return s.replace(/\s+/g, '_') || null;
}

export function normalizeTypeForfaitOption(value) {
  const s = String(value || '').trim().toLowerCase();
  if (s.includes('tout') && s.includes('inclus')) return 'toutinclus';
  if (s.includes('europe')) return 'europen';
  return null;
}

export function formatMoneyValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return { currency: 'default', value: Math.round(n * 100) / 100 };
}

export function formatPropertiesForGhlApi(logicalProps) {
  const mapped = mapLogicalToVoyagesProperties(logicalProps);
  const out = {};

  if (mapped.name) out.name = mapped.name;

  const moneyKeys = new Set([
    'taxes_par_personne',
    'rabais_aubaines_express',
    'depot_par_personne',
    'prix_occ_double',
    'prix_occ_simple',
    'prix_occ_triple',
    'prix_occ_quad',
    'enfant_2_ans_et_moins',
    '1er_enfant_212_ans',
    '2e_enfant_212_ans',
    '1er_enfant_1317_ans',
    '2e_enfant_1317_ans'
  ]);

  for (const [key, value] of Object.entries(mapped)) {
    if (key === 'name') continue;

    if (key === 'statut') {
      const v = normalizeStatutOption(value);
      if (v) out[key] = v;
      continue;
    }
    if (key === 'aroport_de_dpart') {
      const v = normalizeAeroportOption(value);
      if (v) out[key] = v;
      continue;
    }
    if (key === 'aroport_de_retour') {
      const v = normalizeAeroportRetourOption(value);
      if (v) out[key] = v;
      continue;
    }
    if (key === 'fournisseur') {
      const v = normalizeFournisseurOption(value);
      if (v) out[key] = v;
      continue;
    }
    if (key === 'transporteur') {
      const v = normalizeTransporteurOption(value);
      if (v) out[key] = v;
      continue;
    }
    if (key === 'type_de_forfait') {
      const v = normalizeTypeForfaitOption(value);
      if (v) out[key] = v;
      continue;
    }
    if (moneyKeys.has(key)) {
      const v = formatMoneyValue(value);
      if (v) out[key] = v;
      continue;
    }
    if (key === 'critres') {
      const items = Array.isArray(value) ? value : [value];
      const valid = items.filter(Boolean).map(String);
      if (valid.length) out[key] = valid;
      continue;
    }
    if (key === 'photo_principale' || key === 'photos_extra') {
      if (Array.isArray(value)) out[key] = value;
      else if (value?.url) out[key] = [value];
      continue;
    }

    out[key] = value;
  }

  return out;
}

/** Lecture sync : pick depuis record GHL (clé courte ou longue). */
export function pickVoyages(props, logicalKey) {
  const ghlKey = VOYAGES_FIELDS[logicalKey];
  if (!ghlKey) return undefined;
  const fullKey = `${VOYAGES_SCHEMA_KEY}.${ghlKey}`;
  return props[ghlKey] ?? props[fullKey] ?? props[logicalKey];
}

export function unwrapGhlFieldValue(value) {
  if (value === undefined || value === null || value === '') return value;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const inner = value.value ?? value.key ?? value.label ?? value.name ?? value.amount;
    if (inner !== undefined && inner !== null && inner !== '') return inner;
  }
  return value;
}

export function pickVoyagesUnwrapped(props, logicalKey) {
  return unwrapGhlFieldValue(pickVoyages(props, logicalKey));
}
