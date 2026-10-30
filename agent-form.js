(function (global) {
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function agentFromPage() {
        const baked = global.AGENT_PAGE;
        if (!baked || typeof baked !== 'object') return null;
        const id = String(baked.id || '').trim();
        const slug = String(baked.slug || '').trim();
        if (!id || !slug) return null;
        return {
            id: id,
            slug: slug,
            name: String(baked.name || '').trim(),
            email: String(baked.email || '').trim(),
            phone: String(baked.phone || '').trim()
        };
    }

    function setFieldError(input, errorEl, message) {
        if (!input || !errorEl) return;
        if (message) {
            input.setAttribute('aria-invalid', 'true');
            errorEl.hidden = false;
            errorEl.innerHTML = '<strong>Erreur :</strong> ' + escapeHtml(message);
            const described = [input.getAttribute('aria-describedby'), errorEl.id]
                .filter(Boolean)
                .filter(function (id, index, list) { return list.indexOf(id) === index; })
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
        const errors = [];
        const prenom = form.elements.prenom;
        const nom = form.elements.nom;
        const email = form.elements.email;
        const phone = form.elements.phone;
        const depart = form.elements.departure_date;
        const retour = form.elements.return_date;
        const consent = form.elements.terms_and_conditions;

        if (!String(prenom.value || '').trim()) {
            errors.push({ input: prenom, errorId: 'ag-prenom-error', message: 'Entrez votre prénom.' });
        }
        if (!String(nom.value || '').trim()) {
            errors.push({ input: nom, errorId: 'ag-nom-error', message: 'Entrez votre nom.' });
        }
        const emailVal = String(email.value || '').trim();
        if (!emailVal) {
            errors.push({ input: email, errorId: 'ag-email-error', message: 'Entrez votre courriel.' });
        } else if (!validateEmail(emailVal)) {
            errors.push({ input: email, errorId: 'ag-email-error', message: 'Entrez un courriel au format nom@domaine.com.' });
        }
        if (!String(phone.value || '').trim()) {
            errors.push({ input: phone, errorId: 'ag-phone-error', message: 'Entrez votre numéro de téléphone.' });
        }
        if (depart.value && retour.value && retour.value < depart.value) {
            errors.push({ input: retour, errorId: 'ag-return-error', message: 'La date de retour est avant la date de départ.' });
        }
        if (!consent.checked) {
            errors.push({ input: consent, errorId: 'ag-consent-error', message: 'Cochez la case pour confirmer votre consentement.' });
        }
        return errors;
    }

    function showSummary(root, errors) {
        const summary = root.querySelector('#ag-error-summary');
        if (!summary) return;
        if (!errors.length) {
            summary.hidden = true;
            summary.innerHTML = '';
            return;
        }
        const items = errors.map(function (err) {
            const label = err.input.labels && err.input.labels[0]
                ? err.input.labels[0].textContent.replace(/\s+/g, ' ').trim()
                : err.input.name;
            return '<li><a href="#' + escapeHtml(err.input.id) + '">' + escapeHtml(label) + ' : ' + escapeHtml(err.message) + '</a></li>';
        }).join('');
        summary.hidden = false;
        summary.innerHTML = '<h2 id="ag-error-heading">Il y a ' + errors.length + ' erreur' + (errors.length > 1 ? 's' : '') + '</h2><ul>' + items + '</ul>';
        summary.focus();
    }

    function optional(form, name) {
        const value = String(form.elements[name]?.value || '').trim();
        return value || '';
    }

    function bindForm(root, agent) {
        const form = root.querySelector('#ag-form');
        const status = root.querySelector('#ag-status');
        const submit = root.querySelector('#ag-submit');
        if (!form) return;

        document.querySelectorAll('[data-contact]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                const field = document.getElementById('ag-prenom');
                if (!field) return;
                event.preventDefault();
                const reduce = global.matchMedia('(prefers-reduced-motion: reduce)').matches;
                document.getElementById('agent-form')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
                field.focus();
            });
        });

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            ['ag-prenom', 'ag-nom', 'ag-email', 'ag-phone', 'ag-return', 'ag-consent'].forEach(function (id) {
                setFieldError(root.querySelector('#' + id), root.querySelector('#' + id + '-error'), '');
            });

            if (String(form.elements.website?.value || '').trim()) {
                status.textContent = 'Merci. Votre demande a été envoyée.';
                form.hidden = true;
                return;
            }

            const errors = collectErrors(form);
            errors.forEach(function (err) {
                setFieldError(err.input, root.querySelector('#' + err.errorId), err.message);
            });
            showSummary(root, errors);
            if (errors.length) return;

            const apiUrl = String(global.GHL_RESERVATION_API_URL || '').trim();
            if (!apiUrl) {
                status.textContent = 'L’envoi n’est pas configuré pour le moment. Appelez votre conseiller.';
                return;
            }

            submit.disabled = true;
            status.textContent = 'Envoi de votre demande…';

            const message = optional(form, 'message');
            const payload = {
                request_type: 'quickform',
                type: 'quickform',
                p1_prenom: optional(form, 'prenom'),
                p1_nom: optional(form, 'nom'),
                p1_email: optional(form, 'email'),
                p1_phone: optional(form, 'phone'),
                terms_and_conditions: 'true',
                agent_id: agent.id,
                agent_slug: agent.slug,
                conseiller_name: agent.name,
                conseiller_email: agent.email,
                conseiller_phone: agent.phone
            };
            const destination = optional(form, 'destination');
            const departure = optional(form, 'departure_date');
            const retour = optional(form, 'return_date');
            const adults = optional(form, 'nombre_adultes');
            const children = optional(form, 'nombre_enfants');
            if (destination) payload.destination = destination;
            if (departure) payload.departure_date = departure;
            if (retour) payload.return_date = retour;
            if (adults) payload.nombre_adultes = adults;
            if (children) payload.nombre_enfants = children;
            if (message) {
                payload.message = message;
                payload.notes = message;
            }

            try {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({
                        payload: global.VFLeadRef && global.VFLeadRef.attach ? global.VFLeadRef.attach(payload) : payload
                    })
                });
                const data = await res.json().catch(function () { return {}; });
                if (!res.ok || !data.ok) throw new Error(data.error || 'L’envoi a échoué.');
                form.hidden = true;
                const summary = root.querySelector('#ag-error-summary');
                if (summary) summary.hidden = true;
                status.textContent = 'Merci. ' + (agent.name || 'Votre conseiller') + ' a bien reçu votre demande et vous contactera sous peu.';
            } catch (err) {
                status.textContent = err.message || 'L’envoi a échoué. Réessayez dans un instant.';
                submit.disabled = false;
            }
        });
    }

    function bindMotion() {
        const nodes = document.querySelectorAll('[data-anim]');
        let framed = false;
        try { framed = global.self !== global.top; } catch (_) { framed = true; }
        // Dans un iframe (Divi) ou sans animation, tout est visible tout de suite.
        if (framed || global.matchMedia('(prefers-reduced-motion: reduce)').matches || !nodes.length || typeof IntersectionObserver !== 'function') {
            nodes.forEach(function (node) { node.classList.add('is-in'); });
            return;
        }
        const groups = new Map();
        nodes.forEach(function (node) {
            const key = node.getAttribute('data-anim-group') || node.getAttribute('data-anim') || 'page';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(node);
        });
        groups.forEach(function (list) {
            list.forEach(function (node, index) {
                node.style.transitionDelay = Math.min(index * 0.3, 0.9) + 's';
            });
        });
        // threshold 0 : une section plus haute que deux ecrans (mobile) n'atteint jamais 50 %.
        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
        nodes.forEach(function (node) { observer.observe(node); });
    }

    function mount() {
        const root = document.getElementById('agent-form') || document;
        const agent = agentFromPage();
        if (agent && root.querySelector) bindForm(root, agent);
        bindMotion();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})(window);
