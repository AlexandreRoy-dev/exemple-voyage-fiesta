import {
  PAGE_SIZE,
  formatPrice,
  formatDate,
  categoryLabel,
  categoryPath,
  providerOf,
  providerLabel,
  filterGroups,
  sortGroups,
  paginate,
  buildSudSearchUrl,
  buildFlightSearchUrl,
  buildCruiseSearchUrl,
  buildCarSearchUrl
} from './catalog.mjs';

const root = new URL('../', import.meta.url);
const params = new URLSearchParams(location.search);
const cfg = window.GROUPES_CONFIG || {};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inIframe() {
  try { return window.self !== window.top; } catch (_) { return true; }
}

function useFixture() {
  const host = location.hostname;
  return params.get('fixture') === '1' || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:';
}

function jsonUrl() {
  if (params.get('data')) return params.get('data');
  if (!useFixture() && cfg.jsonUrl) return cfg.jsonUrl;
  return new URL('data/groupes.json', root).href;
}

function apiUrl() {
  const base = params.get('api') || cfg.reservationApiUrl || 'https://dashboard.codesurmesure.ca/voyage-fiesta-reservation/';
  return base.endsWith('/') ? base : `${base}/`;
}

function dryRun() {
  return params.get('dry_run') === '1';
}

function withFlags(url) {
  if (params.get('embed') === '1' || inIframe()) url.searchParams.set('embed', '1');
  if (params.get('fixture') === '1') url.searchParams.set('fixture', '1');
  if (dryRun()) url.searchParams.set('dry_run', '1');
  if (params.get('api')) url.searchParams.set('api', params.get('api'));
  if (params.get('data')) url.searchParams.set('data', params.get('data'));
  return url;
}

function href(path) {
  const url = withFlags(new URL(path, root));
  return url.pathname + url.search + url.hash;
}

function groupHref(group) {
  const url = withFlags(new URL(`groupe/?id=${encodeURIComponent(group.id)}&slug=${encodeURIComponent(group.slug || '')}`, root));
  return url.pathname + url.search;
}

function phone() {
  return cfg.phoneDisplay || '514-856-6614';
}

function nav(current) {
  const items = [
    ['index.html', 'Accueil', 'home'],
    ['forfaits-sud/', 'Forfaits SUD', 'sud'],
    ['croisieres/', 'Croisières', 'cruise'],
    ['voyages/', 'Voyages', 'voyage'],
    ['index.html#contact', 'Nous contacter', 'contact']
  ];
  return items.map(([path, label, key]) => {
    const currentAttr = key === current ? ' aria-current="page"' : '';
    return `<a href="${esc(href(path))}"${currentAttr}>${esc(label)}</a>`;
  }).join('');
}

function shell(current) {
  return `
    <a class="skip" href="#contenu">Aller au contenu</a>
    <div class="orb orb-a" aria-hidden="true"></div>
    <div class="orb orb-b" aria-hidden="true"></div>
    <header class="site-header">
      <div class="header-inner">
        <a class="logo" href="${esc(href('index.html'))}">Voyage Fiesta <span>Groupes</span></a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-principale">Menu</button>
        <nav id="nav-principale" class="nav" aria-label="Principale">${nav(current)}</nav>
      </div>
    </header>
    <main id="contenu"></main>
    <footer class="site-footer">
      <div class="wrap">
        <p><strong>Voyage Fiesta</strong></p>
        <p>${esc(cfg.address || '')}</p>
        <p><a href="${esc(cfg.phoneHref || 'tel:+15148566614')}">${esc(phone())}</a> · <a href="mailto:${esc(cfg.email || 'info@voyagesfiesta.com')}">${esc(cfg.email || 'info@voyagesfiesta.com')}</a></p>
        <p><a href="${esc(href('../index.html'))}">Aubaines Express</a></p>
      </div>
    </footer>
    <dialog id="demande-dialog"><div class="dialog-body" id="demande-dialog-body"></div></dialog>
    <dialog id="photo-dialog"><div class="dialog-body"><img id="photo-dialog-img" alt=""></div></dialog>`;
}

function priceLine(group) {
  const price = formatPrice(group.prixAppel);
  if (!price) return '<span class="price">Prix sur demande</span>';
  const old = formatPrice(group.prixAncien);
  return `<span class="price">À partir de ${esc(price)}</span>${old ? `<span class="was">${esc(old)}</span>` : ''}`;
}

function card(group) {
  const img = group.image || 'https://images.pexels.com/photos/1450360/pexels-photo-1450360.jpeg?auto=compress&cs=tinysrgb&w=800';
  const where = [group.country, group.destination].filter(Boolean).join(' · ');
  return `<article class="card">
    <a href="${esc(groupHref(group))}"><img src="${esc(img)}" alt="${esc(group.title)}"></a>
    <div class="card-body">
      <p class="eyebrow">${esc(where || categoryLabel(group.type))}</p>
      <h3><a href="${esc(groupHref(group))}">${esc(group.title)}</a></h3>
      <p class="muted">${esc(providerOf(group))}</p>
      <p class="muted">${esc(formatDate(group.dateDepart))}</p>
      <p>${priceLine(group)}</p>
      <div class="card-actions">
        <button class="btn" type="button" data-demande="${esc(group.id)}">Demander de l'information</button>
      </div>
    </div>
  </article>`;
}

