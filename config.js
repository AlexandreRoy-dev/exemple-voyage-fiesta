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

    window.FILTER_CRITERIA = [
        'Vue mer',
        'Familial',
        'Adultes seulement',
        'Swim Out',
        "Glissades d'eau",
        'Golf'
    ];

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

    /** GHL reservation form embed URL — replace with client's form iframe src from GHL */
    window.GHL_FORM_EMBED_URL = '';

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
