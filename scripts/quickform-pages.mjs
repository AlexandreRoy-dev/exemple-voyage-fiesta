/**
 * Static lead-capture pages, one per GHL user.
 * Live URL: https://aubaineexpress.voyagefiesta.ca/quickform/<slug>.html
 */

import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const QUICKFORM_DIR = resolve(ROOT, 'quickform');

export const SITE_BASE = (process.env.BOUTIQUE_BASE_URL || 'https://aubaineexpress.voyagefiesta.ca').replace(/\/$/, '');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildQuickformPageHtml(agent, options = {}) {
  const slug = String(agent.slug || '').trim();
  const publicSlugs = options.publicSlugs;
  const visible = !publicSlugs || publicSlugs.has(slug);
  const targetPath = visible ? `/agents/${encodeURIComponent(slug)}/` : '/agents/';
  const canonical = `${SITE_BASE}${targetPath}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page conseiller</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta http-equiv="refresh" content="0; url=${escapeHtml(targetPath)}">
  <script>location.replace(${JSON.stringify(targetPath)} + location.search + location.hash);</script>
</head>
<body>
  <p><a href="${escapeHtml(targetPath)}">Continuer vers la page du conseiller</a></p>
</body>
</html>
`;
}

export function writeQuickformPages(agents, options = {}) {
  const dir = options.dir || QUICKFORM_DIR;
  mkdirSync(dir, { recursive: true });
  const currentSlugs = new Set();

  for (const agent of agents || []) {
    const slug = String(agent?.slug || '').trim();
    const id = String(agent?.id || '').trim();
    if (!slug || !id) continue;
    currentSlugs.add(slug);
    writeFileSync(resolve(dir, `${slug}.html`), buildQuickformPageHtml(agent, options), 'utf8');
  }

  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.html') || file.includes('Jean-pc')) continue;
    const slug = file.slice(0, -5);
    if (!currentSlugs.has(slug)) {
      unlinkSync(resolve(dir, file));
    }
  }

  console.log(`Wrote ${currentSlugs.size} quickform page(s) to ${dir}`);
  return currentSlugs.size;
}
