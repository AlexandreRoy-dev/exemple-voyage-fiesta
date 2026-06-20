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

    function optionalPrice(value) {
        if (value === undefined || value === null || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    }

    /** Catalogue occupations client — affiché seulement si le prix GHL est renseigné */
    const OCCUPATION_DEFS = [
        {
            id: 'double',
            label: 'Occ. double',
            hint: '2 adultes — prix par personne, avant taxes',
            primary: true,
            adults: 2,
            children212: 0,
            children1317: 0,
            priceKeys: ['price', 'price_occ_double']
        },
        {
            id: 'double_1_child',
            label: 'Occ. double + 1 enfant (2-12 ans)',
            hint: '2 adultes + 1 enfant (2-12 ans au retour)',
            adults: 2,
            children212: 1,
            children1317: 0,
            priceKeys: ['priceOccDouble1Child', 'price_occ_double_1_child']
        },
        {
            id: 'double_2_child',
            label: 'Occ. double + 2 enfants (2-12 ans)',
            hint: '2 adultes + 2 enfants (2-12 ans au retour)',
            adults: 2,
            children212: 2,
            children1317: 0,
            priceKeys: ['priceOccDouble2Child', 'price_occ_double_2_child']
        },
        {
            id: 'simple',
            label: 'Occ. simple',
            hint: '1 adulte — prix par personne, avant taxes',
            adults: 1,
            children212: 0,
            children1317: 0,
            priceKeys: ['priceOccSimple', 'price_occ_simple']
        },
        {
            id: 'simple_1_child',
            label: 'Occ. simple + 1 enfant (2-12 ans)',
            hint: '1 adulte + 1 enfant (2-12 ans au retour)',
            adults: 1,
            children212: 1,
            children1317: 0,
            priceKeys: ['priceOccSimple1Child', 'price_occ_simple_1_child']
        },
        {
            id: 'triple',
            label: 'Occ. triple',
            hint: '3 adultes — prix par personne, avant taxes',
            adults: 3,
            children212: 0,
            children1317: 0,
            priceKeys: ['priceOccTriple', 'price_occ_triple']
        },
        {
            id: 'quad',
            label: 'Occ. quad',
            hint: '4 adultes — prix par personne, avant taxes',
            adults: 4,
            children212: 0,
            children1317: 0,
            priceKeys: ['priceOccQuad', 'price_occ_quad']
        },
        {
            id: 'autres',
            label: 'Autres',
            hint: 'Autre configuration — prix par personne, avant taxes',
            adults: 1,
            children212: 0,
            children1317: 0,
            priceKeys: ['priceAutres', 'price_autres', 'price_occ_autres']
        }
    ];

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
        const taxes = optionalPrice(p.taxesAmount ?? p.taxes_amount);

        function withTaxes(row) {
            if (taxes !== null) {
                row.taxes = taxes;
                row.totalWithTaxes = row.price + taxes;
            }
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
            }));
        }

        if (rows.length && !rows.some(r => r.primary)) {
            rows[0].primary = true;
        }

        return rows;
    }

    function getOccupationDef(occupationId) {
        return OCCUPATION_DEFS.find(d => d.id === occupationId) || null;
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
     * Dépôt total, prix total (adultes + enfants) et décomposition pour reporting / courriel GHL.
     */
    function getOccupationPricingBreakdown(p, occupationId) {
        const def = getOccupationDef(occupationId);
        const row = getSelectedOccupationRow(p, occupationId);
        if (!def || !row) return null;

        const adults = def.adults ?? 0;
        const children212 = def.children212 ?? 0;
        const children1317 = def.children1317 ?? 0;
        const totalPeople = adults + children212 + children1317;

        const adultUnit = getAdultUnitPriceForDef(p, def);
        const child212Unit = optionalPrice(p.priceChild212 ?? p.price_child_2_12);
        const child1317Unit = optionalPrice(p.priceChild1317 ?? p.price_child_13_17);
        const taxesPerPerson = optionalPrice(p.taxesAmount ?? p.taxes_amount);
        const depositPerPerson = optionalPrice(p.depositAmount ?? p.deposit_amount);

        const hasChildTravelers = children212 > 0 || children1317 > 0;
        const canSplitChildPricing = hasChildTravelers && (child212Unit !== null || child1317Unit !== null);

        let totalBeforeTaxes;
        let pricingMethod;

        if (!hasChildTravelers) {
            const unit = row.price || adultUnit;
            totalBeforeTaxes = adults * unit;
            pricingMethod = 'adults_only';
        } else if (canSplitChildPricing) {
            totalBeforeTaxes =
                adults * adultUnit +
                children212 * (child212Unit ?? row.price) +
                children1317 * (child1317Unit ?? child212Unit ?? row.price);
            pricingMethod = 'adults_and_children';
        } else {
            totalBeforeTaxes = totalPeople * row.price;
            pricingMethod = 'package_per_person';
        }

        totalBeforeTaxes = Math.round(totalBeforeTaxes);
        const totalTaxes = taxesPerPerson !== null ? totalPeople * taxesPerPerson : null;
        const totalWithTaxes = totalTaxes !== null ? totalBeforeTaxes + totalTaxes : null;
        const totalDeposit = depositPerPerson !== null ? totalPeople * depositPerPerson : null;

        const parts = [];
        if (adults > 0 && (pricingMethod !== 'package_per_person' || !hasChildTravelers)) {
            parts.push(`${adults} adulte${adults > 1 ? 's' : ''} × ${formatMoney(adultUnit || row.price)}`);
        }
        if (children212 > 0 && canSplitChildPricing) {
            parts.push(`${children212} enfant${children212 > 1 ? 's' : ''} (2-12) × ${formatMoney(child212Unit)}`);
        }
        if (children1317 > 0 && canSplitChildPricing && child1317Unit !== null) {
            parts.push(`${children1317} enfant${children1317 > 1 ? 's' : ''} (13-17) × ${formatMoney(child1317Unit)}`);
        }
        if (pricingMethod === 'package_per_person') {
            parts.push(`${totalPeople} pers. × ${formatMoney(row.price)}`);
        }

        return {
            adults,
            children212,
            children1317,
            totalPeople,
            adultUnitPrice: adultUnit || row.price,
            child212UnitPrice: child212Unit,
            child1317UnitPrice: child1317Unit,
            selectedUnitPrice: row.price,
            totalBeforeTaxes,
            totalTaxes,
            totalWithTaxes,
            taxesPerPerson,
            depositPerPerson,
            totalDeposit,
            pricingMethod,
            pricingSummary: parts.join(' + ') + ` = ${formatMoney(totalBeforeTaxes)} avant taxes`
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
    function buildGhlReservationParams(p, occupationId) {
        const params = {};
        const set = (key, value) => {
            if (value === undefined || value === null || value === '') return;
            params[key] = String(value);
        };

        set('forfait_slug', p.slug);
        set('forfait_name', p.name);
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
        set('final_payment_date', formatDepartureDate(p.finalPaymentDate));
        set('deposit_amount', optionalPrice(p.depositAmount ?? p.deposit_amount));
        set('taxes_amount', optionalPrice(p.taxesAmount ?? p.taxes_amount));

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

        const row = getSelectedOccupationRow(p, occupationId);
        if (row) {
            set('occupation', row.id);
            set('occupation_label', row.label);
            set('selected_price', row.price);
            set('selected_taxes', row.taxes);
            set('selected_total', row.totalWithTaxes);
        }

        const breakdown = getOccupationPricingBreakdown(p, occupationId);
        if (breakdown) {
            set('nombre_personnes', breakdown.totalPeople);
            set('nombre_adultes', breakdown.adults);
            set('nombre_enfants_2_12', breakdown.children212);
            set('nombre_enfants_13_17', breakdown.children1317);
            set('depot_par_personne', breakdown.depositPerPerson);
            set('depot_total', breakdown.totalDeposit);
            set('prix_adulte_unitaire', breakdown.adultUnitPrice);
            set('prix_enfant_2_12_unitaire', breakdown.child212UnitPrice);
            set('prix_enfant_13_17_unitaire', breakdown.child1317UnitPrice);
            set('prix_total_avant_taxes', breakdown.totalBeforeTaxes);
            set('taxes_total', breakdown.totalTaxes);
            set('prix_total', breakdown.totalWithTaxes ?? breakdown.totalBeforeTaxes);
            set('pricing_summary', breakdown.pricingSummary);
            // Alias pour champs formulaire GHL client (Query Keys du formulaire actuel)
            set('prix_total_avant_taxe', breakdown.totalBeforeTaxes);
            set('taxes_total1', breakdown.totalTaxes);
            set('sommaire', breakdown.pricingSummary);
            set('total', breakdown.totalWithTaxes ?? breakdown.totalBeforeTaxes);
        }

        return params;
    }

    function getPaymentTerms(p) {
        const deposit = optionalPrice(p.depositAmount ?? p.deposit_amount);
        const finalPaymentDateRaw = p.finalPaymentDate ?? p.final_payment_date;
        const finalPaymentDate = finalPaymentDateRaw ? new Date(finalPaymentDateRaw) : null;
        const finalPaymentValid = finalPaymentDate && !Number.isNaN(finalPaymentDate.getTime())
            ? finalPaymentDate
            : null;
        const taxes = optionalPrice(p.taxesAmount ?? p.taxes_amount);

        if (deposit === null && !finalPaymentValid && taxes === null) return null;

        return { deposit, finalPaymentDate: finalPaymentValid, taxes };
    }

    function inferArrivalLabel(p, leg) {
        if (leg?.to) return leg.to;
        if (p.subDest) return p.subDest;
        return p.destination || p.destination1 || '';
    }

    function inferDepartureLabel(p, leg) {
        if (leg?.from) return leg.from;
        return p.departureAirport || 'Montréal (YUL)';
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
            airlineLogo: flights.airlineLogo || ''
        };
    }

    function hasFlights(p) {
        const flights = getEffectiveFlights(p);
        return flightLegHasData(flights.out) || flightLegHasData(flights.return);
    }

    function formatMoney(amount) {
        const n = Math.round(Number(amount));
        if (!Number.isFinite(n)) return '';
        return n.toLocaleString('fr-CA') + '\u00a0$';
    }

    /** Red card incentive — rabais, prix barré, financement optionnel */
    function getIncentive(p) {
        const price = optionalPrice(p.price);
        if (price === null) return null;

        const original = optionalPrice(p.priceOriginal ?? p.price_original);
        let discount = optionalPrice(p.discountAmount ?? p.discount_amount ?? p.rabais);

        if (discount === null && original !== null && original > price) {
            discount = original - price;
        }

        const hasPromo = discount !== null && discount > 0;
        if (!hasPromo) return null;

        const strikePrice = original !== null && original > price ? original : price + discount;
        const financing = optionalPrice(
            p.financingMonthly ?? p.financing_monthly ?? p.financement_mensuel
        );

        return {
            price,
            strikePrice,
            discount,
            financing
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

    /** Hotel star rating — supports half stars (e.g. 3.5) */
    function normalizeStars(value) {
        const n = Number(value);
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
        const returnDate = returnDateRaw ? new Date(returnDateRaw) : null;
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

        return {
            ...p,
            active: state,
            state,
            destLabel: (window.destLabels && window.destLabels[p.destTag]) || p.destTag,
            destination: p.destination1 || p.destination || p.subDest,
            departureAirport: p.departureAirport || 'Montréal (YUL)',
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
            priceOriginal: optionalPrice(p.priceOriginal ?? p.price_original),
            discountAmount: optionalPrice(p.discountAmount ?? p.discount_amount ?? p.rabais),
            financingMonthly: optionalPrice(
                p.financingMonthly ?? p.financing_monthly ?? p.financement_mensuel
            ),
            taxesAmount: optionalPrice(p.taxesAmount ?? p.taxes_amount),
            depositAmount: optionalPrice(p.depositAmount ?? p.deposit_amount),
            finalPaymentDate: finalPaymentValid,
            priceChild212: optionalPrice(p.priceChild212 ?? p.price_child_2_12),
            priceChild1317: optionalPrice(p.priceChild1317 ?? p.price_child_13_17),
            flights: p.flights || { out: {}, return: {}, airlineLogo: '' },
            stars: normalizeStars(p.stars),
            endDate,
            inventory: isSoldOut({ ...p, state }) ? 0 : p.inventory,
            img,
            imgRoom,
            imgExtra,
            images: buildProductGallery({ ...p, img, imgRoom, imgExtra })
        };
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
            return all.find(p => p.slug === slug && isDetailVisible(p)) || null;
        } catch (err) {
            console.error('[api] products.json unavailable for slug:', slug, err.message);
            return null;
        }
    }

    function getProductBySlug(products, slug) {
        return products.find(p => p.slug === slug);
    }

    function isOtherSupplier(supplier) {
        return !(window.KNOWN_SUPPLIERS || []).includes(supplier);
    }

    function matchesSupplierFilter(product, selectedSuppliers) {
        if (!selectedSuppliers.length) return true;
        return selectedSuppliers.some(s => {
            if (s === 'Autres') return isOtherSupplier(product.supplier);
            return product.supplier === s;
        });
    }

    function matchesDestinationFilter(product, selectedDestinations) {
        if (!selectedDestinations.length) return true;
        return selectedDestinations.includes(product.destination);
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

    window.VoyageFiestaAPI = {
        fetchProducts,
        fetchProductBySlug,
        getProductBySlug,
        matchesSupplierFilter,
        matchesDestinationFilter,
        matchesAirportFilter,
        matchesCriteriaFilter,
        formatDepartureDate,
        departureDateSortKey,
        normalizeCriterionValue,
        getCriteriaLabel,
        productHasCriterion,
        getOccupationPrices,
        getSelectedOccupationRow,
        getOccupationPricingBreakdown,
        pickOccupationPrice,
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
