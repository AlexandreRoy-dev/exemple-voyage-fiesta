export const MIRRORED_MEDIA_BASE = 'https://dashboard.codesurmesure.ca/voyage-fiesta-reservation/media';

function acceptCatalogImageUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('//') || value.startsWith('/')) return value;
  if (/^[a-f0-9]{16,}\.(jpe?g|png|webp|gif|avif)$/i.test(value)) return `${MIRRORED_MEDIA_BASE}/${value}`;
  return value;
}

function pair(src, fallback) {
  if (src && fallback && src !== fallback) return { src, fallback };
  if (!src && fallback) return { src: fallback, fallback: '' };
  return { src: src || '', fallback: '' };
}

/** Hosted catalog photo, with the original remote URL kept for a load error. */
export function catalogImage(value, extra = {}) {
  if (value && typeof value === 'object') {
    return pair(
      acceptCatalogImageUrl(value.url || value.src || value.image || ''),
      acceptCatalogImageUrl(value.source || value.remote || value.imageSource || '')
    );
  }
  return pair(
    acceptCatalogImageUrl(value),
    acceptCatalogImageUrl(extra.imageSource || extra.source || extra.remote || '')
  );
}
