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

    function normalizeProduct(p) {
        const endDate = p.endDate
            ? new Date(p.endDate)
            : new Date(Date.now() + (p.endDateIn || 3) * 86400000 + (p.endDateExtra || 0));

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
            criteria: Array.isArray(p.criteria) ? p.criteria : [],
            endDate,
            inventory: isSoldOut({ ...p, state }) ? 0 : p.inventory,
            img,
            imgRoom,
            imgExtra
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

    function matchesCriteriaFilter(product, selectedCriteria) {
        if (!selectedCriteria.length) return true;
        return selectedCriteria.every(c => product.criteria.includes(c));
    }

    window.VoyageFiestaAPI = {
        fetchProducts,
        fetchProductBySlug,
        getProductBySlug,
        matchesSupplierFilter,
        matchesDestinationFilter,
        matchesAirportFilter,
        matchesCriteriaFilter,
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
