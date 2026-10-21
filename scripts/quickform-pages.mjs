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

function escapeJs(value) {
  return JSON.stringify(String(value || ''));
}

function buildQuickformPageHtml(agent) {
  const name = String(agent.name || '').trim() || 'Voyage Fiesta';
  const slug = String(agent.slug || '').trim();
  const pageUrl = `${SITE_BASE}/quickform/${encodeURIComponent(slug)}.html`;
  const boutiqueUrl = `${SITE_BASE}/?agent=${encodeURIComponent(slug)}`;
  const title = `Formulaire de contact : ${name}`;
  const description = `Laissez vos coordonnées pour ${name}. Un conseiller Voyage Fiesta vous rappellera.`;

  return `<!DOCTYPE html>
<html lang="fr-CA">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="author" content="Voyage Fiesta">
  <meta name="theme-color" content="#025091">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Voyage Fiesta">
  <meta property="og:locale" content="fr_CA">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:image" content="https://aubaineexpress.voyagefiesta.ca/assets/hero-plage.jpg">
  <meta property="og:image:secure_url" content="https://aubaineexpress.voyagefiesta.ca/assets/hero-plage.jpg">
  <meta property="og:image:alt" content="${escapeHtml(name)}, Voyage Fiesta">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="https://aubaineexpress.voyagefiesta.ca/assets/hero-plage.jpg">
  <meta name="twitter:image:alt" content="${escapeHtml(name)}, Voyage Fiesta">
  <link rel="stylesheet" href="/assets/tailwind.css">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script>
    window.QUICKFORM_AGENT = {
      id: ${escapeJs(agent.id)},
      slug: ${escapeJs(slug)},
      name: ${escapeJs(name)},
      email: ${escapeJs(agent.email)},
      phone: ${escapeJs(agent.phone)}
    };
  </script>
</head>
<body class="text-gray-800 font-sans min-h-screen">
  <div id="quickform-root"><h1 style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">Formulaire de contact</h1></div>
  <script src="../config.js?v=50"></script>
  <script src="../quickform.js?v=2"></script>
  <script>
    if (window.VoyageFiestaQuickform) {
      window.VoyageFiestaQuickform.mount({
        boutiqueUrl: ${escapeJs(boutiqueUrl)}
      });
    }
  </script>
</body>
</html>
`;
}

export function writeQuickformPages(agents) {
  mkdirSync(QUICKFORM_DIR, { recursive: true });
  const currentSlugs = new Set();

  for (const agent of agents || []) {
    const slug = String(agent?.slug || '').trim();
    const id = String(agent?.id || '').trim();
    if (!slug || !id) continue;
    currentSlugs.add(slug);
    writeFileSync(resolve(QUICKFORM_DIR, `${slug}.html`), buildQuickformPageHtml(agent), 'utf8');
  }

  for (const file of readdirSync(QUICKFORM_DIR)) {
    if (!file.endsWith('.html') || file.includes('Jean-pc')) continue;
    const slug = file.slice(0, -5);
    if (!currentSlugs.has(slug)) {
      unlinkSync(resolve(QUICKFORM_DIR, file));
    }
  }

  console.log(`Wrote ${currentSlugs.size} quickform page(s) to ${QUICKFORM_DIR}`);
  return currentSlugs.size;
}
