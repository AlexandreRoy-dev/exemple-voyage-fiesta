/**
 * Static HTML share landing pages with Open Graph meta for social crawlers.
 * Facebook/Twitter read these files directly — they do not run product.html JS.
 */

import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SHARE_DIR = resolve(ROOT, 'share');

export const SITE_BASE = (process.env.BOUTIQUE_BASE_URL || 'https://aubaineexpress.voyagefiesta.ca').replace(/\/$/, '');
export const DEFAULT_SHARE_IMAGE =
  'https://images.pexels.com/photos/1450360/pexels-photo-1450360.jpeg?auto=compress&cs=tinysrgb&w=1200&fit=crop';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveSiteUrl(pathOrUrl) {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw.replace(/^\.\//, '')}`;
  return `${SITE_BASE}${path}`;
}

function isPlaceholderImage(src) {
  return !src || /placeholder|msgsndr-private/i.test(String(src));
}

function pickShareImage(product) {
  const candidates = [
    product.img,
    ...(Array.isArray(product.images) ? product.images : []),
    product.imgRoom,
    product.imgExtra
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (!isPlaceholderImage(candidate)) {
      return resolveSiteUrl(candidate);
    }
  }
  return DEFAULT_SHARE_IMAGE;
}

function formatMoney(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '';
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0
  }).format(Number(amount));
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

export function buildShareTitle(product) {
  const name = String(product.name || 'Voyage Fiesta').trim();
  const raw = product.discountAmount ?? product.discount_amount ?? product.rabais;
  const discount = Number(raw);
  let title;
  if (Number.isFinite(discount) && discount > 0) {
    const amount = formatMoney(discount);
    title = `${name} - ${amount} de rabais`;
  } else {
    title = name;
  }
  const departureRaw = product.departureDate ?? product.departure_date ?? product.date_de_depart;
  const departureLabel = formatDepartureDate(departureRaw);
  if (departureLabel) title += ` · Départ ${departureLabel}`;
  return title;
}

export function buildShareDescription(product) {
  const parts = [];
  const destination = product.subDest || product.destination || product.destination1;
  if (destination) parts.push(destination);
  if (product.country && product.country !== destination) parts.push(product.country);
  if (product.durationNights) parts.push(`${product.durationNights} nuits`);
  if (product.price != null) {
    parts.push(`à partir de ${formatMoney(product.price)}/pass.`);
  }
  return parts.filter(Boolean).join(' · ') || 'Forfait voyage tout inclus — Voyage Fiesta';
}

export function buildSharePageHtml(product) {
  const slug = String(product.slug || '').trim();
  const productUrl = `${SITE_BASE}/product.html?slug=${encodeURIComponent(slug)}`;
  const shareUrl = `${SITE_BASE}/share/${encodeURIComponent(slug)}.html`;
  const title = buildShareTitle(product);
  const description = buildShareDescription(product);
  const image = pickShareImage(product);
  const imageAlt = product.name || 'Voyage Fiesta';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Voyage Fiesta">
  <meta property="og:locale" content="fr_CA">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(shareUrl)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(image)}">
  <meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <link rel="canonical" href="${escapeHtml(shareUrl)}">
  <script>
    (function () {
      var ua = navigator.userAgent || '';
      var isCrawler = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Pinterest|Slackbot|WhatsApp|Discordbot/i.test(ua);
      if (!isCrawler) location.replace(${JSON.stringify(productUrl)});
    })();
  </script>
</head>
<body>
  <p><a href="${escapeHtml(productUrl)}">Voir le forfait — ${escapeHtml(product.name)}</a></p>
</body>
</html>
`;
}

export function writeSharePages(products) {
  mkdirSync(SHARE_DIR, { recursive: true });
  const currentSlugs = new Set();

  for (const product of products) {
    const slug = String(product.slug || '').trim();
    if (!slug) continue;
    currentSlugs.add(slug);
    writeFileSync(resolve(SHARE_DIR, `${slug}.html`), buildSharePageHtml(product), 'utf8');
  }

  for (const file of readdirSync(SHARE_DIR)) {
    if (!file.endsWith('.html')) continue;
    const slug = file.slice(0, -5);
    if (!currentSlugs.has(slug)) {
      unlinkSync(resolve(SHARE_DIR, file));
    }
  }

  console.log(`Wrote ${currentSlugs.size} share page(s) to ${SHARE_DIR}`);
  return currentSlugs.size;
}
