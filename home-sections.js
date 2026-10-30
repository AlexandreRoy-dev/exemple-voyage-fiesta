(function (global) {
  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(value) {
    var amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return '';
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(amount);
  }

  function dateLabel(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(String(iso))) return '';
    var parts = String(iso).slice(0, 10).split('-').map(Number);
    return new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])));
  }

  function lead(href) {
    try {
      var url = new URL(href, location.origin);
      var current = new URLSearchParams(location.search);
      ['ref', 'ghl_user'].forEach(function (key) {
        if (current.get(key)) url.searchParams.set(key, current.get(key));
      });
      return url.pathname + url.search + url.hash;
    } catch (_) {
      return href;
    }
  }

  // Same list as VF_API_BASES in config.js (read at call time, config.js loads later).
  var DEFAULT_API_BASES = [
    'https://api.voyagefiesta.ca/voyage-fiesta-reservation/',
    'https://dashboard.codesurmesure.ca/voyage-fiesta-reservation/'
  ];
  var HASH_NAME = /^[a-f0-9]{16,}\.(jpe?g|png|webp|gif|avif)$/i;

  function apiBases() {
    if (window.VFApi) return window.VFApi.bases();
    return DEFAULT_API_BASES;
  }

  function mediaBases() {
    return apiBases().map(function (base) { return base + 'media'; });
  }

  /** Every URL for one image: both mirrors when it is a mirrored file, else itself. */
  function imageCandidates(url) {
    var value = String(url || '').trim();
    if (!value) return [];
    var bases = mediaBases();
    var name = HASH_NAME.test(value) ? value : '';
    bases.forEach(function (base) {
      if (!name && value.indexOf(base + '/') === 0 && HASH_NAME.test(value.slice(base.length + 1))) {
        name = value.slice(base.length + 1);
      }
    });
    if (name) return bases.map(function (base) { return base + '/' + name; });
    return [value];
  }

  function catalogImage(value, extra) {
    extra = extra || {};
    var src = '';
    var fallback = '';
    if (value && typeof value === 'object') {
      src = value.url || value.src || value.image || '';
      fallback = value.source || value.remote || value.imageSource || '';
    } else {
      src = value || '';
      fallback = extra.imageSource || extra.source || extra.remote || '';
    }
    var list = [];
    imageCandidates(src).concat(imageCandidates(fallback)).forEach(function (item) {
      if (list.indexOf(item) === -1) list.push(item);
    });
    // fallback is a space separated list, tried in order on load error.
    return { src: list[0] || '', fallback: list.slice(1).join(' ') };
  }

  function card(item) {
    var price = money(item.price);
    var photo = '';
    if (item.image) {
      var img = catalogImage(item.image, { imageSource: item.imageSource, source: item.source });
      photo = '<img src="' + esc(img.src) + '"' + (img.fallback ? ' data-fallback="' + esc(img.fallback) + '"' : '') + ' alt="">';
    }
    return '<a class="vf-offer" href="' + esc(item.href) + '">' + photo + '<div>'
      + (item.badge ? '<span class="vf-offer__badge">' + esc(item.badge) + '</span>' : '')
      + (item.place ? '<p class="vf-offer__place">' + esc(item.place) + '</p>' : '')
      + '<h3>' + esc(item.title) + '</h3>'
      + (item.date ? '<p class="vf-offer__date">' + esc(item.date) + '</p>' : '')
      + '<p class="vf-offer__price">' + (price ? 'À partir de ' + esc(price) : 'Veuillez nous contacter') + '</p>'
      + '</div></a>';
  }

  function band(title, cards, moreHref, moreLabel) {
    if (!cards.length) return '';
    return '<section class="vf-band" data-anim="section"><div class="vf-band__head"><h2>' + esc(title) + '</h2><a href="' + esc(moreHref) + '">' + esc(moreLabel) + '</a></div><div class="vf-cards">' + cards.join('') + '</div></section>';
  }

  function productImage(product) {
    var src = product.img || product.image || '';
    if (!src) return '';
    if (/^https?:\/\//i.test(src) || src.charAt(0) === '/') return src;
    return '/' + src.replace(/^\.\//, '');
  }

  async function loadJson(url) {
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  /** groupes.json from each API base in order (6 s timeout each). */
  async function loadLiveGroupes() {
    if (window.VFApi) {
      var res = await window.VFApi.fetch('groupes.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    }
    var bases = apiBases();
    var lastError = null;
    for (var i = 0; i < bases.length; i += 1) {
      try { return await loadJson(bases[i] + 'groupes.json'); } catch (err) { lastError = err; }
    }
    throw lastError || new Error('groupes');
  }

  async function groupes() {
    var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || new URLSearchParams(location.search).get('fixture') === '1';
    try {
      return (await (local ? loadJson('/groupes/data/groupes.json') : loadLiveGroupes())).groups || [];
    } catch (_) {
      if (local) return [];
      try { return (await loadJson('/groupes/data/groupes.json')).groups || []; } catch (err) { return []; }
    }
  }

  function groupCards(groups, type) {
    return groups.filter(function (group) { return group.type === type; }).slice(0, 4).map(function (group) {
      var params = new URLSearchParams();
      params.set('id', group.id);
      if (group.slug) params.set('slug', group.slug);
      var current = new URLSearchParams(location.search);
      if (current.get('ref')) params.set('ref', current.get('ref'));
      if (current.get('ghl_user')) params.set('ghl_user', current.get('ghl_user'));
      return card({
        href: '/groupes/groupe/?' + params.toString(),
        image: group.image || '',
        imageSource: group.imageSource || group.source || '',
        place: group.country || group.destination || '',
        title: group.title || 'Groupe',
        date: dateLabel(group.dateDepart),
        price: group.prixAppel
      });
    });
  }

  document.addEventListener('error', function (event) {
    var img = event.target;
    if (!img || img.tagName !== 'IMG' || !img.dataset.fallback) return;
    var current = img.getAttribute('src');
    var list = img.dataset.fallback.split(/\s+/).filter(function (item) { return item && item !== current; });
    var next = list.shift();
    if (list.length) img.dataset.fallback = list.join(' ');
    else img.removeAttribute('data-fallback');
    if (next) img.src = next;
  }, true);

  async function render() {
    var host = document.getElementById('vf-home-extra');
    if (!host) return;
    var products = [];
    var groups = [];
    var staff = [];
    try { products = (await loadJson('products.json')).products || []; } catch (_) { products = []; }
    groups = await groupes();
    try { staff = (await loadJson('staff.json')).agents || []; } catch (_) { staff = []; }
    var hidden = { 'agence-voyages-fiesta-et-mariage-sud': true, 'divison-rabais-voyage': true };
    var offers = products.filter(function (product) {
      var state = String(product.active || product.state || '');
      return state === 'actif' || state === 'pre_vente';
    }).slice(0, 4).map(function (product) {
      return card({
        href: lead('/product.html?slug=' + encodeURIComponent(product.slug || '')),
        image: productImage(product),
        place: product.country || product.destination || '',
        title: product.name || 'Forfait',
        date: dateLabel(product.departureDate),
        price: product.price,
        badge: String(product.active || product.state) === 'pre_vente' ? 'Prévente' : ''
      });
    });
    var team = staff.filter(function (agent) { return agent.slug && !hidden[agent.slug]; }).slice(0, 8).map(function (agent) {
      return '<a href="' + esc(lead('/agents/' + encodeURIComponent(agent.slug) + '/')) + '">' + esc(agent.name) + '</a>';
    }).join('');
    host.innerHTML = band('Aubaines Express', offers, lead('/#liste-aubaines'), 'Voir tous les forfaits')
      + band('Forfaits SUD', groupCards(groups, 'sud'), lead('/groupes/forfaits-sud/'), 'Voir tout')
      + band('Croisières', groupCards(groups, 'cruise'), lead('/groupes/croisieres/'), 'Voir tout')
      + band('Voyages', groupCards(groups, 'voyage'), lead('/groupes/voyages/'), 'Voir tout')
      + band('Mariage', groupCards(groups, 'mariage'), lead('/groupes/mariages/'), 'Voir tout')
      + '<section class="vf-band" data-anim="section"><div class="vf-advisor"><h2>Un conseiller pour transformer vos idées en voyage</h2><p>Un conseiller Voyage Fiesta suit la demande, les dates et le prix publié pour l\'occupation choisie.</p><p><a href="' + esc(lead('/agents/')) + '">Voir l\'équipe</a></p></div></section>'
      + (team ? '<section class="vf-band" data-anim="section"><div class="vf-band__head"><h2>Notre équipe</h2><a href="' + esc(lead('/agents/')) + '">Toute l\'équipe</a></div><div class="vf-team">' + team + '</div></section>' : '');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})(window);
