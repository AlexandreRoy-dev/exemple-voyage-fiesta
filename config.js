(function () {
    /**
     * Libellés fournisseurs — clé normalisée (slug GHL) → nom affiché.
     * Évite le regroupement « Autres » pour sunwing, transat, etc.
     */
    window.SUPPLIER_LABELS = {
        sunwing: 'Vacances Sunwing',
        vacances_sunwing: 'Vacances Sunwing',
        air_canada: 'Vacances Air Canada',
        vacances_air_canada: 'Vacances Air Canada',
        westjet: 'Vacances WestJet Québec',
        westjet_quebec: 'Vacances WestJet Québec',
        vacances_westjet_quebec: 'Vacances WestJet Québec',
        transat: 'Vacances Transat',
        vacances_transat: 'Vacances Transat'
    };

    /** Compagnies aériennes — clé normalisée (slug GHL) → nom affiché */
    window.CARRIER_LABELS = {
        air_canada: 'Air Canada',
        westjet: 'WestJet',
        westjet_quebec: 'WestJet',
        sunwing: 'Sunwing Airlines',
        transat: 'Air Transat'
    };

    /** Alias clé normalisée → clé utilisée dans SUPPLIER_LOGOS */
    window.SUPPLIER_LOGO_KEY_ALIASES = {
        westjet: 'westjet_quebec'
    };

    /** Alias compagnie aérienne → clé logo (assets/suppliers/) */
    window.CARRIER_LOGO_KEY_ALIASES = {
        westjet: 'westjet_quebec',
        westjet_quebec: 'westjet_quebec'
    };

    /** Logos fournisseurs / compagnies — clé normalisée → chemin relatif (assets/suppliers/) */
    window.SUPPLIER_LOGOS = {
        sunwing: 'assets/suppliers/sunwing.svg',
        air_canada: 'assets/suppliers/air-canada.png',
        westjet_quebec: 'assets/suppliers/westjet-quebec.svg',
        transat: 'assets/suppliers/transat.svg'
    };

    /** Ordre préféré dans le filtre fournisseurs (clés normalisées) */
    window.KNOWN_SUPPLIER_ORDER = [
        'sunwing',
        'air_canada',
        'westjet',
        'westjet_quebec',
        'transat'
    ];

    /** @deprecated Utiliser SUPPLIER_LABELS — conservé pour compatibilité */
    window.KNOWN_SUPPLIERS = [
        'Vacances Sunwing',
        'Vacances Air Canada',
        'Vacances WestJet Québec',
        'Vacances Transat'
    ];

    /** Destinations (boutique filter) — libellés affichés; comparés en slug (voir DESTINATION_ALIASES) */
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
        'Panama',
        'Paris',
        'Phuket',
        'Prague',
        'Puerto Vallarta',
        'Punta Cana',
        'Québec',
        'Rio de Janeiro',
        'Riviera Maya',
        'Roatan',
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

    /** Alias GHL (slug / variante) → libellé filtre ou slug cible */
    window.DESTINATION_ALIASES = {
        jamaïque: 'Jamaïque',
        jamaque: 'Jamaïque',
        jamaique: 'Jamaïque',
        saintelucie: 'Sainte-Lucie',
        panama: 'Panama',
        roatan: 'Roatan',
        saintmartin: 'Saint-Martin',
        st_martin: 'Saint-Martin',
        playacar: 'Riviera Maya',
        freeport: 'Bahamas',
        republique_dominicaine: 'Punta Cana',
        cozumel: 'Cozumel'
    };

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

    /** Clés option GHL → libellé affiché (doit correspondre à FILTER_AIRPORTS) */
    window.AIRPORT_LABELS = {
        montral_yul: 'Montréal (YUL)',
        qubec_yqb: 'Québec (YQB)',
        ottawa_yow: 'Ottawa (YOW)',
        toronto_yyz: 'Toronto (YYZ)',
        halifax_yhz: 'Halifax (YHZ)',
        vancouver_yvr: 'Vancouver (YVR)'
    };

    /** Hotel star filter options (supports half stars) */
    window.FILTER_STAR_OPTIONS = [3, 3.5, 4, 4.5, 5];

    /** Static product feed — synced by GitHub Actions from GHL */
    window.PRODUCTS_JSON_URL = 'products.json';

    window.SITE_NAME = window.SITE_NAME || 'Voyage Fiesta';
    window.SITE_DEFAULT_DESCRIPTION = window.SITE_DEFAULT_DESCRIPTION
        || 'Aubaines voyage tout inclus — promotions limitées Voyage Fiesta.';
    window.SITE_DEFAULT_SHARE_IMAGE = window.SITE_DEFAULT_SHARE_IMAGE
        || 'https://images.pexels.com/photos/1450360/pexels-photo-1450360.jpeg?auto=compress&cs=tinysrgb&w=1200&fit=crop';

    /** Libellés affichés — taxes + frais aériens (GHL : taxes_amount) */
    window.TAXES_AIR_FEES_LABEL = 'Taxes et frais aériens';
    window.BEFORE_TAXES_AIR_FEES_LABEL = 'Avant taxes et frais aériens';

    /** URL publique de la boutique (iframe + liens directs) */
    window.BOUTIQUE_BASE_URL = 'https://promofiesta.roymarketing.ca';

    /** Chemin liste avec mode intégration (sans bannière hero) */
    window.BOUTIQUE_EMBED_URL = window.BOUTIQUE_BASE_URL + '/index.html?embed=1';

    /** Taux TPS/TVQ — non utilisés (taxes par occupation dans GHL) */
    window.TAX_TPS_RATE = 0.05;
    window.TAX_TVQ_RATE = 0.09975;

    /** GHL reservation form — « Réservation de forfait » (prefill via Query Key = param URL) */
    window.GHL_FORM_EMBED_URL = 'https://api.leadconnectorhq.com/widget/form/V5DftNAy6QDV4X64bYzV';

    /**
     * Query Keys envoyés à l'iframe GHL uniquement (évite URL trop longue → taxes_total1 coupé).
     * Doit correspondre aux champs cachés du formulaire.
     */
    window.GHL_FORM_IFRAME_KEYS = [
        'forfait_name',
        'occupation',
        'nombre_personnes',
        'nombre_adultes',
        'nombre_enfants_2_12',
        'nombre_enfants_13_17',
        'prix_total_avant_taxe',
        'taxes_total1',
        'taxes_par_personne',
        'tax_child_2_12',
        'tax_child_13_17',
        'depot_par_personne',
        'depot_total',
        'final_payment_date',
        'pricing_summary',
        'sommaire',
        'prix_total'
    ];

    /**
     * Champs à créer dans le formulaire GHL (type: Hidden ou Texte en lecture seule).
     * Query Key = exactement la clé ci-dessous (Settings du champ → Query Key).
     */
    window.GHL_FORM_HIDDEN_FIELDS = [
        { key: 'forfait_slug', label: 'Forfait — identifiant (slug)' },
        { key: 'forfait_name', label: 'Forfait — nom de l\'hôtel' },
        { key: 'destination', label: 'Destination' },
        { key: 'sub_destination', label: 'Sous-destination (ville)' },
        { key: 'departure_date', label: 'Date de départ' },
        { key: 'return_date', label: 'Date de retour' },
        { key: 'departure_airport', label: 'Aéroport de départ' },
        { key: 'final_payment_date', label: 'Date paiement final' },
        { key: 'deposit_amount', label: 'Dépôt requis ($ / pers.)' },
        { key: 'occupation', label: 'Occupation — libellé (Occ. double, etc.)' },
        { key: 'occupation_label', label: 'Occupation — libellé' },
        { key: 'selected_price', label: 'Prix sélectionné — avant taxes et frais aériens ($ / pers.)' },
        { key: 'selected_taxes', label: 'Taxes et frais aériens / pers. pour l\'occupation choisie ($)' },
        { key: 'selected_total', label: 'Total par personne (forfait + taxes et frais aériens) ($ / pers.)' },
        { key: 'nombre_personnes', label: 'Nombre total de voyageurs' },
        { key: 'nombre_adultes', label: 'Nombre d\'adultes' },
        { key: 'nombre_enfants_2_12', label: 'Nombre d\'enfants 2-12 ans' },
        { key: 'nombre_enfants_13_17', label: 'Nombre d\'enfants 13-17 ans' },
        { key: 'depot_par_personne', label: 'Dépôt par personne ($)' },
        { key: 'depot_total', label: 'Dépôt total (dépôt × nb personnes)' },
        { key: 'prix_adulte_unitaire', label: 'Prix unitaire adulte ($)' },
        { key: 'prix_enfant_2_12_unitaire', label: 'Prix unitaire enfant 2-12 ($)' },
        { key: 'prix_total_avant_taxes', label: 'Prix total avant taxes et frais aériens ($)' },
        { key: 'taxes_total', label: 'Taxes et frais aériens totaux ($) — montant × nb personnes' },
        { key: 'taxes_total1', label: 'Alias taxes et frais aériens totaux (formulaire client)' },
        { key: 'taxes_par_personne', label: 'Taxes et frais aériens / pers. (occupation choisie)' },
        { key: 'prix_total', label: 'Prix total avec taxes et frais aériens ($)' },
        { key: 'total', label: 'Alias prix total (même que prix_total)' },
        { key: 'pricing_summary', label: 'Résumé texte du calcul (courriel)' },
        { key: 'price_double', label: 'Tarif — occ. double ($ / pers.)' },
        { key: 'price_double_1_child', label: 'Tarif — occ. double + 1 enfant 2-12 ($ / pers.)' },
        { key: 'price_double_2_child', label: 'Tarif — occ. double + 2 enfants 2-12 ($ / pers.)' },
        { key: 'price_simple', label: 'Tarif — occ. simple ($ / pers.)' },
        { key: 'price_simple_1_child', label: 'Tarif — occ. simple + 1 enfant 2-12 ($ / pers.)' },
        { key: 'price_triple', label: 'Tarif — occ. triple ($ / pers.)' },
        { key: 'price_quad', label: 'Tarif — occ. quad ($ / pers.)' },
        { key: 'price_autres', label: 'Tarif — autres ($ / pers.)' },
        { key: 'price_child_2_12', label: 'Réf. enfant 2-12 ans seul ($ / pers.) — optionnel' },
        { key: 'price_child_13_17', label: 'Réf. enfant 13-17 ans seul ($ / pers.) — optionnel' },
        { key: 'supplier', label: 'Fournisseur' },
        { key: 'carrier', label: 'Transporteur' },
        { key: 'room_category', label: 'Catégorie de chambre' },
        { key: 'package_type', label: 'Type de forfait' },
        { key: 'duration_nights', label: 'Durée (nuits)' }
    ];

    /**
     * Page de remerciement après soumission du formulaire.
     * Dans GHL : Formulaire → Paramètres → À la soumission → Rediriger vers une URL :
     *   https://promofiesta.roymarketing.ca/thank-you.html?forfait_slug={{forfait_slug}}
     * (ajustez le domaine si besoin ; le champ caché forfait_slug doit correspondre)
     */
    window.GHL_FORM_THANKYOU_PATH = 'thank-you.html';

    window.buildGhlThankYouUrl = function (forfaitSlug, extraParams) {
        const url = new URL(window.GHL_FORM_THANKYOU_PATH, window.location.href);
        if (forfaitSlug) url.searchParams.set('forfait_slug', forfaitSlug);
        if (extraParams && typeof extraParams === 'object') {
            Object.entries(extraParams).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    url.searchParams.set(key, value);
                }
            });
        }
        return url.toString();
    };

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
