/**
 * Static SEO landing pages, robots.txt, and sitemap for Aubaines Express.
 * Regenerated from products.json so destination lists stay current.
 */

import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DEST_DIR = resolve(ROOT, 'destinations');

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

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function formatMoney(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '';
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(Number(amount));
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

/** Listing price = occ. double + taxes, only when GHL published both sides as numbers. */
function listingPrice(product) {
  const base = Number(product.price);
  if (!Number.isFinite(base)) return null;
  const taxes = Number(product.taxesAmount ?? product.taxes_amount ?? product.taxes_par_personne);
  if (Number.isFinite(taxes) && taxes > 0) return base + taxes;
  return base;
}

function destHaystack(product) {
  return fold(
    [product.destination, product.destination1, product.subDest, product.destTag].filter(Boolean).join(' ')
  );
}

function countryHaystack(product) {
  return fold(product.country || '');
}

function departureHaystack(product) {
  return fold([product.departureAirport, product.returnAirport].filter(Boolean).join(' '));
}

function isPreSale(product) {
  const raw = fold(product.active || product.state || '');
  return raw === 'pre_vente' || raw === 'prevente';
}

function pickImage(product) {
  const candidates = [product.img, ...(Array.isArray(product.images) ? product.images : [])];
  for (const src of candidates) {
    if (!src || /placeholder|msgsndr-private/i.test(String(src))) continue;
    if (/^https?:\/\//i.test(src)) return src;
    const path = String(src).startsWith('/') ? src : `/${String(src).replace(/^\.\//, '')}`;
    return `${SITE_BASE}${path}`;
  }
  return DEFAULT_SHARE_IMAGE;
}

const DESTINATION_PAGES = [
  {
    slug: 'cancun',
    label: 'Cancún',
    title: 'Voyages tout inclus à Cancún | Voyage Fiesta',
    h1: 'Voyages tout inclus à Cancún au départ du Québec',
    description:
      'Forfaits tout inclus à Cancún au départ de Montréal ou Québec. Hôtel, vols et transferts sur les aubaines Voyage Fiesta.',
    match: (p) => destHaystack(p).includes('cancun'),
    listingParam: 'Cancun',
    paragraphs: [
      'Cancún est la destination mexicaine la plus demandée sur Aubaines Express : plages de la côte caraïbe, hôtels tout inclus et vols directs depuis le Québec.',
      'Les forfaits affichés ici reprennent les prix publiés dans GoHighLevel (occupation double, taxes comprises lorsqu’elles sont saisies). Si une occupation n’a pas de tarif, le site demande une soumission plutôt que d’inventer un total.',
    ],
  },
  {
    slug: 'riviera-maya',
    label: 'Riviera Maya',
    title: 'Voyages tout inclus Riviera Maya | Voyage Fiesta',
    h1: 'Forfaits tout inclus pour la Riviera Maya',
    description:
      'Riviera Maya et Playacar : hôtels tout inclus, départs Québec, prix d’occupation double publiés sur Aubaines Express.',
    match: (p) => /riviera maya|playacar/.test(destHaystack(p)),
    listingParam: 'Riviera Maya',
    paragraphs: [
      'La Riviera Maya regroupe Playa del Carmen, Playacar et les hôtels entre Cancún et Tulum. Les séjours listés partent surtout de Montréal.',
      'Comparez les départs, le nombre de nuits et le tarif double publié, puis ouvrez la fiche pour les autres occupations.',
    ],
  },
  {
    slug: 'riviera-nayarit',
    label: 'Riviera Nayarit',
    title: 'Voyages tout inclus Riviera Nayarit | Voyage Fiesta',
    h1: 'Forfaits tout inclus pour la Riviera Nayarit',
    description:
      'Riviera Nayarit au Mexique : forfaits tout inclus Voyage Fiesta au départ du Québec, selon les tarifs publiés.',
    match: (p) => destHaystack(p).includes('nayarit'),
    listingParam: 'Puerto Vallarta',
    paragraphs: [
      'La Riviera Nayarit se trouve sur la côte du Pacifique, près de Puerto Vallarta. Les forfaits tout inclus y sont moins nombreux que Cancún, mais restent affichés dès qu’un tarif est publié.',
    ],
  },
  {
    slug: 'punta-cana',
    label: 'Punta Cana',
    title: 'Voyages tout inclus à Punta Cana | Voyage Fiesta',
    h1: 'Forfaits tout inclus pour Punta Cana',
    description:
      'Punta Cana, République Dominicaine : voyages tout inclus au départ de Montréal ou Québec, prix publiés Aubaines Express.',
    match: (p) => destHaystack(p).includes('punta cana'),
    listingParam: 'Punta Cana',
    paragraphs: [
      'Punta Cana est le principal départ dominicain de la boutique : plages de l’est, hôtels tout inclus et vols vers PUJ.',
      'Chaque fiche indique le départ, la durée et le prix d’occupation double seulement s’il existe dans GoHighLevel.',
    ],
  },
  {
    slug: 'samana',
    label: 'Samaná',
    title: 'Voyages tout inclus à Samaná | Voyage Fiesta',
    h1: 'Forfaits tout inclus pour Samaná',
    description:
      'Samaná en République Dominicaine : forfaits tout inclus Voyage Fiesta, vols et hôtel selon les aubaines en cours.',
    match: (p) => destHaystack(p).includes('samana'),
    listingParam: 'Samana',
    paragraphs: [
      'Samaná (aéroport AZS) est une alternative plus calme à Punta Cana, sur la péninsule nord-est de la République Dominicaine.',
    ],
  },
  {
    slug: 'puerto-plata',
    label: 'Puerto Plata',
    title: 'Voyages tout inclus à Puerto Plata | Voyage Fiesta',
    h1: 'Forfaits tout inclus pour Puerto Plata',
    description:
      'Puerto Plata, République Dominicaine : séjours tout inclus au départ du Québec sur Aubaines Express.',
    match: (p) => destHaystack(p).includes('puerto plata'),
    listingParam: 'Puerto Plata',
    paragraphs: [
      'Puerto Plata (POP) dessert la côte nord dominicaine. Les forfaits listés suivent le même barème de prix que le reste de la boutique.',
    ],
  },
  {
    slug: 'roatan',
    label: 'Roatán',
    title: 'Voyages tout inclus à Roatán | Voyage Fiesta',
    h1: 'Forfaits tout inclus pour Roatán, Honduras',
    description:
      'Roatán au Honduras : plongée et plages, forfaits tout inclus Voyage Fiesta au départ du Québec.',
    match: (p) => destHaystack(p).includes('roatan'),
    listingParam: 'Roatan',
    paragraphs: [
      'Roatán est une île hondurienne de la mer des Caraïbes, souvent choisie pour la plongée et les séjours plage tout inclus.',
    ],
  },
  {
    slug: 'cozumel',
    label: 'Cozumel',
    title: 'Voyages tout inclus à Cozumel | Voyage Fiesta',
    h1: 'Forfaits tout inclus pour Cozumel',
    description:
      'Cozumel au Mexique : forfaits tout inclus Voyage Fiesta, vols et hôtel selon les tarifs d’occupation publiés.',
    match: (p) => destHaystack(p).includes('cozumel'),
    listingParam: 'Cozumel',
    paragraphs: [
      'Cozumel est une île au large de la Riviera Maya, connue pour ses récifs. Les aubaines apparaissent ici dès qu’un forfait est actif.',
    ],
  },
  {
    slug: 'playacar',
    label: 'Playacar',
    title: 'Voyages tout inclus à Playacar | Voyage Fiesta',
    h1: 'Forfaits tout inclus pour Playacar',
    description:
      'Playacar, près de Playa del Carmen : hôtels tout inclus au départ du Québec sur Aubaines Express.',
    match: (p) => destHaystack(p).includes('playacar'),
    listingParam: 'Riviera Maya',
    paragraphs: [
      'Playacar est le quartier hôtelier au sud de Playa del Carmen, sur la Riviera Maya. Les forfaits y sont classés avec les séjours mexicains de la boutique.',
    ],
  },
  {
    slug: 'freeport',
    label: 'Freeport',
    title: 'Voyages tout inclus à Freeport | Voyage Fiesta',
    h1: 'Forfaits tout inclus pour Freeport, Bahamas',
    description:
      'Freeport aux Bahamas : forfaits tout inclus Voyage Fiesta au départ du Québec, selon les aubaines publiées.',
    match: (p) => destHaystack(p).includes('freeport') || countryHaystack(p).includes('bahamas'),
    listingParam: 'Bahamas',
    paragraphs: [
      'Freeport, sur Grand Bahama, est le départ bahamien actuellement listé. Le prix affiché est celui de l’occupation double publiée.',
    ],
  },
];

const COUNTRY_PAGES = [
  {
    slug: 'mexique',
    label: 'Mexique',
    title: 'Voyages tout inclus au Mexique | Voyage Fiesta',
    h1: 'Forfaits tout inclus au Mexique',
    description:
      'Cancún, Riviera Maya, Cozumel et Riviera Nayarit : voyages tout inclus au Mexique au départ du Québec.',
    match: (p) => countryHaystack(p).includes('mexique'),
    listingParam: 'Cancun',
    paragraphs: [
      'Le Mexique concentre la majorité des aubaines de la boutique : Cancún, Riviera Maya, Playacar, Cozumel et parfois la Riviera Nayarit.',
      'Filtrez ensuite par hôtel, dates ou aéroport de départ sur la page des promotions.',
    ],
  },
  {
    slug: 'republique-dominicaine',
    label: 'République Dominicaine',
    title: 'Voyages tout inclus République Dominicaine | Voyage Fiesta',
    h1: 'Forfaits tout inclus en République Dominicaine',
    description:
      'Punta Cana, Samaná et Puerto Plata : voyages tout inclus en République Dominicaine au départ du Québec.',
    match: (p) => countryHaystack(p).includes('dominicaine'),
    listingParam: 'Punta Cana',
    paragraphs: [
      'La République Dominicaine est le deuxième pôle de la boutique après le Mexique, avec Punta Cana, Samaná et Puerto Plata.',
    ],
  },
  {
    slug: 'honduras',
    label: 'Honduras',
    title: 'Voyages tout inclus au Honduras | Voyage Fiesta',
    h1: 'Forfaits tout inclus au Honduras',
    description:
      'Roatán et autres départs honduriens : forfaits tout inclus Voyage Fiesta au départ du Québec.',
    match: (p) => countryHaystack(p).includes('honduras'),
    listingParam: 'Roatan',
    paragraphs: [
      'Les aubaines honduriennes listées en ce moment partent vers Roatán. D’autres îles ou villes n’apparaissent que si un forfait est publié.',
    ],
  },
  {
    slug: 'bahamas',
    label: 'Bahamas',
    title: 'Voyages tout inclus aux Bahamas | Voyage Fiesta',
    h1: 'Forfaits tout inclus aux Bahamas',
    description:
      'Freeport et les Bahamas : forfaits tout inclus Voyage Fiesta, vols au départ du Québec.',
    match: (p) => countryHaystack(p).includes('bahamas') || destHaystack(p).includes('freeport'),
    listingParam: 'Bahamas',
    paragraphs: [
      'Les Bahamas apparaissent dans Aubaines Express lorsqu’un hôtel tout inclus a un tarif d’occupation publié, le plus souvent vers Freeport.',
    ],
  },
];

function topicPages() {
  return [
    {
      file: resolve(ROOT, 'voyages-tout-inclus.html'),
      url: `${SITE_BASE}/voyages-tout-inclus.html`,
      title: 'Voyages tout inclus au départ du Québec | Voyage Fiesta',
      h1: 'Voyages tout inclus au départ du Québec',
      description:
        'Aubaines Express liste des forfaits tout inclus : vols, hôtel et repas, au départ de Montréal ou Québec, aux tarifs publiés.',
      match: () => true,
      listingHref: `/`,
      paragraphs: [
        'Un forfait tout inclus de la boutique comprend généralement le vol, l’hôtel, les repas et les transferts indiqués sur la fiche. Les extras (activités, bagages, occupations non publiées) restent à confirmer.',
        'Le prix mis en avant est celui de l’occupation double. Une occupation simple, triple, quadruple ou enfant n’est calculée que si le champ correspondant existe dans GoHighLevel.',
      ],
    },
    {
      file: resolve(ROOT, 'prevente.html'),
      url: `${SITE_BASE}/prevente.html`,
      title: 'Pré-vente de voyages tout inclus | Voyage Fiesta',
      h1: 'Forfaits en pré-vente',
      description:
        'Forfaits Voyage Fiesta en pré-vente : même formulaire qu’une vente, sans dépôt, dès qu’un tarif d’occupation est publié.',
      match: isPreSale,
      listingHref: `/`,
      paragraphs: [
        'La pré-vente sert à réserver un intérêt sur un départ à venir. Quand l’occupation choisie a un prix publié, le formulaire est le même que pour une vente ; aucun dépôt n’est demandé à cette étape.',
        'Sans tarif publié pour l’occupation, le site affiche une demande de contact plutôt qu’un total.',
      ],
    },
    {
      file: resolve(ROOT, 'departs-montreal.html'),
      url: `${SITE_BASE}/departs-montreal.html`,
      title: 'Voyages tout inclus au départ de Montréal | Voyage Fiesta',
      h1: 'Forfaits au départ de Montréal (YUL)',
      description:
        'Aubaines voyage tout inclus au départ de Montréal-Trudeau : Cancún, Punta Cana, Roatán et autres départs publiés.',
      match: (p) => /montreal|yul/.test(departureHaystack(p)),
      listingHref: `/`,
      paragraphs: [
        'La plupart des aubaines partent de l’aéroport Montréal-Trudeau (YUL). La fiche précise la compagnie, les horaires et l’aéroport d’arrivée.',
      ],
    },
    {
      file: resolve(ROOT, 'departs-quebec.html'),
      url: `${SITE_BASE}/departs-quebec.html`,
      title: 'Voyages tout inclus au départ de Québec | Voyage Fiesta',
      h1: 'Forfaits au départ de Québec (YQB)',
      description:
        'Forfaits tout inclus au départ de l’aéroport Jean-Lesage (YQB), selon les aubaines Voyage Fiesta en cours.',
      match: (p) => /quebec|yqb/.test(departureHaystack(p)),
      listingHref: `/`,
      paragraphs: [
        'Les départs de Québec (YQB) sont moins nombreux que Montréal. Dès qu’un vol est publié, le forfait apparaît ici avec le même barème de prix.',
      ],
    },
    {
      file: resolve(ROOT, 'comment-reserver.html'),
      url: `${SITE_BASE}/comment-reserver.html`,
      title: 'Comment réserver un forfait Aubaines Express | Voyage Fiesta',
      h1: 'Comment réserver un forfait sur Aubaines Express',
      description:
        'Choisir un forfait, une occupation publiée, puis envoyer le formulaire à un conseiller Voyage Fiesta.',
      match: null,
      listingHref: `/`,
      paragraphs: [
        'Ouvrez la liste des promotions, filtrez par destination ou date, puis ouvrez la fiche de l’hôtel.',
        'Choisissez une occupation qui a un prix publié. Le site n’additionne pas d’autres grilles pour inventer un total. S’il n’y a pas de tarif, utilisez le formulaire de demande de prix.',
        'Le formulaire envoie le dossier au conseiller assigné (sous-boutique ou propriétaire du forfait). Un dépôt n’est demandé que sur les ventes qui l’indiquent, pas en pré-vente.',
      ],
    },
    {
      file: resolve(ROOT, 'a-propos.html'),
      url: `${SITE_BASE}/a-propos.html`,
      title: 'À propos d’Aubaines Express | Voyage Fiesta',
      h1: 'À propos d’Aubaines Express',
      description:
        'Aubaines Express est la boutique publique de Voyage Fiesta : forfaits tout inclus au départ du Québec, tarifs tirés de GoHighLevel.',
      match: null,
      listingHref: `/`,
      paragraphs: [
        'Voyage Fiesta publie ici les aubaines tout inclus destinées surtout aux voyageurs du Québec. Chaque fiche est synchronisée depuis GoHighLevel : nom de l’hôtel, dates, occupations et prix.',
        'Les conseillers ont chacun une sous-boutique. Un forfait sans propriétaire reste visible sur le site principal seulement.',
      ],
    },
    {
      file: resolve(ROOT, 'contact.html'),
      url: `${SITE_BASE}/contact.html`,
      title: 'Contacter un conseiller Voyage Fiesta',
      h1: 'Contacter un conseiller',
      description:
        'Écrire à Voyage Fiesta pour une aubaine tout inclus : formulaire de la boutique ou conseiller déjà assigné à votre dossier.',
      match: null,
      listingHref: `/`,
      paragraphs: [
        'Si vous avez déjà un conseiller, utilisez son formulaire ou répondez à ses messages. Sinon, laissez vos coordonnées sur le formulaire général : un membre de l’équipe vous rappelle.',
        'Pour un forfait précis, ouvrez d’abord la fiche : le message arrive alors avec l’hôtel, les dates et l’occupation choisis.',
      ],
    },
  ];
}

function renderMeta({ title, description, url, image, imageAlt, jsonLd }) {
  const img = image || DEFAULT_SHARE_IMAGE;
  const alt = imageAlt || title;
  return `  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
  <meta property="og:image" content="${escapeHtml(img)}">
  <meta property="og:image:secure_url" content="${escapeHtml(img)}">
  <meta property="og:image:alt" content="${escapeHtml(alt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(img)}">
  <meta name="twitter:image:alt" content="${escapeHtml(alt)}">
${jsonLd ? `  <script type="application/ld+json">${jsonLd}</script>\n` : ''}`;
}

function footerHtml() {
  const dests = [
    ['Cancún', '/destinations/cancun.html'],
    ['Riviera Maya', '/destinations/riviera-maya.html'],
    ['Punta Cana', '/destinations/punta-cana.html'],
    ['Samaná', '/destinations/samana.html'],
    ['Puerto Plata', '/destinations/puerto-plata.html'],
    ['Roatán', '/destinations/roatan.html'],
    ['Cozumel', '/destinations/cozumel.html'],
    ['Mexique', '/destinations/mexique.html'],
    ['République Dominicaine', '/destinations/republique-dominicaine.html'],
  ];
  const pages = [
    ['Promotions', '/'],
    ['Tout inclus', '/voyages-tout-inclus.html'],
    ['Pré-vente', '/prevente.html'],
    ['Départs Montréal', '/departs-montreal.html'],
    ['Départs Québec', '/departs-quebec.html'],
    ['Comment réserver', '/comment-reserver.html'],
    ['À propos', '/a-propos.html'],
    ['Contact', '/contact.html'],
  ];
  return `<footer class="mt-auto border-t border-slate-200 bg-white">
  <div class="mx-auto max-w-6xl px-4 py-10">
    <p class="text-lg font-semibold text-brand-blue">Voyage Fiesta — Aubaines Express</p>
    <p class="mt-1 text-sm text-slate-600">Forfaits tout inclus au départ du Québec, aux tarifs d’occupation publiés.</p>
    <nav class="mt-6" aria-label="Destinations">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Destinations</p>
      <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        ${dests.map(([label, href]) => `<li><a class="text-brand-blue hover:underline" href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`).join('\n        ')}
      </ul>
    </nav>
    <nav class="mt-5" aria-label="Pages du site">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Boutique</p>
      <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        ${pages.map(([label, href]) => `<li><a class="text-brand-blue hover:underline" href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`).join('\n        ')}
      </ul>
    </nav>
  </div>
</footer>`;
}

function headerHtml(currentUrl) {
  const links = [
    ['Promotions', '/'],
    ['Destinations', '/destinations/'],
    ['Tout inclus', '/voyages-tout-inclus.html'],
    ['Comment réserver', '/comment-reserver.html'],
    ['Contact', '/contact.html'],
  ];
  return `<header class="relative z-10 border-b border-slate-200 bg-white/95">
  <div class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
    <a class="text-lg font-semibold text-brand-blue" href="/">Voyage Fiesta <span class="font-medium text-brand-orange">Aubaines Express</span></a>
    <nav aria-label="Principale">
      <ul class="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
        ${links
          .map(([label, href]) => {
            let currentPath = '/';
            try {
              currentPath = new URL(currentUrl).pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
            } catch {
              currentPath = String(currentUrl || '').replace(/\/$/, '') || '/';
            }
            const hrefPath = href.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
            const current = hrefPath === currentPath;
            return `<li><a class="text-slate-700 hover:text-brand-orange${current ? ' underline' : ''}" href="${escapeHtml(href)}"${current ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a></li>`;
          })
          .join('\n        ')}
      </ul>
    </nav>
  </div>
</header>`;
}

function productCards(products) {
  if (!products.length) {
    return `<p class="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">Aucun forfait publié pour cette page en ce moment. Consultez <a class="text-brand-blue underline" href="/">toutes les promotions</a>.</p>`;
  }
  return `<ul class="grid gap-4 md:grid-cols-2">
    ${products
      .map((p) => {
        const href = `/product.html?slug=${encodeURIComponent(p.slug)}`;
        const dest = p.destination || p.subDest || '';
        const country = p.country || '';
        const nights = p.durationNights ? `${p.durationNights} nuits` : '';
        const when = formatDepartureDate(p.departureDate);
        const price = listingPrice(p);
        const meta = [dest, country && fold(country) !== fold(dest) ? country : '', nights, when && `Départ ${when}`]
          .filter(Boolean)
          .join(' · ');
        const priceHtml =
          price != null
            ? `<p class="mt-2 text-base font-semibold text-brand-blue">À partir de ${escapeHtml(formatMoney(price))} / passager <span class="block text-xs font-normal text-slate-500">occupation double, taxes incluses si publiées</span></p>`
            : `<p class="mt-2 text-sm text-slate-600">Prix selon l’occupation publiée — voir la fiche</p>`;
        return `<li>
      <article class="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-brand-blue"><a class="hover:underline" href="${escapeHtml(href)}">${escapeHtml(p.name || 'Forfait')}</a></h2>
        <p class="mt-1 text-sm text-slate-600">${escapeHtml(meta)}</p>
        ${priceHtml}
        <p class="mt-3"><a class="text-sm font-semibold text-brand-orange hover:underline" href="${escapeHtml(href)}">Voir le forfait ${escapeHtml(p.name || '')}</a></p>
      </article>
    </li>`;
      })
      .join('\n    ')}
  </ul>`;
}

function renderPage({ title, description, url, h1, paragraphs, products, listingHref, image }) {
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url,
    isPartOf: { '@type': 'WebSite', name: 'Voyage Fiesta', url: `${SITE_BASE}/` },
    mainEntity: products?.length
      ? {
          '@type': 'ItemList',
          numberOfItems: products.length,
          itemListElement: products.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: p.name,
            url: `${SITE_BASE}/product.html?slug=${encodeURIComponent(p.slug)}`,
          })),
        }
      : undefined,
  });
  const listBlock =
    products == null
      ? `<p class="mt-6"><a class="inline-flex min-h-12 items-center rounded-lg bg-brand-orange px-5 font-semibold text-white hover:opacity-95" href="${escapeHtml(listingHref || '/')}">${String(listingHref || '').includes('quickform') ? 'Ouvrir le formulaire de contact' : 'Ouvrir les promotions'}</a></p>`
      : `<section class="mt-10" aria-labelledby="forfaits-en-cours">
        <h2 id="forfaits-en-cours" class="mb-4 text-xl font-semibold text-brand-blue">Forfaits en cours</h2>
        ${productCards(products)}
        <p class="mt-6 text-sm"><a class="font-semibold text-brand-orange hover:underline" href="${escapeHtml(listingHref || '/')}">Voir toutes les promotions</a></p>
      </section>`;

  return `<!DOCTYPE html>
<html lang="fr-CA">
<head>
${renderMeta({ title, description, url, image, imageAlt: h1, jsonLd })}
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Poppins', 'sans-serif'] },
          colors: { brand: { blue: '#025091', orange: '#F26522', dark: '#1F2937', light: '#F3F7FA' } }
        }
      }
    };
  </script>
  <style>
    body {
      background:
        radial-gradient(900px 420px at 8% -10%, rgba(2, 80, 145, 0.08), transparent 55%),
        radial-gradient(700px 380px at 110% 8%, rgba(242, 101, 34, 0.08), transparent 50%),
        #F3F7FA;
    }
    .seo-orb {
      position: fixed;
      border-radius: 9999px;
      filter: blur(40px);
      opacity: 0.35;
      pointer-events: none;
      z-index: 0;
      animation: seo-drift 36s ease-in-out infinite alternate;
    }
    .seo-orb-a { width: 18rem; height: 18rem; background: #025091; top: 8%; left: -4rem; }
    .seo-orb-b { width: 14rem; height: 14rem; background: #F26522; bottom: 12%; right: -3rem; animation-delay: -12s; }
    @keyframes seo-drift {
      from { transform: translate3d(0, 0, 0); }
      to { transform: translate3d(24px, -18px, 0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .seo-orb { animation: none; }
    }
  </style>
</head>
<body class="flex min-h-screen flex-col font-sans text-slate-800">
  <div class="seo-orb seo-orb-a" aria-hidden="true"></div>
  <div class="seo-orb seo-orb-b" aria-hidden="true"></div>
  ${headerHtml(url)}
  <main class="relative z-10 mx-auto w-full max-w-6xl flex-grow px-4 py-10">
    <p class="text-sm text-slate-600"><a class="text-brand-blue hover:underline" href="/">Promotions</a> / ${escapeHtml(h1)}</p>
    <h1 class="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-brand-blue md:text-4xl">${escapeHtml(h1)}</h1>
    ${paragraphs.map((p) => `<p class="mt-4 max-w-3xl text-base leading-relaxed text-slate-700">${escapeHtml(p)}</p>`).join('\n    ')}
    ${listBlock}
  </main>
  ${footerHtml()}
</body>
</html>
`;
}

