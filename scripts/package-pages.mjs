/**
 * One static HTML file per published forfait.
 * product.html?slug= stays as the booking shell (noindex). These files are the
 * canonical URLs, with a unique French title in the first HTML response.
 */

import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickShareImage } from './share-pages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'forfaits');
const TEMPLATE = resolve(ROOT, 'product.html');

export const SITE_BASE = (process.env.BOUTIQUE_BASE_URL || 'https://aubaineexpress.voyagefiesta.ca').replace(/\/$/, '');

const VISIBLE_STATES = new Set(['actif', 'pre_vente', 'prevente', 'complet_sold_out', 'vendu']);

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function formatDepartureDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function isVisiblePackage(product) {
  const raw = String(product?.active || product?.state || '')
    .toLowerCase()
    .trim();
  return VISIBLE_STATES.has(raw);
}

export function packageCanonicalPath(slug) {
  return `/forfaits/${slug}.html`;
}

export function packageCanonicalUrl(slug) {
  return `${SITE_BASE}${packageCanonicalPath(slug)}`;
}

/** Keep in sync with buildProductSeoTitle in api.js. */
export function packageSeoTitle(product) {
  const name = String(product?.name || '').trim() || 'Forfait tout inclus';
  return `${name} | Forfait tout inclus | Voyage Fiesta`;
}

/** Facts already on the fiche. No price: occupancy totals stay on the page. */
export function packageSeoDescription(product) {
  const parts = [];
  const destination = String(product?.destination || product?.subDest || product?.destination1 || '').trim();
  const country = String(product?.country || '').trim();
  if (destination && country && fold(country) !== fold(destination)) parts.push(`${destination}, ${country}`);
  else if (destination) parts.push(destination);
  else if (country) parts.push(country);

  const nights = Number(product?.durationNights);
  if (Number.isFinite(nights) && nights > 0) parts.push(`${nights} nuit${nights > 1 ? 's' : ''}`);

  const when = formatDepartureDate(product?.departureDate);
  const airport = String(product?.departureAirport || '').trim();
  if (when && airport) parts.push(`départ le ${when} de ${airport}`);
  else if (when) parts.push(`départ le ${when}`);
  else if (airport) parts.push(`départ de ${airport}`);

  let text = 'Forfait tout inclus Voyage Fiesta';
  if (parts.length) text += ` : ${parts.join(', ')}`;
  text += '.';
  return text;
}

function seoBlock({ title, description, url, image, imageAlt, jsonLd }) {
  return `<!-- seo:start -->
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <meta name="author" content="Voyage Fiesta">
    <meta name="theme-color" content="#025091">
    <link rel="canonical" href="${escapeHtml(url)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Voyage Fiesta">
    <meta property="og:locale" content="fr_CA">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(url)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:image:secure_url" content="${escapeHtml(image)}">
    <meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">
    <meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">
    <script type="application/ld+json">${jsonLd}</script>
<!-- seo:end -->`;
}

function buildPackageHtml(template, product) {
  const slug = String(product.slug || '').trim();
  const url = packageCanonicalUrl(slug);
  const title = packageSeoTitle(product);
  const description = packageSeoDescription(product);
  const image = pickShareImage(product);
  const imageAlt = String(product.name || 'Forfait tout inclus').trim();
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url,
    inLanguage: 'fr-CA',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Voyage Fiesta',
      url: `${SITE_BASE}/`,
    },
    publisher: {
      '@type': 'TravelAgency',
      name: 'Voyage Fiesta',
      alternateName: 'Aubaines Express',
      url: `${SITE_BASE}/`,
    },
  });

  let html = template;
  if (!html.includes('<base href="/">')) {
    html = html.replace(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <base href="/">'
    );
  }
  html = html.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, seoBlock({
    title,
    description,
    url,
    image,
    imageAlt,
    jsonLd,
  }));
  html = html.replace(
    /(<h1 id="product-static-title"[^>]*>)[\s\S]*?(<\/h1>)/,
    `$1${escapeHtml(imageAlt)}$2`
  );
  html = html.replace(
    /(<p id="product-static-summary"[^>]*>)[\s\S]*?(<\/p>)/,
    `$1${escapeHtml(description)}$2`
  );
  const preset = `<script>window.PRESET_PRODUCT_SLUG=${JSON.stringify(slug)};</script>\n    `;
  if (!html.includes('window.PRESET_PRODUCT_SLUG')) {
    html = html.replace('<script src="/config.js', `${preset}<script src="/config.js`);
  }
  return html;
}

export function writePackagePages(products = []) {
  const template = readFileSync(TEMPLATE, 'utf8');
  mkdirSync(OUT_DIR, { recursive: true });
  const keep = new Set();
  let written = 0;

  for (const product of products) {
    const slug = String(product?.slug || '').trim();
    if (!slug || !/^[a-z0-9-]+$/i.test(slug)) continue;
    if (!isVisiblePackage(product)) continue;
    writeFileSync(resolve(OUT_DIR, `${slug}.html`), buildPackageHtml(template, product), 'utf8');
    keep.add(`${slug}.html`);
    written += 1;
  }

  for (const file of readdirSync(OUT_DIR)) {
    if (!file.endsWith('.html')) continue;
    if (!keep.has(file)) unlinkSync(resolve(OUT_DIR, file));
  }

  console.log(`Wrote ${written} forfait page(s) to ${OUT_DIR}`);
  return written;
}
