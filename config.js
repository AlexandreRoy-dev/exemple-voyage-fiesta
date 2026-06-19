(function () {
    /** Primary suppliers shown in filters; all others match "Autres" */
    window.KNOWN_SUPPLIERS = [
        'Vacances Sunwing',
        'Vacances Air Canada',
        'Vacances WestJet Québec',
        'Vacances Transat'
    ];

    /** Destinations (boutique filter) — must match GHL field `destination1` exactly */
    window.FILTER_DESTINATIONS = [
        'Amsterdam',
        'Antigua',
        'Aruba',
        'Athènes',
        'Bahamas',
        'Bali',
        'Barcelone',
        'Belize',
        'Berlin',
        'Boracay',
        'Boston',
        'Budapest',
        'Cancun',
        'Cap-Vert',
        'Cartagena',
        'Cayo Coco',
        'Charleston',
        'Chicago',
        'Cozumel',
        'Cracovie',
        'Cuba',
        'Curaçao',
        'Dublin',
        'Égypte',
        'Floride',
        'Grenade',
        'Hanoï',
        'Hawaii',
        'Holbox',
        'Holguin',
        'Île Maurice',
        'Istanbul',
        'Jamaïque',
        'La Havane',
        'Las Vegas',
        'Lisbonne',
        'Londres',
        'Los Angeles',
        'Los Cabos',
        'Madrid',
        'Malaga',
        'Maldives',
        'Marrakech',
        'Miami',
        'Monaco',
        'Montego Bay',
        'Mont-Tremblant',
        'New York',
        'Nice',
        'Orlando',
        'Paris',
        'Phuket',
        'Prague',
        'Puerto Vallarta',
        'Punta Cana',
        'Québec',
        'Rio de Janeiro',
        'Riviera Maya',
        'Rome',
        'Saint-Barthélemy',
        'Saint-Martin',
        'Sainte-Lucie',
        'San Francisco',
        'Santo Domingo',
        'Seychelles',
        'Split',
        'Stockholm',
        'Tenerife',
        'Tokyo',
        'Turks et Caicos',
        'Varadero',
        'Vancouver',
        'Venise',
        'Vienne',
        'Zanzibar'
    ];

    /** Critères (boutique filter) — labels + GHL keys from field `criteria` */
    window.CRITERIA_OPTIONS = [
        { label: 'Tout inclus', value: 'tout_inclus_allinclusive' },
        { label: 'Pour adultes (18+)', value: 'pour_adultes_18' },
        { label: 'Familial', value: 'familial' },
        { label: 'Romantique / Lune de miel', value: 'romantique__lune_de_miel' },
        { label: 'Tranquille / Détente', value: 'tranquille__dtente' },
        { label: 'Animation / Fête', value: 'animation__fte' },
        { label: 'Pour célibataires', value: 'pour_celibataires' },
        { label: 'Adapté aux bébés', value: 'adapt_aux_bbs' },
        { label: 'Directement sur la plage', value: 'directement_sur_la_plage' },
        { label: 'Vue sur la mer', value: 'vue_sur_la_mer' },
        { label: 'Deuxième ligne (courte marche)', value: 'deuxime_ligne_courte_marche' },
        { label: 'Près du centre-ville', value: 'prs_du_centreville' },
        { label: 'Isolé / En nature', value: 'isol__en_nature' },
        { label: 'Déjeuners inclus', value: 'djeuners_inclus' },
        { label: 'Plan européen (sans repas)', value: 'plan_europen_sans_repas' },
        { label: 'Boissons de marques premium incluses', value: 'boissons_de_marques_premium_incluses' },
        { label: 'Soupers à la carte illimités', value: 'soupers__la_carte_illimits' },
        { label: "Glissades d'eau / Parc aquatique", value: 'glissades_deau__parc_aquatique' },
        { label: 'Piscine pour enfants', value: 'piscine_pour_enfants' },
        { label: 'Piscine réservée aux adultes', value: 'piscine_rserve_aux_adultes' },
        { label: 'Piscine à débordement (Infinity)', value: 'piscine__dbordement_infinity' },
        { label: 'Prendre un verre dans la piscine (Swim-up bar)', value: 'prendre_un_verre_dans_la_piscine_swim_up_bar' },
        { label: 'Section Privilège / Club sélect', value: 'section_privilge__club_slect' },
        { label: 'Spa / Centre de bien-être', value: 'spa__centre_de_bientre' },
        { label: 'Wi-Fi gratuit partout', value: 'wifi_gratuit_partout' },
        { label: 'Wi-Fi gratuit au lobby seulement', value: 'wifi_gratuit_au_lobby_seulement' },
        { label: 'Service aux chambres 24h', value: 'service_aux_chambres_24h' },
        { label: 'Récemment rénové', value: 'rcemment_rnov' },
        { label: 'Accessible en fauteuil roulant', value: 'accessible_en_fauteuil_roulant' },
        { label: 'Parcours de golf à proximité', value: 'parcours_de_golf__proximit' },
        { label: 'Centre de plongée (PADI)', value: 'centre_de_plonge_padi' },
        { label: 'Tennis', value: 'tennis' },
        { label: 'Sports nautiques non motorisés inclus', value: 'sports_nautiques_non_motoriss_inclus' },
        { label: 'Gym / Centre de fitness', value: 'gym__centre_de_fitness' },
        { label: 'Casino sur place', value: 'casino_sur_place' },
        { label: 'Vol direct (Sans escale)', value: 'vol_direct_sans_escale' },
        { label: 'Transferts aéroport-hôtel inclus', value: 'transferts_aroporthtel_inclus' },
        { label: 'Départ de nuit', value: 'dpart_de_nuit' },
        { label: 'Sièges en classe économique privilège', value: 'siges_en_classe_conomique_privilge' }
    ];

    window.CRITERIA_BY_VALUE = Object.fromEntries(
        window.CRITERIA_OPTIONS.map(o => [o.value, o.label])
    );

    /** GHL auto-slugs that differ from the canonical key (typos / legacy) */
    window.CRITERIA_ALIASES = {
        pour_clibataires: 'pour_celibataires'
    };

    /** @deprecated use CRITERIA_OPTIONS — kept for backward compatibility */
    window.FILTER_CRITERIA = window.CRITERIA_OPTIONS.map(o => o.label);

    /** Departure airports — synced with GHL field `departure_airport` */
    window.FILTER_AIRPORTS = [
        'Montréal (YUL)',
        'Québec (YQB)',
        'Ottawa (YOW)',
        'Toronto (YYZ)',
        'Halifax (YHZ)',
        'Vancouver (YVR)'
    ];

    /** Static product feed — synced by GitHub Actions from GHL */
    window.PRODUCTS_JSON_URL = 'products.json';

    /** GHL reservation form — « Réservation de forfait » (prefill: forfait_slug) */
    window.GHL_FORM_EMBED_URL = 'https://api.leadconnectorhq.com/widget/form/V5DftNAy6QDV4X64bYzV';

    window.destLabels = {
        SUD: 'Sud',
        EUROPE: 'Europe',
        'CROISIÈRE': 'Croisière',
        CIRCUIT: 'Circuit',
        CANADA: 'Canada',
        USA: 'États-Unis'
    };

    /** GHL field: custom_objects.forfaits_voyage.state */
    window.PRODUCT_STATES = {
        ACTIF: 'actif',
        BROUILLON: 'brouillon',
        COMPLET: 'complet_sold_out',
        ARCHIVE: 'archiv'
    };

    /** Visible on boutique + indexable for SEO (actif + complet) */
    window.VISIBLE_STATES = ['actif', 'complet_sold_out'];
})();