function hubPage(products) {
  const url = `${SITE_BASE}/destinations/`;
  const title = 'Destinations tout inclus | Voyage Fiesta';
  const description =
    'Cancún, Punta Cana, Riviera Maya, Roatán et les autres départs tout inclus d’Aubaines Express, au départ du Québec.';
  const cards = [...DESTINATION_PAGES, ...COUNTRY_PAGES].map((page) => {
    const count = products.filter(page.match).length;
    return `<li>
      <article class="h-full rounded-xl border border-slate-200 bg-white p-5">
        <h2 class="text-lg font-semibold text-brand-blue"><a class="hover:underline" href="/destinations/${page.slug}.html">${escapeHtml(page.label || page.h1)}</a></h2>
        <p class="mt-2 text-sm text-slate-600">${escapeHtml(page.description)}</p>
        <p class="mt-3 text-xs text-slate-500">${count} forfait${count > 1 ? 's' : ''} en cours</p>
      </article>
    </li>`;
  });
  return `<!DOCTYPE html>
<html lang="fr-CA">
<head>
${renderMeta({
  title,
  description,
  url,
  jsonLd: JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url,
    description,
  }),
})}
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Poppins', 'sans-serif'] },
          colors: { brand: { blue: '#025091', orange: '#F26522', dark: '#1F2937', light: '#F3F7FA' } }
        }
      }
    };
  </script>
</head>
<body class="flex min-h-screen flex-col bg-brand-light font-sans text-slate-800">
  ${headerHtml(url)}
  <main class="mx-auto w-full max-w-6xl flex-grow px-4 py-10">
    <h1 class="text-3xl font-semibold text-brand-blue md:text-4xl">Destinations tout inclus au départ du Québec</h1>
    <p class="mt-4 max-w-3xl text-slate-700">Chaque page reprend les forfaits actuellement publiés pour une ville ou un pays. Les prix viennent uniquement des occupations saisies dans GoHighLevel.</p>
    <ul class="mt-8 grid gap-4 md:grid-cols-2">
      ${cards.join('\n      ')}
    </ul>
  </main>
  ${footerHtml()}
</body>
</html>
`;
}

