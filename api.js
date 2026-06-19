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

    /** Occupation + enfant rows — prix avant taxes affichés; taxes en note si renseignées */
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

        const double = optionalPrice(p.price ?? p.price_occ_double);
        if (double !== null) {
            rows.push(withTaxes({
                id: 'double',
                label: 'Occ. double (2 pers.)',
                price: double,
                primary: true,
                hint: 'Prix par personne, avant taxes'
            }));
        }
        const triple = optionalPrice(p.priceOccTriple ?? p.price_occ_triple);
        if (triple !== null) {
            rows.push(withTaxes({
                id: 'triple',
                label: 'Occ. triple (3 pers.)',
                price: triple,
                hint: 'Prix par personne, avant taxes'
            }));
        }
        const simple = optionalPrice(p.priceOccSimple ?? p.price_occ_simple);
        if (simple !== null) {
            rows.push(withTaxes({
                id: 'simple',
                label: 'Occ. simple (1 pers.)',
                price: simple,
                hint: 'Prix par personne, avant taxes'
            }));
        }
        const doubleChild = optionalPrice(p.priceOccDouble1Child ?? p.price_occ_double_1_child);
        if (doubleChild !== null) {
            rows.push(withTaxes({
                id: 'double_1_child',
                label: 'Occ. double avec 1 enfant (- de 12 ans)',
                price: doubleChild,
                hint: '2 adultes + 1 enfant de moins de 12 ans au retour'
            }));
        }
        const child212 = optionalPrice(p.priceChild212 ?? p.price_child_2_12);
        if (child212 !== null) {
            rows.push(withTaxes({
                id: 'child_2_12',
                label: 'Enfant (2 à 12 ans)',
                price: child212,
                hint: 'Prix par personne, avant taxes'
            }));
        }
        const child1317 = optionalPrice(p.priceChild1317 ?? p.price_child_13_17);
        if (child1317 !== null) {
            rows.push(withTaxes({
                id: 'child_13_17',
                label: 'Enfant (13 à 17 ans)',
                price: child1317,
                hint: 'Prix par personne, avant taxes'
            }));
        }
        return rows;
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
        getPaymentTerms,
        getEffectiveFlights,
        getIncentive,
        formatMoney,
        formatFlightDate,
        formatFlightTime,
        formatFlightNumber,
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
