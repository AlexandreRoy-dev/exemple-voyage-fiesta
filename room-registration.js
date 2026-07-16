/**
 * Formulaire d'inscription de chambre (natif) → autofill GHL
 * Form: https://api.leadconnectorhq.com/widget/form/DXJYaNnY1fdP5D1uVr9K
 *
 * Étape 1 : contact + dépôt (obligatoire)
 * Étape 2 : facturation & assurances (obligatoire)
 * Étape 3 : infos passagers (optionnel)
 */
(function (global) {
    'use strict';

    const MAX_STRUCTURED_PASSENGERS = 5;
    const GENDER_OPTIONS = [
        { value: 'Homme', label: 'Homme' },
        { value: 'Femme', label: 'Femme' },
        { value: 'Autre', label: 'Autre' }
    ];
    const YES_NO = [
        { value: 'Oui', label: 'Oui' },
        { value: 'Non', label: 'Non' }
    ];

    function getMap() {
        return global.GHL_ROOM_FORM_FIELD_MAP || {};
    }

    function getEmbedUrl() {
        return global.GHL_ROOM_FORM_EMBED_URL || '';
    }

    function getRoomFormId() {
        const url = getEmbedUrl();
        if (!url) return '';
        try {
            const parts = new URL(url).pathname.split('/').filter(Boolean);
            return parts[parts.length - 1] || '';
        } catch (_) {
            return '';
        }
    }

    function payloadToGhlFields(payload) {
        const map = getMap();
        const fields = {};
        Object.entries(payload || {}).forEach(([nativeKey, value]) => {
            if (value === undefined || value === null || value === '') return;
            const q = map[nativeKey] || nativeKey;
            fields[q] = String(value);
        });
        return fields;
    }

    /**
     * Soumet le formulaire GHL sans étape iframe / clic Envoyer.
     * Utilise l'endpoint public de soumission GHL, puis redirige vers thank-you.
     */
    async function submitGhlRoomForm({ payload, redirectUrl } = {}) {
        const formId = getRoomFormId();
        if (!formId) {
            throw new Error('Identifiant du formulaire manquant.');
        }

        const fields = payloadToGhlFields(payload);
        const formDataJson = {
            formId,
            ...fields,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto'
        };

        if (global.GHL_LOCATION_ID) {
            formDataJson.location_id = global.GHL_LOCATION_ID;
        }
        if (redirectUrl) {
            formDataJson.redirectUrl = redirectUrl;
        }

        const submitUrl = global.GHL_ROOM_FORM_SUBMIT_URL
            || 'https://backend.leadconnectorhq.com/forms/submit';

        const body = new FormData();
        body.set('formData', JSON.stringify(formDataJson));

        let res;
        try {
            res = await fetch(submitUrl, {
                method: 'POST',
                body,
                credentials: 'omit'
            });
        } catch (networkErr) {
            // CORS / réseau : repli via POST navigateur (quitte la page)
            postFormNavigate(submitUrl, { formData: JSON.stringify(formDataJson) });
            return { ok: true, navigated: true };
        }

        if (!res.ok) {
            let detail = '';
            try {
                const errJson = await res.json();
                detail = errJson?.message || errJson?.error || '';
            } catch (_) {
                /* ignore */
            }
            throw new Error(detail || `Envoi refusé (${res.status}).`);
        }

        let result = null;
        try {
            result = await res.json();
        } catch (_) {
            result = null;
        }

        const nextUrl = redirectUrl
            || result?.redirectUrl
            || result?.redirect_url
            || '';
        if (nextUrl) {
            window.location.href = nextUrl;
            return { ok: true, redirected: true, result };
        }

        return { ok: true, result };
    }

    function postFormNavigate(actionUrl, fields) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = actionUrl;
        form.style.display = 'none';
        Object.entries(fields || {}).forEach(([name, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            input.value = value;
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDobForGhl(isoOrLocal) {
        if (!isoOrLocal) return '';
        const s = String(isoOrLocal).trim();
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
        return s;
    }

    function passengerSlotKeys(index) {
        const n = index;
        return {
            prenom: `p${n}_prenom`,
            nom: `p${n}_nom`,
            genre: `p${n}_genre`,
            dob: `p${n}_dob`,
            phone: n <= 2 ? `p${n}_phone` : null,
            email: n === 1 ? 'p1_email' : null
        };
    }

    function selectHtml(name, options, required, placeholder) {
        const opts = [`<option value="">${escapeHtml(placeholder || 'Choisissez une option')}</option>`]
            .concat(options.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`));
        return `<select name="${escapeHtml(name)}" class="rr-input" ${required ? 'required' : ''}>${opts.join('')}</select>`;
    }

    function progressHtml(activeStep) {
        const steps = [
            { n: 1, label: 'Coordonnées' },
            { n: 2, label: 'Assurances' },
            { n: 3, label: 'Passagers' }
        ];
        return `
            <nav class="rr-progress" aria-label="Progression">
                ${steps.map((s, i) => `
                    <div class="rr-progress-item${s.n === activeStep ? ' is-active' : ''}${s.n < activeStep ? ' is-done' : ''}" data-progress="${s.n}">
                        <span class="rr-progress-num">${s.n}</span>
                        <span class="rr-progress-label">${escapeHtml(s.label)}</span>
                    </div>
                    ${i < steps.length - 1 ? '<span class="rr-progress-line" aria-hidden="true"></span>' : ''}
                `).join('')}
            </nav>`;
    }

    function passengerBlockHtml(index, { required, isPrincipal }) {
        const keys = passengerSlotKeys(index);
        const title = isPrincipal ? 'Passager principal' : `Passager ${index}`;
        return `
            <section class="rr-card" data-passenger-block="${index}">
                <h3 class="rr-card-title">${escapeHtml(title)}</h3>
                ${isPrincipal ? `<p class="rr-hint">Le prénom, le nom et la date de naissance doivent être identiques au passeport.</p>` : ''}
                <div class="rr-grid">
                    <label class="rr-field">
                        <span>Prénom ${required ? '*' : ''}</span>
                        <input class="rr-input" type="text" name="${keys.prenom}" autocomplete="given-name" ${required ? 'required' : ''} placeholder="Prénom" ${isPrincipal ? 'data-prefill-prenom' : ''}>
                    </label>
                    <label class="rr-field">
                        <span>Nom de famille ${required ? '*' : ''}</span>
                        <input class="rr-input" type="text" name="${keys.nom}" autocomplete="family-name" ${required ? 'required' : ''} placeholder="Nom" ${isPrincipal ? 'data-prefill-nom' : ''}>
                    </label>
                    <label class="rr-field">
                        <span>Genre ${required ? '*' : ''}</span>
                        ${selectHtml(keys.genre, GENDER_OPTIONS, required, 'Choisir le genre')}
                    </label>
                    <label class="rr-field">
                        <span>Date de naissance ${required ? '*' : ''}</span>
                        <input class="rr-input" type="date" name="${keys.dob}" ${required ? 'required' : ''}>
                    </label>
                    ${!isPrincipal && keys.phone ? `
                    <label class="rr-field">
                        <span>Téléphone</span>
                        <input class="rr-input" type="tel" name="${keys.phone}" autocomplete="tel" placeholder="+1 (555) 000-0000">
                    </label>` : ''}
                </div>
            </section>`;
    }

    function kidRowHtml(i) {
        return `
            <div class="rr-kid-row" data-kid-row>
                <h4 class="rr-kid-title">Enfant ${i}</h4>
                <div class="rr-grid">
                    <label class="rr-field">
                        <span>Prénom *</span>
                        <input class="rr-input" type="text" name="kid_prenom_${i}" required placeholder="Prénom">
                    </label>
                    <label class="rr-field">
                        <span>Nom *</span>
                        <input class="rr-input" type="text" name="kid_nom_${i}" required placeholder="Nom">
                    </label>
                    <label class="rr-field">
                        <span>Genre *</span>
                        ${selectHtml(`kid_genre_${i}`, GENDER_OPTIONS, true, 'Genre')}
                    </label>
                    <label class="rr-field">
                        <span>Date de naissance *</span>
                        <input class="rr-input" type="date" name="kid_dob_${i}" required>
                    </label>
                </div>
            </div>`;
    }

    function kidsSectionHtml(fixedKidsCount) {
        const n = Math.max(0, Number(fixedKidsCount) || 0);
        if (n <= 0) return '';
        const rows = Array.from({ length: n }, (_, i) => kidRowHtml(i + 1)).join('');
        return `
            <section class="rr-card" id="rr-kids-section">
                <h3 class="rr-card-title">Enfants (${n})</h3>
                <div id="rr-kids-list" class="rr-stack">${rows}</div>
            </section>`;
    }

    function formHtml(fixedPassengerCount, fixedKidsCount) {
        const adults = Math.min(MAX_STRUCTURED_PASSENGERS, Math.max(1, Number(fixedPassengerCount) || 1));
        const kids = Math.max(0, Number(fixedKidsCount) || 0);
        const totalPeople = adults + kids;
        const countLabel = totalPeople === 1 ? '1 passager' : `${totalPeople} passagers`;
        return `
            <form id="room-registration-form" class="rr-form" novalidate>
                <input type="hidden" name="nombre_passagers" value="${totalPeople}">
                <input type="hidden" name="nombre_adultes" value="${adults}">
                <input type="hidden" name="nombre_enfants" value="${kids}">
                <input type="hidden" name="infopassager" id="rr-infopassager" value="Remplir plus tard">

                <div id="rr-progress-root">${progressHtml(1)}</div>

                <div id="rr-step-1" class="rr-step" data-rr-step="1">
                    <p class="rr-step-lead">Vos coordonnées pour démarrer la réservation.</p>

                    <section class="rr-card">
                        <h3 class="rr-card-title">Vos coordonnées</h3>
                        <div class="rr-grid">
                            <label class="rr-field">
                                <span>Prénom *</span>
                                <input class="rr-input" type="text" name="contact_prenom" required autocomplete="given-name" placeholder="Prénom">
                            </label>
                            <label class="rr-field">
                                <span>Nom *</span>
                                <input class="rr-input" type="text" name="contact_nom" required autocomplete="family-name" placeholder="Nom">
                            </label>
                            <label class="rr-field">
                                <span>Téléphone *</span>
                                <input class="rr-input" type="tel" name="contact_phone" required autocomplete="tel" placeholder="+1 (555) 000-0000">
                            </label>
                            <label class="rr-field">
                                <span>Courriel *</span>
                                <input class="rr-input" type="email" name="contact_email" required autocomplete="email" placeholder="Votre@courriel.com">
                            </label>
                            <label class="rr-field">
                                <span>Nombre de passagers</span>
                                <input class="rr-input rr-input-readonly" type="text" value="${escapeHtml(countLabel)}" readonly tabindex="-1">
                            </label>
                            <label class="rr-field">
                                <span>Dépôt</span>
                                <input class="rr-input rr-input-readonly" type="text" name="depot_display" id="rr-depot-display" readonly tabindex="-1" placeholder="-">
                                <input type="hidden" name="depot" id="rr-depot-value" value="">
                                <span class="rr-field-hint" id="rr-depot-hint"></span>
                            </label>
                        </div>
                    </section>

                    <section class="rr-card rr-card-terms">
                        <label class="rr-check">
                            <input type="checkbox" name="terms_and_conditions" value="true" required>
                            <span>J'ai lu et j'accepte les termes et conditions du document 001-554 et je confirme que toutes les informations fournies sont exactes.</span>
                        </label>
                    </section>

                    <p id="rr-form-error-1" class="rr-error hidden" role="alert"></p>
                    <div class="rr-actions">
                        <button type="button" class="rr-btn-primary" id="rr-step1-next">Continuer</button>
                    </div>
                </div>

                <div id="rr-step-2" class="rr-step hidden" data-rr-step="2">
                    <p class="rr-step-lead">Facturation et assurances. Après cette étape, vous pouvez réserver tout de suite ou ajouter les passagers.</p>

                    <section class="rr-card">
                        <h3 class="rr-card-title">Adresse de facturation</h3>
                        <div class="rr-grid">
                            <label class="rr-field rr-field-full">
                                <span>Adresse civique du passager principal *</span>
                                <input class="rr-input" type="text" name="address" required autocomplete="street-address" placeholder="Entrez l'adresse civique">
                            </label>
                            <label class="rr-field">
                                <span>Ville *</span>
                                <input class="rr-input" type="text" name="city" required autocomplete="address-level2" placeholder="Entrez la ville">
                            </label>
                            <label class="rr-field">
                                <span>Code postal *</span>
                                <input class="rr-input" type="text" name="postal_code" required autocomplete="postal-code" placeholder="Entrez le code postal">
                            </label>
                        </div>
                    </section>

                    <section class="rr-card">
                        <h3 class="rr-card-title">Assurances & documents</h3>
                        <div class="rr-stack-fields">
                            <label class="rr-field">
                                <span>Tous les voyageurs sont-ils couverts par une assurance voyage incluant les soins médicaux d'urgence ? *</span>
                                ${selectHtml('assurance_medicale', YES_NO, true)}
                            </label>
                            <label class="rr-field">
                                <span>Le passeport de chaque voyageur est-il valide au moins 6 mois après la date de retour prévue ? *</span>
                                ${selectHtml('passeport_valide', YES_NO, true)}
                            </label>
                            <label class="rr-field">
                                <span>Désirez-vous une assurance voyage Annulation ? *</span>
                                ${selectHtml('assurance_annulation', YES_NO, true)}
                            </label>
                            <label class="rr-field">
                                <span>Responsable du paiement *</span>
                                <input class="rr-input" type="text" name="payment_responsible" required placeholder="Nom complet">
                            </label>
                        </div>
                    </section>

                    <p id="rr-form-error-2" class="rr-error hidden" role="alert"></p>
                    <div class="rr-actions rr-actions-stack">
                        <button type="button" class="rr-btn-primary" id="rr-step2-next">Continuer vers les passagers</button>
                        <button type="button" class="rr-btn-ghost" id="rr-step2-reserve">Réserver maintenant</button>
                        <p class="rr-actions-hint">Les étapes 1 et 2 suffisent pour réserver. Les infos passagers peuvent être ajoutées plus tard.</p>
                        <button type="button" class="rr-btn-secondary" id="rr-step2-back">Retour</button>
                    </div>
                </div>

                <div id="rr-step-3" class="rr-step hidden" data-rr-step="3">
                    <p class="rr-step-lead">Renseignez chaque passager tel qu'indiqué sur le passeport.</p>
                    <div id="rr-passengers" class="rr-stack"></div>
                    ${kidsSectionHtml(kids)}
                    <section class="rr-card">
                        <label class="rr-field">
                            <span>Notes additionnelles</span>
                            <textarea class="rr-input rr-textarea" name="notes_extra" rows="3" placeholder="Infos supplémentaires (optionnel)"></textarea>
                        </label>
                    </section>
                    <p id="rr-form-error-3" class="rr-error hidden" role="alert"></p>
                    <div class="rr-actions rr-actions-split">
                        <button type="button" class="rr-btn-secondary" id="rr-step3-back">Retour</button>
                        <button type="submit" class="rr-btn-primary" id="rr-submit">Envoyer la demande</button>
                    </div>
                </div>
            </form>`;
    }

    function collectKidsNotes(form) {
        const rows = [...form.querySelectorAll('[data-kid-row]')];
        const lines = [];
        rows.forEach((row, idx) => {
            const prenom = row.querySelector(`[name^="kid_prenom"]`)?.value?.trim();
            const nom = row.querySelector(`[name^="kid_nom"]`)?.value?.trim();
            const genre = row.querySelector(`[name^="kid_genre"]`)?.value?.trim();
            const dobRaw = row.querySelector(`[name^="kid_dob"]`)?.value;
            const dob = formatDobForGhl(dobRaw);
            if (!prenom && !nom && !dob) return;
            lines.push(
                `Enfant ${idx + 1}: ${[prenom, nom].filter(Boolean).join(' ')}` +
                (genre ? ` | ${genre}` : '') +
                (dob ? ` | ${dob}` : '')
            );
        });
        return lines.join('\n');
    }

    function formDataToPayload(form, { includePassengers, completedStep }) {
        const fd = new FormData(form);
        const get = (name) => String(fd.get(name) || '').trim();
        const count = Math.max(1, Number(get('nombre_passagers')) || 1);

        const payload = {
            nombre_passagers: String(count),
            depot: get('depot'),
            p1_prenom: get('contact_prenom'),
            p1_nom: get('contact_nom'),
            p1_phone: get('contact_phone'),
            p1_email: get('contact_email'),
            address: get('address'),
            city: get('city'),
            postal_code: get('postal_code'),
            assurance_medicale: get('assurance_medicale'),
            passeport_valide: get('passeport_valide'),
            assurance_annulation: get('assurance_annulation'),
            payment_responsible: get('payment_responsible') || `${get('contact_prenom')} ${get('contact_nom')}`.trim(),
            infopassager: includePassengers ? 'Oui' : 'Remplir plus tard',
            terms_and_conditions: form.querySelector('[name="terms_and_conditions"]')?.checked ? 'true' : ''
        };

        const noteParts = [];
        if (!includePassengers) {
            noteParts.push('Infos passagers : à remplir plus tard');
        }

        if (includePassengers) {
            const adultSlots = Math.min(
                MAX_STRUCTURED_PASSENGERS,
                Math.max(1, Number(get('nombre_adultes')) || count)
            );
            for (let i = 1; i <= adultSlots; i++) {
                const keys = passengerSlotKeys(i);
                if (i === 1) {
                    payload.p1_prenom = get(keys.prenom) || payload.p1_prenom;
                    payload.p1_nom = get(keys.nom) || payload.p1_nom;
                    payload.p1_genre = get(keys.genre);
                    payload.p1_dob = formatDobForGhl(get(keys.dob));
                } else {
                    payload[keys.prenom] = get(keys.prenom);
                    payload[keys.nom] = get(keys.nom);
                    payload[keys.genre] = get(keys.genre);
                    payload[keys.dob] = formatDobForGhl(get(keys.dob));
                    if (keys.phone) payload[keys.phone] = get(keys.phone);
                }
            }
            const kidsNotes = collectKidsNotes(form);
            if (kidsNotes) noteParts.push(kidsNotes);
        }

        const extra = get('notes_extra');
        if (extra) noteParts.push(extra);
        payload.notes = noteParts.filter(Boolean).join('\n\n');

        return payload;
    }

    function buildGhlRoomFormUrl(payload, extraParams) {
        const base = getEmbedUrl();
        if (!base) return '';
        const map = getMap();
        const url = new URL(base);
        Object.entries(payload || {}).forEach(([nativeKey, value]) => {
            if (value === undefined || value === null || value === '') return;
            const q = map[nativeKey] || nativeKey;
            url.searchParams.set(q, String(value));
        });
        if (extraParams && typeof extraParams === 'object') {
            Object.entries(extraParams).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
            });
        }
        return url.toString();
    }

    function renderPassengerBlocks(container, count) {
        const n = Math.min(MAX_STRUCTURED_PASSENGERS, Math.max(1, Number(count) || 1));
        container.innerHTML = Array.from({ length: n }, (_, i) =>
            passengerBlockHtml(i + 1, { required: true, isPrincipal: i === 0 })
        ).join('');
    }

    function formatMoneyCad(amount) {
        if (amount == null || !Number.isFinite(Number(amount))) return '-';
        return new Intl.NumberFormat('fr-CA', {
            style: 'currency',
            currency: 'CAD',
            maximumFractionDigits: 2
        }).format(Number(amount));
    }

    function setStepRequired(stepEl, enabled) {
        if (!stepEl) return;
        stepEl.querySelectorAll('input, select, textarea').forEach(el => {
            if (!el.dataset.wasRequired) {
                if (el.required) el.dataset.wasRequired = '1';
            }
            if (enabled) {
                if (el.dataset.wasRequired === '1') el.required = true;
            } else {
                if (el.required) el.dataset.wasRequired = '1';
                el.required = false;
            }
        });
    }

    function mountForm(root, options = {}) {
        const {
            initialPassengerCount = 2,
            initialKidsCount = 0,
            depositPerPerson = null,
            pricingSummary = '',
            onSubmit,
            summaryHtml = '',
            onStepChange
        } = options;

        const perPerson = depositPerPerson != null && Number.isFinite(Number(depositPerPerson))
            ? Number(depositPerPerson)
            : null;

        root.innerHTML = `
            ${summaryHtml ? `<div class="rr-summary">${summaryHtml}</div>` : ''}
            ${formHtml(initialPassengerCount, initialKidsCount)}
        `;

        const form = root.querySelector('#room-registration-form');
        const progressRoot = form.querySelector('#rr-progress-root');
        const stepEls = {
            1: form.querySelector('#rr-step-1'),
            2: form.querySelector('#rr-step-2'),
            3: form.querySelector('#rr-step-3')
        };
        const passengersEl = form.querySelector('#rr-passengers');
        const adultsInput = form.querySelector('[name="nombre_adultes"]');
        const totalInput = form.querySelector('[name="nombre_passagers"]');
        const depotDisplay = form.querySelector('#rr-depot-display');
        const depotValue = form.querySelector('#rr-depot-value');
        const depotHint = form.querySelector('#rr-depot-hint');
        const infoPassagerInput = form.querySelector('#rr-infopassager');

        const adultCount = Math.min(
            MAX_STRUCTURED_PASSENGERS,
            Math.max(1, Number(adultsInput?.value) || Number(initialPassengerCount) || 1)
        );
        const totalPeople = Math.max(
            adultCount,
            Number(totalInput?.value) || (adultCount + Math.max(0, Number(initialKidsCount) || 0))
        );

        let currentStep = 1;
        let passengersRendered = false;

        function errorEl(step) {
            return form.querySelector(`#rr-form-error-${step}`);
        }

        function clearError(step) {
            const el = errorEl(step);
            if (!el) return;
            el.classList.add('hidden');
            el.textContent = '';
        }

        function showError(step, message) {
            const el = errorEl(step);
            if (!el) return;
            el.textContent = message;
            el.classList.remove('hidden');
        }

        function updateDepot() {
            if (!depotDisplay || !depotValue) return;
            if (perPerson == null) {
                depotDisplay.value = '';
                depotValue.value = '';
                if (depotHint) depotHint.textContent = '';
                return;
            }
            const total = Math.round(perPerson * totalPeople * 100) / 100;
            depotValue.value = String(total);
            depotDisplay.value = formatMoneyCad(total);
            if (depotHint) {
                depotHint.textContent = `${formatMoneyCad(perPerson)} / pass. x ${totalPeople} = ${formatMoneyCad(total)}`;
            }
        }

        function updateProgress(n) {
            if (progressRoot) progressRoot.innerHTML = progressHtml(n);
        }

        function showStep(n) {
            currentStep = n;
            [1, 2, 3].forEach(i => {
                const el = stepEls[i];
                if (!el) return;
                const active = i === n;
                el.classList.toggle('hidden', !active);
                setStepRequired(el, active);
            });
            updateProgress(n);
            if (typeof onStepChange === 'function') onStepChange(n);
            stepEls[n]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function validateStep(n) {
            clearError(n);
            const stepEl = stepEls[n];
            if (!stepEl) return false;
            const fields = stepEl.querySelectorAll('input, select, textarea');
            for (const el of fields) {
                if (!el.checkValidity()) {
                    el.reportValidity();
                    return false;
                }
            }
            return true;
        }

        function ensurePassengersRendered() {
            if (passengersRendered || !passengersEl) return;
            renderPassengerBlocks(passengersEl, adultCount);
            const prenom = form.querySelector('[name="contact_prenom"]')?.value || '';
            const nom = form.querySelector('[name="contact_nom"]')?.value || '';
            const prePrenom = passengersEl.querySelector('[data-prefill-prenom]');
            const preNom = passengersEl.querySelector('[data-prefill-nom]');
            if (prePrenom) prePrenom.value = prenom;
            if (preNom) preNom.value = nom;
            passengersRendered = true;
        }

        function doSubmit({ includePassengers, completedStep }) {
            updateDepot();
            if (infoPassagerInput) {
                infoPassagerInput.value = includePassengers ? 'Oui' : 'Remplir plus tard';
            }
            const payload = formDataToPayload(form, { includePassengers, completedStep });
            if (pricingSummary) payload.sommaire = pricingSummary;

            if (typeof onSubmit === 'function') {
                onSubmit({ payload, form, includePassengers, completedStep });
                return;
            }

            const thankYou = typeof global.buildGhlThankYouUrl === 'function'
                ? global.buildGhlThankYouUrl('')
                : 'thank-you.html';

            submitGhlRoomForm({ payload, redirectUrl: thankYou }).catch((err) => {
                showError(currentStep, err?.message
                    || 'Le formulaire est temporairement indisponible. Veuillez réessayer plus tard.');
            });
        }

        updateDepot();
        showStep(1);

        form.querySelector('#rr-step1-next')?.addEventListener('click', () => {
            if (!validateStep(1)) return;
            const pay = form.querySelector('[name="payment_responsible"]');
            if (pay && !pay.value.trim()) {
                const p = form.querySelector('[name="contact_prenom"]')?.value || '';
                const n = form.querySelector('[name="contact_nom"]')?.value || '';
                pay.value = `${p} ${n}`.trim();
            }
            showStep(2);
        });

        form.querySelector('#rr-step2-next')?.addEventListener('click', () => {
            if (!validateStep(2)) return;
            ensurePassengersRendered();
            showStep(3);
        });

        form.querySelector('#rr-step2-reserve')?.addEventListener('click', () => {
            if (!validateStep(2)) return;
            doSubmit({ includePassengers: false, completedStep: 2 });
        });

        form.querySelector('#rr-step2-back')?.addEventListener('click', () => showStep(1));
        form.querySelector('#rr-step3-back')?.addEventListener('click', () => showStep(2));

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (currentStep !== 3) return;
            if (!validateStep(3)) return;
            doSubmit({ includePassengers: true, completedStep: 3 });
        });

        return {
            form,
            updateDepot,
            showStep
        };
    }

    const css = `
.rr-form { display: flex; flex-direction: column; gap: 0; }
.rr-step { display: flex; flex-direction: column; gap: 1.75rem; }
.rr-step-lead {
  margin: 0; font-size: 0.9rem; font-weight: 500; color: #4b5563; line-height: 1.5;
}
.rr-progress {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.35rem; margin-bottom: 1.75rem; padding: 0.25rem 0;
}
.rr-progress-item {
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
  flex: 0 0 auto; min-width: 4.5rem; opacity: 0.45;
}
.rr-progress-item.is-active, .rr-progress-item.is-done { opacity: 1; }
.rr-progress-num {
  width: 2rem; height: 2rem; border-radius: 9999px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.85rem; font-weight: 700; background: #e5e7eb; color: #6b7280;
}
.rr-progress-item.is-active .rr-progress-num {
  background: #F26522; color: #fff;
}
.rr-progress-item.is-done .rr-progress-num {
  background: #025091; color: #fff;
}
.rr-progress-label {
  font-size: 0.7rem; font-weight: 600; color: #6b7280; text-align: center;
  letter-spacing: 0.02em;
}
.rr-progress-item.is-active .rr-progress-label { color: #F26522; }
.rr-progress-item.is-done .rr-progress-label { color: #025091; }
.rr-progress-line {
  flex: 1 1 auto; height: 2px; background: #e5e7eb; margin: 0 0.15rem 1.1rem;
  align-self: center;
}
.rr-summary {
  background: #F3F7FA; border: 1px solid #dbe7f0; border-radius: 0.75rem;
  padding: 1.1rem 1.25rem; font-size: 0.875rem; color: #374151; line-height: 1.55;
  margin-bottom: 1.5rem;
}
.rr-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 1rem;
  padding: 1.75rem 1.75rem 1.85rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.rr-card-terms { padding: 1.35rem 1.5rem; background: #F3F7FA; }
.rr-card-title {
  font-size: 1.05rem; font-weight: 700; color: #025091;
  margin: 0 0 1.5rem; padding-bottom: 0.85rem;
  border-bottom: 1px solid #edf2f7;
}
.rr-hint {
  font-size: 0.8rem; font-weight: 500; color: #6b7280;
  margin: -0.65rem 0 1.35rem; line-height: 1.5;
}
.rr-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  column-gap: 1.25rem; row-gap: 1.65rem;
}
.rr-stack-fields { display: flex; flex-direction: column; gap: 1.65rem; }
.rr-field {
  display: flex; flex-direction: column; gap: 0.7rem;
  font-size: 0.875rem; font-weight: 600; color: #374151;
  line-height: 1.45;
}
.rr-field-full { grid-column: 1 / -1; }
.rr-input, .rr-textarea {
  font-family: inherit; font-size: 0.95rem; font-weight: 500;
  border: 1px solid #d1d5db; border-radius: 0.75rem;
  padding: 0.95rem 1.05rem; background: #fff; color: #1f2937; width: 100%;
  min-height: 3.1rem; line-height: 1.4;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
select.rr-input {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236b7280' d='M1.4.6 6 5.2 10.6.6 12 2 6 8 0 2z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1.05rem center;
  padding-right: 2.5rem;
}
.rr-textarea { min-height: 6rem; resize: vertical; line-height: 1.55; }
.rr-input-readonly {
  background: #F3F7FA; font-weight: 600; color: #025091;
  border-color: #dbe7f0;
}
.rr-field-hint {
  font-size: 0.8rem; font-weight: 500;
  color: #6b7280; line-height: 1.4; margin-top: 0.15rem;
}
.rr-input:focus, .rr-textarea:focus {
  outline: none; border-color: #025091;
  box-shadow: 0 0 0 3px rgba(2, 80, 145, 0.15);
}
.rr-input::placeholder, .rr-textarea::placeholder { color: #9ca3af; font-weight: 400; }
.rr-stack { display: flex; flex-direction: column; gap: 1.75rem; }
.rr-kid-row {
  background: #F3F7FA; border: 1px solid #e5e7eb; border-radius: 0.85rem;
  padding: 1.35rem 1.4rem;
}
.rr-kid-title {
  font-size: 0.95rem; font-weight: 700; color: #025091;
  margin: 0 0 1.15rem;
}
.rr-check {
  display: flex; gap: 0.9rem; align-items: flex-start;
  font-size: 0.9rem; color: #374151; line-height: 1.55; font-weight: 500;
}
.rr-check input {
  margin-top: 0.2rem; width: 1.15rem; height: 1.15rem; flex-shrink: 0;
  accent-color: #F26522;
}
.rr-actions {
  display: flex; justify-content: flex-end; align-items: center; gap: 0.85rem;
  padding-top: 0.35rem; padding-bottom: 0.25rem; flex-wrap: wrap;
}
.rr-actions-split { justify-content: space-between; }
.rr-actions-stack {
  flex-direction: column; align-items: stretch; gap: 0.75rem;
}
.rr-actions-hint {
  margin: 0.15rem 0 0; font-size: 0.8rem; color: #6b7280; text-align: center; line-height: 1.4;
}
.rr-btn-primary {
  background: #F26522; color: #fff; font-weight: 600; border: 0;
  border-radius: 0.65rem; padding: 1rem 1.65rem; cursor: pointer;
  font-size: 0.95rem; font-family: inherit;
  transition: background-color 0.15s ease;
}
.rr-btn-primary:hover { background: #025091; }
.rr-btn-secondary {
  background: #fff; color: #025091; border: 1px solid #c5d5e3;
  border-radius: 0.65rem; padding: 0.95rem 1.35rem; font-size: 0.9rem;
  font-weight: 600; cursor: pointer; white-space: nowrap; font-family: inherit;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.rr-btn-secondary:hover { background: #F3F7FA; border-color: #025091; }
.rr-btn-ghost {
  background: transparent; color: #025091; border: 0;
  border-radius: 0.65rem; padding: 0.85rem 1rem; font-size: 0.9rem;
  font-weight: 600; cursor: pointer; font-family: inherit;
  text-decoration: underline; text-underline-offset: 3px;
}
.rr-btn-ghost:hover { color: #F26522; }
.rr-error {
  color: #b91c1c; font-size: 0.875rem; background: #fef2f2;
  border: 1px solid #fecaca; border-radius: 0.65rem; padding: 1rem 1.1rem;
  line-height: 1.45;
}
.rr-error.hidden, .hidden { display: none !important; }
@media (max-width: 640px) {
  .rr-grid { grid-template-columns: 1fr; column-gap: 0; row-gap: 1.4rem; }
  .rr-card { padding: 1.35rem 1.25rem 1.5rem; }
  .rr-step { gap: 1.4rem; }
  .rr-progress-label { font-size: 0.65rem; }
  .rr-actions-split { flex-direction: column-reverse; }
  .rr-btn-primary, .rr-btn-secondary { width: 100%; text-align: center; }
}
`;

    function injectStyles() {
        let style = document.getElementById('room-registration-styles');
        if (!style) {
            style = document.createElement('style');
            style.id = 'room-registration-styles';
            document.head.appendChild(style);
        }
        style.textContent = css;
    }

    global.RoomRegistration = {
        MAX_STRUCTURED_PASSENGERS,
        mountForm,
        formHtml,
        buildGhlRoomFormUrl,
        submitGhlRoomForm,
        payloadToGhlFields,
        formDataToPayload,
        formatDobForGhl,
        injectStyles,
        renderPassengerBlocks
    };
})(typeof window !== 'undefined' ? window : globalThis);