function formFields(group, prefix) {
  const summary = [
    group.title,
    formatDate(group.dateDepart) ? `départ le ${formatDate(group.dateDepart)}` : '',
    formatPrice(group.prixAppel) ? `à partir de ${formatPrice(group.prixAppel)}` : 'prix sur demande'
  ].filter(Boolean).join(', ');
  return `
    ${dryRun() ? '<p class="banner">Mode essai: la demande est préparée, aucun contact n\'est créé.</p>' : ''}
    <p id="${prefix}-summary">Voyage sélectionné: ${esc(summary)}.</p>
    <div class="field"><label for="${prefix}-name">Nom complet</label><input id="${prefix}-name" name="full_name" autocomplete="name" required></div>
    <div class="field"><label for="${prefix}-email">Courriel</label><input id="${prefix}-email" name="email" type="email" autocomplete="email" required></div>
    <div class="field"><label for="${prefix}-phone">Téléphone</label><input id="${prefix}-phone" name="phone" type="tel" autocomplete="tel" required></div>
    <div class="search-grid">
      <div class="field"><label for="${prefix}-adults">Adultes</label><input id="${prefix}-adults" name="adults" type="number" min="1" max="8" value="2"></div>
      <div class="field"><label for="${prefix}-children">Enfants</label><input id="${prefix}-children" name="children" type="number" min="0" max="6" value="0"></div>
    </div>
    <div class="field"><label for="${prefix}-message">Message</label><textarea id="${prefix}-message" name="message" rows="3"></textarea></div>
    <label class="check" for="${prefix}-terms">
      <input id="${prefix}-terms" name="terms_and_conditions" type="checkbox" required>
      <span>J'ai lu et j'accepte les termes et conditions du document 001-554 et je confirme que toutes les informations fournies sont exactes.</span>
    </label>
    <p class="fine">Vos coordonnées servent à répondre à cette demande. En envoyant ce formulaire, vous acceptez les conditions générales de vente de Voyage Fiesta.</p>
    <button class="btn btn-block" type="submit">Envoyer la demande</button>
    <p class="status" id="${prefix}-status" role="alert" aria-live="assertive"></p>`;
}

function bindDemande(button, group) {
  button.addEventListener('click', () => openDemande(group));
}

function openDemande(group) {
  const dialog = document.getElementById('demande-dialog');
  const body = document.getElementById('demande-dialog-body');
  body.innerHTML = `<header><h2 id="demande-title">Demander de l'information</h2><button class="icon-btn" type="button" data-close-dialog>Fermer</button></header>
    <form id="form-dialog" data-group="${esc(group.id)}">${formFields(group, 'dialog')}</form>`;
  body.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
  bindForm(body.querySelector('form'), group);
  dialog.showModal();
  body.querySelector('#dialog-name')?.focus();
}

function bindForm(form, group) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
  const status = form.querySelector('.status');
  const name = form.querySelector('[name="full_name"]');
    const email = form.querySelector('[name="email"]');
    const phone = form.querySelector('[name="phone"]');
    const terms = form.querySelector('[name="terms_and_conditions"]');
    [name, email, phone, terms].forEach((field) => field.removeAttribute('aria-invalid'));
    const missing = [name, email, phone].find((field) => !field.value.trim()) || (!terms.checked ? terms : null);
    if (missing) {
      missing.setAttribute('aria-invalid', 'true');
      status.dataset.kind = 'error';
      status.textContent = missing === terms
        ? 'Cochez la case pour accepter les conditions.'
        : 'Nom, courriel et téléphone sont requis.';
      missing.focus();
      return;
    }
    const parts = name.value.trim().split(/\s+/);
    const payload = {
      request_type: 'demande_groupe',
      dry_run: dryRun() ? true : undefined,
      groupe_id: String(group.id),
      id_groupe: String(group.id),
      groupe_titre: group.title,
      groupe_type: group.type,
      forfait_name: group.title,
      nom_du_forfait: group.title,
      destination: group.destination || '',
      country: group.country || '',
      departure_date: group.dateDepart || '',
      duration_nights: group.dureeNuits != null ? String(group.dureeNuits) : '',
      duration_label: [group.dureeJours ? `${group.dureeJours} jours` : '', group.dureeNuits ? `${group.dureeNuits} nuits` : ''].filter(Boolean).join(', '),
      prix_appel: group.prixAppel != null ? String(group.prixAppel) : '',
      hotel: group.hotel || '',
      navire: group.navire || '',
      compagnie: group.compagnie || '',
      provider: providerOf(group),
      groupe_url: new URL(groupHref(group), location.origin).href,
      full_name: name.value.trim(),
      p1_prenom: parts[0] || '',
      p1_nom: parts.slice(1).join(' '),
      email: email.value.trim(),
      p1_email: email.value.trim(),
      phone: phone.value.trim(),
      p1_phone: phone.value.trim(),
      nombre_adultes: form.querySelector('[name="adults"]').value,
      nombre_enfants: form.querySelector('[name="children"]').value,
      message: form.querySelector('[name="message"]').value.trim(),
      terms_and_conditions: 'true'
    };
    Object.keys(payload).forEach((key) => { if (payload[key] === undefined) delete payload[key]; });
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    status.dataset.kind = '';
    status.textContent = 'Envoi de votre demande…';
    try {
      const response = await fetch(apiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || 'Envoi impossible.');
      status.dataset.kind = 'ok';
      if (data.dryRun) {
        status.textContent = `Essai seulement: aucun contact n'a été créé. Étiquettes: ${(data.tags || []).join(', ')}.`;
      } else {
        status.textContent = 'Votre demande est envoyée. Un conseiller de Voyage Fiesta va vous répondre.';
      }
      form.querySelectorAll('input, textarea, button').forEach((el) => { if (el !== button) el.disabled = true; });
    } catch (error) {
      button.disabled = false;
      status.dataset.kind = 'error';
      status.textContent = error.message || 'Envoi impossible. Réessayez ou appelez-nous.';
    }
    notifyHeight();
  });
}

