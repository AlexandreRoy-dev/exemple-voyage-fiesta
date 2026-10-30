import { mediaBases } from './endpoints.mjs';

/** Primary media mirror (api.voyagefiesta.ca). */
export const MIRRORED_MEDIA_BASE = mediaBases()[0];

const HASH_NAME = /^[a-f0-9]{16,}\.(jpe?g|png|webp|gif|avif)$/i;

/** File name when the URL points at one of the media mirrors. */
function mirrorName(value, bases) {
  for (const base of bases) {
    if (value.startsWith(`${base}/`)) {
      const name = value.slice(base.length + 1);
      if (HASH_NAME.test(name)) return name;
    }
  }
  return HASH_NAME.test(value) ? value : '';
}

function candidates(url, bases) {
  const value = String(url || '').trim();
  if (!value) return [];
  const name = mirrorName(value, bases);
  if (name) return bases.map((base) => `${base}/${name}`);
  return [value];
}

/**
 * Hosted catalog photo. src is the primary mirror, fallback is a space
 * separated list: the other mirror, then the original remote URL.
 */
export function catalogImage(value, extra = {}, cfg) {
  const bases = mediaBases(cfg);
  let src;
  let remote;
  if (value && typeof value === 'object') {
    src = value.url || value.src || value.image || '';
    remote = value.source || value.remote || value.imageSource || '';
  } else {
    src = value;
    remote = extra.imageSource || extra.source || extra.remote || '';
  }
  const list = [...new Set([...candidates(src, bases), ...candidates(remote, bases)])];
  return { src: list[0] || '', fallback: list.slice(1).join(' ') };
}

/** Next URL from a data-fallback list, and the rest of the list. */
export function nextFallback(list, current = '') {
  const items = String(list || '').split(/\s+/).filter((item) => item && item !== current);
  return { next: items[0] || '', rest: items.slice(1).join(' ') };
}
