(function () {
    const FETCH_TIMEOUT_MS = 15000;
    const JSON_URL = (window.PRODUCTS_JSON_URL || 'products.json').replace(/^\//, '');

    function isActifPackage(p) {
        return p && normalizeState(p.state, p.active) === 'actif';
    }

    function isListingVisible(p) {
        return isDetailVisible(p);
    }

    function isDetailVisible(p) {
        if (!p) return false;
        const state = normalizeState(p.state, p.active);
        return state === 'actif' || state === 'complet_sold_out';
    }

    function rawStateValue(state, legacyActive) {
        const raw = state ?? legacyActive;
        if (raw === undefined || raw === null || raw === '') return '';
        if (typeof raw === 'object') {
            return raw.value ?? raw.key ?? raw.id ?? raw.label ?? raw.name ?? '';
        }
        return String(raw);
    }

    function normalizeState(state, legacyActive) {
        const s = rawStateValue(state, legacyActive).toLowerCase().trim();
        if (!s) {
            if (legacyActive === false) return 'archiv';
            return 'actif';
        }

        if (s === 'actif' || s === 'active') return 'actif';
        if (s === 'brouillon' || s === 'draft') return 'brouillon';
        if (s === 'complet_sold_out' || s === 'complet-sold-out') return 'complet_sold_out';
        if (s === 'archiv' || s === 'archive' || s === 'archivé') return 'archiv';

        if (/sold\s*out|complet\s*\(|complet.*sold|épuisé|epuise/.test(s)) return 'complet_sold_out';
        if (/^complet$|complet\s*-/.test(s)) return 'complet_sold_out';
        if (/brouillon|draft/.test(s)) return 'brouillon';
        if (/archiv|archive/.test(s)) return 'archiv';
        if (/actif|active|publié|publie/.test(s)) return 'actif';

        return s.replace(/[^a-z0-9]+/g, '_');
    }

    function isSoldOut(p) {
        const state = normalizeState(p.state, p.active);
        return state === 'complet_sold_out' || p.inventory === 0;
    }

    function isVisibleOnSite(p) {
        return isActifPackage(p) || normalizeState(p.state, p.active) === 'complet_sold_out';
    }

    const PLACEHOLDER_IMG =
        'https://images.pexels.com/photos/1450360/pexels-photo-1450360.jpeg?auto=compress&cs=tinysrgb&w=800&fit=crop';

    /** GHL file fields: URL string or [{ url: "..." }] */
    function resolveMediaUrl(value) {
        if (!value) return '';
        if (typeof value === 'string') return value.trim();
        if (Array.isArray(value)) {
            for (const item of value) {
                const url = resolveMediaUrl(item);
                if (url) return url;
            }
            return '';
        }
        if (typeof value === 'object' && typeof value.url === 'string') {
            return value.url.trim();
        }
        return '';
    }

    function isPublicImageUrl(url) {
        if (!url || !/^https?:\/\//i.test(url)) return false;
        // GHL file uploads are private — not loadable on a public GitHub Pages site
        if (/msgsndr-private\.storage\.googleapis\.com/i.test(url)) return false;
        return true;
    }

    function normalizeImageSrc(value) {
        const url = resolveMediaUrl(value);
        if (!url) return PLACEHOLDER_IMG;
        if (url.startsWith('assets/')) return url;
        if (isPublicImageUrl(url)) return url;
        return PLACEHOLDER_IMG;
    }

    function isPlaceholderImage(url) {
        if (!url) return true;
        return url === PLACEHOLDER_IMG || /pexels\.com\/photos\/1450360/.test(url);
    }

    function buildProductGallery(p) {
        const rawList = Array.isArray(p.images) && p.images.length
            ? p.images
            : [p.img, p.imgRoom, p.imgExtra];

        const gallery = [];
        for (const src of rawList) {
            const url = normalizeImageSrc(src);
            if (isPlaceholderImage(url) || gallery.includes(url)) continue;
            gallery.push(url);
        }

        if (!gallery.length) {
            const fallback = normalizeImageSrc(p.img);
            if (!isPlaceholderImage(fallback)) gallery.push(fallback);
        }

        return gallery;
    }

    function unwrapFieldValue(value) {
        if (value === undefined || value === null || value === '') return value;
        if (typeof value === 'object' && !Array.isArray(value)) {
            const inner = value.value ?? value.amount ?? value.number ?? value.val;
            if (inner !== undefined && inner !== null && inner !== '') return inner;
        }
        return value;
    }

    function optionalPrice(value) {
        value = unwrapFieldValue(value);
        if (value === undefined || value === null || value === '') return null;
        if (typeof value === 'string') {
            const cleaned = value.replace(/\s/g, '').replace(/\$/g, '').replace(',', '.');
            const n = Number(cleaned);
            return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
        }
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    }

    /** Montants taxes — conserve les centimes (ex. 265,50 $ / pers.). */
    function optionalTaxAmount(value) {
        value = unwrapFieldValue(value);
        if (value === undefined || value === null || value === '') return null;
        if (typeof value === 'string') {
            const cleaned = value.replace(/\s/g, '').replace(/\$/g, '').replace(',', '.');
            const n = Number(cleaned);
            return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
        }
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
    }

    function normalizeExternalUrl(value) {
        const raw = unwrapFieldValue(value);
        const url = raw === undefined || raw === null ? '' : String(raw).trim();
        if (!url) return null;
        if (/^https?:\/\//i.test(url)) return url;
        if (/^\/\//.test(url)) return 'https:' + url;
        return 'https://' + url;
    }

    const TVQ_RATE = 0.09975;

    function getTaxRates() {
        return {
            tps: window.TAX_TPS_RATE ?? TPS_RATE,
            tvq: window.TAX_TVQ_RATE ?? TVQ_RATE
        };
    }

    /** TPS 5 % + TVQ 9,975 % — chaque taxe calculée sur le montant avant taxes */
    function calculateSalesTaxes(baseAmount) {
        const base = Math.round(Number(baseAmount));
        if (!Number.isFinite(base) || base <= 0) return null;
        const { tps: tpsRate, tvq: tvqRate } = getTaxRates();
        const tps = Math.round(base * tpsRate);
        const tvq = Math.round(base * tvqRate);
        return { base, tps, tvq, total: tps + tvq };
    }

    function formatTaxRatesLabel() {
        const { tps, tvq } = getTaxRates();
        const tpsPct = (tps * 100).toLocaleString('fr-CA', { maximumFractionDigits: 2 });
        const tvqPct = (tvq * 100).toLocaleString('fr-CA', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        return `TPS ${tpsPct} % + TVQ ${tvqPct} %`;
    }

    function getTaxesAirFeesLabel(options = {}) {
        const base = window.TAXES_AIR_FEES_LABEL || 'Taxes et frais aériens';
        if (options.perPerson) return `${base} / pers.`;
        if (options.enSus) return `${base} en sus`;
        if (options.inclus) return `${base} inclus`;
        return base;
    }

    function getBeforeTaxesLabel(options = {}) {
        const base = window.BEFORE_TAXES_AIR_FEES_LABEL || 'Avant taxes et frais aériens';
        if (options.perPerson) return `${base} / pers.`;
        return base;
    }

    const OCCUPATION_DEFS = [
        {
            id: 'double',
            label: 'Occ. double',
            hint: '2 adultes — prix par personne, avant taxes et frais aériens',
            primary: true,
            adults: 2,
            children212: 0,
            children1317: 0,
            priceKeys: ['price', 'price_occ_double'],
            taxesKeys: ['taxesOccDouble', 'taxes_occ_double']
        },
        {
            id: 'double_1_child',
            label: 'Occ. double + 1 enfant (2-12 ans)',
            hint: '2 adultes + 1 enfant (2-12 ans au retour) — prix par personne',
            adults: 2,
            children212: 1,
            children1317: 0,
            priceKeys: ['priceOccDouble1Child', 'price_occ_double_1_child'],
            taxesKeys: ['taxesOccDouble1Child', 'taxes_occ_double_1_child']
        },
        {
            id: 'double_2_child',
            label: 'Occ. double + 2 enfants (2-12 ans)',
            hint: '2 adultes + 2 enfants (2-12 ans au retour) — prix par personne',
            adults: 2,
            children212: 2,
            children1317: 0,
            priceKeys: ['priceOccDouble2Child', 'price_occ_double_2_child'],
            taxesKeys: ['taxesOccDouble2Child', 'taxes_occ_double_2_child']
        },
        {
            id: 'double_1_child_1317',
            label: 'Occ. double + 1 enfant (13-17 ans)',
            hint: '2 adultes + 1 adolescent (13-17 ans au retour) — prix par personne',
            adults: 2,
            children212: 0,
            children1317: 1,
            priceKeys: ['priceOccDouble1Child1317', 'price_occ_double_1_child_13_17'],
            taxesKeys: ['taxesOccDouble1Child1317', 'taxes_occ_double_1_child_13_17']
        },
        {
            id: 'double_2_child_1317',
            label: 'Occ. double + 2 enfants (13-17 ans)',
            hint: '2 adultes + 2 adolescents (13-17 ans au retour) — prix par personne',
            adults: 2,
            children212: 0,
            children1317: 2,
            priceKeys: ['priceOccDouble2Child1317', 'price_occ_double_2_child_13_17'],
            taxesKeys: ['taxesOccDouble2Child1317', 'taxes_occ_double_2_child_13_17']
        },
        {
            id: 'simple',
            label: 'Occ. simple',
            hint: '1 adulte — prix par personne, avant taxes et frais aériens',
            adults: 1,
            children212: 0,
            children1317: 0,
            priceKeys: ['priceOccSimple', 'price_occ_simple'],
            taxesKeys: ['taxesOccSimple', 'taxes_occ_simple']
        },
        {
            id: 'simple_1_child',
            label: 'Occ. simple + 1 enfant (2-12 ans)',
            hint: '1 adulte + 1 enfant (2-12 ans au retour) — prix par personne',
            adults: 1,
            children212: 1,
            children1317: 0,
            priceKeys: ['priceOccSimple1Child', 'price_occ_simple_1_child'],
            taxesKeys: ['taxesOccSimple1Child', 'taxes_occ_simple_1_child']
        },
        {
            id: 'simple_1_child_1317',
            label: 'Occ. simple + 1 enfant (13-17 ans)',
            hint: '1 adulte + 1 adolescent (13-17 ans au retour) — prix par personne',
            adults: 1,
            children212: 0,
            children1317: 1,
            priceKeys: ['priceOccSimple1Child1317', 'price_occ_simple_1_child_13_17'],
            taxesKeys: ['taxesOccSimple1Child1317', 'taxes_occ_simple_1_child_13_17']
        },
        {
            id: 'triple',
            label: 'Occ. triple',
            hint: '3 adultes — prix par personne, avant taxes et frais aériens',
            adults: 3,
            children212: 0,
            children1317: 0,
            priceKeys: ['priceOccTriple', 'price_occ_triple'],
            taxesKeys: ['taxesOccTriple', 'taxes_occ_triple']
        },
        {
            id: 'quad',
            label: 'Occ. quad',
            hint: '4 adultes — prix par personne, avant taxes et frais aériens',
            adults: 4,
            children212: 0,
            children1317: 0,
            priceKeys: ['priceOccQuad', 'price_occ_quad'],
            taxesKeys: ['taxesOccQuad', 'taxes_occ_quad']
        },
        {
            id: 'autres',
            label: 'Autres',
            hint: 'Autre configuration — prix par personne, avant taxes et frais aériens',
            adults: 1,
            children212: 0,
            children1317: 0,
            priceKeys: ['priceAutres', 'price_autres', 'price_occ_autres'],
            taxesKeys: ['taxesOccAutres', 'taxes_occ_autres']
        }
    ];

    function pickOccupationTaxPerPerson(p) {
        return optionalTaxAmount(p.taxesAmount ?? p.taxes_amount ?? p.taxes_par_personne);
    }

    /** GHL met parfois le prix double+1 enfant dans price_occ_simple_1_child. */
    function normalizeOccupationPriceFields(product) {
        const p = { ...product };
        const avgPerPerson = (total, people) => {
            if (!Number.isFinite(total) || people <= 0) return null;
            return Math.round((total / people) * 100) / 100;
        };

        const doublePrice = optionalPrice(p.price);
        const simplePrice = optionalPrice(p.priceOccSimple ?? p.price_occ_simple);
        const child212 = optionalPrice(p.priceChild212 ?? p.price_child_2_12);
        const child212b = optionalPrice(p.priceChild212_2 ?? p.prix_2e_enfant_2_12);
        const child1317 = optionalPrice(p.priceChild1317 ?? p.price_child_13_17);
        const child1317b = optionalPrice(p.priceChild1317_2 ?? p.prix_2e_enfant_13_17);

        const double1 = optionalPrice(p.priceOccDouble1Child ?? p.price_occ_double_1_child);
        const simple1 = optionalPrice(p.priceOccSimple1Child ?? p.price_occ_simple_1_child);

        if (double1 === null && simple1 !== null && doublePrice !== null && simple1 > doublePrice) {
            p.priceOccDouble1Child = simple1;
            p.priceOccSimple1Child = null;
            p.price_occ_double_1_child = simple1;
            p.price_occ_simple_1_child = null;
        }

        if (optionalPrice(p.priceOccDouble1Child ?? p.price_occ_double_1_child) === null
            && doublePrice !== null && child212 !== null) {
            p.priceOccDouble1Child = avgPerPerson(2 * doublePrice + child212, 3);
        }
        if (optionalPrice(p.priceOccDouble2Child ?? p.price_occ_double_2_child) === null
            && doublePrice !== null && child212 !== null && child212b !== null) {
            p.priceOccDouble2Child = avgPerPerson(2 * doublePrice + child212 + child212b, 4);
        }
        if (optionalPrice(p.priceOccSimple1Child ?? p.price_occ_simple_1_child) === null
            && simplePrice !== null && child212 !== null) {
            p.priceOccSimple1Child = avgPerPerson(simplePrice + child212, 2);
        }

        if (optionalPrice(p.priceOccDouble1Child1317 ?? p.price_occ_double_1_child_13_17) === null
            && doublePrice !== null && child1317 !== null) {
            p.priceOccDouble1Child1317 = avgPerPerson(2 * doublePrice + child1317, 3);
        }
        if (optionalPrice(p.priceOccDouble2Child1317 ?? p.price_occ_double_2_child_13_17) === null
            && doublePrice !== null && child1317 !== null && child1317b !== null) {
            p.priceOccDouble2Child1317 = avgPerPerson(2 * doublePrice + child1317 + child1317b, 4);
        }
        if (optionalPrice(p.priceOccSimple1Child1317 ?? p.price_occ_simple_1_child_13_17) === null
            && simplePrice !== null && child1317 !== null) {
            p.priceOccSimple1Child1317 = avgPerPerson(simplePrice + child1317, 2);
        }

        return p;
    }

    function clearLegacyTaxOccFields(product) {
        if (pickOccupationTaxPerPerson(product) === null) return product;
        return {
            ...product,
            taxesOccDouble: null,
            taxes_occ_double: null,
            taxesOccDouble1Child: null,
            taxes_occ_double_1_child: null,
            taxesOccDouble2Child: null,
            taxes_occ_double_2_child: null,
            taxesOccDouble1Child1317: null,
            taxes_occ_double_1_child_13_17: null,
            taxesOccDouble2Child1317: null,
            taxes_occ_double_2_child_13_17: null,
            taxesOccSimple: null,
            taxes_occ_simple: null,
            taxesOccSimple1Child: null,
            taxes_occ_simple_1_child: null,
            taxesOccSimple1Child1317: null,
            taxes_occ_simple_1_child_13_17: null,
            taxesOccTriple: null,
            taxes_occ_triple: null,
            taxesOccQuad: null,
            taxes_occ_quad: null,
            taxesOccAutres: null,
            taxes_occ_autres: null
        };
    }

    function getOccupationPickerLabel(occupationId, p) {
        const def = getOccupationDef(occupationId);
        if (!def) return String(occupationId || '');

        const adults = def.adults ?? 0;
        const children212 = def.children212 ?? 0;
        const children1317 = def.children1317 ?? 0;
        const totalPeople = adults + children212 + children1317;

        if (productHasChildUnitPricing(p) && !isChildOccupationDef(def)) {
            return adults > 0
                ? `${def.label} · ${adults} adulte${adults > 1 ? 's' : ''}`
                : def.label;
        }

        if (isChildOccupationDef(def) && totalPeople > 0) {
            return `${def.label} · ${totalPeople} pers.`;
        }

        return def.label;
    }

    function getOccupationPeopleCount(def) {
        if (!def) return 0;
        return (def.adults ?? 0) + (def.children212 ?? 0) + (def.children1317 ?? 0);
    }

    function isChildOccupationDef(def) {
        if (!def) return false;
        return (def.children212 ?? 0) > 0 || (def.children1317 ?? 0) > 0;
    }

    function getChildPricingInfo(p) {
        const child212First = optionalPrice(p.priceChild212 ?? p.price_child_2_12);
        const child212Second = optionalPrice(p.priceChild212_2 ?? p.prix_2e_enfant_2_12);
        const child1317First = optionalPrice(p.priceChild1317 ?? p.price_child_13_17);
        const child1317Second = optionalPrice(p.priceChild1317_2 ?? p.prix_2e_enfant_13_17);
        return {
            has212: child212First !== null,
            has1317: child1317First !== null,
            hasSecond212: child212Second !== null,
            hasSecond1317: child1317Second !== null,
            max212: child212First === null ? 0 : clampInt(window.MAX_CHILD_COUNT_SELECT ?? 4, { min: 1, max: 9 }),
            max1317: child1317First === null ? 0 : clampInt(window.MAX_CHILD_COUNT_SELECT ?? 4, { min: 1, max: 9 }),
            child212First,
            child212Second,
            child1317First,
            child1317Second
        };
    }

    function productHasChildUnitPricing(p) {
        const info = getChildPricingInfo(p);
        return info.has212 || info.has1317;
    }

    function getChild212UnitPrice(p, index) {
        const info = getChildPricingInfo(p);
        if (info.child212First === null || index < 0) return null;
        if (index === 0) return info.child212First;
        if (index === 1 && info.child212Second !== null) return info.child212Second;
        return info.child212Second ?? info.child212First;
    }

    function getChild1317UnitPrice(p, index) {
        const info = getChildPricingInfo(p);
        if (info.child1317First === null || index < 0) return null;
        if (index === 0) return info.child1317First;
        if (index === 1 && info.child1317Second !== null) return info.child1317Second;
        return info.child1317Second ?? info.child1317First;
    }

    /** Libellé enfant — sans « 1er » s'il n'y a qu'un seul tarif enfant pour la tranche. */
    function getChildPriceLabel(band, childIndex, hasSecondPrice) {
        const ageLabel = band === '1317' ? '13-17 ans' : '2-12 ans';
        if (childIndex === 0 && !hasSecondPrice) return `Enfant (${ageLabel})`;
        const ordinals = ['1er', '2e', '3e', '4e'];
        const ordinal = ordinals[childIndex] || `${childIndex + 1}e`;
        return `${ordinal} enfant (${ageLabel})`;
    }

    /** Libellé tableau tarifs — tranche d'âge sur la ligne suivante. */
    function formatChildTableLabelHtml(band, childIndex, hasSecondPrice) {
        const ageLabel = band === '1317' ? '13-17 ans' : '2-12 ans';
        let main;
        if (childIndex === 0 && !hasSecondPrice) {
            main = 'Enfant';
        } else {
            const ordinals = ['1er', '2e', '3e', '4e'];
            main = `${ordinals[childIndex] || `${childIndex + 1}e`} enfant`;
        }
        return `${main}<br><span class="text-gray-500 text-xs leading-tight">(${ageLabel})</span>`;
    }

    function sumChildUnitPrices(p, children212, children1317) {
        let total = 0;
        for (let i = 0; i < children212; i++) {
            const price = getChild212UnitPrice(p, i);
            if (price === null) return null;
            total += price;
        }
        for (let i = 0; i < children1317; i++) {
            const price = getChild1317UnitPrice(p, i);
            if (price === null) return null;
            total += price;
        }
        return total;
    }

    function buildBookingOccupationLabel(def, children212, children1317) {
        if (!def) return '';
        const parts = [];
        if (children212 > 0) {
            parts.push(`${children212} enfant${children212 > 1 ? 's' : ''} (2-12 ans)`);
        }
        if (children1317 > 0) {
            parts.push(`${children1317} enfant${children1317 > 1 ? 's' : ''} (13-17 ans)`);
        }
        if (!parts.length) return def.label;
        return `${def.label} + ${parts.join(' + ')}`;
    }

    /** taxes_amount = $ / pers. — affiché tel quel (sans × nb voyageurs). */
    function resolveOccupationTaxes(p, def) {
        const perPerson = pickOccupationTaxPerPerson(p);
        if (perPerson !== null) {
            return { taxesPerPerson: perPerson, totalTaxes: perPerson };
        }

        for (const key of def.taxesKeys || []) {
            const legacyPerPerson = optionalPrice(p[key]);
            if (legacyPerPerson !== null) {
                return { taxesPerPerson: legacyPerPerson, totalTaxes: legacyPerPerson };
            }
        }

        return { taxesPerPerson: null, totalTaxes: null };
    }

    function addUtcDays(date, days) {
        const d = new Date(date.getTime());
        d.setUTCDate(d.getUTCDate() + Number(days));
        return d;
    }

    function deriveReturnDate(departureDate, durationNights) {
        if (!departureDate || durationNights === undefined || durationNights === null) return null;
        const nights = Number(durationNights);
        if (!Number.isFinite(nights) || nights <= 0) return null;
        return addUtcDays(departureDate, nights);
    }

    function buildLocationText(subDest, country) {
        return [subDest, country].filter(Boolean).join(', ') || '';
    }

    function pickOccupationPrice(p, priceKeys) {
        for (const key of priceKeys) {
            const val = optionalPrice(p[key]);
            if (val !== null) return val;
        }
        return null;
    }

    /** Occupations client — prix GHL = $ / pers. avant taxes */
    function getOccupationPrices(p) {
        const rows = [];
        const hideChildOccRows = productHasChildUnitPricing(p);

        function withTaxes(row, def, product) {
            const peopleCount = getOccupationPeopleCount(def);
            const { taxesPerPerson, totalTaxes } = resolveOccupationTaxes(product, def);
            row.peopleCount = peopleCount;
            row.pricePerPerson = row.price;
            row.taxesPerPerson = taxesPerPerson;
            row.totalTaxes = totalTaxes;
            row.taxes = totalTaxes;
            row.totalWithTaxes = totalTaxes !== null ? row.price + totalTaxes : null;
            row.totalPerPerson = row.totalWithTaxes;
            row.isChildOccupation = isChildOccupationDef(def);
            return row;
        }

        for (const def of OCCUPATION_DEFS) {
            if (hideChildOccRows && isChildOccupationDef(def)) continue;
            const price = pickOccupationPrice(p, def.priceKeys);
            if (price === null) continue;
            rows.push(withTaxes({
                id: def.id,
                label: def.label,
                price,
                primary: def.primary === true,
                hint: def.hint
            }, def, p));
        }

        if (rows.length && !rows.some(r => r.primary)) {
            rows[0].primary = true;
        }

        return rows;
    }

    function getOccupationComparableAmount(row) {
        if (!row) return null;
        return row.totalWithTaxes ?? row.price ?? null;
    }

    /** Occupation la moins chère parmi celles définies dans GHL (total avec taxes si disponible). */
    function getLowestOccupationRow(p) {
        const rows = getOccupationPrices(p);
        if (!rows.length) return null;

        return rows.reduce((best, row) => {
            const value = getOccupationComparableAmount(row);
            const bestValue = getOccupationComparableAmount(best);
            if (value === null) return best;
            if (bestValue === null || value < bestValue) return row;
            return best;
        });
    }

    /** Taxes / pers. pour l'occ. double (affichage liste). */
    function getDoubleOccupationTaxTotal(p) {
        return pickOccupationTaxPerPerson(p);
    }

    /** Prix / pers. occ. double avec taxes = price + taxes_amount. */
    function getDoubleOccupationTotalWithTaxes(p) {
        const base = optionalPrice(p.price);
        if (base === null) return null;
        const taxes = getDoubleOccupationTaxTotal(p);
        return taxes !== null ? base + taxes : base;
    }

    /** Prix occ. double avec taxes — pastille rouge (liste). */
    function getDoubleOccupationDisplayPrice(p) {
        const amount = getDoubleOccupationTotalWithTaxes(p);
        if (amount === null) return null;
        return { amount, label: 'Occ. double' };
    }

    /** Prix affiché sur la fiche liste — occupation la moins chère. */
    function getListingDisplayPrice(p) {
        const lowest = getLowestOccupationRow(p);
        if (lowest) {
            const amount = getOccupationComparableAmount(lowest);
            if (amount !== null) {
                return { amount, label: lowest.label };
            }
        }

        const base = optionalPrice(p.price);
        if (base === null) return null;
        const taxes = getDoubleOccupationTaxTotal(p);
        return {
            amount: taxes !== null ? base + taxes : base,
            label: 'Occ. double'
        };
    }

    function clampInt(value, { min = 0, max = 99 } = {}) {
        const n = Math.floor(Number(value));
        if (!Number.isFinite(n)) return min;
        return Math.max(min, Math.min(max, n));
    }

    /**
     * Détail tarifaire — adulte / pers. + enfant / enfant; totaux = somme des composantes.
     */
    function getOccupationPricingBreakdown(p, occupationId, overrides) {
        const def = getOccupationDef(occupationId);
        const row = getSelectedOccupationRow(p, occupationId);
        if (!def || !row) return null;

        const childInfo = getChildPricingInfo(p);
        const useComponentPricing = productHasChildUnitPricing(p) && !isChildOccupationDef(def);
        const roundMoney = (value) => Math.round(value * 100) / 100;

        const adults = def.adults ?? 0;
        let children212;
        let children1317;

        if (useComponentPricing) {
            children212 = overrides && overrides.children212 !== undefined
                ? clampInt(overrides.children212, { min: 0, max: childInfo.max212 })
                : 0;
            children1317 = overrides && overrides.children1317 !== undefined
                ? clampInt(overrides.children1317, { min: 0, max: childInfo.max1317 })
                : 0;
        } else {
            children212 = overrides && overrides.children212 !== undefined
                ? clampInt(overrides.children212, { min: 0, max: 9 })
                : (def.children212 ?? 0);
            children1317 = overrides && overrides.children1317 !== undefined
                ? clampInt(overrides.children1317, { min: 0, max: 9 })
                : (def.children1317 ?? 0);
        }

        const totalPeople = adults + children212 + children1317;
        const adultUnitPrice = row.pricePerPerson ?? row.price;
        const taxesPerPerson = row.taxesPerPerson ?? row.taxes ?? pickOccupationTaxPerPerson(p);
        const bookingLabel = buildBookingOccupationLabel(def, children212, children1317);

        const child212Lines = [];
        for (let i = 0; i < children212; i++) {
            const unit = getChild212UnitPrice(p, i);
            if (unit === null) return null;
            child212Lines.push({
                index: i + 1,
                band: '212',
                label: getChildPriceLabel('212', i, childInfo.hasSecond212),
                unitPrice: unit,
                taxesPerPerson: taxesPerPerson,
                totalWithTaxes: taxesPerPerson !== null ? unit + taxesPerPerson : null
            });
        }

        const child1317Lines = [];
        for (let i = 0; i < children1317; i++) {
            const unit = getChild1317UnitPrice(p, i);
            if (unit === null) return null;
            child1317Lines.push({
                index: i + 1,
                band: '1317',
                label: getChildPriceLabel('1317', i, childInfo.hasSecond1317),
                unitPrice: unit,
                taxesPerPerson: taxesPerPerson,
                totalWithTaxes: taxesPerPerson !== null ? unit + taxesPerPerson : null
            });
        }

        let bookingBeforeTaxes;
        let pricePerPerson;
        let totalPerPerson;
        let pricingSummary;

        if (useComponentPricing) {
            const childTotal = sumChildUnitPrices(p, children212, children1317);
            if (childTotal === null) return null;
            bookingBeforeTaxes = roundMoney((adultUnitPrice * adults) + childTotal);
            pricePerPerson = adultUnitPrice;
            totalPerPerson = taxesPerPerson !== null ? adultUnitPrice + taxesPerPerson : adultUnitPrice;

            const summaryParts = [`${formatMoneyPerPerson(adultUnitPrice, { html: false })} × ${adults} adulte${adults > 1 ? 's' : ''}`];
            child212Lines.forEach(line => {
                summaryParts.push(`${formatMoneyPerChild(line.unitPrice, { html: false })} (${line.label.toLowerCase()})`);
            });
            child1317Lines.forEach(line => {
                summaryParts.push(`${formatMoneyPerChild(line.unitPrice, { html: false })} (${line.label.toLowerCase()})`);
            });
            pricingSummary = summaryParts.join(' + ');
            if (taxesPerPerson !== null) {
                pricingSummary += ` · ${getTaxesAirFeesLabel({ perPerson: true }).toLowerCase()}`;
            }
            if (totalPeople > 0) {
                const bookingTotalPreview = taxesPerPerson !== null
                    ? roundMoney(bookingBeforeTaxes + (taxesPerPerson * totalPeople))
                    : bookingBeforeTaxes;
                pricingSummary += ` · forfait ${totalPeople} pers. : ${formatMoney(bookingTotalPreview)}`;
            }
        } else {
            pricePerPerson = adultUnitPrice;
            totalPerPerson = row.totalPerPerson ?? row.totalWithTaxes ?? (
                taxesPerPerson !== null ? pricePerPerson + taxesPerPerson : pricePerPerson
            );
            bookingBeforeTaxes = roundMoney(pricePerPerson * totalPeople);
            pricingSummary = `${formatMoneyPerPerson(pricePerPerson, { html: false })} ${getBeforeTaxesLabel().toLowerCase()}`;
            if (taxesPerPerson !== null && totalPerPerson !== null) {
                pricingSummary += ` + ${formatMoneyPerPerson(taxesPerPerson, { html: false })} ${getTaxesAirFeesLabel().toLowerCase()} = ${formatMoneyPerPerson(totalPerPerson, { html: false })} total`;
            }
            if (totalPeople > 1) {
                const bookingTotalPreview = totalPerPerson !== null
                    ? roundMoney(totalPerPerson * totalPeople)
                    : bookingBeforeTaxes;
                pricingSummary += ` · forfait ${totalPeople} pers. : ${formatMoney(bookingTotalPreview)}`;
            }
        }

        const bookingTaxes = taxesPerPerson !== null ? roundMoney(taxesPerPerson * totalPeople) : null;
        const bookingTotalWithTaxes = taxesPerPerson !== null
            ? roundMoney(bookingBeforeTaxes + bookingTaxes)
            : bookingBeforeTaxes;

        const depositPerPerson = optionalPrice(p.depositAmount ?? p.deposit_amount);
        const totalDeposit = depositPerPerson !== null ? roundMoney(depositPerPerson * totalPeople) : null;

        return {
            adults,
            children212,
            children1317,
            totalPeople,
            adultUnitPrice,
            child212UnitPrice: childInfo.child212First,
            child1317UnitPrice: childInfo.child1317First,
            child212SecondUnitPrice: childInfo.child212Second,
            child1317SecondUnitPrice: childInfo.child1317Second,
            child212Lines,
            child1317Lines,
            taxChild212Unit: taxesPerPerson,
            taxChild1317Unit: taxesPerPerson,
            selectedUnitPrice: pricePerPerson,
            pricePerPerson,
            totalBeforeTaxes: useComponentPricing ? adultUnitPrice : pricePerPerson,
            totalTaxes: taxesPerPerson,
            totalWithTaxes: totalPerPerson,
            bookingBeforeTaxes,
            bookingTaxes,
            bookingTotalWithTaxes,
            taxesPerPerson,
            depositPerPerson,
            totalDeposit,
            pricingMethod: useComponentPricing ? 'component' : 'per_person',
            pricingSummary,
            bookingLabel,
            useComponentPricing
        };
    }

    function getSelectedOccupationRow(p, occupationId) {
        const rows = getOccupationPrices(p);
        if (!rows.length) return null;
        if (occupationId) {
            return rows.find(r => r.id === occupationId) || null;
        }
        return rows.find(r => r.primary) || rows[0];
    }

    /** URL params → champs cachés GHL (Query Key identique au nom du paramètre) */
    function buildGhlReservationParams(p, occupationId, overrides) {
        const params = {};
        const set = (key, value) => {
            if (value === undefined || value === null || value === '') return;
            params[key] = String(value);
        };

        const row = getSelectedOccupationRow(p, occupationId);
        const breakdown = getOccupationPricingBreakdown(p, occupationId, overrides);

        // Champs du formulaire GHL — en premier (URL iframe limitée)
        set('forfait_name', p.name);
        if (row) {
            const occupationLabel = breakdown?.bookingLabel || row.label;
            set('occupation', occupationLabel);
            set('occupation_code', row.id);
            set('occupation_label', occupationLabel);
            set('selected_price', breakdown?.adultUnitPrice ?? row.pricePerPerson ?? row.price);
            set('selected_taxes', breakdown?.taxesPerPerson ?? row.taxesPerPerson ?? row.taxes);
            set('selected_total', breakdown?.totalWithTaxes ?? row.totalPerPerson ?? row.totalWithTaxes);
        }
        if (breakdown) {
            set('nombre_personnes', breakdown.totalPeople);
            set('nombre_adultes', breakdown.adults);
            set('nombre_enfants_2_12', breakdown.children212);
            set('nombre_enfants_13_17', breakdown.children1317);
            set('prix_total_avant_taxe', breakdown.bookingBeforeTaxes);
            set('prix_total_avant_taxes', breakdown.bookingBeforeTaxes);
            set('taxes_total1', breakdown.bookingTaxes);
            set('taxes_total', breakdown.bookingTaxes);
            set('taxes_par_personne', breakdown.taxesPerPerson);
            set('tax_child_2_12', breakdown.taxChild212Unit);
            set('tax_child_13_17', breakdown.taxChild1317Unit);
            set('depot_par_personne', breakdown.depositPerPerson);
            set('depot_total', breakdown.totalDeposit);
            set('prix_total', breakdown.bookingTotalWithTaxes ?? breakdown.bookingBeforeTaxes);
            set('total', breakdown.bookingTotalWithTaxes ?? breakdown.bookingBeforeTaxes);
            set('pricing_summary', breakdown.pricingSummary);
            set('sommaire', breakdown.pricingSummary);
        }
        set('final_payment_date', formatDepartureDate(p.finalPaymentDate));
        set('deposit_amount', optionalPrice(p.depositAmount ?? p.deposit_amount));

        // Contexte étendu (exclu de l'iframe si GHL_FORM_IFRAME_KEYS est défini)
        set('forfait_slug', p.slug);
        set('destination', p.destination || p.destination1 || p.subDest);
        set('sub_destination', p.subDest);
        set('country', p.country);
        set('departure_airport', p.departureAirport);
        set('supplier', p.supplierLabel || formatSupplierLabel(p.supplier));
        set('carrier', p.carrierLabel || formatCarrierLabel(p.carrier));
        set('room_category', p.roomCategory);
        set('package_type', p.packageType);
        set('duration_nights', p.durationNights);
        set('departure_date', formatDepartureDate(p.departureDate));
        set('return_date', formatDepartureDate(p.returnDate));
        set('prix_adulte_unitaire', breakdown?.adultUnitPrice);
        set('prix_enfant_2_12_unitaire', breakdown?.child212UnitPrice);
        set('prix_enfant_13_17_unitaire', breakdown?.child1317UnitPrice);
        set('tax_child_2_12', breakdown?.taxChild212Unit);
        set('tax_child_13_17', breakdown?.taxChild1317Unit);
        set('price_double', pickOccupationPrice(p, ['price', 'price_occ_double']));
        set('price_double_1_child', pickOccupationPrice(p, ['priceOccDouble1Child', 'price_occ_double_1_child']));
        set('price_double_2_child', pickOccupationPrice(p, ['priceOccDouble2Child', 'price_occ_double_2_child']));
        set('price_double_1_child_13_17', pickOccupationPrice(p, ['priceOccDouble1Child1317', 'price_occ_double_1_child_13_17']));
        set('price_double_2_child_13_17', pickOccupationPrice(p, ['priceOccDouble2Child1317', 'price_occ_double_2_child_13_17']));
        set('price_simple', pickOccupationPrice(p, ['priceOccSimple', 'price_occ_simple']));
        set('price_simple_1_child', pickOccupationPrice(p, ['priceOccSimple1Child', 'price_occ_simple_1_child']));
        set('price_simple_1_child_13_17', pickOccupationPrice(p, ['priceOccSimple1Child1317', 'price_occ_simple_1_child_13_17']));
        set('price_triple', pickOccupationPrice(p, ['priceOccTriple', 'price_occ_triple']));
        set('price_quad', pickOccupationPrice(p, ['priceOccQuad', 'price_occ_quad']));
        set('price_autres', pickOccupationPrice(p, ['priceAutres', 'price_autres', 'price_occ_autres']));
        set('price_child_2_12', optionalPrice(p.priceChild212 ?? p.price_child_2_12));
        set('price_child_13_17', optionalPrice(p.priceChild1317 ?? p.price_child_13_17));

        return params;
    }

    function getPaymentTerms(p) {
        const deposit = optionalPrice(p.depositAmount ?? p.deposit_amount);
        const finalPaymentDateRaw = p.finalPaymentDate ?? p.final_payment_date;
        const finalPaymentDate = finalPaymentDateRaw ? new Date(finalPaymentDateRaw) : null;
        const finalPaymentValid = finalPaymentDate && !Number.isNaN(finalPaymentDate.getTime())
            ? finalPaymentDate
            : null;

        if (deposit === null && !finalPaymentValid) return null;

        return { deposit, finalPaymentDate: finalPaymentValid };
    }

    function inferArrivalLabel(p, leg) {
        if (leg?.to) return leg.to;
        if (p.subDest) return p.subDest;
        return p.destination || p.destination1 || '';
    }

    function inferReturnAirportLabel(p, leg) {
        if (leg?.to) return leg.to;
        const returnAirport = formatAirportLabel(
            p.returnAirport ?? p.aeroport_retour ?? p.return_airport
        );
        if (returnAirport) return returnAirport;
        return formatAirportLabel(p.departureAirport || '');
    }

    function inferDepartureLabel(p, leg) {
        if (leg?.from) return leg.from;
        return formatAirportLabel(p.departureAirport || '');
    }

    function formatAirportLabel(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const key = raw.toLowerCase().replace(/\s+/g, '_');
        const labels = window.AIRPORT_LABELS || {};
        if (labels[key]) return labels[key];
        if (labels[raw]) return labels[raw];
        return raw;
    }

    /** Use GHL flight fields, or build from departure/return dates when routes missing */
    function getEffectiveFlights(p) {
        const flights = p.flights || { out: {}, return: {}, airlineLogo: '' };
        const out = { ...(flights.out || {}) };
        const ret = { ...(flights.return || {}) };

        const departureDate = p.departureDate instanceof Date
            ? p.departureDate.toISOString()
            : (p.departureDate || p.departure_date || '');
        const returnDateRaw = p.returnDate ?? p.return_date;
        const returnDate = returnDateRaw instanceof Date
            ? returnDateRaw.toISOString()
            : (returnDateRaw || '');

        if (departureDate || p.departureAirport) {
            if (!out.from) out.from = inferDepartureLabel(p, out);
            if (!out.departDate) out.departDate = departureDate;
            if (!out.to) out.to = inferArrivalLabel(p, out);
            if (!out.arriveDate) out.arriveDate = out.departDate || departureDate;
        }
        if (returnDate || p.subDest) {
            if (!ret.from) ret.from = inferArrivalLabel(p, ret);
            if (!ret.departDate) ret.departDate = returnDate;
            if (!ret.to) ret.to = inferReturnAirportLabel(p, ret);
            if (!ret.arriveDate) ret.arriveDate = ret.departDate || returnDate;
        }

        return {
            out,
            return: ret,
            airlineLogo: getAirlineLogo(p) || ''
        };
    }

    function hasFlights(p) {
        const flights = getEffectiveFlights(p);
        return flightLegHasData(flights.out) || flightLegHasData(flights.return);
    }

    function formatMoney(amount) {
        const n = Number(amount);
        if (!Number.isFinite(n)) return '';
        const rounded = Math.round(n * 100) / 100;
        if (rounded % 1 !== 0) {
            return rounded.toLocaleString('fr-CA', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) + '\u00a0$';
        }
        return Math.round(rounded).toLocaleString('fr-CA') + '\u00a0$';
    }

    function formatMoneyPerPerson(amount, options = {}) {
        const formatted = formatMoney(amount);
        if (!formatted) return '';
        if (options.html === false) return `${formatted} / pers.`;
        const suffixClass = options.suffixClass || 'text-[0.72em] font-normal text-gray-500 whitespace-nowrap';
        return `${formatted}<span class="${suffixClass}"> / pers.</span>`;
    }

    function formatMoneyPerChild(amount, options = {}) {
        const formatted = formatMoney(amount);
        if (!formatted) return '';
        if (options.html === false) return `${formatted} / enfant`;
        const suffixClass = options.suffixClass || 'text-[0.72em] font-normal text-gray-500 whitespace-nowrap';
        return `${formatted}<span class="${suffixClass}"> / enfant</span>`;
    }

    /** Red card incentive — price / pers. + taxes / pers. ; barré = (price + rabais) + taxes */
    function getIncentive(p) {
        const doubleBeforeTaxes = optionalPrice(p.price);
        const doubleTaxes = getDoubleOccupationTaxTotal(p);
        if (doubleBeforeTaxes === null) return null;

        const price = doubleTaxes !== null ? doubleBeforeTaxes + doubleTaxes : doubleBeforeTaxes;
        const discount = optionalPrice(p.discountAmount ?? p.discount_amount ?? p.rabais);

        if (discount === null || discount <= 0) return null;

        const strikeBeforeTaxes = doubleBeforeTaxes + discount;
        const strikePrice = doubleTaxes !== null ? strikeBeforeTaxes + doubleTaxes : strikeBeforeTaxes;
        const financing = optionalPrice(
            p.financingMonthly ?? p.financing_monthly ?? p.financement_mensuel
        );

        return {
            price,
            strikePrice,
            discount,
            financing,
            occupationLabel: 'Occ. double'
        };
    }

    function formatFlightDate(value) {
        if (!value) return '';
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) return String(value).trim();
        return d.toLocaleDateString('fr-CA', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC'
        });
    }

    function formatFlightTime(value) {
        const s = value === undefined || value === null ? '' : String(value).trim();
        return s || 'à venir';
    }

    function flightLegHasData(leg) {
        if (!leg) return false;
        return Boolean(
            leg.from || leg.to || leg.departDate || leg.arriveDate || leg.number ||
            leg.departTime || leg.arriveTime
        );
    }

    function formatFlightNumber(value) {
        const s = value === undefined || value === null ? '' : String(value).trim();
        return s || 'À venir';
    }

    /** Hotel star rating — supports half stars (e.g. 3.5, 4.5) */
    function parseStarValue(value) {
        if (value === undefined || value === null || value === '') return NaN;
        if (typeof value === 'number') return value;
        const s = String(value).trim().replace(',', '.');
        return Number(s);
    }

    function normalizeStars(value) {
        const n = parseStarValue(value);
        if (!Number.isFinite(n) || n <= 0) return 0;
        return Math.round(n * 2) / 2;
    }

    function starsFilterKey(value) {
        const n = normalizeStars(value);
        if (!n) return '0';
        return Number.isInteger(n) ? String(n) : n.toFixed(1);
    }

    function formatStarsLabel(count) {
        const n = normalizeStars(count);
        if (!n) return '';
        const formatted = n.toLocaleString('fr-CA', {
            minimumFractionDigits: n % 1 ? 1 : 0,
            maximumFractionDigits: 1
        });
        return `${formatted} étoile${n > 1 ? 's' : ''}`;
    }

    function renderStarsHtml(count, sizeClass) {
        const rating = normalizeStars(count);
        const cls = sizeClass || 'text-sm';
        let html = '';
        for (let i = 1; i <= 5; i++) {
            if (rating >= i) {
                html += `<i class="fa-solid fa-star text-yellow-400 ${cls}"></i>`;
            } else if (rating >= i - 0.5) {
                html += `<i class="fa-solid fa-star-half-stroke text-yellow-400 ${cls}"></i>`;
            } else {
                html += `<i class="fa-solid fa-star text-gray-300 ${cls}"></i>`;
            }
        }
        return html;
    }

    function matchesStarsFilter(product, selectedStars) {
        if (!selectedStars.length) return true;
        return selectedStars.includes(starsFilterKey(product.stars));
    }

    function normalizeProduct(p) {
        const endDate = p.endDate
            ? new Date(p.endDate)
            : new Date(Date.now() + (p.endDateIn || 3) * 86400000 + (p.endDateExtra || 0));

        const departureDateRaw = p.departureDate ?? p.departure_date ?? p.date_de_depart;
        const departureDate = departureDateRaw ? new Date(departureDateRaw) : null;
        const departureDateValid = departureDate && !Number.isNaN(departureDate.getTime()) ? departureDate : null;

        const returnDateRaw = p.returnDate ?? p.return_date;
        let returnDate = returnDateRaw ? new Date(returnDateRaw) : null;
        if (returnDate && Number.isNaN(returnDate.getTime())) returnDate = null;
        if (!returnDate && departureDateValid) {
            returnDate = deriveReturnDate(departureDateValid, p.durationNights ?? p.duration_nights);
        }
        const returnDateValid = returnDate && !Number.isNaN(returnDate.getTime()) ? returnDate : null;

        const finalPaymentRaw = p.finalPaymentDate ?? p.final_payment_date;
        const finalPaymentDate = finalPaymentRaw ? new Date(finalPaymentRaw) : null;
        const finalPaymentValid = finalPaymentDate && !Number.isNaN(finalPaymentDate.getTime())
            ? finalPaymentDate
            : null;

        const state = normalizeState(p.state, p.active);
        const img = normalizeImageSrc(p.img);
        const imgRoom = normalizeImageSrc(p.imgRoom || p.img);
        const imgExtra = normalizeImageSrc(p.imgExtra || p.img);
        const subDest = p.subDest ?? p.sub_dest ?? '';
        const country = p.country ?? p.pays ?? '';
        const supplier = p.supplier || '';
        const carrier = p.carrier || '';
        const location = p.location || buildLocationText(subDest, country);
        const taxesAmount = pickOccupationTaxPerPerson(p);

        const base = {
            ...p,
            active: state,
            state,
            subDest,
            country,
            location,
            supplier,
            carrier,
            supplierLabel: formatSupplierLabel(supplier),
            carrierLabel: formatCarrierLabel(carrier),
            taxesAmount,
            destLabel: (window.destLabels && window.destLabels[p.destTag])
                || (p.destTag ? String(p.destTag) : '')
                || formatDestinationLabel(p.destination1 || p.destination || subDest),
            destination: p.destination1 || p.destination || subDest,
            destinationLabel: formatDestinationLabel(p.destination1 || p.destination || subDest),
            departureAirport: formatAirportLabel(
                p.departureAirport || p.departure_airport || p.aeroport_depart || ''
            ),
            returnAirport: formatAirportLabel(
                p.returnAirport || p.return_airport || p.aeroport_retour || ''
            ),
            departureDate: departureDateValid,
            returnDate: returnDateValid,
            criteria: Array.isArray(p.criteria) ? p.criteria.map(normalizeCriterionValue) : [],
            priceOccSimple: optionalPrice(p.priceOccSimple ?? p.price_occ_simple),
            priceOccTriple: optionalPrice(p.priceOccTriple ?? p.price_occ_triple),
            priceOccDouble1Child: optionalPrice(p.priceOccDouble1Child ?? p.price_occ_double_1_child),
            priceOccDouble2Child: optionalPrice(p.priceOccDouble2Child ?? p.price_occ_double_2_child),
            priceOccDouble1Child1317: optionalPrice(p.priceOccDouble1Child1317 ?? p.price_occ_double_1_child_13_17),
            priceOccDouble2Child1317: optionalPrice(p.priceOccDouble2Child1317 ?? p.price_occ_double_2_child_13_17),
            priceOccSimple1Child: optionalPrice(p.priceOccSimple1Child ?? p.price_occ_simple_1_child),
            priceOccSimple1Child1317: optionalPrice(p.priceOccSimple1Child1317 ?? p.price_occ_simple_1_child_13_17),
            priceOccQuad: optionalPrice(p.priceOccQuad ?? p.price_occ_quad),
            priceAutres: optionalPrice(p.priceAutres ?? p.price_autres ?? p.price_occ_autres),
            taxesOccDouble: optionalPrice(p.taxesOccDouble ?? p.taxes_occ_double),
            taxesOccDouble1Child: optionalPrice(p.taxesOccDouble1Child ?? p.taxes_occ_double_1_child),
            taxesOccDouble2Child: optionalPrice(p.taxesOccDouble2Child ?? p.taxes_occ_double_2_child),
            taxesOccDouble1Child1317: optionalPrice(p.taxesOccDouble1Child1317 ?? p.taxes_occ_double_1_child_13_17),
            taxesOccDouble2Child1317: optionalPrice(p.taxesOccDouble2Child1317 ?? p.taxes_occ_double_2_child_13_17),
            taxesOccSimple: optionalPrice(p.taxesOccSimple ?? p.taxes_occ_simple),
            taxesOccSimple1Child: optionalPrice(p.taxesOccSimple1Child ?? p.taxes_occ_simple_1_child),
            taxesOccSimple1Child1317: optionalPrice(p.taxesOccSimple1Child1317 ?? p.taxes_occ_simple_1_child_13_17),
            taxesOccTriple: optionalPrice(p.taxesOccTriple ?? p.taxes_occ_triple),
            taxesOccQuad: optionalPrice(p.taxesOccQuad ?? p.taxes_occ_quad),
            taxesOccAutres: optionalPrice(p.taxesOccAutres ?? p.taxes_occ_autres),
            discountAmount: optionalPrice(p.discountAmount ?? p.discount_amount ?? p.rabais),
            financingMonthly: optionalPrice(
                p.financingMonthly ?? p.financing_monthly ?? p.financement_mensuel
            ),
            depositAmount: optionalPrice(p.depositAmount ?? p.deposit_amount),
            finalPaymentDate: finalPaymentValid,
            priceChild212: optionalPrice(p.priceChild212 ?? p.price_child_2_12),
            priceChild212_2: optionalPrice(p.priceChild212_2 ?? p.prix_2e_enfant_2_12),
            priceChild1317: optionalPrice(p.priceChild1317 ?? p.price_child_13_17),
            priceChild1317_2: optionalPrice(p.priceChild1317_2 ?? p.prix_2e_enfant_13_17),
            taxChild212: optionalPrice(p.taxChild212 ?? p.tax_child_2_12),
            taxChild1317: optionalPrice(p.taxChild1317 ?? p.tax_child_13_17),
            forfaitLink: normalizeExternalUrl(p.forfaitLink ?? p.forfait_link),
            flights: p.flights || { out: {}, return: {}, airlineLogo: '' },
            stars: normalizeStars(p.stars),
            endDate,
            inventory: isSoldOut({ ...p, state }) ? 0 : p.inventory,
            img,
            imgRoom,
            imgExtra,
            images: buildProductGallery({ ...p, img, imgRoom, imgExtra })
        };

        return clearLegacyTaxOccFields(normalizeOccupationPriceFields(base));
    }

    function extractPackageArray(data) {
        if (Array.isArray(data)) return data;
        if (!data || typeof data !== 'object') return [];
        if (Array.isArray(data.products)) return data.products;
        if (Array.isArray(data.packages)) return data.packages;
        if (Array.isArray(data.records)) return data.records;
        if (Array.isArray(data.data)) return data.data;
        if (data.package || data.slug || data.name) return [data];
        return [];
    }

    function fetchWithTimeout(url, options, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
    }

    async function loadProductsJson() {
        const res = await fetchWithTimeout(
            JSON_URL + '?t=' + Date.now(),
            { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' },
            FETCH_TIMEOUT_MS
        );

        if (!res.ok) {
            throw new Error('HTTP ' + res.status + ' ' + res.statusText);
        }

        const data = await res.json();
        return extractPackageArray(data).map(normalizeProduct);
    }

    async function fetchProducts() {
        try {
            const all = await loadProductsJson();
            return all.filter(isListingVisible);
        } catch (err) {
            const message = err.name === 'AbortError'
                ? 'Request timed out after ' + FETCH_TIMEOUT_MS + 'ms'
                : err.message;
            console.error('[api] products.json unavailable:', message);
            return [];
        }
    }

    async function fetchProductBySlug(slug) {
        try {
            const all = await loadProductsJson();
            const wanted = String(slug || '').trim().toLowerCase();
            return all.find(p => String(p.slug || '').trim().toLowerCase() === wanted && isDetailVisible(p)) || null;
        } catch (err) {
            console.error('[api] products.json unavailable for slug:', slug, err.message);
            return null;
        }
    }

    function getProductBySlug(products, slug) {
        const wanted = String(slug || '').trim().toLowerCase();
        return products.find(p => String(p.slug || '').trim().toLowerCase() === wanted);
    }

    function normalizeSupplierKey(supplier) {
        if (supplier === undefined || supplier === null || supplier === '') return '';
        const raw = String(supplier).trim();
        if (!raw) return '';

        const labels = window.SUPPLIER_LABELS || {};
        for (const [key, label] of Object.entries(labels)) {
            if (raw === key || raw.toLowerCase() === key || raw === label) {
                return key;
            }
        }

        const slug = raw
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');

        const aliases = {
            vacances_sunwing: 'sunwing',
            sunwing_vacations: 'sunwing',
            sunwing_airlines: 'sunwing',
            vacances_air_canada: 'air_canada',
            air_canada_vacations: 'air_canada',
            vacances_westjet_quebec: 'westjet_quebec',
            vacances_westjet: 'westjet_quebec',
            west_jet: 'westjet_quebec',
            westjet: 'westjet_quebec',
            vacances_transat: 'transat',
            transat_vacations: 'transat'
        };

        return aliases[slug] || slug;
    }

    function resolveLogoKey(normalizedKey) {
        if (!normalizedKey) return '';
        const aliases = window.SUPPLIER_LOGO_KEY_ALIASES || {};
        return aliases[normalizedKey] || normalizedKey;
    }

    /** Logo compagnie aérienne — carrier d'abord, jamais le fournisseur tour operator. */
    function resolveCarrierLogoKey(normalizedKey) {
        if (!normalizedKey) return '';
        const aliases = window.CARRIER_LOGO_KEY_ALIASES || {};
        return aliases[normalizedKey] || normalizedKey;
    }

    function getCarrierLogo(carrier) {
        const key = resolveCarrierLogoKey(normalizeCarrierKey(carrier));
        if (!key) return null;
        const logos = window.SUPPLIER_LOGOS || {};
        const path = logos[key];
        return path ? String(path).trim() : null;
    }

    function getAirlineLogo(p) {
        const flights = p.flights || {};
        const custom = String(flights.airlineLogo || '').trim();
        if (custom) return custom;
        const carrier = String(p.carrier || '').trim();
        if (carrier) return getCarrierLogo(carrier);
        return null;
    }

    function formatSupplierLabel(supplier) {
        const key = normalizeSupplierKey(supplier);
        if (!key) return '';
        const labels = window.SUPPLIER_LABELS || {};
        if (labels[key]) return labels[key];

        const raw = String(supplier).trim();
        const known = window.KNOWN_SUPPLIERS || [];
        if (known.includes(raw)) return raw;

        return raw
            .replace(/_/g, ' ')
            .replace(/\b\w/g, ch => ch.toUpperCase());
    }

    function normalizeCarrierKey(carrier) {
        if (carrier === undefined || carrier === null || carrier === '') return '';
        const raw = String(carrier).trim();
        if (!raw) return '';

        const labels = window.CARRIER_LABELS || {};
        for (const [key, label] of Object.entries(labels)) {
            if (raw === key || raw.toLowerCase() === key || raw === label) {
                return key;
            }
        }

        const slug = raw
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');

        const aliases = {
            ac: 'air_canada',
            air_canada_vacations: 'air_canada',
            west_jet: 'westjet',
            sunwing_airlines: 'sunwing'
        };

        return aliases[slug] || slug;
    }

    function formatCarrierLabel(carrier) {
        const key = normalizeCarrierKey(carrier);
        if (!key) return '';
        const labels = window.CARRIER_LABELS || {};
        if (labels[key]) return labels[key];

        const raw = String(carrier).trim();
        return raw
            .replace(/_/g, ' ')
            .replace(/\b\w/g, ch => ch.toUpperCase());
    }

    /** Libellé affiché pour un champ produit (carrier, supplier, etc.) */
    function formatProductDisplayValue(product, fieldKey, rawValue) {
        const p = product || {};
        const key = String(fieldKey || '').trim().toLowerCase();
        const value = rawValue !== undefined && rawValue !== null && rawValue !== ''
            ? rawValue
            : p[key] ?? p[fieldKey];

        switch (key) {
            case 'carrier':
            case 'transporteur':
                return p.carrierLabel || formatCarrierLabel(value);
            case 'supplier':
            case 'fournisseur':
                return p.supplierLabel || formatSupplierLabel(value);
            case 'departure_airport':
            case 'departureairport':
            case 'aeroport_depart':
                return p.departureAirport || formatAirportLabel(value);
            case 'return_airport':
            case 'returnairport':
            case 'aeroport_retour':
                return p.returnAirport || formatAirportLabel(value);
            default:
                return value === undefined || value === null ? '' : String(value);
        }
    }

    function getSupplierLogo(supplier) {
        const key = resolveLogoKey(normalizeSupplierKey(supplier));
        if (!key) return null;
        const logos = window.SUPPLIER_LOGOS || {};
        const path = logos[key];
        return path ? String(path).trim() : null;
    }

    function getSupplierFilterOptions(products) {
        const seen = new Map();
        for (const p of products || []) {
            const key = normalizeSupplierKey(p.supplier);
            if (!key || seen.has(key)) continue;
            seen.set(key, formatSupplierLabel(p.supplier));
        }

        const preferred = (window.KNOWN_SUPPLIER_ORDER || []).map(normalizeSupplierKey);
        const entries = [...seen.entries()];
        entries.sort((a, b) => {
            const ai = preferred.indexOf(a[0]);
            const bi = preferred.indexOf(b[0]);
            if (ai !== -1 && bi !== -1) return ai - bi;
            if (ai !== -1) return -1;
            if (bi !== -1) return 1;
            return a[1].localeCompare(b[1], 'fr');
        });

        return entries.map(([value, label]) => ({
            value,
            label,
            logo: getSupplierLogo(value)
        }));
    }

    function isOtherSupplier(supplier) {
        return !normalizeSupplierKey(supplier);
    }

    function matchesSupplierFilter(product, selectedSuppliers) {
        if (!selectedSuppliers.length) return true;
        const productKey = normalizeSupplierKey(product.supplier);
        if (!productKey) return false;
        return selectedSuppliers.some(s => normalizeSupplierKey(s) === productKey);
    }

    function getProductDestinationFilterKeys(product) {
        const keys = new Set();
        const candidates = [
            product.subDest,
            product.destination1,
            product.destination,
            product.destinationLabel,
            product.country,
            product.location
        ];
        for (const value of candidates) {
            if (value === undefined || value === null || value === '') continue;
            const parts = String(value).split(/[,/|]/).map(s => s.trim()).filter(Boolean);
            for (const part of (parts.length ? parts : [String(value).trim()])) {
                const key = normalizeDestinationKey(part);
                if (key) keys.add(key);
            }
        }
        return keys;
    }

    function formatDestinationLabelFromKey(key) {
        if (!key) return '';
        const labels = window.FILTER_DESTINATIONS || [];
        for (const label of labels) {
            if (normalizeDestinationKey(label) === key) return label;
        }
        const aliases = window.DESTINATION_ALIASES || {};
        for (const [alias, target] of Object.entries(aliases)) {
            if (normalizeDestinationKey(alias) === key || normalizeDestinationKey(target) === key) {
                return target;
            }
        }
        return String(key)
            .replace(/_/g, ' ')
            .replace(/\b([a-zàâäéèêëïîôùûüç])/gi, (_, c) => c.toUpperCase());
    }

    /** Options filtre destination — uniquement les clés présentes dans le catalogue. */
    function getDestinationFilterOptions(products) {
        const map = new Map();
        for (const product of products || []) {
            for (const key of getProductDestinationFilterKeys(product)) {
                if (!key || map.has(key)) continue;
                map.set(key, formatDestinationLabelFromKey(key));
            }
        }
        return [...map.entries()]
            .sort((a, b) => a[1].localeCompare(b[1], 'fr'))
            .map(([value, label]) => ({ value, label }));
    }

    function matchesDestinationFilter(product, selectedDestinations) {
        if (!selectedDestinations.length) return true;
        const productKeys = getProductDestinationFilterKeys(product);
        if (!productKeys.size) return false;
        return selectedDestinations.some(d => {
            const selectedKey = normalizeDestinationKey(d);
            return selectedKey && productKeys.has(selectedKey);
        });
    }

    function normalizeDestinationKey(value) {
        if (value === undefined || value === null || value === '') return '';
        const raw = String(value).trim();
        if (!raw) return '';

        const labels = window.FILTER_DESTINATIONS || [];
        for (const label of labels) {
            if (raw === label || raw.toLowerCase() === label.toLowerCase()) {
                return slugifyDestination(label);
            }
        }

        const aliases = window.DESTINATION_ALIASES || {};
        const lower = raw.toLowerCase();
        const slug = slugifyDestination(raw);
        const aliasTarget = aliases[raw] ?? aliases[lower] ?? aliases[slug];
        if (aliasTarget) {
            const targetSlug = slugifyDestination(String(aliasTarget).trim());
            if (targetSlug === slug) return slug;
            return normalizeDestinationKey(aliasTarget);
        }

        return slug;
    }

    function formatDestinationLabel(value) {
        if (value === undefined || value === null || value === '') return '';
        const raw = String(value).trim();
        if (!raw) return '';

        const labels = window.FILTER_DESTINATIONS || [];
        for (const label of labels) {
            if (raw === label || raw.toLowerCase() === label.toLowerCase()) {
                return label;
            }
        }

        const key = normalizeDestinationKey(raw);
        for (const label of labels) {
            if (normalizeDestinationKey(label) === key) {
                return label;
            }
        }

        const aliases = window.DESTINATION_ALIASES || {};
        const lower = raw.toLowerCase();
        const slug = slugifyDestination(raw);
        const aliasTarget = aliases[raw] ?? aliases[lower] ?? aliases[slug];
        if (aliasTarget) return aliasTarget;

        return raw
            .replace(/_/g, ' ')
            .replace(/\b([a-zàâäéèêëïîôùûüç])/gi, (_, c) => c.toUpperCase());
    }

    function slugifyDestination(value) {
        return String(value)
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
    }

    function matchesAirportFilter(product, selectedAirports) {
        if (!selectedAirports.length) return true;
        const productAirport = formatAirportLabel(product.departureAirport);
        return selectedAirports.includes(productAirport);
    }

    function normalizeCriterionValue(raw) {
        if (raw === undefined || raw === null || raw === '') return '';
        let key;
        if (typeof raw === 'object') {
            key = String(raw.value ?? raw.key ?? raw.id ?? raw.label ?? raw.name ?? '').trim();
        } else {
            key = String(raw).trim();
        }
        if (window.CRITERIA_ALIASES && window.CRITERIA_ALIASES[key]) {
            return window.CRITERIA_ALIASES[key];
        }
        return key;
    }

    function getCriteriaLabel(value) {
        const key = normalizeCriterionValue(value);
        if (window.CRITERIA_BY_VALUE && window.CRITERIA_BY_VALUE[key]) {
            return window.CRITERIA_BY_VALUE[key];
        }
        return key;
    }

    function productHasCriterion(product, slug) {
        const wanted = normalizeCriterionValue(slug);
        return (product.criteria || []).some(c => normalizeCriterionValue(c) === wanted);
    }

    function matchesCriteriaFilter(product, selectedCriteria) {
        if (!selectedCriteria.length) return true;
        return selectedCriteria.every(c => productHasCriterion(product, c));
    }

    function formatDepartureDate(value) {
        if (!value) return null;
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        return d.toLocaleDateString('fr-CA', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
        });
    }

    function departureDateSortKey(product) {
        if (!product.departureDate) return Number.POSITIVE_INFINITY;
        const t = product.departureDate instanceof Date
            ? product.departureDate.getTime()
            : new Date(product.departureDate).getTime();
        return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
    }

    /** Stable YYYY-MM-DD key for departure date filters (UTC). */
    function departureDateFilterKey(value) {
        if (!value) return '';
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return d.toISOString().slice(0, 10);
    }

    function getDepartureDateFilterOptions(products) {
        const seen = new Map();
        for (const p of products || []) {
            const key = departureDateFilterKey(p.departureDate);
            if (!key || seen.has(key)) continue;
            seen.set(key, formatDepartureDate(p.departureDate) || key);
        }
        return [...seen.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([value, label]) => ({ value, label }));
    }

    function matchesDepartureDateFilter(product, selectedDates) {
        if (!selectedDates.length) return true;
        const key = departureDateFilterKey(product.departureDate);
        if (!key) return false;
        return selectedDates.includes(key);
    }

    function getSiteBaseUrl() {
        const configured = String(window.BOUTIQUE_BASE_URL || '').trim().replace(/\/$/, '');
        if (configured) return configured;
        const path = window.location.pathname.replace(/[^/]+$/, '').replace(/\/$/, '');
        return `${window.location.origin}${path}`;
    }

    function resolveAbsoluteUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw)) return raw;
        const base = getSiteBaseUrl().replace(/\/$/, '');
        const path = raw.startsWith('/') ? raw : `/${raw.replace(/^\.\//, '')}`;
        return `${base}${path}`;
    }

    function escapeShareAttr(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function getProductShareImage(p) {
        const gallery = buildProductGallery(p);
        const imagePath = gallery[0] || normalizeImageSrc(p.img);
        const absolute = resolveAbsoluteUrl(imagePath);
        if (absolute && !isPlaceholderImage(imagePath)) return absolute;
        return window.SITE_DEFAULT_SHARE_IMAGE || resolveAbsoluteUrl(PLACEHOLDER_IMG);
    }

    function getProductPageUrl(p) {
        const slug = String(p?.slug || '').trim();
        if (!slug) return getSiteBaseUrl();
        return `${getSiteBaseUrl().replace(/\/$/, '')}/product.html?slug=${encodeURIComponent(slug)}`;
    }

    /** Static share page — crawlers (Facebook) read OG tags here, not product.html JS. */
    function getProductShareUrl(p) {
        const slug = String(p?.slug || '').trim();
        if (!slug) return getSiteBaseUrl();
        return `${getSiteBaseUrl().replace(/\/$/, '')}/share/${encodeURIComponent(slug)}.html`;
    }

    function buildProductShareDescription(p) {
        const parts = [];
        const destination = p.destinationLabel || p.destination || p.subDest;
        if (destination) parts.push(destination);
        if (p.country && p.country !== destination) parts.push(p.country);
        if (p.durationNights) parts.push(`${p.durationNights} nuits`);
        const listing = getListingDisplayPrice(p);
        if (listing?.amount != null) {
            parts.push(`à partir de ${formatMoneyPerPerson(listing.amount, { html: false })}`);
        }
        return parts.join(' · ') || window.SITE_DEFAULT_DESCRIPTION || '';
    }

    function buildProductSharePayload(p) {
        const title = `${p.name} | ${window.SITE_NAME || 'Voyage Fiesta'}`;
        return {
            url: getProductShareUrl(p),
            title,
            description: buildProductShareDescription(p),
            image: getProductShareImage(p),
            imageAlt: p.name || window.SITE_NAME || 'Voyage Fiesta'
        };
    }

    function buildListingSharePayload() {
        const base = getSiteBaseUrl().replace(/\/$/, '');
        return {
            url: `${base}/index.html`,
            title: `Promotions | ${window.SITE_NAME || 'Voyage Fiesta'}`,
            description: window.SITE_DEFAULT_DESCRIPTION || '',
            image: window.SITE_DEFAULT_SHARE_IMAGE || '',
            imageAlt: window.SITE_NAME || 'Voyage Fiesta'
        };
    }

    function setDocumentMeta(attr, key, content) {
        if (content === undefined || content === null || content === '') return;
        let el = document.querySelector(`meta[${attr}="${key}"]`);
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute(attr, key);
            document.head.appendChild(el);
        }
        el.setAttribute('content', String(content));
    }

    function applySocialMetaTags(payload) {
        if (!payload || typeof document === 'undefined') return;
        const siteName = window.SITE_NAME || 'Voyage Fiesta';
        setDocumentMeta('property', 'og:type', 'website');
        setDocumentMeta('property', 'og:site_name', siteName);
        setDocumentMeta('property', 'og:locale', 'fr_CA');
        setDocumentMeta('property', 'og:title', payload.title);
        setDocumentMeta('property', 'og:description', payload.description);
        setDocumentMeta('property', 'og:url', payload.url);
        setDocumentMeta('property', 'og:image', payload.image);
        setDocumentMeta('property', 'og:image:alt', payload.imageAlt || payload.title);
        setDocumentMeta('name', 'twitter:card', 'summary_large_image');
        setDocumentMeta('name', 'twitter:title', payload.title);
        setDocumentMeta('name', 'twitter:description', payload.description);
        setDocumentMeta('name', 'twitter:image', payload.image);
        setDocumentMeta('name', 'description', payload.description);
    }

    function getSocialShareHref(platform, payload) {
        const url = encodeURIComponent(payload.url);
        const text = encodeURIComponent(`${payload.title}${payload.description ? ` — ${payload.description}` : ''}`);
        const image = encodeURIComponent(payload.image || '');
        switch (platform) {
            case 'facebook':
                return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
            case 'x':
                return `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
            case 'whatsapp':
                return `https://wa.me/?text=${text}%20${url}`;
            case 'pinterest':
                return `https://pinterest.com/pin/create/button/?url=${url}&media=${image}&description=${text}`;
            case 'linkedin':
                return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
            case 'email':
                return `mailto:?subject=${encodeURIComponent(payload.title)}&body=${text}%0A%0A${url}`;
            default:
                return payload.url;
        }
    }

    function showShareToast(message) {
        if (typeof document === 'undefined') return;
        let toast = document.getElementById('share-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'share-toast';
            toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg opacity-0 pointer-events-none transition-opacity duration-200';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.remove('opacity-0');
        clearTimeout(showShareToast._timer);
        showShareToast._timer = setTimeout(() => toast.classList.add('opacity-0'), 2200);
    }

    function renderSocialShareButtonsHtml(p, options = {}) {
        const payload = buildProductSharePayload(p);
        const compact = options.compact === true;
        const btnClass = compact
            ? 'inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-brand-light hover:text-brand-blue transition-colors shrink-0'
            : 'inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-brand-light hover:text-brand-blue transition-colors shrink-0';

        const platforms = [];
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            platforms.push({ id: 'native', icon: 'fa-solid fa-share-nodes', label: 'Partager', action: 'native' });
        }
        platforms.push(
            { id: 'facebook', icon: 'fa-brands fa-facebook-f', label: 'Facebook' },
            { id: 'whatsapp', icon: 'fa-brands fa-whatsapp', label: 'WhatsApp' },
            { id: 'pinterest', icon: 'fa-brands fa-pinterest-p', label: 'Pinterest' },
            { id: 'x', icon: 'fa-brands fa-x-twitter', label: 'X (Twitter)' },
            { id: 'email', icon: 'fa-solid fa-envelope', label: 'Courriel' },
            { id: 'copy', icon: 'fa-solid fa-link', label: 'Copier le lien', action: 'copy' }
        );

        const slug = escapeShareAttr(p.slug);
        const buttons = platforms.map(platform => {
            const title = escapeShareAttr(platform.label);
            if (platform.action === 'copy' || platform.action === 'native') {
                return `<button type="button" class="${btnClass}" data-share-action="${platform.action}" data-share-slug="${slug}" aria-label="${title}" title="${title}"><i class="${platform.icon} ${compact ? 'text-xs' : 'text-sm'}"></i></button>`;
            }
            const href = escapeShareAttr(getSocialShareHref(platform.id, payload));
            return `<a href="${href}" class="${btnClass}" target="_blank" rel="noopener noreferrer" aria-label="${title}" title="${title}" data-share-link="1"><i class="${platform.icon} ${compact ? 'text-xs' : 'text-sm'}"></i></a>`;
        }).join('');

        const labelHtml = compact
            ? ''
            : '<p class="text-xs font-bold text-gray-500 uppercase tracking-tighter mb-2"><i class="fa-solid fa-share-nodes mr-1"></i> Partager cette offre</p>';

        return `<div class="social-share ${compact ? 'social-share--compact' : ''}" data-share-slug="${slug}">${labelHtml}<div class="flex flex-wrap items-center gap-2">${buttons}</div></div>`;
    }

    function bindSocialShare(root, getProduct) {
        const container = root && root.querySelectorAll ? root : document;
        container.querySelectorAll('[data-share-action]').forEach(btn => {
            if (btn.dataset.shareBound === '1') return;
            btn.dataset.shareBound = '1';

            btn.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();

                const slug = btn.dataset.shareSlug
                    || btn.closest('[data-share-slug]')?.dataset.shareSlug
                    || '';
                const product = typeof getProduct === 'function' ? getProduct(slug) : null;
                if (!product) return;

                const payload = buildProductSharePayload(product);
                const action = btn.dataset.shareAction;

                if (action === 'copy') {
                    try {
                        await navigator.clipboard.writeText(payload.url);
                        showShareToast('Lien copié!');
                    } catch (_) {
                        window.prompt('Copier le lien:', payload.url);
                    }
                    return;
                }

                if (action === 'native' && navigator.share) {
                    try {
                        await navigator.share({
                            title: payload.title,
                            text: payload.description,
                            url: payload.url
                        });
                    } catch (_) { /* cancelled */ }
                }
            });
        });
    }

    window.VoyageFiestaAPI = {
        fetchProducts,
        fetchProductBySlug,
        getProductBySlug,
        matchesSupplierFilter,
        matchesDestinationFilter,
        getProductDestinationFilterKeys,
        getDestinationFilterOptions,
        formatDestinationLabelFromKey,
        normalizeDestinationKey,
        formatDestinationLabel,
        formatAirportLabel,
        matchesAirportFilter,
        matchesDepartureDateFilter,
        matchesCriteriaFilter,
        formatDepartureDate,
        departureDateSortKey,
        departureDateFilterKey,
        getDepartureDateFilterOptions,
        normalizeCriterionValue,
        getCriteriaLabel,
        productHasCriterion,
        getOccupationPrices,
        getOccupationDef,
        getOccupationPickerLabel,
        getChildPricingInfo,
        productHasChildUnitPricing,
        getChildPriceLabel,
        formatChildTableLabelHtml,
        getLowestOccupationRow,
        getDoubleOccupationDisplayPrice,
        getListingDisplayPrice,
        getSelectedOccupationRow,
        getOccupationPricingBreakdown,
        buildBookingOccupationLabel,
        pickOccupationPrice,
        calculateSalesTaxes,
        formatTaxRatesLabel,
        getTaxesAirFeesLabel,
        getBeforeTaxesLabel,
        buildGhlReservationParams,
        getPaymentTerms,
        getEffectiveFlights,
        getIncentive,
        formatMoney,
        formatMoneyPerPerson,
        formatMoneyPerChild,
        formatFlightDate,
        formatFlightTime,
        formatFlightNumber,
        normalizeStars,
        starsFilterKey,
        formatStarsLabel,
        renderStarsHtml,
        matchesStarsFilter,
        hasFlights,
        flightLegHasData,
        buildProductGallery,
        optionalPrice,
        normalizeExternalUrl,
        normalizeSupplierKey,
        formatSupplierLabel,
        normalizeCarrierKey,
        formatCarrierLabel,
        formatProductDisplayValue,
        getSupplierLogo,
        getCarrierLogo,
        getAirlineLogo,
        resolveLogoKey,
        clampInt,
        getSupplierFilterOptions,
        isOtherSupplier,
        isSoldOut,
        isVisibleOnSite,
        isActifPackage,
        isListingVisible,
        isDetailVisible,
        normalizeState,
        extractPackageArray,
        getSiteBaseUrl,
        resolveAbsoluteUrl,
        getProductShareImage,
        getProductShareUrl,
        buildProductSharePayload,
        buildListingSharePayload,
        applySocialMetaTags,
        getSocialShareHref,
        renderSocialShareButtonsHtml,
        bindSocialShare
    };
})();
