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
  /** Label GHL « Vol aller - heure d'arrivée » → clé générée avec __ et sans accent */
  vol_aller_heure_arrivee: 'vol_aller__heure_darrivee',
  vol_retour_numero: 'vol_retour_numero',
  vol_retour_heure_depart: 'vol_retour_heure_dpart',
  vol_retour_heure_arrivee: 'vol_retour__heure_darrivee',
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

/** Clé option GHL → libellé affiché boutique */
export const AEROPORT_LABELS = {
  montral_yul: 'Montréal (YUL)',
  qubec_yqb: 'Québec (YQB)',
  ottawa_yow: 'Ottawa (YOW)',
  toronto_yyz: 'Toronto (YYZ)',
  halifax_yhz: 'Halifax (YHZ)',
  vancouver_yvr: 'Vancouver (YVR)'
};

export function formatAeroportLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  if (AEROPORT_LABELS[key]) return AEROPORT_LABELS[key];
  if (AEROPORT_LABELS[raw]) return AEROPORT_LABELS[raw];
  return raw;
}

export function normalizeStatutOption(value) {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'actif') return 'actif';
  if (s === 'complet_sold_out' || s === 'complet' || s === 'inactif') return 'inactif';
  if (s === 'brouillon' || s === 'archiv') return 'inactif';
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
      out[key] = String(value).trim();
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
