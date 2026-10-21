/**
 * Realistic Atrium v3 envelopes for tests and the public fixture.
 * Field names follow openapi.yaml (Groupe, Hotel, CruiseNavire, CruiseCompagnie)
 * plus additionalProperties used by the catalogue (titre, destination, listes de texte).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const hotels = [
  {
    id_hotel: 1269,
    nom: 'Riu Guanacaste',
    destination: 'Liberia',
    chaine: 'RIU',
    etoiles: 4.5,
    description_fr: 'Hôtel en bord de mer à Matapalo, avec un grand complexe de piscines et un accès à la plage.',
    services: ['Salle d\'entraînement', 'Club enfants', 'Spa', 'Accès Internet', 'Accessible'],
    url_img: 'https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg?auto=compress&cs=tinysrgb&w=1400',
    images: [
      'https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/189296/pexels-photo-189296.jpeg?auto=compress&cs=tinysrgb&w=1200'
    ]
  },
  {
    id_hotel: 287,
    nom: 'Bahia Principe Grand El Portillo',
    destination: 'Samana',
    chaine: 'Bahia Principe',
    etoiles: 4,
    description_fr: 'Resort tout inclus sur la côte de Samaná, avec plage et restaurants sur place.',
    services: ['Plage', 'Tout inclus', 'Club enfants', 'Piscine'],
    url_img: 'https://images.pexels.com/photos/1450360/pexels-photo-1450360.jpeg?auto=compress&cs=tinysrgb&w=1400'
  },
  {
    id_hotel: 44,
    nom: 'Barcelo Bavaro Palace',
    destination: 'Punta Cana',
    chaine: 'Barcelo',
    etoiles: 5,
    description_fr: 'Grand resort de Punta Cana, côté plage, avec golf à proximité et plusieurs restaurants.',
    services: ['Golf à proximité', 'Spa', 'Casino', 'Plage'],
    url_img: 'https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg?auto=compress&cs=tinysrgb&w=1400'
  },
  {
    id_hotel: 880,
    nom: 'Riu Palace Macao',
    destination: 'Punta Cana',
    chaine: 'RIU',
    etoiles: 5,
    description_fr: 'Resort adultes en bord de mer à Bávaro, formule tout inclus.',
    services: ['Adultes', 'Spa', 'Plage', 'Tout inclus'],
    url_img: 'https://images.pexels.com/photos/237272/pexels-photo-237272.jpeg?auto=compress&cs=tinysrgb&w=1400'
  },
  {
    id_hotel: 515,
    nom: 'Riu Ocho Rios',
    destination: 'Ocho Rios',
    chaine: 'RIU',
    etoiles: 4,
    description_fr: 'Hôtel de plage à Ocho Rios, avec piscine et animations.',
    services: ['Plage', 'Piscine', 'Animations'],
    url_img: 'https://images.pexels.com/photos/1174732/pexels-photo-1174732.jpeg?auto=compress&cs=tinysrgb&w=1400'
  },
  {
    id_hotel: 640,
    nom: 'Grand Palladium Colonial',
    destination: 'Riviera Maya',
    chaine: 'Palladium',
    etoiles: 4.5,
    description_fr: 'Resort familial sur la Riviera Maya, avec parc aquatique et plage.',
    services: ['Familial', 'Parc aquatique', 'Plage'],
    url_img: 'https://images.pexels.com/photos/261395/pexels-photo-261395.jpeg?auto=compress&cs=tinysrgb&w=1400'
  }
];

const navires = [
  {
    id_navire: 301,
    id_compagnie: 12,
    nom: 'MSC Virtuosa',
    nom_compagnie: 'MSC Croisières',
    description_titre_fr: 'Navire de la classe Meraviglia, avec promenades intérieures et plusieurs restaurants.',
    date_lancement: '2021-02-01',
    tonnage: 181541,
    nb_passager: 6334,
    nb_equipage: 1704,
    cote_ensemble: 4.2,
    url_img_main: 'https://images.pexels.com/photos/813011/pexels-photo-813011.jpeg?auto=compress&cs=tinysrgb&w=1400',
    alts_img: [
      'https://images.pexels.com/photos/2044434/pexels-photo-2044434.jpeg?auto=compress&cs=tinysrgb&w=1200'
    ],
    wifi: 'Internet',
    piscine: 'Piscines',
    spa: 'Spa',
    club_enfants: 'Club enfants',
    theatre: 0
  },
  {
    id_navire: 302,
    id_compagnie: 18,
    nom: 'Symphony of the Seas',
    nom_compagnie: 'Royal Caribbean',
    description_titre_fr: 'Grand navire des Caraïbes, avec quartiers distincts et nombreuses activités à bord.',
    date_lancement: '2018-04-07',
    tonnage: 228081,
    nb_passager: 6680,
    nb_equipage: 2200,
    cote_ensemble: 4.4,
    url_img_main: 'https://images.pexels.com/photos/1371360/pexels-photo-1371360.jpeg?auto=compress&cs=tinysrgb&w=1400',
    piscine: 'Piscines',
    parc_aquatique: 'Parc aquatique',
    spa: 'Spa',
    club_enfants: 'Club enfants'
  },
  {
    id_navire: 303,
    id_compagnie: 21,
    nom: 'Norwegian Joy',
    nom_compagnie: 'Norwegian Cruise Line',
    description_titre_fr: 'Navire Norwegian avec restaurants libres et spectacles en soirée.',
    date_lancement: '2017-04-27',
    tonnage: 167725,
    nb_passager: 3804,
    nb_equipage: 1840,
    url_img_main: 'https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=1400',
    casino: 'Casino',
    spa: 'Spa',
    piscine: 'Piscines'
  }
];

const compagnies = [
  {
    id_compagnie: 12,
    nom_fr: 'MSC Croisières',
    nom_en: 'MSC Cruises',
    description_fr: 'Compagnie européenne, départs fréquents dans les Caraïbes et en Méditerranée.',
    luxe: false
  },
  {
    id_compagnie: 18,
    nom_fr: 'Royal Caribbean',
    nom_en: 'Royal Caribbean',
    description_fr: 'Grands navires, activités à bord et itinéraires dans les Caraïbes.',
    luxe: false
  },
  {
    id_compagnie: 21,
    nom_fr: 'Norwegian Cruise Line',
    nom_en: 'Norwegian Cruise Line',
    description_fr: 'Formule libre, restaurants et spectacles inclus selon la catégorie de cabine.',
    luxe: false
  }
];

function groupe(partial) {
  return {
    status: 'actif',
    devise: 'CAD',
    secret_echo: 'do-not-publish',
    ...partial
  };
}

const sud = [
  groupe({
    id_groupe: 661,
    type: 'sud',
    ordre: 1,
    titre: 'Noël au Costa Rica, tout inclus',
    destination: 'Liberia',
    pays: 'Costa Rica',
    region: 'Amérique centrale',
    date_depart: '2026-12-21',
    date_expire: '2026-12-18',
    nb_jours: 8,
    nb_nuits: 7,
    prix_appel: '2959',
    prix_old_appel: '3505',
    id_hotel: 1269,
    nom_hotel: 'Riu Guanacaste',
    points_forts: [
      'Départ de Montréal en décembre, hôtel tout inclus à Guanacaste.',
      'Sept nuits au Riu Guanacaste, transferts et taxes du forfait inclus.'
    ],
    inclusions: [
      'Vol au départ de Montréal',
      'Transferts aéroport et hôtel',
      '7 nuits en tout inclus',
      'Taxes du forfait'
    ],
    exclusions: ['Assurance voyage', 'Dépenses personnelles', 'Excursions en option'],
    services: ['Vol', 'Autobus', 'Hébergement'],
    list_date: [{ id_groupe_date: 6611, date_depart: '2026-12-21', date_desc: 'Départ de Montréal', ordre: 1 }],
    list_vol: [{
      aller_retour: 'aller',
      compagnie_aerienne: 'WestJet',
      numero_vol: 'WS2700',
      aeroport_depart: 'Montréal (YUL)',
      date_depart: '2026-12-21',
      heure_depart: '08:30',
      aeroport_arrivee: 'Liberia (LIR)',
      date_arrivee: '2026-12-21',
      heure_arrivee: '13:05',
      ordre: 1
    }],
    list_prix: [{
      categorie: 'Tout inclus',
      prix: '2959.00',
      prix_ancien: '3505.00',
      disponibilite: '10 places'
    }],
    list_image: [
      { url: 'https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg?auto=compress&cs=tinysrgb&w=1400', titre: 'Piscine de l\'hôtel' },
      { url: 'https://images.pexels.com/photos/1450363/pexels-photo-1450363.jpeg?auto=compress&cs=tinysrgb&w=1200', titre: 'Plage' }
    ]
  }),
  groupe({
    id_groupe: 6,
    type: 'sud',
    ordre: 2,
    titre: 'Samana, Bahia Principe Grand El Portillo',
    destination: 'Samana',
    pays: 'République dominicaine',
    region: 'Caraïbes',
    date_depart: '2026-10-26',
    nb_jours: 8,
    nb_nuits: 7,
    prix_appel: 2569,
    id_hotel: 287,
    nom_hotel: 'Bahia Principe Grand El Portillo',
    points_forts: ['Semaine tout inclus à Samaná, au départ de Montréal.'],
    inclusions: ['Vol', 'Transferts', '7 nuits tout inclus'],
    exclusions: ['Assurance voyage', 'Pourboires'],
    services: ['Vol', 'Hébergement'],
    list_prix: [{ categorie: 'Tout inclus', prix: 2569, disponibilite: '6 places' }],
    list_date: [{ date_depart: '2026-10-26', ordre: 1 }]
  }),
  groupe({
    id_groupe: 545,
    type: 'sud',
    ordre: 3,
    titre: 'Groupe golf avec départ de Montréal',
    destination: 'Punta Cana',
    pays: 'République dominicaine',
    region: 'Caraïbes',
    date_depart: '2026-12-05',
    nb_jours: 8,
    nb_nuits: 7,
    prix_appel: 3099,
    prix_old_appel: 3399,
    id_hotel: 44,
    nom_hotel: 'Barcelo Bavaro Palace',
    points_forts: ['Séjour golf à Punta Cana, hôtel Barcelo Bavaro Palace.'],
    inclusions: ['Vol de Montréal', '7 nuits', 'Transferts'],
    exclusions: ['Droits de golf', 'Assurance voyage'],
    services: ['Vol', 'Hébergement'],
    list_prix: [{ categorie: 'Chambre double', prix: 3099, prix_ancien: 3399, disponibilite: '8 places' }]
  }),
  groupe({
    id_groupe: 670,
    type: 'sud',
    ordre: 4,
    titre: 'Jour de l\'an en Jamaïque',
    destination: 'Ocho Rios',
    pays: 'Jamaïque',
    region: 'Caraïbes',
    date_depart: '2026-12-30',
    nb_jours: 8,
    nb_nuits: 7,
    prix_appel: 2659,
    id_hotel: 515,
    nom_hotel: 'Riu Ocho Rios',
    points_forts: ['Départ du 30 décembre vers Ocho Rios, formule tout inclus.'],
    inclusions: ['Vol', '7 nuits', 'Transferts'],
    exclusions: ['Assurance voyage'],
    services: ['Vol', 'Hébergement'],
    list_prix: [{ categorie: 'Tout inclus', prix: 2659, disponibilite: '12 places' }]
  })
];

const extraSud = [
  ['701', 'Cancún en famille', 'Cancun', 'Mexique', '2027-01-16', 1899, 640, 'Grand Palladium Colonial', 8],
  ['702', 'Punta Cana, semaine détente', 'Punta Cana', 'République dominicaine', '2027-01-23', 2149, 880, 'Riu Palace Macao', 5],
  ['703', 'Riviera Maya, tout inclus', 'Riviera Maya', 'Mexique', '2027-02-06', 2290, 640, 'Grand Palladium Colonial', 6],
  ['704', 'Puerto Plata, départ de Québec', 'Puerto Plata', 'République dominicaine', '2027-02-13', 1750, 287, 'Bahia Principe Grand El Portillo', 9],
  ['705', 'Liberia, retour au Costa Rica', 'Liberia', 'Costa Rica', '2027-02-20', 2790, 1269, 'Riu Guanacaste', 4],
  ['706', 'Montego Bay, une semaine', 'Montego Bay', 'Jamaïque', '2027-03-06', 2410, 515, 'Riu Ocho Rios', 7],
  ['707', 'Samana au printemps', 'Samana', 'République dominicaine', '2027-03-13', 1985, 287, 'Bahia Principe Grand El Portillo', 10],
  ['708', 'Punta Cana en mars', 'Punta Cana', 'République dominicaine', '2027-03-20', 2050, 44, 'Barcelo Bavaro Palace', 11],
  ['709', 'Cancún, départ du 27 mars', 'Cancun', 'Mexique', '2027-03-27', 2195, 640, 'Grand Palladium Colonial', 12],
  ['710', 'Ocho Rios en avril', 'Ocho Rios', 'Jamaïque', '2027-04-03', 2320, 515, 'Riu Ocho Rios', 13]
];

for (const [id, titre, destination, pays, date, prix, hotelId, hotel, ordre] of extraSud) {
  sud.push(groupe({
    id_groupe: Number(id),
    type: 'sud',
    ordre,
    titre,
    destination,
    pays,
    region: 'Caraïbes',
    date_depart: date,
    nb_jours: 8,
    nb_nuits: 7,
    prix_appel: prix,
    id_hotel: hotelId,
    nom_hotel: hotel,
    points_forts: [`Forfait sud de 7 nuits à ${destination}.`],
    inclusions: ['Vol au départ du Québec', '7 nuits', 'Transferts'],
    exclusions: ['Assurance voyage', 'Dépenses personnelles'],
    services: ['Vol', 'Hébergement'],
    list_prix: [{ categorie: 'Tout inclus', prix, disponibilite: 'Places limitées' }],
    list_date: [{ date_depart: date, ordre: 1 }]
  }));
}

const cruises = [
  ['801', 'Croisière 7 nuits, Caraïbes au départ de Miami', 'Miami', 'Caraïbes', '2026-11-29', 2249, 301, 12, 'MSC Croisières', 'MSC Virtuosa', 1],
  ['802', 'Croisière 7 nuits au départ de Fort Lauderdale', 'Fort Lauderdale', 'Caraïbes', '2026-12-10', 2499, 302, 18, 'Royal Caribbean', 'Symphony of the Seas', 2],
  ['803', 'Croisière 7 nuits, Bahamas et Caraïbes', 'Miami', 'Bahamas', '2026-12-17', 1849, 303, 21, 'Norwegian Cruise Line', 'Norwegian Joy', 3],
  ['804', 'Croisière 12 nuits dans les Caraïbes du Sud', 'San Juan', 'Caraïbes', '2027-01-09', 2890, 301, 12, 'MSC Croisières', 'MSC Virtuosa', 4],
  ['805', 'Croisière 7 nuits, escales en République dominicaine', 'Miami', 'République dominicaine', '2027-01-16', 2099, 302, 18, 'Royal Caribbean', 'Symphony of the Seas', 5],
  ['806', 'Croisière 7 nuits vers Cozumel', 'Galveston', 'Mexique', '2027-01-30', 1690, 303, 21, 'Norwegian Cruise Line', 'Norwegian Joy', 6],
  ['807', 'Croisière 14 nuits, canal et Caraïbes', 'Miami', 'Caraïbes', '2027-02-07', 3490, 301, 12, 'MSC Croisières', 'MSC Virtuosa', 7],
  ['808', 'Croisière 7 nuits, côte ouest des Caraïbes', 'Miami', 'Caraïbes', '2027-02-14', 1980, 302, 18, 'Royal Caribbean', 'Symphony of the Seas', 8],
  ['809', 'Croisière 7 nuits au départ de Tampa', 'Tampa', 'Caraïbes', '2027-02-21', 1760, 303, 21, 'Norwegian Cruise Line', 'Norwegian Joy', 9],
  ['810', 'Croisière 7 nuits, îles Vierges', 'San Juan', 'Îles Vierges', '2027-03-06', 2310, 301, 12, 'MSC Croisières', 'MSC Virtuosa', 10],
  ['811', 'Croisière 5 nuits, Bahamas courtes', 'Miami', 'Bahamas', '2027-03-13', 1290, 302, 18, 'Royal Caribbean', 'Symphony of the Seas', 11],
  ['812', 'Croisière 7 nuits, Jamaïque et Cayman', 'Fort Lauderdale', 'Jamaïque', '2027-03-20', 2150, 303, 21, 'Norwegian Cruise Line', 'Norwegian Joy', 12],
  ['813', 'Croisière 10 nuits, Caraïbes du Sud', 'Miami', 'Caraïbes', '2027-04-04', 2680, 301, 12, 'MSC Croisières', 'MSC Virtuosa', 13]
].map(([id, titre, destination, pays, date, prix, navireId, compagnieId, compagnie, navire, ordre]) => groupe({
  id_groupe: Number(id),
  type: 'cruise',
  ordre,
  titre,
  destination,
  pays,
  region: 'Caraïbes',
  date_depart: date,
  nb_jours: titre.includes('12 nuits') ? 13 : titre.includes('14 nuits') ? 15 : titre.includes('10 nuits') ? 11 : titre.includes('5 nuits') ? 6 : 8,
  nb_nuits: titre.includes('12 nuits') ? 12 : titre.includes('14 nuits') ? 14 : titre.includes('10 nuits') ? 10 : titre.includes('5 nuits') ? 5 : 7,
  prix_appel: prix,
  id_navire: navireId,
  id_compagnie: compagnieId,
  compagnie_cruise: compagnie,
  navire_nom: navire,
  points_forts: [`${titre}. Cabines intérieures à partir du prix affiché.`],
  inclusions: ['Cabine intérieure', 'Repas principaux', 'Animations à bord', 'Taxes portuaires du tarif'],
  exclusions: ['Vol vers le port', 'Pourboires', 'Excursions', 'Boissons selon la compagnie'],
  services: ['Hébergement', 'Restauration'],
  list_prix: [
    { categorie: 'Cabine intérieure', prix, disponibilite: 'Sous réserve' },
    { categorie: 'Cabine balcon', prix: prix + 640, disponibilite: 'Sous réserve' }
  ],
  list_date: [{ date_depart: date, ordre: 1 }]
}));

const voyages = [
  ['901', 'Une autre facette de la Thaïlande', 'Bangkok', 'Thaïlande', '2026-11-06', 3479, 14, 1],
  ['902', 'Laos et Cambodge', 'Siem Reap', 'Cambodge', '2026-11-09', 3969, 16, 2],
  ['903', 'Circuit Portugal et Lisbonne', 'Lisbonne', 'Portugal', '2027-04-18', 2890, 10, 3],
  ['904', 'Italie du Nord en petit groupe', 'Milan', 'Italie', '2027-05-02', 3120, 9, 4],
  ['905', 'Andalousie, villes et côte', 'Malaga', 'Espagne', '2027-05-09', 2740, 8, 5],
  ['906', 'Islande, route du sud', 'Reykjavik', 'Islande', '2027-06-12', 3590, 8, 6],
  ['907', 'Japon, Tokyo et Kyoto', 'Tokyo', 'Japon', '2027-10-03', 4890, 12, 7],
  ['908', 'Maroc impérial', 'Marrakech', 'Maroc', '2027-03-04', 2190, 8, 8]
].map(([id, titre, destination, pays, date, prix, nuits, ordre]) => groupe({
  id_groupe: Number(id),
  type: 'voyage',
  ordre,
  titre,
  destination,
  pays,
  region: 'Circuit',
  date_depart: date,
  nb_jours: nuits + 1,
  nb_nuits: nuits,
  prix_appel: prix,
  points_forts: [`Circuit accompagné: ${titre}.`],
  inclusions: ['Hébergement selon l\'itinéraire', 'Déjeuners indiqués au programme', 'Transport entre les étapes'],
  exclusions: ['Vol international sauf mention', 'Pourboires', 'Repas libres'],
  services: ['Hébergement', 'Autocar'],
  description: `Voyage de groupe de ${nuits} nuits, avec les étapes principales annoncées par l'agence.`,
  list_iti: [
    { titre: `Jour 1, arrivée à ${destination}`, description: 'Accueil et installation à l\'hôtel.' },
    { titre: 'Jours suivants', description: 'Visites et temps libre selon le programme remis avant le départ.' }
  ],
  list_prix: [{ categorie: 'Prix par personne', prix, disponibilite: 'Groupe limité' }],
  list_image: [{
    url: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=1400',
    titre: destination
  }],
  list_date: [{ date_depart: date, ordre: 1 }]
}));

const inactive = groupe({
  id_groupe: 9999,
  type: 'sud',
  status: 'inactif',
  titre: 'Groupe retiré du catalogue',
  destination: 'Nulle part',
  date_depart: '2027-01-01',
  prix_appel: 1,
  nom_hotel: 'Ne pas afficher'
});

const envelope = (data) => ({ status: 'success', data });

const fixture = {
  groupes: envelope([...sud, ...cruises, ...voyages, inactive]),
  hotels: envelope(hotels),
  navires: envelope(navires),
  compagnies: envelope(compagnies)
};

mkdirSync(__dirname, { recursive: true });
const target = join(__dirname, 'atrium-api.json');
writeFileSync(target, `${JSON.stringify(fixture)}\n`);
console.log(`wrote ${target} groupes=${fixture.groupes.data.length}`);
