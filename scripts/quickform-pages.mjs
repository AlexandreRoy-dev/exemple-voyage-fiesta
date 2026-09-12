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
  const title = `Formulaire de contact — ${name}`;
  const description = `Laissez vos coordonnées pour ${name}. Un conseiller Voyage Fiesta vous rappellera.`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="noindex">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Voyage Fiesta">
  <meta property="og:locale" content="fr_CA">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Poppins', 'sans-serif'] },
          colors: {
            brand: { blue: '#025091', orange: '#F26522', dark: '#1F2937', light: '#F3F7FA' }
          }
        }
      }
    };
  </script>
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
  <div id="quickform-root"></div>
  <script src="../config.js?v=50"></script>
  <script src="../quickform.js?v=1"></script>
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
    if (!file.endsWith('.html')) continue;
    const slug = file.slice(0, -5);
    if (!currentSlugs.has(slug)) {
      unlinkSync(resolve(QUICKFORM_DIR, file));
    }
  }

  console.log(`Wrote ${currentSlugs.size} quickform page(s) to ${QUICKFORM_DIR}`);
  return currentSlugs.size;
}
