(function (global) {
    const TAG = 'quickform';

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function assetPrefix() {
        return /\/quickform\/[^/]+\.html$/i.test(global.location.pathname) ? '../' : '';
    }

    function getApiUrl() {
        return String(global.GHL_RESERVATION_API_URL || '').trim();
    }

    function getAgentFromWindow() {
        const baked = global.QUICKFORM_AGENT;
        if (baked && typeof baked === 'object' && String(baked.id || '').trim()) {
            return {
                id: String(baked.id).trim(),
                slug: String(baked.slug || '').trim(),
                name: String(baked.name || '').trim(),
                email: String(baked.email || '').trim(),
                phone: String(baked.phone || '').trim()
            };
        }
        return null;
    }

    function getAgentKeyFromUrl() {
        try {
            return String(new URLSearchParams(global.location.search).get('agent') || '').trim();
        } catch (_) {
            return '';
        }
    }

    async function fetchStaff() {
        const prefix = assetPrefix();
        const res = await fetch(prefix + 'staff.json?t=' + Date.now(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            cache: 'no-store'
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.agents) ? data.agents : [];
    }

    function findAgent(agents, key) {
        const wanted = String(key || '').trim().toLowerCase();
        if (!wanted) return null;
        return (agents || []).find((agent) => {
            const slug = String(agent?.slug || '').trim().toLowerCase();
            const id = String(agent?.id || '').trim().toLowerCase();
            return (slug && slug === wanted) || (id && id === wanted);
        }) || null;
    }

    async function resolveAgent() {
        const baked = getAgentFromWindow();
        if (baked) return baked;
        const key = getAgentKeyFromUrl();
        if (!key) return null;
        const agents = await fetchStaff();
        const found = findAgent(agents, key);
        if (!found) return null;
        return {
            id: String(found.id || '').trim(),
            slug: String(found.slug || '').trim(),
            name: String(found.name || '').trim(),
            email: String(found.email || '').trim(),
            phone: String(found.phone || '').trim()
        };
    }

    function fieldErrorHtml(id, message) {
        if (!message) return '';
        return `<p id="${id}" class="mt-1 text-sm text-red-700"><strong>Erreur :</strong> ${escapeHtml(message)}</p>`;
    }

    function describedBy(hintId, errorId, hasError) {
        return hasError ? `${hintId} ${errorId}` : hintId;
    }

    function renderMissingAgent(root) {
        root.innerHTML = `
            <header class="bg-brand-blue text-white py-8 px-4">
                <div class="max-w-xl mx-auto">
                    <p class="text-sm text-white/80 mb-2">Voyage Fiesta</p>
                    <h1 class="text-2xl md:text-3xl font-bold">Formulaire de contact</h1>
                </div>
            </header>
            <main class="max-w-xl mx-auto px-4 py-10">
                <p class="text-gray-700">Ce lien conseiller n’est pas valide. Demandez le bon URL à votre conseiller Voyage Fiesta.</p>
                <p class="mt-4"><a class="text-brand-blue font-semibold underline" href="${escapeHtml(assetPrefix())}index.html">Retour à la boutique</a></p>
            </main>`;
    }

    function renderForm(root, agent, options) {
        const boutiqueUrl = options.boutiqueUrl
            || `${assetPrefix()}index.html?agent=${encodeURIComponent(agent.slug)}`;
        const name = agent.name || 'votre conseiller';

        root.innerHTML = `
            <div class="qf-atmosphere" aria-hidden="true"></div>
            <header class="relative bg-brand-blue text-white py-8 px-4">
                <div class="max-w-xl mx-auto">
                    <p class="text-sm text-white/80 mb-2">Voyage Fiesta</p>
                    <h1 class="text-2xl md:text-3xl font-bold">Formulaire de contact</h1>
                    <p class="mt-3 text-sm text-white/90 leading-relaxed">
                        Votre demande sera envoyée à ${escapeHtml(name)}.
                        Les champs marqués « obligatoire » doivent être remplis.
                    </p>
                </div>
            </header>
            <main class="relative max-w-xl mx-auto px-4 py-8">
                <div id="qf-error-summary" class="hidden mb-6 rounded-xl border border-red-200 bg-red-50 p-4" tabindex="-1" aria-labelledby="qf-error-heading"></div>
                <form id="qf-form" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4" novalidate>
                    <div class="sr-only" aria-hidden="true">
                        <label for="qf-website">Site web</label>
                        <input id="qf-website" name="website" type="text" tabindex="-1" autocomplete="off">
                    </div>
                    <div>
                        <label for="qf-prenom" class="block text-sm font-medium text-gray-800">Prénom <span class="text-gray-500 font-normal">(obligatoire)</span></label>
                        <input id="qf-prenom" name="prenom" type="text" autocomplete="given-name" required
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none">
                        <p id="qf-prenom-error" hidden></p>
                    </div>
                    <div>
                        <label for="qf-nom" class="block text-sm font-medium text-gray-800">Nom <span class="text-gray-500 font-normal">(obligatoire)</span></label>
                        <input id="qf-nom" name="nom" type="text" autocomplete="family-name" required
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none">
                        <p id="qf-nom-error" hidden></p>
                    </div>
                    <div>
                        <label for="qf-email" class="block text-sm font-medium text-gray-800">Courriel <span class="text-gray-500 font-normal">(obligatoire)</span></label>
                        <p id="qf-email-hint" class="mt-0.5 text-xs text-gray-500">Exemple : nom@domaine.com</p>
                        <input id="qf-email" name="email" type="email" autocomplete="email" required
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none">
                        <p id="qf-email-error" hidden></p>
                    </div>
                    <div>
                        <label for="qf-phone" class="block text-sm font-medium text-gray-800">Téléphone <span class="text-gray-500 font-normal">(obligatoire)</span></label>
                        <input id="qf-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none">
                        <p id="qf-phone-error" hidden></p>
                    </div>
                    <div>
                        <label for="qf-message" class="block text-sm font-medium text-gray-800">Message <span class="text-gray-500 font-normal">(facultatif)</span></label>
                        <textarea id="qf-message" name="message" rows="4" autocomplete="off"
                            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20 outline-none"></textarea>
                    </div>
                    <button type="submit" id="qf-submit"
                        class="w-full bg-brand-orange hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors">
                        Envoyer la demande
                    </button>
                    <p id="qf-status" class="text-sm text-gray-600" role="status" aria-live="polite"></p>
                </form>
                <p class="mt-6 text-sm text-gray-600">
                    <a class="text-brand-blue font-semibold underline" href="${escapeHtml(boutiqueUrl)}">Voir les aubaines de ${escapeHtml(name)}</a>
                </p>
            </main>
            <style>
                body {
                    background:
                        radial-gradient(900px 420px at 8% -10%, rgba(2, 80, 145, 0.08), transparent 55%),
                        radial-gradient(700px 380px at 110% 8%, rgba(242, 101, 34, 0.08), transparent 50%),
                        #F3F7FA;
                }
                .qf-atmosphere {
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    z-index: 0;
                    background:
                        radial-gradient(420px 280px at 12% 18%, rgba(2, 80, 145, 0.07), transparent 70%),
                        radial-gradient(360px 240px at 88% 72%, rgba(242, 101, 34, 0.06), transparent 70%);
                    animation: qf-drift 36s ease-in-out infinite alternate;
                }
                @keyframes qf-drift {
                    from { transform: translate3d(0, 0, 0); }
                    to { transform: translate3d(24px, -18px, 0); }
                }
                .sr-only {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip: rect(0, 0, 0, 0);
                    white-space: nowrap;
                    border: 0;
                }
                @media (prefers-reduced-motion: reduce) {
                    .qf-atmosphere { animation: none; }
                    body { background: #F3F7FA; }
                }
            </style>
        `;

        bindForm(root, agent);
    }

    function setFieldError(input, errorEl, message) {
        if (message) {
            input.setAttribute('aria-invalid', 'true');
            errorEl.hidden = false;
            errorEl.id = errorEl.id || (input.id + '-error');
            errorEl.className = 'mt-1 text-sm text-red-700';
            errorEl.innerHTML = `<strong>Erreur :</strong> ${escapeHtml(message)}`;
            const described = [input.getAttribute('aria-describedby'), errorEl.id]
                .filter(Boolean)
                .filter((id, i, arr) => arr.indexOf(id) === i)
                .join(' ');
            if (described) input.setAttribute('aria-describedby', described);
        } else {
            input.removeAttribute('aria-invalid');
            errorEl.hidden = true;
            errorEl.textContent = '';
        }
    }

    function validateEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function collectErrors(form) {
        const prenom = form.elements.prenom;
        const nom = form.elements.nom;
        const email = form.elements.email;
        const phone = form.elements.phone;
        const errors = [];

        if (!String(prenom.value || '').trim()) {
            errors.push({ input: prenom, errorId: 'qf-prenom-error', message: 'Entrez votre prénom.' });
        }
        if (!String(nom.value || '').trim()) {
            errors.push({ input: nom, errorId: 'qf-nom-error', message: 'Entrez votre nom.' });
        }
        const emailVal = String(email.value || '').trim();
        if (!emailVal) {
            errors.push({ input: email, errorId: 'qf-email-error', message: 'Entrez votre courriel.' });
        } else if (!validateEmail(emailVal)) {
            errors.push({ input: email, errorId: 'qf-email-error', message: 'Entrez un courriel au format nom@domaine.com.' });
        }
        if (!String(phone.value || '').trim()) {
            errors.push({ input: phone, errorId: 'qf-phone-error', message: 'Entrez votre numéro de téléphone.' });
        }
        return errors;
    }

    function showSummary(root, errors) {
        const summary = root.querySelector('#qf-error-summary');
        if (!summary) return;
        if (!errors.length) {
            summary.classList.add('hidden');
            summary.innerHTML = '';
            return;
        }
        const items = errors.map((err) => (
            `<li><a class="underline text-red-800" href="#${escapeHtml(err.input.id)}">${escapeHtml(err.input.labels?.[0]?.textContent?.replace(/\s+/g, ' ').trim() || err.input.name)} : ${escapeHtml(err.message)}</a></li>`
        )).join('');
        summary.classList.remove('hidden');
        summary.innerHTML = `
            <h2 id="qf-error-heading" class="font-semibold text-red-800">Il y a ${errors.length} erreur${errors.length > 1 ? 's' : ''}</h2>
            <ul class="mt-2 list-disc pl-5 space-y-1">${items}</ul>
        `;
        summary.focus();
    }

    function bindForm(root, agent) {
        const form = root.querySelector('#qf-form');
        const status = root.querySelector('#qf-status');
        const submit = root.querySelector('#qf-submit');
        if (!form) return;

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            ['qf-prenom', 'qf-nom', 'qf-email', 'qf-phone'].forEach((id) => {
                const input = root.querySelector('#' + id);
                const errorEl = root.querySelector('#' + id + '-error');
                if (input && errorEl) setFieldError(input, errorEl, '');
            });

            if (String(form.elements.website?.value || '').trim()) {
                status.textContent = 'Merci. Votre demande a été envoyée.';
                form.hidden = true;
                return;
            }

            const errors = collectErrors(form);
            errors.forEach((err) => {
                const errorEl = root.querySelector('#' + err.errorId);
                if (errorEl) setFieldError(err.input, errorEl, err.message);
            });
            showSummary(root, errors);
            if (errors.length) return;

            const apiUrl = getApiUrl();
            if (!apiUrl) {
                status.textContent = 'L’envoi n’est pas configuré pour le moment. Appelez votre conseiller.';
                return;
            }

            submit.disabled = true;
            status.textContent = 'Envoi de votre demande…';

            const payload = {
                request_type: TAG,
                type: TAG,
                p1_prenom: String(form.elements.prenom.value || '').trim(),
                p1_nom: String(form.elements.nom.value || '').trim(),
                p1_email: String(form.elements.email.value || '').trim(),
                p1_phone: String(form.elements.phone.value || '').trim(),
                notes: String(form.elements.message.value || '').trim(),
                agent_id: agent.id,
                agent_slug: agent.slug,
                conseiller_name: agent.name,
                conseiller_email: agent.email,
                conseiller_phone: agent.phone
            };

            try {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({ payload })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.ok) {
                    throw new Error(data.error || 'L’envoi a échoué.');
                }
                form.hidden = true;
                root.querySelector('#qf-error-summary')?.classList.add('hidden');
                status.textContent = `Merci. ${agent.name || 'Votre conseiller'} a bien reçu votre demande et vous contactera sous peu.`;
            } catch (err) {
                status.textContent = err.message || 'L’envoi a échoué. Réessayez dans un instant.';
                submit.disabled = false;
            }
        });
    }

    async function mount(options = {}) {
        const root = document.getElementById('quickform-root');
        if (!root) return;
        try {
            const agent = await resolveAgent();
            if (!agent || !agent.id) {
                renderMissingAgent(root);
                return;
            }
            renderForm(root, agent, options);
        } catch (_) {
            renderMissingAgent(root);
        }
    }

    global.VoyageFiestaQuickform = { mount };
})(window);
