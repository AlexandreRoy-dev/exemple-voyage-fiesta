(function () {
    /** Primary suppliers shown in filters; all others match "Autres" */
    window.KNOWN_SUPPLIERS = [
        'Vacances Sunwing',
        'Vacances Air Canada',
        'Vacances WestJet Québec',
        'Vacances Transat'
    ];

    /** Checkbox destinations (boutique filter) — synced with GHL Custom Object field `destination` */
    window.FILTER_DESTINATIONS = [
        'Aruba',
        'Bahamas',
        'Barcelone',
        'Berlin',
        'Cancun',
        'Las Vegas',
        'Madrid',
        'Miami',
        'Monaco',
        'Punta Cana',
        'Québec',
        'Riviera Maya',
        'Rome',
        'Sainte-Lucie'
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
