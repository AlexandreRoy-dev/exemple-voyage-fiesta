/**
 * Champs de l'objet existant custom_objects.groupes.
 * Les clés de repli ne servent que si le schéma n'a pas pu être lu.
 * Avec un schéma, la clé GHL (suffixe de custom_objects.groupes.) est
 * essayée d'abord. L'étiquette ne sert que si aucune clé ne correspond.
 */
export const GROUPES_SCHEMA_KEY = 'custom_objects.groupes';

export const GROUPE_FIELD_DEFS = [
  { logical: 'atrium_id', labels: ['Atrium ID', 'ID Atrium', 'ID Atrium (ne pas modifier)'], fallback: 'atrium_id' },
  { logical: 'slug', labels: ['Slug', 'Slug public'], fallback: 'slug' },
  { logical: 'type_groupe', labels: ['Type de groupe', 'Type groupe', 'Type'], fallback: 'type_groupe' },
  { logical: 'statut_synchro', labels: ['Statut synchro', 'Statut de synchro', 'Statut synchronisation'], fallback: 'statut_synchro' },
  { logical: 'lien_page', labels: ['Lien de la page', 'Lien page'], fallback: 'lien_page' },
  { logical: 'destination', labels: ['Destination'], fallback: 'destination' },
  { logical: 'pays', labels: ['Pays'], fallback: 'pays' },
  { logical: 'region', labels: ['Région', 'Region'], fallback: 'region' },
  { logical: 'date_depart', labels: ['Date de départ', 'Date départ'], fallback: 'date_depart' },
  { logical: 'date_expiration', labels: ["Date d'expiration", 'Date expiration'], fallback: 'date_expiration' },
  { logical: 'autres_dates', labels: ['Autres dates'], fallback: 'autres_dates' },
  { logical: 'description_groupe', labels: ['Description du groupe', 'Description groupe'], fallback: 'description_groupe' },
  { logical: 'derniere_synchro', labels: ['Dernière synchro', 'Derniere synchro', 'Dernière synchronisation'], fallback: 'derniere_synchro' },
  { logical: 'titre', labels: ['Titre', 'Nom du groupe', 'Titre du groupe'], fallback: '' },
  { logical: 'hotel', labels: ['Hôtel', 'Hotel'], fallback: '' },
  { logical: 'hotel_etoiles', labels: ['Étoiles', 'Etoiles'], fallback: '' },
  { logical: 'chaine', labels: ['Chaîne', 'Chaine'], fallback: '' },
  { logical: 'hotel_description', labels: ["Description de l'hôtel", 'Description hôtel'], fallback: '' },
  { logical: 'compagnie', labels: ['Compagnie', 'Compagnie de croisière'], fallback: '' },
  { logical: 'navire', labels: ['Navire'], fallback: '' },
  { logical: 'navire_description', labels: ['Description du navire', 'Description navire'], fallback: '' },
  { logical: 'itineraire', labels: ['Itinéraire', 'Itineraire'], fallback: '' },
  { logical: 'duree_jours', labels: ['Durée jours', 'Durée (jours)'], fallback: '' },
  { logical: 'duree_nuits', labels: ['Durée nuits', 'Durée (nuits)'], fallback: '' },
  { logical: 'points_forts', labels: ['Points forts'], fallback: '' },
  { logical: 'inclusions', labels: ['Inclusions'], fallback: '' },
  { logical: 'prix_appel', labels: ["Prix d'appel", 'Prix appel'], fallback: '' },
  { logical: 'prix_ancien', labels: ['Ancien prix'], fallback: '' },
  { logical: 'tarifs', labels: ['Tarifs'], fallback: '' },
  { logical: 'vols', labels: ['Vols'], fallback: '' },
  { logical: 'photo_principale', labels: ['Photo principale'], fallback: '' },
  { logical: 'photo_url', labels: ['URL photo principale', 'URL de la photo', 'Photo URL'], fallback: '' },
  { logical: 'photos', labels: ['Photos', 'Galerie photos'], fallback: '' },
  { logical: 'compagnie_aerienne', labels: ['Compagnie aérienne', 'Compagnie aerienne'], fallback: 'compagnie_aerienne' },
  { logical: 'vols_detail', labels: ['Détail des vols', 'Vols détail', 'Détail vols'], fallback: 'vols_detail' },
  { logical: 'tarifs_detail', labels: ['Détail des tarifs', 'Tarifs détail', 'Détail tarifs'], fallback: 'tarifs_detail' },
  { logical: 'galerie_urls', labels: ['URLs galerie', 'Galerie URLs', 'URLs de la galerie'], fallback: 'galerie_urls' },
  { logical: 'photo_principale_url', labels: ['URL de la photo principale', 'Photo principale URL'], fallback: 'photo_principale_url' },
  { logical: 'hotel_chaine', labels: ['Chaîne hôtelière', 'Chaine hôtelière', 'Chaîne hôtel'], fallback: 'hotel_chaine' },
  { logical: 'aeroport_depart', labels: ['Aéroport de départ', 'Aeroport de depart', 'Aéroport départ'], fallback: 'aeroport_depart' },
  { logical: 'programme', labels: ['Programme'], fallback: 'programme' },
  { logical: 'devise', labels: ['Devise'], fallback: 'devise' },
  { logical: 'nombre_photos', labels: ['Nombre de photos', 'Nombre photos'], fallback: 'nombre_photos' },
  { logical: 'navire_annee', labels: ['Année du navire', 'Annee du navire', 'Année navire'], fallback: 'navire_annee' },
  { logical: 'navire_passagers', labels: ['Passagers du navire', 'Passagers navire'], fallback: 'navire_passagers' }
];

