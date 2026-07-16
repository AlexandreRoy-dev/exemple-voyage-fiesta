/**
 * Formulaire d'inscription de chambre (natif) → autofill GHL
 * Form: https://api.leadconnectorhq.com/widget/form/DXJYaNnY1fdP5D1uVr9K
 *
 * Étape 1 : contact + dépôt + facturation/assurances + question infopassager
 * Étape 2 : infos passagers (seulement si Oui)
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
    const INFO_PASSAGER_OPTIONS = [
        { value: 'Oui', label: 'Oui' },
        { value: 'Remplir plus tard', label: 'Remplir plus tard' }
    ];

    function getMap() {
        return global.GHL_ROOM_FORM_FIELD_MAP || {};
    }

    function getEmbedUrl() {
        return global.GHL_ROOM_FORM_EMBED_URL || '';
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

                <div id="rr-step-1" data-rr-step="1">
                    <p class="rr-step-label">Étape 1 sur 2 - Vos coordonnées</p>

                    <section class="rr-card">
                        <h3 class="rr-card-title">Contact</h3>
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

                    <section class="rr-card">
                        <h3 class="rr-card-title">Facturation & assurances</h3>
                        <div class="rr-grid">
                            <label class="rr-field rr-field-full">
                                <span>Adresse civique de facturation du passager principal *</span>
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
                            <label class="rr-field rr-field-full">
                                <span>Tous les voyageurs inscrits sont-ils couverts par une assurance voyage incluant les soins médicaux d'urgence ? *</span>
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
                            <label class="rr-field rr-field-full">
                                <span>Responsable du paiement *</span>
                                <input class="rr-input" type="text" name="payment_responsible" required placeholder="Nom complet">
                            </label>
                            <label class="rr-field rr-field-full">
                                <span>Souhaitez-vous inscrire les informations des passagers maintenant ? *</span>
                                ${selectHtml('infopassager', INFO_PASSAGER_OPTIONS, true, 'Choisissez une option')}
                            </label>
                        </div>
                    </section>

                    <section class="rr-card">
                        <label class="rr-check">
                            <input type="checkbox" name="terms_and_conditions" value="true" required>
                            <span>J'ai lu et j'accepte les termes et conditions du document 001-554 et je confirme que toutes les informations fournies sont exactes.</span>
                        </label>
                    </section>

                    <p id="rr-form-error" class="rr-error hidden" role="alert"></p>
                    <div class="rr-actions">
                        <button type="button" class="rr-btn-primary" id="rr-step1-next">Continuer</button>
                    </div>
                </div>

                <div id="rr-step-2" data-rr-step="2" class="hidden">
                    <p class="rr-step-label">Étape 2 sur 2 - Informations des passagers</p>
                    <div id="rr-passengers"></div>
                    ${kidsSectionHtml(kids)}
                    <section class="rr-card">
                        <label class="rr-field rr-field-full">
                            <span>Notes additionnelles</span>
                            <textarea class="rr-input rr-textarea" name="notes_extra" rows="3" placeholder="Infos supplémentaires (optionnel)"></textarea>
                        </label>
                    </section>
                    <p id="rr-form-error-2" class="rr-error hidden" role="alert"></p>
                    <div class="rr-actions rr-actions-split">
                        <button type="button" class="rr-btn-secondary" id="rr-step2-back">Retour</button>
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

    function formDataToPayload(form, { includePassengers }) {
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
            payment_responsible: get('payment_responsible'),
            infopassager: get('infopassager'),
            terms_and_conditions: form.querySelector('[name="terms_and_conditions"]')?.checked ? 'true' : ''
        };

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
            const extra = get('notes_extra');
            payload.notes = [kidsNotes, extra].filter(Boolean).join('\n\n');
        } else {
            const extra = get('notes_extra');
            payload.notes = [
                'Infos passagers : à remplir plus tard',
                extra
            ].filter(Boolean).join('\n\n');
        }

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
        const step1 = form.querySelector('#rr-step-1');
        const step2 = form.querySelector('#rr-step-2');
        const passengersEl = form.querySelector('#rr-passengers');
        const adultsInput = form.querySelector('[name="nombre_adultes"]');
        const totalInput = form.querySelector('[name="nombre_passagers"]');
        const depotDisplay = form.querySelector('#rr-depot-display');
        const depotValue = form.querySelector('#rr-depot-value');
        const depotHint = form.querySelector('#rr-depot-hint');
        const errorEl = form.querySelector('#rr-form-error');
        const errorEl2 = form.querySelector('#rr-form-error-2');

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

        function updateDepot() {
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

        function showStep(n) {
            currentStep = n;
            const is1 = n === 1;
            step1.classList.toggle('hidden', !is1);
            step2.classList.toggle('hidden', is1);
            setStepRequired(step1, is1);
            setStepRequired(step2, !is1);
            if (typeof onStepChange === 'function') onStepChange(n);
            if (!is1) {
                step2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
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

        function validateStep1() {
            errorEl.classList.add('hidden');
            errorEl.textContent = '';
            const fields = step1.querySelectorAll('input, select, textarea');
            for (const el of fields) {
                if (!el.checkValidity()) {
                    el.reportValidity();
                    return false;
                }
            }
            return true;
        }

        function doSubmit(includePassengers) {
            updateDepot();
            const payload = formDataToPayload(form, { includePassengers });
            if (pricingSummary) payload.sommaire = pricingSummary;
            const ghlUrl = buildGhlRoomFormUrl(payload);
            if (!ghlUrl) {
                const err = includePassengers ? errorEl2 : errorEl;
                err.textContent = 'Le formulaire est temporairement indisponible. Veuillez réessayer plus tard.';
                err.classList.remove('hidden');
                return;
            }
            if (typeof onSubmit === 'function') {
                onSubmit({ payload, ghlUrl, form, includePassengers });
            } else {
                window.location.href = ghlUrl;
            }
        }

        updateDepot();
        showStep(1);

        const step1NextBtn = form.querySelector('#rr-step1-next');
        const infoPassagerSelect = form.querySelector('[name="infopassager"]');

        function syncStep1ButtonLabel() {
            if (!step1NextBtn) return;
            step1NextBtn.textContent = infoPassagerSelect?.value === 'Remplir plus tard'
                ? 'Envoyer la demande'
                : 'Continuer';
        }

        infoPassagerSelect?.addEventListener('change', syncStep1ButtonLabel);
        syncStep1ButtonLabel();

        step1NextBtn?.addEventListener('click', () => {
            if (!validateStep1()) return;
            const choice = infoPassagerSelect?.value;
            if (choice === 'Oui') {
                ensurePassengersRendered();
                showStep(2);
                return;
            }
            doSubmit(false);
        });

        form.querySelector('#rr-step2-back')?.addEventListener('click', () => {
            showStep(1);
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (errorEl2) {
                errorEl2.classList.add('hidden');
                errorEl2.textContent = '';
            }
            if (currentStep !== 2) return;
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            doSubmit(true);
        });

        return {
            form,
            updateDepot,
            showStep
        };
    }

    const css = `
.rr-form { display: flex; flex-direction: column; gap: 1rem; }
.rr-step-label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #025091; margin: 0 0 0.25rem; }
.rr-summary { background: #F3F7FA; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 0.875rem 1rem; font-size: 0.875rem; color: #374151; margin-bottom: 0.25rem; }
.rr-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 1rem; padding: 1rem 1.1rem; }
.rr-card-title { font-size: 1rem; font-weight: 700; color: #025091; margin: 0 0 0.75rem; }
.rr-hint { font-size: 0.75rem; color: #6b7280; margin: -0.35rem 0 0.85rem; line-height: 1.4; }
.rr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.rr-field { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.8rem; font-weight: 600; color: #374151; }
.rr-field-full { grid-column: 1 / -1; }
.rr-input, .rr-textarea {
  font-family: inherit; font-size: 0.9rem; font-weight: 400;
  border: 1px solid #d1d5db; border-radius: 0.65rem; padding: 0.65rem 0.75rem;
  background: #fff; color: #111827; width: 100%;
}
.rr-input-readonly { background: #F3F7FA; font-weight: 600; color: #025091; }
.rr-field-hint { font-size: 0.7rem; font-weight: 500; color: #6b7280; }
.rr-input:focus, .rr-textarea:focus { outline: 2px solid #02509133; border-color: #025091; }
.rr-stack { display: flex; flex-direction: column; gap: 0.75rem; }
.rr-kid-row { padding-top: 0.25rem; }
.rr-kid-title { font-size: 0.9rem; font-weight: 700; color: #025091; margin: 0 0 0.65rem; }
.rr-check { display: flex; gap: 0.65rem; align-items: flex-start; font-size: 0.8rem; color: #374151; line-height: 1.45; font-weight: 500; }
.rr-check input { margin-top: 0.2rem; accent-color: #F26522; }
.rr-actions { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.25rem; }
.rr-actions-split { justify-content: space-between; }
.rr-btn-primary {
  background: #F26522; color: #fff; font-weight: 700; border: 0; border-radius: 0.75rem;
  padding: 0.85rem 1.35rem; cursor: pointer; font-size: 0.95rem;
}
.rr-btn-primary:hover { background: #025091; }
.rr-btn-secondary {
  background: #fff; color: #025091; border: 1px solid #02509155; border-radius: 0.65rem;
  padding: 0.75rem 1.1rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.rr-error { color: #b91c1c; font-size: 0.85rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.65rem; padding: 0.65rem 0.85rem; }
.rr-error.hidden, .hidden { display: none !important; }
@media (max-width: 640px) {
  .rr-grid { grid-template-columns: 1fr; }
}
`;

    function injectStyles() {
        if (document.getElementById('room-registration-styles')) return;
        const style = document.createElement('style');
        style.id = 'room-registration-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    global.RoomRegistration = {
        MAX_STRUCTURED_PASSENGERS,
        mountForm,
        formHtml,
        buildGhlRoomFormUrl,
        formDataToPayload,
        formatDobForGhl,
        injectStyles,
        renderPassengerBlocks
    };
})(typeof window !== 'undefined' ? window : globalThis);
