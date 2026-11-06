function isFramed(view) {
  try { return view.self !== view.top; } catch (_) { return true; }
}

function tryOpen(target, url, name) {
  try {
    if (!target || typeof target.open !== 'function') return false;
    const popup = target.open(url, name);
    if (!popup) return false;
    try { popup.opener = null; } catch (_) { /* déjà isolé */ }
    return true;
  } catch (_) {
    return false;
  }
}

function clickAnchor(view, url, target) {
  const doc = view.document;
  const link = doc.createElement('a');
  link.href = url;
  link.target = target;
  link.rel = 'noopener noreferrer';
  (doc.body || doc.documentElement).appendChild(link);
  link.click();
  link.remove();
}

/**
 * Ouvre un moteur de recherche.
 * Hors iframe : nouvel onglet.
 * Dans l'iframe (voyagefiesta.com) : d'abord window.top.open, sinon un lien target=_top
 * plus un message voyage-fiesta-navigate si le parent bloque la sortie.
 */
export function openSearchResult(url, view = globalThis) {
  if (typeof url !== 'string' || !/^https:\/\//.test(url)) return 'invalid';
  const framed = isFramed(view);
  if (!framed && tryOpen(view, url, '_blank')) return 'blank';
  if (framed && tryOpen(view.top, url, '_blank')) return 'top-blank';
  const target = framed ? '_top' : '_blank';
  if (framed) {
    try {
      if (view.parent && view.parent !== view) {
        view.parent.postMessage({ type: 'voyage-fiesta-navigate', url }, '*');
      }
    } catch (_) { /* parent inaccessible */ }
  }
  try {
    clickAnchor(view, url, target);
    return framed ? 'top-link' : 'blank-link';
  } catch (_) {
    try {
      view.location.assign(url);
      return 'assign';
    } catch (_) {
      return 'failed';
    }
  }
}
