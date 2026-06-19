(function () {
    const FETCH_TIMEOUT_MS = 15000;
    const JSON_URL = (window.PRODUCTS_JSON_URL || 'products.json').replace(/^\//, '');

    function isActifPackage(p) {
        return p && p.active === 'actif';
    }

    function isDetailVisible(p) {
        if (!p) return false;
        const state = normalizeState(p.state, p.active);
        return state === 'actif' || state === 'complet_sold_out';
    }

    function normalizeState(state, legacyActive) {
        if (state) return String(state).toLowerCase();
        if (legacyActive === false) return 'archiv';
        if (legacyActive === 'actif' || legacyActive === 'complet_sold_out') return legacyActive;
        return 'actif';
    }

    function isSoldOut(p) {
        const state = normalizeState(p.state, p.active);
        return state === 'complet_sold_out' || p.inventory === 0;
    }

    function isVisibleOnSite(p) {
        return isActifPackage(p) || normalizeState(p.state, p.active) === 'complet_sold_out';
    }

    function normalizeProduct(p) {
        const endDate = p.endDate
            ? new Date(p.endDate)
            : new Date(Date.now() + (p.endDateIn || 3) * 86400000 + (p.endDateExtra || 0));

        const state = normalizeState(p.state, p.active);

        return {
            ...p,
            active: p.active || state,
            state,
            destLabel: (window.destLabels && window.destLabels[p.destTag]) || p.destTag,
            destination: p.destination || p.subDest,
            departureAirport: p.departureAirport || 'Montréal (YUL)',
            criteria: Array.isArray(p.criteria) ? p.criteria : [],
            endDate,
            inventory: isSoldOut({ ...p, state }) ? 0 : p.inventory
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
            const listing = all.filter(isActifPackage);
            if (!listing.length) {
                throw new Error(all.length
                    ? 'No actif packages in products.json'
                    : 'products.json is empty');
            }
            return listing;
        } catch (err) {
            const message = err.name === 'AbortError'
                ? 'Request timed out after ' + FETCH_TIMEOUT_MS + 'ms'
                : err.message;
            console.error('[api] products.json fetch failed:', message);
            return loadFallbackProducts(true);
        }
    }

    async function fetchProductBySlug(slug) {
        try {
            const all = await loadProductsJson();
            const product = all.find(p => p.slug === slug && isDetailVisible(p));
            if (product) return product;
            throw new Error('Product not found in products.json');
        } catch (err) {
            console.warn('[api] Detail fetch fallback for slug:', slug, err.message);
            return loadFallbackProductBySlug(slug);
        }
    }

    function loadFallbackProducts(actifOnly) {
        if (!window.products || !window.products.length) {
            console.error('[api] No fallback products available');
            return [];
        }
        console.warn('[api] Using local fallback products (products.js)');
        const list = window.products.map(normalizeProduct);
        return actifOnly ? list.filter(isActifPackage) : list.filter(isDetailVisible);
    }

    function loadFallbackProductBySlug(slug) {
        if (!window.products) return null;
        const product = window.products
            .map(normalizeProduct)
            .find(p => p.slug === slug && isDetailVisible(p));
        return product || null;
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
        isDetailVisible,
        normalizeState,
        extractPackageArray
    };
})();
