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

    const OCCUPATION_DEFS = [
        {
            id: 'double',
            label: 'Occ. double',
            hint: '2 adultes — prix total occupation, avant taxes',
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
            hint: '2 adultes + 1 enfant (2-12 ans au retour)',
            adults: 2,
            children212: 1,
            children1317: 0,
            priceKeys: ['priceOccDouble1Child', 'price_occ_double_1_child'],
            taxesKeys: ['taxesOccDouble1Child', 'taxes_occ_double_1_child']
        },
        {
            id: 'double_2_child',
            label: 'Occ. double + 2 enfants (2-12 ans)',
            hint: '2 adultes + 2 enfants (2-12 ans au retour)',
            adults: 2,
            children212: 2,
            children1317: 0,
            priceKeys: ['priceOccDouble2Child', 'price_occ_double_2_child'],
            taxesKeys: ['taxesOccDouble2Child', 'taxes_occ_double_2_child']
        },
        {
            id: 'simple',
            label: 'Occ. simple',
            hint: '1 adulte — prix total occupation, avant taxes',
            adults: 1,
            children212: 0,
            children1317: 0,
            priceKeys: ['priceOccSimple', 'price_occ_simple'],
            taxesKeys: ['taxesOccSimple', 'taxes_occ_simple']
        },
        {
            id: 'simple_1_child',
            label: 'Occ. simple + 1 enfant (2-12 ans)',
            hint: '1 adulte + 1 enfant (2-12 ans au retour)',
            adults: 1,
            children212: 1,
            children1317: 0,
            priceKeys: ['priceOccSimple1Child', 'price_occ_simple_1_child'],
            taxesKeys: ['taxesOccSimple1Child', 'taxes_occ_simple_1_child']
        },
        {
            id: 'triple',
            label: 'Occ. triple',
            hint: '3 adultes — prix total occupation, avant taxes',
            adults: 3,
            children212: 0,
            children1317: 0,
            priceKeys: ['priceOccTriple', 'price_occ_triple'],
            taxesKeys: ['taxesOccTriple', 'taxes_occ_triple']
        },
        {
            id: 'quad',
            label: 'Occ. quad',
            hint: '4 adultes — prix total occupation, avant taxes',
            adults: 4,
            children212: 0,
            children1317: 0,
            priceKeys: ['priceOccQuad', 'price_occ_quad'],
            taxesKeys: ['taxesOccQuad', 'taxes_occ_quad']
        },
        {
            id: 'autres',
            label: 'Autres',
            hint: 'Autre configuration — prix total occupation, avant taxes',
            adults: 1,
            children212: 0,
            children1317: 0,
            priceKeys: ['priceAutres', 'price_autres', 'price_occ_autres'],
            taxesKeys: ['taxesOccAutres', 'taxes_occ_autres']
        }
    ];

    function pickOccupationTaxPerPerson(p) {
        return optionalTaxAmount(p.taxesAmount ?? p.taxes_amount);
    }

    function getOccupationDef(occupationId) {
        return OCCUPATION_DEFS.find(d => d.id === occupationId) || null;
    }

    function getOccupationPeopleCount(def) {
        if (!def) return 0;
        return (def.adults ?? 0) + (def.children212 ?? 0) + (def.children1317 ?? 0);
    }

    /** taxes_amount = $ / pers. (adulte ou enfant) × nb voyageurs de l'occupation. */
    function resolveOccupationTaxes(p, def) {
        const peopleCount = getOccupationPeopleCount(def);
        if (!peopleCount) {
            return { taxesPerPerson: null, totalTaxes: null };
        }

        const perPerson = pickOccupationTaxPerPerson(p);
        if (perPerson !== null) {
            return {
                taxesPerPerson: perPerson,
                totalTaxes: Math.round(perPerson * peopleCount * 100) / 100
            };
        }

        for (const key of def.taxesKeys || []) {
            const legacyTotal = optionalPrice(p[key]);
            if (legacyTotal !== null) {
                return {
                    taxesPerPerson: Math.round(legacyTotal / peopleCount),
                    totalTaxes: legacyTotal
                };
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

    /** Occupations client — seulement celles avec un prix défini dans GHL */
    function getOccupationPrices(p) {
        const rows = [];

        /** Prix occupation (total GHL) + taxes (taux fixe / pers. dérivé de l'occ. double). */
        function withTaxes(row, def, product) {
            const peopleCount = getOccupationPeopleCount(def);
            const { taxesPerPerson, totalTaxes } = resolveOccupationTaxes(product, def);
            row.peopleCount = peopleCount;
            row.taxesPerPerson = taxesPerPerson;
            row.totalTaxes = totalTaxes;
            row.taxes = totalTaxes;
            row.totalWithTaxes = totalTaxes !== null ? row.price + totalTaxes : null;
            return row;
        }

        for (const def of OCCUPATION_DEFS) {
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

    /** Prix occ. double avec taxes — pastille rouge (liste). */
    function getDoubleOccupationDisplayPrice(p) {
        const rows = getOccupationPrices(p);
        const doubleRow = rows.find(r => r.id === 'double');
        if (doubleRow) {
            const amount = getOccupationComparableAmount(doubleRow);
            if (amount !== null) {
                return { amount, label: doubleRow.label };
            }
        }

        const base = optionalPrice(p.price);
        if (base === null) return null;
        const doubleDef = getOccupationDef('double');
        const { totalTaxes } = doubleDef ? resolveOccupationTaxes(p, doubleDef) : { totalTaxes: null };
        return {
            amount: totalTaxes !== null ? base + totalTaxes : base,
            label: 'Occ. double'
        };
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
        const doubleDef = getOccupationDef('double');
        const { totalTaxes } = doubleDef ? resolveOccupationTaxes(p, doubleDef) : { totalTaxes: null };
        return {
            amount: totalTaxes !== null ? base + totalTaxes : base,
            label: 'Occ. double'
        };
    }

    function clampInt(value, { min = 0, max = 99 } = {}) {
        const n = Math.floor(Number(value));
        if (!Number.isFinite(n)) return min;
        return Math.max(min, Math.min(max, n));
    }

    function getAdultUnitPriceForDef(p, def) {
        if (!def) return 0;
        switch (def.id) {
            case 'simple':
            case 'simple_1_child':
                return pickOccupationPrice(p, ['priceOccSimple', 'price_occ_simple']) ?? 0;
            case 'triple':
                return pickOccupationPrice(p, ['priceOccTriple', 'price_occ_triple']) ?? 0;
            case 'quad':
                return pickOccupationPrice(p, ['priceOccQuad', 'price_occ_quad']) ?? 0;
            case 'autres':
                return pickOccupationPrice(p, ['priceAutres', 'price_autres', 'price_occ_autres']) ?? 0;
            default:
                return pickOccupationPrice(p, ['price', 'price_occ_double']) ?? 0;
        }
    }

    /**
     * Totaux occupation — prix total GHL; taxes = taxes_amount ($ / pers.) × voyageurs.
     */
    function getOccupationPricingBreakdown(p, occupationId, overrides) {
        const def = getOccupationDef(occupationId);
        const row = getSelectedOccupationRow(p, occupationId);
        if (!def || !row) return null;

        const adults = def.adults ?? 0;
        const baseChildren212 = def.children212 ?? 0;
        const baseChildren1317 = def.children1317 ?? 0;
        const children212 = overrides && overrides.children212 !== undefined
            ? clampInt(overrides.children212, { min: 0, max: 9 })
            : baseChildren212;
        const children1317 = overrides && overrides.children1317 !== undefined
            ? clampInt(overrides.children1317, { min: 0, max: 9 })
            : baseChildren1317;
        const totalPeople = adults + children212 + children1317;

        const totalBeforeTaxes = Math.round(row.price);
        const totalTaxes = row.totalTaxes ?? null;
        const totalWithTaxes = row.totalWithTaxes ?? (totalTaxes !== null ? totalBeforeTaxes + totalTaxes : null);
        const taxesPerPerson = row.taxesPerPerson ?? (
            totalTaxes !== null && totalPeople > 0 ? Math.round(totalTaxes / totalPeople) : null
        );

        const depositPerPerson = optionalPrice(p.depositAmount ?? p.deposit_amount);
        const totalDeposit = depositPerPerson !== null ? totalPeople * depositPerPerson : null;

        const taxChild212Unit = taxesPerPerson;
        const taxChild1317Unit = taxesPerPerson;

        let pricingSummary = `${formatMoney(totalBeforeTaxes)} avant taxes`;
        if (totalTaxes !== null && totalWithTaxes !== null) {
            pricingSummary += ` + taxes ${formatMoney(totalTaxes)} = ${formatMoney(totalWithTaxes)} total`;
        }

        return {
            adults,
            children212,
            children1317,
            totalPeople,
            adultUnitPrice: null,
            child212UnitPrice: optionalPrice(p.priceChild212 ?? p.price_child_2_12),
            child1317UnitPrice: optionalPrice(p.priceChild1317 ?? p.price_child_13_17),
            taxChild212Unit,
            taxChild1317Unit,
            selectedUnitPrice: row.price,
            totalBeforeTaxes,
            totalTaxes,
            totalWithTaxes,
            taxesPerPerson,
            depositPerPerson,
            totalDeposit,
            pricingMethod: 'occupation_total',
            pricingSummary
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
            set('occupation', row.label);
            set('occupation_code', row.id);
            set('occupation_label', row.label);
            set('selected_price', row.price);
            set('selected_taxes', row.totalTaxes ?? row.taxes);
            set('selected_total', row.totalWithTaxes);
        }
        if (breakdown) {
            set('nombre_personnes', breakdown.totalPeople);
            set('nombre_adultes', breakdown.adults);
            set('nombre_enfants_2_12', breakdown.children212);
            set('nombre_enfants_13_17', breakdown.children1317);
            set('prix_total_avant_taxe', breakdown.totalBeforeTaxes);
            set('prix_total_avant_taxes', breakdown.totalBeforeTaxes);
            set('taxes_total1', breakdown.totalTaxes);
            set('taxes_total', breakdown.totalTaxes);
            set('taxes_par_personne', breakdown.taxesPerPerson);
            set('tax_child_2_12', breakdown.taxChild212Unit);
            set('tax_child_13_17', breakdown.taxChild1317Unit);
            set('depot_par_personne', breakdown.depositPerPerson);
            set('depot_total', breakdown.totalDeposit);
            set('prix_total', breakdown.totalWithTaxes ?? breakdown.totalBeforeTaxes);
            set('total', breakdown.totalWithTaxes ?? breakdown.totalBeforeTaxes);
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
        set('supplier', p.supplier);
        set('carrier', p.carrier);
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
        set('price_simple', pickOccupationPrice(p, ['priceOccSimple', 'price_occ_simple']));
        set('price_simple_1_child', pickOccupationPrice(p, ['priceOccSimple1Child', 'price_occ_simple_1_child']));
        set('price_triple', pickOccupationPrice(p, ['priceOccTriple', 'price_occ_triple']));
        set('price_quad', pickOccupationPrice(p, ['priceOccQuad', 'price_occ_quad']));
        set('price_autres', pickOccupationPrice(p, ['priceAutres', 'price_autres', 'price_occ_autres']));
        set('price_child_2_12', optionalPrice(p.priceChild212 ?? p.price_child_2_12));
        set('price_child_13_17', optionalPrice(p.priceChild1317 ?? p.price_child_13_17));
        set('price_original', optionalPrice(p.priceOriginal ?? p.price_original));

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

    function inferDepartureLabel(p, leg) {
        if (leg?.from) return leg.from;
        return p.departureAirport || '';
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

        if (!flightLegHasData(out) && (departureDate || p.departureAirport)) {
            out.from = inferDepartureLabel(p, out);
            out.departDate = out.departDate || departureDate;
            out.to = inferArrivalLabel(p, out);
            out.arriveDate = out.arriveDate || out.departDate || departureDate;
        }
        if (!flightLegHasData(ret) && (returnDate || p.subDest)) {
            ret.from = ret.from || inferArrivalLabel(p, ret);
            ret.departDate = ret.departDate || returnDate;
            ret.to = ret.to || inferDepartureLabel(p, ret);
            ret.arriveDate = ret.arriveDate || ret.departDate || returnDate;
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

    /** Red card incentive — rabais, prix barré, financement optionnel */
    function getIncentive(p) {
        const doubleListing = getDoubleOccupationDisplayPrice(p);
        const price = doubleListing?.amount ?? null;
        if (price === null) return null;

        const original = optionalPrice(p.priceOriginal ?? p.price_original);
        const discount = optionalPrice(p.discountAmount ?? p.discount_amount ?? p.rabais);

        const hasPromo = discount !== null && discount > 0;
        if (!hasPromo) return null;

        const doubleDef = getOccupationDef('double');
        const { totalTaxes } = doubleDef ? resolveOccupationTaxes(p, doubleDef) : { totalTaxes: null };
        const doubleBeforeTaxes = optionalPrice(p.price);
        let strikeBeforeTaxes = original;
        if (strikeBeforeTaxes === null && doubleBeforeTaxes !== null && discount !== null) {
            strikeBeforeTaxes = doubleBeforeTaxes + discount;
        }
        const strikePrice = strikeBeforeTaxes !== null
            ? (totalTaxes !== null ? strikeBeforeTaxes + totalTaxes : strikeBeforeTaxes)
            : price + discount;
        const financing = optionalPrice(
            p.financingMonthly ?? p.financing_monthly ?? p.financement_mensuel
        );

        return {
            price,
            strikePrice,
            discount,
            financing,
            occupationLabel: doubleListing?.label ?? 'Occ. double'
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
            taxesAmount,
            destLabel: (window.destLabels && window.destLabels[p.destTag]) || p.destTag,
            destination: p.destination1 || p.destination || subDest,
            destinationLabel: formatDestinationLabel(p.destination1 || p.destination || subDest),
            departureAirport: p.departureAirport || p.departure_airport || '',
            departureDate: departureDateValid,
            returnDate: returnDateValid,
            criteria: Array.isArray(p.criteria) ? p.criteria.map(normalizeCriterionValue) : [],
            priceOccSimple: optionalPrice(p.priceOccSimple ?? p.price_occ_simple),
            priceOccTriple: optionalPrice(p.priceOccTriple ?? p.price_occ_triple),
            priceOccDouble1Child: optionalPrice(p.priceOccDouble1Child ?? p.price_occ_double_1_child),
            priceOccDouble2Child: optionalPrice(p.priceOccDouble2Child ?? p.price_occ_double_2_child),
            priceOccSimple1Child: optionalPrice(p.priceOccSimple1Child ?? p.price_occ_simple_1_child),
            priceOccQuad: optionalPrice(p.priceOccQuad ?? p.price_occ_quad),
            priceAutres: optionalPrice(p.priceAutres ?? p.price_autres ?? p.price_occ_autres),
            taxesOccDouble: optionalPrice(p.taxesOccDouble ?? p.taxes_occ_double),
            taxesOccDouble1Child: optionalPrice(p.taxesOccDouble1Child ?? p.taxes_occ_double_1_child),
            taxesOccDouble2Child: optionalPrice(p.taxesOccDouble2Child ?? p.taxes_occ_double_2_child),
            taxesOccSimple: optionalPrice(p.taxesOccSimple ?? p.taxes_occ_simple),
            taxesOccSimple1Child: optionalPrice(p.taxesOccSimple1Child ?? p.taxes_occ_simple_1_child),
            taxesOccTriple: optionalPrice(p.taxesOccTriple ?? p.taxes_occ_triple),
            taxesOccQuad: optionalPrice(p.taxesOccQuad ?? p.taxes_occ_quad),
            taxesOccAutres: optionalPrice(p.taxesOccAutres ?? p.taxes_occ_autres),
            priceOriginal: optionalPrice(p.priceOriginal ?? p.price_original),
            discountAmount: optionalPrice(p.discountAmount ?? p.discount_amount ?? p.rabais),
            financingMonthly: optionalPrice(
                p.financingMonthly ?? p.financing_monthly ?? p.financement_mensuel
            ),
            depositAmount: optionalPrice(p.depositAmount ?? p.deposit_amount),
            finalPaymentDate: finalPaymentValid,
            priceChild212: optionalPrice(p.priceChild212 ?? p.price_child_2_12),
            priceChild1317: optionalPrice(p.priceChild1317 ?? p.price_child_13_17),
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

        return base;
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
    function getAirlineLogo(p) {
        const flights = p.flights || {};
        const custom = String(flights.airlineLogo || '').trim();
        if (custom) return custom;
        const carrier = String(p.carrier || '').trim();
        if (carrier) return getSupplierLogo(carrier);
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

    function matchesDestinationFilter(product, selectedDestinations) {
        if (!selectedDestinations.length) return true;
        const productKey = normalizeDestinationKey(product.destination);
        if (!productKey) return false;
        return selectedDestinations.some(d => normalizeDestinationKey(d) === productKey);
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
        return selectedAirports.includes(product.departureAirport);
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

    window.VoyageFiestaAPI = {
        fetchProducts,
        fetchProductBySlug,
        getProductBySlug,
        matchesSupplierFilter,
        matchesDestinationFilter,
        normalizeDestinationKey,
        formatDestinationLabel,
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
        getLowestOccupationRow,
        getDoubleOccupationDisplayPrice,
        getListingDisplayPrice,
        getSelectedOccupationRow,
        getOccupationPricingBreakdown,
        pickOccupationPrice,
        calculateSalesTaxes,
        formatTaxRatesLabel,
        buildGhlReservationParams,
        getPaymentTerms,
        getEffectiveFlights,
        getIncentive,
        formatMoney,
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
        getSupplierLogo,
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
        extractPackageArray
    };
})();
