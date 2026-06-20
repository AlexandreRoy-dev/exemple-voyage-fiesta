(function () {
    const params = new URLSearchParams(window.location.search);
    const forcedEmbed = params.get('embed') === '1';

    function inIframe() {
        try {
            return window.self !== window.top;
        } catch (_) {
            return true;
        }
    }

    function isEmbedMode() {
        return forcedEmbed || inIframe();
    }

    /** Preserve ?embed=1 on internal boutique links. */
    function boutiqueUrl(href) {
        if (!href || !isEmbedMode()) return href;
        try {
            const u = new URL(href, window.location.href);
            if (u.origin !== window.location.origin) return href;
            u.searchParams.set('embed', '1');
            const path = u.pathname.replace(/^\//, '');
            return path + u.search + u.hash;
        } catch (_) {
            return href;
        }
    }

    function applyEmbedMode() {
        if (!isEmbedMode()) return;
        document.documentElement.classList.add('embed-mode');
    }

    function patchLinks(root) {
        if (!isEmbedMode()) return;
        (root || document).querySelectorAll('a[href]').forEach(function (a) {
            const href = a.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
            if (/^https?:\/\//i.test(href)) {
                try {
                    if (new URL(href).origin !== window.location.origin) return;
                } catch (_) {
                    return;
                }
            }
            const patched = boutiqueUrl(href);
            if (patched !== href) a.setAttribute('href', patched);
        });
    }

    let resizeTimer;
    function notifyParentHeight() {
        if (!isEmbedMode() || !window.parent || window.parent === window) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            const height = Math.ceil(Math.max(
                document.documentElement.scrollHeight,
                document.body ? document.body.scrollHeight : 0,
                document.documentElement.offsetHeight
            ));
            if (height > 0) {
                window.parent.postMessage({
                    type: 'voyage-fiesta-resize',
                    height: height,
                    path: location.pathname + location.search
                }, '*');
            }
        }, 80);
    }

    window.VoyageFiestaEmbed = {
        isEmbedMode: isEmbedMode,
        boutiqueUrl: boutiqueUrl,
        patchLinks: patchLinks,
        notifyParentHeight: notifyParentHeight
    };

    applyEmbedMode();

    function onReady() {
        patchLinks();
        notifyParentHeight();

        if (isEmbedMode() && typeof MutationObserver !== 'undefined' && document.body) {
            var mo = new MutationObserver(function () {
                patchLinks();
                notifyParentHeight();
            });
            mo.observe(document.body, { childList: true, subtree: true });
        }

        if (isEmbedMode() && typeof ResizeObserver !== 'undefined' && document.documentElement) {
            var ro = new ResizeObserver(notifyParentHeight);
            ro.observe(document.documentElement);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }

    window.addEventListener('load', notifyParentHeight);
    window.addEventListener('resize', notifyParentHeight);
})();
