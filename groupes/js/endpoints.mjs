/**
 * Reservation API bases, in order. The first one is api.voyagefiesta.ca.
 * The second one is the current host, kept only as a fallback until the
 * DNS record for api.voyagefiesta.ca exists. Remove it after the cutover.
 * GROUPES_CONFIG.apiBases (groupes/config.js) overrides this list.
 */
export const DEFAULT_API_BASES = [
  'https://api.voyagefiesta.ca/voyage-fiesta-reservation/',
  'https://dashboard.codesurmesure.ca/voyage-fiesta-reservation/'
];

/** GET timeout before the next base is tried. */
export const GET_TIMEOUT_MS = 6000;

/** A POST is retried on the next base only when the app never saw it. */
const POST_RETRY_STATUS = new Set([404, 421, 502, 503]);

function slash(base) {
  const value = String(base || '').trim();
  if (!value) return '';
  return value.endsWith('/') ? value : `${value}/`;
}

export function apiBases(cfg = globalThis.GROUPES_CONFIG || {}) {
  const list = Array.isArray(cfg.apiBases) && cfg.apiBases.length ? cfg.apiBases : DEFAULT_API_BASES;
  return [...new Set(list.map(slash).filter(Boolean))];
}

export function mediaBases(cfg) {
  return apiBases(cfg).map((base) => `${base}media`);
}

/** Every candidate URL for a path under the API, primary first. */
export function apiUrls(path = '', cfg) {
  const clean = String(path || '').replace(/^\/+/, '');
  return apiBases(cfg).map((base) => base + clean);
}

function withTimeout(fetchFn, url, init, ms) {
  if (!ms || typeof AbortController === 'undefined') return fetchFn(url, init);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetchFn(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * fetch() over a list of URLs. GET moves on after a network error, a
 * timeout or a non ok status. POST moves on only after a network error or
 * a status that means the reservation app did not get the request, so a
 * form is never sent twice.
 */
export async function fetchFirst(urls, init = {}, { fetchFn = globalThis.fetch, timeoutMs = GET_TIMEOUT_MS } = {}) {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  const method = String(init.method || 'GET').toUpperCase();
  const safe = method === 'GET' || method === 'HEAD';
  let lastError = null;
  let lastResponse = null;
  for (let i = 0; i < list.length; i += 1) {
    const isLast = i === list.length - 1;
    try {
      const response = await withTimeout(fetchFn, list[i], init, safe ? timeoutMs : 0);
      if (isLast || response.ok) return response;
      if (safe || POST_RETRY_STATUS.has(response.status)) {
        lastResponse = response;
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError || new Error('fetch');
}