export function foldLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function fieldSuffix(fieldKey) {
  if (!fieldKey) return '';
  const parts = String(fieldKey).split('.');
  return parts[parts.length - 1];
}

function schemaFieldList(schemaJson) {
  if (!schemaJson) return [];
  const object = schemaJson.object || schemaJson;
  const fields = object.fields || schemaJson.fields || [];
  return Array.isArray(fields) ? fields : [];
}

export function bindGroupeFields(schemaJson) {
  const list = schemaFieldList(schemaJson);
  const bound = {};
  if (!list.length) {
    for (const def of GROUPE_FIELD_DEFS) {
      if (!def.fallback) continue;
      bound[def.logical] = { key: def.fallback, type: 'TEXT', options: [], label: def.labels[0] };
    }
    return { bound, schemaCount: 0, usedFallback: true, unmapped: [] };
  }
  const byKey = new Map();
  const byLabel = new Map();
  for (const field of list) {
    const key = fieldSuffix(field.fieldKey || field.key);
    if (key && !byKey.has(key)) byKey.set(key, field);
    const label = foldLabel(field.label || field.name || '');
    if (label && !byLabel.has(label)) byLabel.set(label, field);
  }
  const used = new Set();
  for (const def of GROUPE_FIELD_DEFS) {
    const keyNames = [def.logical, def.fallback].filter(Boolean);
    const hit = keyNames.map((name) => byKey.get(name)).find(Boolean)
      || def.labels.map((label) => byLabel.get(foldLabel(label))).find(Boolean);
    if (!hit) continue;
    const key = fieldSuffix(hit.fieldKey || hit.key);
    if (!key) continue;
    bound[def.logical] = {
      key,
      type: String(hit.dataType || hit.type || 'TEXT').toUpperCase(),
      options: hit.options || hit.picklistOptions || [],
      label: hit.label || def.labels[0]
    };
    used.add(hit);
  }
  const unmapped = list
    .filter((field) => !used.has(field))
    .map((field) => ({
      key: fieldSuffix(field.fieldKey || field.key),
      label: field.label || field.name || '',
      type: String(field.dataType || field.type || '')
    }));
  return { bound, schemaCount: list.length, usedFallback: false, unmapped };
}

export function analyzeCatalog(groups = []) {
  const types = {};
  for (const group of groups) {
    const type = group?.type || 'autre';
    if (!types[type]) {
      types[type] = {
        count: 0,
        hotel: 0,
        navire: 0,
        prix: 0,
        image: 0,
        description: 0,
        vols: 0,
        tarifs: 0,
        itineraire: 0
      };
    }
    const row = types[type];
    row.count += 1;
    if (group.hotel) row.hotel += 1;
    if (group.navire) row.navire += 1;
    if (group.prixAppel) row.prix += 1;
    if (group.image) row.image += 1;
    if (String(group.description || '').trim()) row.description += 1;
    if (group.vols?.length) row.vols += 1;
    if (group.tarifs?.length) row.tarifs += 1;
    if (group.itineraire?.length) row.itineraire += 1;
  }
  return types;
}
