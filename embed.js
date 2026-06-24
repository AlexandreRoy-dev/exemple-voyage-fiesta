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

    /** Prevent sideways page scroll on mobile / in iframe embed. */
    function injectOverflowFixStyles() {
        if (document.getElementById('vf-overflow-fix')) return;
        var style = document.createElement('style');
        style.id = 'vf-overflow-fix';
        style.textContent = [
            'html, body { max-width: 100%; overflow-x: clip; }',
            'img, video, iframe, svg { max-width: 100%; }',
            'html.embed-mode body { touch-action: pan-y; overscroll-behavior-x: none; }',
            '@media (max-width: 1023px) {',
            '  html, body { overflow-x: clip; touch-action: pan-y; overscroll-behavior-x: none; }',
            '  main, .container, #product-content { max-width: 100%; overflow-x: clip; }',
            '  .overflow-x-auto { max-width: 100%; -webkit-overflow-scrolling: touch; }',
            '}',
            '#vf-scroll-top {',
            '  position: fixed;',
            '  right: 1rem;',
            '  bottom: max(1rem, env(safe-area-inset-bottom));',
            '  z-index: 55;',
            '  display: inline-flex;',
            '  align-items: center;',
            '  justify-content: center;',
            '  gap: 0.35rem;',
            '  min-width: 2.75rem;',
            '  height: 2.75rem;',
            '  padding: 0 0.85rem;',
            '  border: none;',
            '  border-radius: 9999px;',
            '  background: #025091;',
            '  color: #fff;',
            '  font: inherit;',
            '  font-size: 0.8125rem;',
            '  font-weight: 600;',
            '  line-height: 1;',
            '  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);',
            '  cursor: pointer;',
            '  opacity: 0;',
            '  visibility: hidden;',
            '  transform: translateY(0.5rem);',
            '  transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease, background 0.2s ease;',
            '  -webkit-tap-highlight-color: transparent;',
            '}',
            '#vf-scroll-top.is-visible {',
            '  opacity: 1;',
            '  visibility: visible;',
            '  transform: translateY(0);',
            '}',
            '#vf-scroll-top:hover { background: #F26522; }',
            '#vf-scroll-top i { font-size: 0.95rem; }',
            '@media (min-width: 640px) {',
            '  #vf-scroll-top {',
            '    min-width: 3rem;',
            '    height: 3rem;',
            '    font-size: 0.875rem;',
            '  }',
            '}'
        ].join('\n');
        (document.head || document.documentElement).appendChild(style);
    }

    function initScrollToTop() {
        if (document.getElementById('vf-scroll-top')) return;
        var btn = document.createElement('button');
        btn.id = 'vf-scroll-top';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Retour en haut de la page');
        btn.innerHTML = '<i class="fa-solid fa-chevron-up" aria-hidden="true"></i><span class="hidden sm:inline">Haut</span>';

        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            notifyParentHeight();
        });

        var visible = false;
        function onScroll() {
            var show = (window.scrollY || document.documentElement.scrollTop) > 280;
            if (show === visible) return;
            visible = show;
            btn.classList.toggle('is-visible', show);
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        document.body.appendChild(btn);
        onScroll();
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

    function initEmbedChrome() {
        if (!isEmbedMode()) return;
        document.querySelectorAll('.embed-chrome').forEach(function (el) {
            el.classList.remove('hidden');
            el.removeAttribute('hidden');
        });
        document.querySelectorAll('[data-embed-financing]').forEach(function (el) {
            if (window.VoyageFiestaAPI && typeof window.VoyageFiestaAPI.renderFinancingNoteHtml === 'function') {
                el.innerHTML = window.VoyageFiestaAPI.renderFinancingNoteHtml({
                    compact: el.dataset.embedFinancing === 'compact',
                    sameTab: true
                });
            }
        });
        notifyParentHeight();
    }

    window.VoyageFiestaEmbed = {
        isEmbedMode: isEmbedMode,
        boutiqueUrl: boutiqueUrl,
        patchLinks: patchLinks,
        notifyParentHeight: notifyParentHeight,
        initEmbedChrome: initEmbedChrome
    };

    applyEmbedMode();
    injectOverflowFixStyles();

    function onReady() {
        patchLinks();
        initScrollToTop();
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

    window.addEventListener('load', function () {
        initEmbedChrome();
        notifyParentHeight();
    });
    window.addEventListener('resize', notifyParentHeight);
})();