function options(list, placeholder) {
  return [`<option value="">${esc(placeholder)}</option>`]
    .concat((list || []).filter((item) => item.value).map((item) => `<option value="${esc(item.value)}">${esc(item.label)}</option>`))
    .join('');
}

function selectField(id, label, list, placeholder, extra = '') {
  return `<div class="field"><label for="${id}">${esc(label)}</label><select id="${id}" ${extra}>${options(list, placeholder)}</select></div>`;
}

function comboField(id, label, list, placeholder) {
  return `<div class="field wide combo"><label for="${id}">${esc(label)}</label>
    <input id="${id}" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list" placeholder="${esc(placeholder)}" autocomplete="off">
    <ul id="${id}-list" class="combo-list" role="listbox" hidden></ul>
    <input type="hidden" id="${id}-value">
  </div>`;
}

function bindCombo(id, list) {
  const input = document.getElementById(id);
  const menu = document.getElementById(`${id}-list`);
  const hidden = document.getElementById(`${id}-value`);
  if (!input || !menu) return;
  const choices = (list || []).filter((item) => item.value);
  let active = -1;
  const close = () => { menu.hidden = true; input.setAttribute('aria-expanded', 'false'); };
  const render = () => {
    const q = input.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const matches = choices.filter((item) => !q || `${item.label} ${item.value}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q)).slice(0, 40);
    menu.innerHTML = matches.map((item, index) => `<li><button type="button" role="option" data-value="${esc(item.value)}" ${index === active ? 'aria-selected="true"' : ''}>${esc(item.label)}</button></li>`).join('') || '<li>Aucun résultat</li>';
    menu.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    menu.querySelectorAll('button').forEach((button) => {
      button.addEventListener('mousedown', (event) => {
        event.preventDefault();
        hidden.value = button.dataset.value;
        input.value = button.textContent;
        close();
      });
    });
  };
  input.addEventListener('focus', () => { active = -1; render(); });
  input.addEventListener('input', () => { hidden.value = ''; active = -1; render(); });
  input.addEventListener('keydown', (event) => {
    const buttons = [...menu.querySelectorAll('button')];
    if (event.key === 'Escape') return close();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      active = event.key === 'ArrowDown' ? Math.min(active + 1, buttons.length - 1) : Math.max(active - 1, 0);
      render();
    }
    if (event.key === 'Enter' && active >= 0 && buttons[active]) {
      event.preventDefault();
      hidden.value = buttons[active].dataset.value;
      input.value = buttons[active].textContent;
      close();
    }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
}

function searchCard(search) {
  if (!search) {
    return `<div class="search-card"><p>Les moteurs de recherche ne sont pas disponibles pour le moment. Appelez-nous au ${esc(phone())}.</p></div>`;
  }
  const today = new Date().toISOString().slice(0, 10);
  return `<div class="search-card">
    <div class="tabs" role="tablist" aria-label="Recherche">
      <button type="button" role="tab" id="tab-sud" aria-controls="panel-sud" aria-selected="true">Forfaits SUD</button>
      <button type="button" role="tab" id="tab-vols" aria-controls="panel-vols" aria-selected="false">Vols</button>
      <button type="button" role="tab" id="tab-cruise" aria-controls="panel-cruise" aria-selected="false">Croisières</button>
      <button type="button" role="tab" id="tab-car" aria-controls="panel-car" aria-selected="false">Voitures</button>
    </div>
    <form id="panel-sud" data-search="sud" role="tabpanel" aria-labelledby="tab-sud">
      <div class="search-grid">
        ${selectField('sud-gateway', 'Départ de', search.sud.gateways, 'Choisir')}
        ${comboField('sud-dest', 'Destination', search.sud.destinations, 'Rechercher une destination')}
        <div class="field"><label for="sud-date">Date de départ</label><input id="sud-date" type="date" min="${today}"></div>
        ${selectField('sud-duration', 'Durée', search.sud.durations, 'Choisir')}
        <div class="field"><label for="sud-adults">Adulte(s)</label><select id="sud-adults">${[1,2,3,4,5,6,7,8].map((n) => `<option ${n===2?'selected':''}>${n}</option>`).join('')}</select></div>
        <div class="field"><label for="sud-children">Enfant(s)</label><select id="sud-children">${[0,1,2,3,4,5,6].map((n) => `<option>${n}</option>`).join('')}</select></div>
        <div class="field wide" id="sud-ages-wrap" hidden><label for="sud-ages">Âges des enfants</label><input id="sud-ages" placeholder="Ex. 8, 10"></div>
      </div>
      <button class="btn btn-block" type="submit">Rechercher un forfait sud</button>
    </form>
    <form id="panel-vols" data-search="vols" role="tabpanel" aria-labelledby="tab-vols" hidden>
      <div class="search-grid">
        ${selectField('vol-from', 'Ville de départ', search.vols.departures, 'Choisir')}
        ${comboField('vol-to', 'Destination', search.vols.destinations, 'Rechercher une destination')}
        <div class="field"><label for="vol-depart">Date de départ</label><input id="vol-depart" type="date" min="${today}" required></div>
        <div class="field" id="vol-return-wrap"><label for="vol-return">Date de retour</label><input id="vol-return" type="date" min="${today}" required></div>
        ${selectField('vol-class', 'Classe', search.vols.classes, 'Classe économique')}
        <div class="field"><label for="vol-trip">Type de vol</label><select id="vol-trip"><option value="roundtrip">Aller-retour</option><option value="oneway">Aller simple</option></select></div>
        <div class="field"><label for="vol-adults">Adulte(s)</label><select id="vol-adults">${[1,2,3,4,5,6].map((n) => `<option ${n===2?'selected':''}>${n}</option>`).join('')}</select></div>
      </div>
      <button class="btn btn-block" type="submit">Rechercher les vols</button>
    </form>
    <form id="panel-cruise" data-search="cruise" role="tabpanel" aria-labelledby="tab-cruise" hidden>
      <div class="search-grid">
        ${comboField('cruise-port', 'Départ de', search.croisieres.ports, 'Tous les ports de départ')}
        ${comboField('cruise-dest', 'Destination', search.croisieres.destinations, 'Toutes les destinations')}
        <div class="field"><label for="cruise-date">Date de départ</label><input id="cruise-date" type="date" min="${today}"></div>
        ${comboField('cruise-vendor', 'Croisiériste', search.croisieres.vendors, 'Tous les croisiéristes')}
        ${selectField('cruise-duration', 'Durée', search.croisieres.durations, 'Toutes les durées')}
      </div>
      <button class="btn btn-block" type="submit">Rechercher une croisière</button>
    </form>
    <form id="panel-car" data-search="car" role="tabpanel" aria-labelledby="tab-car" hidden>
      <div class="search-grid">
        ${comboField('car-loc', 'Lieu de prise en charge', search.voitures.locations, 'Ville ou aéroport')}
        <div class="field"><label for="car-from">Date de prise</label><input id="car-from" type="date" min="${today}" required></div>
        <div class="field"><label for="car-to">Date de retour</label><input id="car-to" type="date" min="${today}" required></div>
      </div>
      <button class="btn btn-block" type="submit">Rechercher une voiture</button>
    </form>
  </div>`;
}

function bindSearch(search) {
  if (!search) return;
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = [...document.querySelectorAll('[data-search]')];
  const selectTab = (tab) => {
    tabs.forEach((item) => {
      const on = item === tab;
      item.setAttribute('aria-selected', String(on));
      item.tabIndex = on ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.id !== tab.getAttribute('aria-controls'); });
  };
  tabs.forEach((tab, index) => {
    tab.tabIndex = index === 0 ? 0 : -1;
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      selectTab(next);
    });
  });
  const gateway = document.getElementById('sud-gateway');
  if (gateway) gateway.value = 'YUL';
  const duration = document.getElementById('sud-duration');
  if (duration && [...duration.options].some((opt) => opt.value === '7')) duration.value = '7';
  const from = document.getElementById('vol-from');
  if (from) from.value = 'YUL';
  document.getElementById('sud-children')?.addEventListener('change', (event) => {
    const wrap = document.getElementById('sud-ages-wrap');
    wrap.hidden = Number(event.target.value) === 0;
  });
  document.getElementById('vol-trip')?.addEventListener('change', (event) => {
    document.getElementById('vol-return-wrap').hidden = event.target.value === 'oneway';
  });
  bindCombo('sud-dest', search.sud.destinations);
  bindCombo('vol-to', search.vols.destinations);
  bindCombo('cruise-port', search.croisieres.ports);
  bindCombo('cruise-dest', search.croisieres.destinations);
  bindCombo('cruise-vendor', search.croisieres.vendors);
  bindCombo('car-loc', search.voitures.locations);
  document.getElementById('panel-sud')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const url = buildSudSearchUrl({
      gateway: document.getElementById('sud-gateway').value,
      destination: document.getElementById('sud-dest-value').value,
      date: document.getElementById('sud-date').value,
      duration: document.getElementById('sud-duration').value,
      adults: document.getElementById('sud-adults').value,
      children: document.getElementById('sud-children').value,
      childAges: document.getElementById('sud-ages').value
    });
    window.open(url, '_blank', 'noopener');
  });
  document.getElementById('panel-vols')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const to = document.getElementById('vol-to-value').value;
    if (!to) {
      document.getElementById('vol-to').focus();
      return;
    }
    const url = buildFlightSearchUrl({
      from: document.getElementById('vol-from').value,
      to,
      depart: document.getElementById('vol-depart').value,
      returnDate: document.getElementById('vol-return').value,
      cabin: document.getElementById('vol-class').value || 'Y',
      trip: document.getElementById('vol-trip').value,
      adults: document.getElementById('vol-adults').value
    });
    window.open(url, '_blank', 'noopener');
  });
  document.getElementById('panel-cruise')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const url = buildCruiseSearchUrl({
      port: document.getElementById('cruise-port-value').value,
      destination: document.getElementById('cruise-dest-value').value,
      date: document.getElementById('cruise-date').value,
      vendor: document.getElementById('cruise-vendor-value').value,
      duration: document.getElementById('cruise-duration').value || '0',
      adults: '2'
    });
    window.open(url, '_blank', 'noopener');
  });
  document.getElementById('panel-car')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const location = document.getElementById('car-loc-value').value;
    if (!location) {
      document.getElementById('car-loc').focus();
      return;
    }
    const url = buildCarSearchUrl({
      location,
      pickup: document.getElementById('car-from').value,
      dropoff: document.getElementById('car-to').value
    });
    window.open(url, '_blank', 'noopener');
  });
}

function unavailable() {
  return `<div class="error-box"><p><strong>Les groupes ne peuvent pas être affichés pour le moment.</strong></p><p>Réessayez un peu plus tard, ou appelez-nous au <a href="${esc(cfg.phoneHref || 'tel:+15148566614')}">${esc(phone())}</a>.</p></div>`;
}

function renderHome(groups, search, failed) {
  const main = document.getElementById('contenu');
  const block = (type, title, path) => {
    const items = sortGroups((groups || []).filter((group) => group.type === type), 'agence').slice(0, 4);
    return `<section class="section" data-animate><div class="wrap">
      <div class="section-head"><div><p class="eyebrow">${esc(title)}</p><h2>${esc(title)}</h2></div><a href="${esc(href(path))}">Voir la liste</a></div>
      ${failed ? '' : `<div class="cards">${items.map(card).join('') || '<p>Aucun groupe dans cette catégorie.</p>'}</div>`}
    </div></section>`;
  };
  main.innerHTML = `
    <section class="hero"><div class="hero-grid">
      <div>
        <p class="eyebrow">Forfaits, croisières et voyages</p>
        <h1>Forfaits sud, vols, croisières et voyages de groupe</h1>
        <p>Recherchez un départ ou parcourez les groupes publiés par Voyage Fiesta. La demande d'information part avec le voyage déjà indiqué.</p>
        <a class="btn" href="${esc(href('forfaits-sud/'))}">Voir les forfaits sud</a>
      </div>
      ${searchCard(search)}
    </div></section>
    <section class="trust" data-animate>
      <article><h2>Accompagnement</h2><p>Un conseiller suit le dossier avant le départ, pendant le voyage et au retour.</p></article>
      <article><h2>Prix du groupe</h2><p>Le prix affiché est le prix d'appel publié pour le groupe. Un conseiller confirme la place.</p></article>
      <article><h2>Questions</h2><p>L'équipe répond sur les dates, les hôtels, les navires et les cabines.</p></article>
      <article><h2>Demande</h2><p>Le formulaire envoie la demande au dossier, avec le voyage choisi.</p></article>
    </section>
    ${failed ? `<section class="section"><div class="wrap">${unavailable()}</div></section>` : ''}
    ${block('sud', 'Forfaits sud', 'forfaits-sud/')}
    ${block('cruise', 'Croisières', 'croisieres/')}
    ${block('voyage', 'Voyages', 'voyages/')}
    <section class="section" id="contact"><div class="wrap panel">
      <p class="eyebrow">Nous joindre</p>
      <h2>Nous contacter</h2>
      <p>${esc(cfg.address || '')}</p>
      <p><a href="${esc(cfg.phoneHref || 'tel:+15148566614')}">${esc(phone())}</a></p>
      <p><a href="mailto:${esc(cfg.email || 'info@voyagesfiesta.com')}">${esc(cfg.email || 'info@voyagesfiesta.com')}</a></p>
      <p>Pour un groupe précis, ouvrez sa fiche et envoyez la demande: le titre, les dates et le prix d'appel y sont déjà inscrits.</p>
    </div></section>`;
  bindSearch(search);
  wireCards(groups);
}

function readFilters() {
  const q = new URLSearchParams(location.search);
  return {
    search: q.get('q') || '',
    destination: q.get('dest') || '',
    provider: q.get('hotel') || '',
    dateFrom: q.get('du') || '',
    dateTo: q.get('au') || '',
    priceMin: q.get('min') || '',
    priceMax: q.get('max') || '',
    sort: q.get('tri') || 'agence',
    page: Number(q.get('page') || 1)
  };
}

function renderListing(groups, type) {
  const titles = { sud: 'Forfaits sud', cruise: 'Croisières', voyage: 'Voyages' };
  const headings = {
    sud: 'Tous nos forfaits sud',
    cruise: 'Toutes nos croisières',
    voyage: 'Tous nos voyages'
  };
  const main = document.getElementById('contenu');
  if (!groups) {
    main.innerHTML = `<section class="section"><div class="wrap"><h1>${esc(titles[type])}</h1>${unavailable()}</div></section>`;
    return;
  }
  const subset = groups.filter((group) => group.type === type);
  const destinations = [...new Set(subset.map((group) => group.destination).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const providers = [...new Set(subset.map((group) => providerOf(group)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  main.innerHTML = `<section class="section"><div class="wrap">
    <p class="eyebrow">${esc(titles[type])}</p>
    <h1>${esc(headings[type] || titles[type])}</h1>
    <form id="filters" class="filters">
      <div class="field"><label for="f-q">Rechercher</label><input id="f-q" type="search" placeholder="Destination, titre…"></div>
      <div class="field"><label for="f-dest">Destination</label><select id="f-dest"><option value="">Toutes</option>${destinations.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}</select></div>
      <div class="field"><label for="f-hotel">${esc(providerLabel(type))}</label><select id="f-hotel"><option value="">Tous</option>${providers.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}</select></div>
      <div class="field"><label for="f-du">Départ à partir du</label><input id="f-du" type="date"></div>
      <div class="field"><label for="f-au">Départ avant le</label><input id="f-au" type="date"></div>
      <div class="field"><label for="f-min">Prix minimum</label><input id="f-min" type="number" min="0" step="50" placeholder="0 $"></div>
      <div class="field"><label for="f-max">Prix maximum</label><input id="f-max" type="number" min="0" step="50" placeholder="Aucun maximum"></div>
      <div class="field"><label for="f-tri">Trier par</label><select id="f-tri">
        <option value="agence">Sélection de l'agence</option>
        <option value="date-asc">Date, plus proche</option>
        <option value="date-desc">Date, plus éloignée</option>
        <option value="prix-asc">Prix, croissant</option>
        <option value="prix-desc">Prix, décroissant</option>
        <option value="titre">Titre, A à Z</option>
      </select></div>
      <div class="actions"><button type="button" id="f-reset">Réinitialiser</button></div>
    </form>
    <p class="count" id="result-count" aria-live="polite"></p>
    <div id="results" class="cards"></div>
    <nav id="pager" class="pager" aria-label="Pagination"></nav>
  </div></section>`;
  const fields = {
    search: document.getElementById('f-q'),
    destination: document.getElementById('f-dest'),
    provider: document.getElementById('f-hotel'),
    dateFrom: document.getElementById('f-du'),
    dateTo: document.getElementById('f-au'),
    priceMin: document.getElementById('f-min'),
    priceMax: document.getElementById('f-max'),
    sort: document.getElementById('f-tri')
  };
  const apply = (page = 1, push = false) => {
    const filters = {
      search: fields.search.value,
      destination: fields.destination.value,
      provider: fields.provider.value,
      dateFrom: fields.dateFrom.value,
      dateTo: fields.dateTo.value,
      priceMin: fields.priceMin.value,
      priceMax: fields.priceMax.value,
      sort: fields.sort.value
    };
    const filtered = sortGroups(filterGroups(subset, filters), filters.sort);
    const view = paginate(filtered, page, cfg.pageSize || PAGE_SIZE);
    document.getElementById('result-count').textContent = `${view.total} résultat(s)`;
    document.getElementById('results').innerHTML = view.items.map(card).join('') || '<p class="error-box">Aucun groupe ne correspond à ces filtres.</p>';
    document.getElementById('pager').innerHTML = view.pages < 2 ? '' : Array.from({ length: view.pages }, (_, index) => {
      const n = index + 1;
      return `<button type="button" class="btn-secondary" data-page="${n}" ${n === view.page ? 'aria-current="page"' : ''}>${n}</button>`;
    }).join('');
    document.getElementById('results').querySelectorAll('[data-demande]').forEach((button) => {
      const group = subset.find((item) => String(item.id) === button.dataset.demande);
      if (group) bindDemande(button, group);
    });
    const url = new URL(location.href);
    const set = (key, value) => { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); };
    set('q', filters.search);
    set('dest', filters.destination);
    set('hotel', filters.provider);
    set('du', filters.dateFrom);
    set('au', filters.dateTo);
    set('min', filters.priceMin);
    set('max', filters.priceMax);
    set('tri', filters.sort === 'agence' ? '' : filters.sort);
    set('page', view.page > 1 ? String(view.page) : '');
    history[push ? 'pushState' : 'replaceState'](null, '', url.pathname + url.search);
    notifyHeight();
  };
  const initial = readFilters();
  fields.search.value = initial.search;
  fields.destination.value = initial.destination;
  fields.provider.value = initial.provider;
  fields.dateFrom.value = initial.dateFrom;
  fields.dateTo.value = initial.dateTo;
  fields.priceMin.value = initial.priceMin;
  fields.priceMax.value = initial.priceMax;
  fields.sort.value = initial.sort;
  document.getElementById('filters').addEventListener('input', () => apply(1));
  document.getElementById('filters').addEventListener('change', () => apply(1));
  document.getElementById('f-reset').addEventListener('click', () => {
    document.getElementById('filters').reset();
    apply(1);
  });
  document.getElementById('pager').addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button) return;
    apply(Number(button.dataset.page), true);
    document.getElementById('result-count').focus?.();
  });
  apply(initial.page);
}

function listBlock(title, items) {
  if (!items?.length) return '';
  return `<section class="panel"><h2>${esc(title)}</h2><ul>${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></section>`;
}

function renderDetail(groups) {
  const main = document.getElementById('contenu');
  const id = params.get('id') || (location.pathname.match(/\/groupe\/(\d+)/) || [])[1];
  const group = (groups || []).find((item) => String(item.id) === String(id));
  if (!groups) {
    main.innerHTML = `<section class="section"><div class="wrap">${unavailable()}</div></section>`;
    return;
  }
  if (!group) {
    main.innerHTML = `<section class="section"><div class="wrap"><h1>Groupe introuvable</h1><p>Ce groupe n'est pas dans le catalogue publié.</p><p><a href="${esc(href('index.html'))}">Retour à l'accueil</a></p></div></section>`;
    return;
  }
  document.title = `${group.title} | Voyage Fiesta`;
  const back = categoryPath(group.type);
  const images = group.images?.length ? group.images : (group.image ? [{ url: group.image, alt: group.title }] : []);
  const hero = images[0]?.url || '';
  const duration = [group.dureeJours ? `${group.dureeJours} jours` : '', group.dureeNuits ? `${group.dureeNuits} nuits` : ''].filter(Boolean).join(', ');
  const hotel = group.hotelDetail;
  const ship = group.navireDetail;
  const stay = hotel?.nom ? `
    <section class="panel"><h2>${esc(hotel.nom)}</h2>
      ${hotel.description ? `<p>${esc(hotel.description)}</p>` : ''}
      <ul>
        ${hotel.destination ? `<li>Destination: ${esc(hotel.destination)}</li>` : ''}
        ${hotel.chaine ? `<li>Chaîne: ${esc(hotel.chaine)}</li>` : ''}
        ${hotel.etoiles ? `<li>Classification: ${esc(String(hotel.etoiles).replace('.', ','))} étoiles</li>` : ''}
      </ul>
      ${hotel.services?.length ? `<h3>Caractéristiques et services</h3><ul class="chips">${hotel.services.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
    </section>` : '';
  const shipBlock = group.type === 'cruise' && (ship?.nom || group.navire) ? `
    <section class="panel"><h2>${esc(ship?.nom || group.navire)}</h2>
      ${ship?.description ? `<p>${esc(ship.description)}</p>` : ''}
      <ul>
        ${ship?.compagnie || group.compagnie ? `<li>Compagnie: ${esc(ship?.compagnie || group.compagnie)}</li>` : ''}
        ${ship?.passagers ? `<li>Passagers: ${esc(ship.passagers)}</li>` : ''}
        ${ship?.tonnage ? `<li>Tonnage: ${esc(ship.tonnage)}</li>` : ''}
        ${ship?.annee ? `<li>Mise en service: ${esc(ship.annee)}</li>` : ''}
      </ul>
      ${ship?.services?.length ? `<h3>Caractéristiques et services</h3><ul class="chips">${ship.services.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
    </section>` : '';
  const rates = group.tarifs?.length ? `<section class="panel"><h2>Tarifs disponibles</h2>
    <table><caption class="sr-only">Tarifs du groupe</caption><thead><tr><th>Catégorie</th><th>Prix</th><th>Prix précédent</th><th>Disponibilité</th></tr></thead>
    <tbody>${group.tarifs.map((row) => `<tr><td>${esc(row.categorie)}</td><td>${esc(formatPrice(row.prix) || 'Sur demande')}</td><td>${esc(formatPrice(row.prixAncien) || '')}</td><td>${esc(row.disponibilite || '')}</td></tr>`).join('')}</tbody></table>
    <p class="fine">Les tarifs affichés viennent du catalogue du groupe. Les prix et les places peuvent changer. Un conseiller confirme le total.</p></section>` : '';
  const flights = group.vols?.length ? `<section class="panel"><h2>Vols</h2><ul>${group.vols.map((vol) => `<li>${esc([vol.sens, vol.compagnie, vol.numero, vol.depart && vol.arrivee ? `${vol.depart} vers ${vol.arrivee}` : '', formatDate(vol.dateDepart)].filter(Boolean).join(', '))}</li>`).join('')}</ul></section>` : '';
  const steps = group.itineraire?.length ? `<section class="panel"><h2>Itinéraire</h2><ol>${group.itineraire.map((step) => `<li><strong>${esc(step.titre)}</strong> ${esc(step.description || '')}</li>`).join('')}</ol></section>` : '';
  main.innerHTML = `
    <section class="detail-hero" style="--hero:url('${esc(hero)}')"><div class="wrap">
      <p class="eyebrow">${esc(categoryLabel(group.type))}</p>
      <h1>${esc(group.title)}</h1>
      <div class="meta"><span>Départ le ${esc(formatDate(group.dateDepart) || 'date à confirmer')}</span>${duration ? `<span>${esc(duration)}</span>` : ''}<strong>${priceLine(group)}</strong></div>
    </div></section>
    <div class="wrap layout">
      <div>
        <p><a href="${esc(href(back))}">Retour à la liste</a></p>
        ${images.length ? `<section class="panel"><h2>Galerie photos</h2><div class="gallery">${images.map((image, index) => `<button type="button" data-photo="${esc(image.url)}" aria-label="Agrandir la photo ${index + 1}"><img src="${esc(image.url)}" alt="${esc(image.alt || `${group.title}, photo ${index + 1}`)}"></button>`).join('')}</div></section>` : ''}
        ${group.description ? `<section class="panel"><h2>Description</h2><p>${esc(group.description)}</p></section>` : ''}
        ${listBlock('Points forts', group.pointsForts)}
        ${listBlock('Inclusions', group.inclusions)}
        ${listBlock('Exclusions', group.exclusions)}
        ${listBlock('Services compris ou proposés', group.services)}
        ${rates}
        ${flights}
        ${steps}
        ${stay}
        ${shipBlock}
      </div>
      <aside class="side">
        <section class="panel">
          <p class="eyebrow">Votre prochain départ</p>
          <h2>${esc(group.title)}</h2>
          <p>Départ: ${esc(formatDate(group.dateDepart) || 'à confirmer')}</p>
          <p>${priceLine(group)}</p>
          <p class="fine">Prix d'appel publié pour ce groupe, par personne, selon la catégorie indiquée.</p>
          <form id="form-fiche" data-group="${esc(group.id)}">${formFields(group, 'fiche')}</form>
          <p><a href="${esc(cfg.phoneHref || 'tel:+15148566614')}">Appeler au ${esc(phone())}</a></p>
          <button class="btn-secondary" type="button" id="copy-link">Copier le lien du voyage</button>
        </section>
      </aside>
    </div>`;
  bindForm(document.getElementById('form-fiche'), group);
  document.getElementById('copy-link')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(location.href);
      button.textContent = 'Lien copié';
    } catch (_) {
      button.textContent = 'Copie impossible';
    }
  });
  const photoDialog = document.getElementById('photo-dialog');
  document.querySelectorAll('[data-photo]').forEach((button) => {
    button.addEventListener('click', () => {
      const img = document.getElementById('photo-dialog-img');
      img.src = button.dataset.photo;
      img.alt = button.querySelector('img')?.alt || '';
      photoDialog.showModal();
    });
  });
  photoDialog.addEventListener('click', () => photoDialog.close());
}

function wireCards(groups) {
  document.querySelectorAll('[data-demande]').forEach((button) => {
    const group = (groups || []).find((item) => String(item.id) === button.dataset.demande);
    if (group) bindDemande(button, group);
  });
}

function observe() {
  const nodes = [...document.querySelectorAll('[data-animate]')];
  if (!nodes.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    nodes.forEach((node) => node.classList.add('is-in'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.5 });
  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) node.classList.add('is-in');
    else observer.observe(node);
  });
}

function notifyHeight() {
  if (!inIframe() && params.get('embed') !== '1') return;
  const height = Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  window.parent.postMessage({ type: 'voyage-fiesta-resize', height, path: location.pathname + location.search }, '*');
}

async function loadJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

function setCanonical() {
  if (!cfg.canonicalOrigin) return;
  const link = document.querySelector('link[rel="canonical"]') || document.head.appendChild(document.createElement('link'));
  link.rel = 'canonical';
  link.href = new URL(location.pathname + location.search, cfg.canonicalOrigin).href;
}

async function main() {
  document.documentElement.classList.remove('no-js');
  setCanonical();
  if (inIframe() || params.get('embed') === '1') document.documentElement.classList.add('embed');
  const page = document.body.dataset.page || 'home';
  const type = document.body.dataset.type || '';
  const current = page === 'listing' ? type : page === 'home' ? 'home' : '';
  document.body.insertAdjacentHTML('afterbegin', shell(current));
  document.querySelector('.nav-toggle').addEventListener('click', (event) => {
    const open = event.currentTarget.getAttribute('aria-expanded') === 'true';
    event.currentTarget.setAttribute('aria-expanded', String(!open));
    document.getElementById('nav-principale').classList.toggle('is-open', !open);
  });
  let groups = null;
  let failed = false;
  let search = null;
  try {
    const data = await loadJson(jsonUrl());
    if (!Array.isArray(data?.groups)) throw new Error('format');
    groups = data.groups;
  } catch (_) {
    failed = true;
  }
  try {
    search = await loadJson(new URL('search-catalog.json', root).href);
  } catch (_) {
    search = null;
  }
  if (page === 'listing') renderListing(failed ? null : groups, type);
  else if (page === 'detail') renderDetail(failed ? null : groups);
  else renderHome(groups, search, failed);
  observe();
  notifyHeight();
  if (inIframe() || params.get('embed') === '1') {
    window.addEventListener('resize', notifyHeight);
    if ('ResizeObserver' in window) new ResizeObserver(notifyHeight).observe(document.documentElement);
  }
}

main();
