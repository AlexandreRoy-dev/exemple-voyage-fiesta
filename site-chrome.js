(function (global) {
  var LINKS = [
    ['/', 'Aubaines Express', 'aubaines'],
    ['/groupes/forfaits-sud/', 'Forfaits SUD', 'sud'],
    ['/groupes/croisieres/', 'Croisières', 'cruise'],
    ['/groupes/voyages/', 'Voyages', 'voyage'],
    ['/groupes/mariages/', 'Mariage', 'mariage'],
    ['/agents/', 'Notre équipe', 'equipe'],
    ['/#contact', 'Contact', 'contact']
  ];

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function currentKey() {
    var path = location.pathname.replace(/\/index\.html$/, '/');
    if (path === '/' || path === '/index.html') return 'aubaines';
    if (path.indexOf('/groupes/forfaits-sud') === 0) return 'sud';
    if (path.indexOf('/groupes/croisieres') === 0) return 'cruise';
    if (path.indexOf('/groupes/voyages') === 0) return 'voyage';
    if (path.indexOf('/groupes/mariages') === 0) return 'mariage';
    if (path.indexOf('/agents') === 0) return 'equipe';
    if (path.indexOf('/contact') === 0) return 'contact';
    return '';
  }

  function withLead(href) {
    try {
      var url = new URL(href, location.origin);
      var current = new URLSearchParams(location.search);
      ['ref', 'ghl_user', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
        if (current.get(key) && !url.searchParams.get(key)) url.searchParams.set(key, current.get(key));
      });
      var token = global.VoyageFiestaEmbed && global.VoyageFiestaEmbed.embedToken && global.VoyageFiestaEmbed.embedToken();
      if (token) {
        var keepSections = token === 'sections' && (url.pathname === '/' || url.pathname === '/index.html');
        url.searchParams.set('embed', keepSections ? 'sections' : '1');
      }
      return url.pathname + url.search + url.hash;
    } catch (_) {
      return href;
    }
  }

  function headerHtml() {
    var active = currentKey();
    var links = LINKS.map(function (item) {
      var current = item[2] === active ? ' aria-current="page"' : '';
      return '<a href="' + esc(withLead(item[0])) + '"' + current + '>' + esc(item[1]) + '</a>';
    }).join('');
    return '<div class="vf-site-header__inner">'
      + '<a class="vf-site-logo" href="' + esc(withLead('/')) + '">Voyage Fiesta <span>Aubaines Express</span></a>'
      + '<button class="vf-nav-toggle" type="button" aria-expanded="false" aria-controls="vf-site-nav">Menu</button>'
      + '<nav id="vf-site-nav" class="vf-site-nav" aria-label="Principale">' + links + '</nav>'
      + '</div>';
  }

  function footerHtml() {
    return '<div class="vf-site-footer__grid" id="contact">'
      + '<div><p><strong>Voyage Fiesta</strong></p>'
      + '<p>2001, boul. Robert-Bourassa, bureau 1700, Montréal (QC) H3A 2A6</p>'
      + '<p><a href="tel:+15148566614">514-856-6614</a></p>'
      + '<p><a href="mailto:info@voyagesfiesta.com">info@voyagesfiesta.com</a></p>'
      + '<p>Permis d\'agence de voyages du Québec : 703631. Contribution au Fonds FICAV.</p>'
      + '<p><a href="/agents/">Notre équipe</a></p></div>'
      + '<form id="vf-contact-form" novalidate>'
      + '<h2>Nous joindre</h2>'
      + '<div class="vf-sr" style="position:absolute;width:1px;height:1px;overflow:hidden"><label for="vf-website">Site web</label><input id="vf-website" name="website" tabindex="-1" autocomplete="off"></div>'
      + '<div><label for="vf-prenom">Prénom (obligatoire)</label><input id="vf-prenom" name="prenom" autocomplete="given-name" required></div>'
      + '<div><label for="vf-nom">Nom (obligatoire)</label><input id="vf-nom" name="nom" autocomplete="family-name" required></div>'
      + '<div><label for="vf-email">Courriel (obligatoire)</label><input id="vf-email" name="email" type="email" autocomplete="email" required></div>'
      + '<div><label for="vf-phone">Téléphone (obligatoire)</label><input id="vf-phone" name="phone" type="tel" autocomplete="tel" required></div>'
      + '<div><label for="vf-message">Message</label><textarea id="vf-message" name="message" rows="3"></textarea></div>'
      + '<label class="vf-check"><input id="vf-consent" name="terms_and_conditions" type="checkbox" required> <span>J\'accepte que Voyage Fiesta utilise ces renseignements pour répondre à ma demande. (obligatoire)</span></label>'
      + '<button type="submit">Envoyer</button>'
      + '<p id="vf-contact-status" role="status"></p>'
      + '</form></div>';
  }

  function bindForm(form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var status = document.getElementById('vf-contact-status');
      if (String(form.elements.website.value || '').trim()) {
        status.textContent = 'Merci. Votre message a été envoyé.';
        form.hidden = true;
        return;
      }
      if (!form.elements.prenom.value.trim() || !form.elements.nom.value.trim() || !form.elements.email.value.trim() || !form.elements.phone.value.trim() || !form.elements.terms_and_conditions.checked) {
        status.textContent = 'Remplissez les champs obligatoires, y compris le consentement.';
        return;
      }
      var api = String(global.GHL_RESERVATION_API_URL || '').trim();
      if (!api) {
        status.textContent = 'L\'envoi n\'est pas configuré. Appelez le 514-856-6614.';
        return;
      }
      var payload = {
        request_type: 'quickform',
        type: 'quickform',
        p1_prenom: form.elements.prenom.value.trim(),
        p1_nom: form.elements.nom.value.trim(),
        p1_email: form.elements.email.value.trim(),
        p1_phone: form.elements.phone.value.trim(),
        message: form.elements.message.value.trim(),
        notes: form.elements.message.value.trim(),
        terms_and_conditions: 'true'
      };
      status.textContent = 'Envoi de votre message…';
      fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ payload: global.VFLeadRef && global.VFLeadRef.attach ? global.VFLeadRef.attach(payload) : payload })
      }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok && data.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) throw new Error(result.data.error || 'L\'envoi a échoué.');
          form.hidden = true;
          status.textContent = 'Merci. Voyage Fiesta a bien reçu votre message.';
        })
        .catch(function (err) {
          status.textContent = err.message || 'L\'envoi a échoué. Réessayez dans un instant.';
        });
    });
  }

  function framed() {
    try { return global.self !== global.top; } catch (_) { return true; }
  }

  function isEmbedded() {
    var root = document.documentElement;
    if (root.classList.contains('embed-mode') || root.classList.contains('embed')) return true;
    if (global.VoyageFiestaEmbed && global.VoyageFiestaEmbed.isEmbedMode && global.VoyageFiestaEmbed.isEmbedMode()) return true;
    return framed();
  }

  // Les blocs [data-anim] partent a opacity 0. Ils doivent toujours finir visibles :
  // dans un iframe, avec du contenu injecte apres coup (home-sections.js) ou avec
  // une section plus haute que l'ecran.
  function bindMotion() {
    var instant = isEmbedded() || global.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver !== 'function';
    var observer = instant ? null : new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    function scan(scope) {
      var list = [];
      if (scope.nodeType === 1 && scope.hasAttribute('data-anim')) list.push(scope);
      if (scope.querySelectorAll) list = list.concat([].slice.call(scope.querySelectorAll('[data-anim]')));
      list.forEach(function (node) {
        if (node.classList.contains('is-in') || node.__vfAnim) return;
        node.__vfAnim = true;
        var rect = node.getBoundingClientRect();
        if (instant || (rect.top < global.innerHeight && rect.bottom > 0)) node.classList.add('is-in');
        else observer.observe(node);
      });
    }
    scan(document);
    if (typeof MutationObserver === 'function') {
      new MutationObserver(function (records) {
        records.forEach(function (record) {
          [].forEach.call(record.addedNodes, function (node) { if (node.nodeType === 1) scan(node); });
        });
      }).observe(document.body || document.documentElement, { childList: true, subtree: true });
    }
  }

  function mount() {
    if (!global.__vfMotionBound) { global.__vfMotionBound = true; bindMotion(); }
    if (isEmbedded()) return;
    var header = document.getElementById('vf-site-header');
    var footer = document.getElementById('vf-site-footer');
    if (header && !header.childElementCount) header.innerHTML = headerHtml();
    if (footer && !footer.childElementCount) {
      footer.classList.add('vf-site-footer');
      footer.innerHTML = footerHtml();
    }
    var toggle = document.querySelector('.vf-nav-toggle');
    var nav = document.getElementById('vf-site-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        nav.classList.toggle('is-open', !open);
      });
    }
    var form = document.getElementById('vf-contact-form');
    if (form) bindForm(form);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(window);
