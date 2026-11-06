/**
 * Embed mode for /agents/<slug>/ and /agents/.
 * Same parent message as embed.js and groupes/js/app.mjs:
 * { type: 'voyage-fiesta-resize', height, path }
 * height is the bottom of <main>, so the iframe can shrink.
 * The header and footer stay in the markup. CSS hides them only
 * when html.embed / html.embed-mode is set (iframe or ?embed=1).
 */
(function () {
    var params = new URLSearchParams(window.location.search);

    function inIframe() {
        try {
            return window.self !== window.top;
        } catch (_) {
            return true;
        }
    }

    function embedOn() {
        var value = params.get('embed');
        return value === '1' || value === 'sections' || inIframe();
    }

    function applyEmbedMode() {
        if (!embedOn()) return;
        document.documentElement.classList.add('embed', 'embed-mode');
    }

    function hasLead(search) {
        var found = false;
        search.forEach(function (value, key) {
            if (value && (key === 'ref' || key === 'ghl_user' || key.indexOf('utm_') === 0)) found = true;
        });
        return found;
    }

    /** Keep ref, ghl_user and utm_* already on the link. Fill only the missing ones from this page. */
    function keepLead(href) {
        try {
            var url = new URL(href, window.location.href);
            if (url.origin !== window.location.origin) return href;
            params.forEach(function (value, key) {
                if (!value) return;
                if ((key === 'ref' || key === 'ghl_user' || key.indexOf('utm_') === 0) && !url.searchParams.has(key)) {
                    url.searchParams.set(key, value);
                }
            });
            if (embedOn()) url.searchParams.set('embed', '1');
            return url.pathname + url.search + url.hash;
        } catch (_) {
            return href;
        }
    }

    function patchLinks(root) {
        if (!embedOn() && !hasLead(params)) return;
        (root || document).querySelectorAll('a[href]').forEach(function (anchor) {
            var href = anchor.getAttribute('href');
            if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;
            var patched = keepLead(href);
            if (patched !== href) anchor.setAttribute('href', patched);
        });
    }

    function contentHeight() {
        var main = document.querySelector('main');
        if (!main) return 0;
        var rect = main.getBoundingClientRect();
        return Math.ceil(rect.bottom + window.scrollY);
    }

    var timer;
    function notifyParentHeight() {
        if (!embedOn() || !window.parent || window.parent === window) return;
        clearTimeout(timer);
        timer = setTimeout(function () {
            var height = contentHeight();
            if (height > 0) {
                window.parent.postMessage({
                    type: 'voyage-fiesta-resize',
                    height: height,
                    path: location.pathname + location.search
                }, '*');
            }
        }, 80);
    }

    applyEmbedMode();

    function onReady() {
        patchLinks(document);
        notifyParentHeight();
        if (!embedOn()) return;
        window.addEventListener('resize', notifyParentHeight);
        if (document.readyState === 'complete') notifyParentHeight();
        else window.addEventListener('load', notifyParentHeight);
        var main = document.querySelector('main');
        if (main && typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(notifyParentHeight).observe(main);
        }
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(notifyParentHeight);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
})();
