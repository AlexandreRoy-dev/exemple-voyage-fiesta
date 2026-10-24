/**
 * Copy remote voyage and group images onto disk and report the count and size.
 *
 * Leaves the original URL in place when a download fails. Rewrites a catalog
 * URL to the local public address only when publicBase is set and the file
 * was stored.
 *
 * Env:
 *   ATRIUM_OUTPUT / ATRIUM_CATALOG   groupes.json to read
 *   ATRIUM_PRODUCTS                  products.json (optional)
 *   ATRIUM_MEDIA_DIR                 folder for the files
 *   ATRIUM_MEDIA_PUBLIC_BASE         public prefix, no trailing slash
 *   ATRIUM_MIRROR_DRY_RUN            1 = count URLs, do not download
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const candidates = [
    join(__dirname, '.env'),
    join(__dirname, '..', '.env'),
    join(__dirname, '..', 'reservation-api', '.env')
  ];
  for (const envPath of candidates) {
    let text = '';
    try {
      text = readFileSync(envPath, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eq = trimmed.indexOf('=');
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

export function isRemoteImage(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function fileNameFor(url) {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 20);
  let ext = 'img';
  try {
    const match = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
    if (match) ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  } catch {
    ext = 'img';
  }
  return `${hash}.${ext}`;
}

function addUrl(bag, url) {
  const value = String(url || '').trim();
  if (isRemoteImage(value)) bag.add(value);
}

function walkImages(node, bag, depth = 0) {
  if (!node || depth > 6) return;
  if (typeof node === 'string') {
    addUrl(bag, node);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => walkImages(item, bag, depth + 1));
    return;
  }
  if (typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (/image|img|photo|url|fichier/i.test(key)) walkImages(value, bag, depth + 1);
    }
  }
}

export function collectImageUrls({ catalog, products } = {}) {
  const bag = new Set();
  for (const group of catalog?.groups || []) walkImages(group, bag);
  for (const product of products || []) {
    addUrl(bag, product.img);
    addUrl(bag, product.image);
    addUrl(bag, product.imgRoom);
    addUrl(bag, product.imgExtra);
    walkImages(product.images, bag);
    walkImages(product.gallery, bag);
  }
  return [...bag];
}

function readManifest(path) {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return data && typeof data.files === 'object' ? data : { files: {} };
  } catch {
    return { files: {} };
  }
}

function publicUrl(publicBase, fileName) {
  if (!publicBase) return '';
  return `${String(publicBase).replace(/\/$/, '')}/${fileName}`;
}

function rewriteValue(value, map) {
  if (typeof value === 'string') return map.get(value) || value;
  if (Array.isArray(value)) return value.map((item) => rewriteValue(item, map));
  if (value && typeof value === 'object') {
    const next = { ...value };
    for (const key of Object.keys(next)) {
      if (/image|img|photo|url|fichier/i.test(key)) next[key] = rewriteValue(next[key], map);
    }
    return next;
  }
  return value;
}

export function applyHostedUrls(catalog, hostedBySource) {
  if (!catalog || !hostedBySource.size) return catalog;
  return {
    ...catalog,
    groups: (catalog.groups || []).map((group) => rewriteValue(group, hostedBySource))
  };
}

export async function mirrorImages({
  catalog = { groups: [] },
  products = [],
  mediaDir,
  publicBase = '',
  fetchImpl = globalThis.fetch,
  dryRun = false
} = {}) {
  if (!mediaDir) throw new Error('ATRIUM_MEDIA_DIR manquant');
  const urls = collectImageUrls({ catalog, products });
  mkdirSync(mediaDir, { recursive: true });
  const manifestPath = join(mediaDir, 'manifest.json');
  const manifest = readManifest(manifestPath);
  const report = {
    urls: urls.length,
    copied: 0,
    unchanged: 0,
    failed: 0,
    bytes: 0,
    totalBytes: 0,
    failures: []
  };
  const hosted = new Map();

  for (const url of urls) {
    const fileName = fileNameFor(url);
    const dest = join(mediaDir, fileName);
    const prior = manifest.files[url] || {};
    if (dryRun) continue;
    try {
      let etag = '';
      if (existsSync(dest) && prior.etag) {
        const head = await fetchImpl(url, { method: 'HEAD' }).catch(() => null);
        etag = head?.headers?.get?.('etag') || '';
        if (head?.ok && etag && etag === prior.etag) {
          report.unchanged += 1;
          if (publicBase) hosted.set(url, publicUrl(publicBase, fileName));
          continue;
        }
      }
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const digest = createHash('sha256').update(bytes).digest('hex');
      etag = response.headers?.get?.('etag') || etag;
      if (existsSync(dest) && prior.sha256 && prior.sha256 === digest) {
        report.unchanged += 1;
      } else {
        writeFileSync(dest, bytes);
        report.copied += 1;
        report.bytes += bytes.length;
      }
      manifest.files[url] = { file: fileName, bytes: bytes.length, sha256: digest, etag };
      if (publicBase) hosted.set(url, publicUrl(publicBase, fileName));
    } catch (error) {
      report.failed += 1;
      report.failures.push({ url, error: error.message });
    }
  }

  if (!dryRun) writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const entry of Object.values(manifest.files)) {
    const filePath = join(mediaDir, entry.file || '');
    if (entry.file && existsSync(filePath)) report.totalBytes += statSync(filePath).size;
  }
  return {
    report,
    catalog: applyHostedUrls(catalog, hosted)
  };
}

function defaultMediaDir() {
  const parent = join(__dirname, '..');
  if (existsSync(join(parent, 'server.mjs'))) return join(parent, 'media');
  return join(parent, 'reservation-api', 'media');
}

async function main() {
  loadEnvFile();
  const catalogPath = process.env.ATRIUM_CATALOG || process.env.ATRIUM_OUTPUT || join(__dirname, '..', 'reservation-api', 'groupes.json');
  const productsPath = process.env.ATRIUM_PRODUCTS || '';
  const catalog = existsSync(catalogPath) ? JSON.parse(readFileSync(catalogPath, 'utf8')) : { groups: [] };
  const products = productsPath && existsSync(productsPath)
    ? (JSON.parse(readFileSync(productsPath, 'utf8')).products || [])
    : [];
  const result = await mirrorImages({
    catalog,
    products,
    mediaDir: process.env.ATRIUM_MEDIA_DIR || defaultMediaDir(),
    publicBase: process.env.ATRIUM_MEDIA_PUBLIC_BASE || '',
    dryRun: ['1', 'true', 'yes', 'on'].includes(String(process.env.ATRIUM_MIRROR_DRY_RUN || '').toLowerCase())
  });
  const { report } = result;
  const mb = (report.totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`[mirror] ${report.urls} URL, ${report.copied} copiée(s), ${report.unchanged} inchangée(s), ${report.failed} échec, ${report.bytes} octets écrits, ${mb} Mo au total`);
  if (process.env.ATRIUM_MEDIA_PUBLIC_BASE && process.env.ATRIUM_CATALOG_OUTPUT) {
    writeFileSync(process.env.ATRIUM_CATALOG_OUTPUT, `${JSON.stringify(result.catalog)}\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`[mirror] ${error.message}`);
    process.exit(1);
  });
}