function writeRobots() {
  writeFileSync(
    resolve(ROOT, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_BASE}/sitemap.xml\n`,
    'utf8'
  );
}

function writeSitemap({ products, staff, extraUrls }) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE_BASE}/`, priority: '1.0' },
    { loc: `${SITE_BASE}/destinations/`, priority: '0.9' },
    ...extraUrls.map((loc) => ({ loc, priority: '0.8' })),
    ...products
      .filter((p) => p.slug)
      .map((p) => ({ loc: `${SITE_BASE}/product.html?slug=${encodeURIComponent(p.slug)}`, priority: '0.7' })),
    ...((staff || [])
      .map((a) => String(a.slug || '').trim())
      .filter(Boolean)
      .map((slug) => ({ loc: `${SITE_BASE}/quickform/${encodeURIComponent(slug)}.html`, priority: '0.3' }))),
    { loc: `${SITE_BASE}/quickform.html`, priority: '0.3' },
  ];
  const seen = new Set();
  const body = urls
    .filter((u) => {
      if (seen.has(u.loc)) return false;
      seen.add(u.loc);
      return true;
    })
    .map(
      (u) => `  <url>
    <loc>${escapeHtml(u.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');
  writeFileSync(
    resolve(ROOT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    'utf8'
  );
}

export function writeSeoPages({ products = [], staff = [] } = {}) {
  mkdirSync(DEST_DIR, { recursive: true });
  const extraUrls = [];
  const keep = new Set(['index.html']);

  writeFileSync(resolve(DEST_DIR, 'index.html'), hubPage(products), 'utf8');
  extraUrls.push(`${SITE_BASE}/destinations/`);

  for (const page of [...DESTINATION_PAGES, ...COUNTRY_PAGES]) {
    const matched = products.filter(page.match);
    const html = renderPage({
      title: page.title,
      description: page.description,
      url: `${SITE_BASE}/destinations/${page.slug}.html`,
      h1: page.h1,
      paragraphs: page.paragraphs,
      products: matched,
      listingHref: `/index.html?destination=${encodeURIComponent(page.listingParam)}`,
      image: pickImage(matched[0] || {}),
    });
    writeFileSync(resolve(DEST_DIR, `${page.slug}.html`), html, 'utf8');
    keep.add(`${page.slug}.html`);
    extraUrls.push(`${SITE_BASE}/destinations/${page.slug}.html`);
  }

  for (const file of readdirSync(DEST_DIR)) {
    if (file.endsWith('.html') && !keep.has(file)) unlinkSync(resolve(DEST_DIR, file));
  }

  for (const page of topicPages()) {
    const matched = page.match ? products.filter(page.match) : null;
    writeFileSync(
      page.file,
      renderPage({
        title: page.title,
        description: page.description,
        url: page.url,
        h1: page.h1,
        paragraphs: page.paragraphs,
        products: matched,
        listingHref: page.listingHref,
        image: pickImage((matched && matched[0]) || {}),
      }),
      'utf8'
    );
    extraUrls.push(page.url);
  }

  writeRobots();
  writeSitemap({ products, staff, extraUrls });
  console.log(`Wrote ${extraUrls.length} SEO URL(s), robots.txt and sitemap.xml`);
  return extraUrls.length;
}
