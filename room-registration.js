/**
 * Formulaire d'inscription de chambre (natif) → autofill GHL
 * Form: https://api.leadconnectorhq.com/widget/form/DXJYaNnY1fdP5D1uVr9K
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
        // HTML date input → YYYY-MM-DD
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        // Already JJ/MM/AAAA
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
        return s;
    }

    function passengerSlotKeys(index) {
        const n = index; // 1-5
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

    function passengerBlockHtml(index, { required }) {
        const keys = passengerSlotKeys(index);
        const title = index === 1 ? 'Passager principal' : `Passager ${index}`;
        const isPrincipal = index === 1;
        return `
            <section class="rr-card" data-passenger-block="${index}">
                <h3 class="rr-card-title">${escapeHtml(title)}</h3>
                ${isPrincipal ? `<p class="rr-hint">Le prénom, le nom et la date de naissance doivent être identiques au passeport.</p>` : ''}
                <div class="rr-grid">
                    <label class="rr-field">
                        <span>Prénom ${required ? '*' : ''}</span>
                        <input class="rr-input" type="text" name="${keys.prenom}" autocomplete="given-name" ${required ? 'required' : ''} placeholder="Prénom">
                    </label>
                    <label class="rr-field">
                        <span>Nom de famille ${required ? '*' : ''}</span>
                        <input class="rr-input" type="text" name="${keys.nom}" autocomplete="family-name" ${required ? 'required' : ''} placeholder="Nom">
                    </label>
                    <label class="rr-field">
                        <span>Genre ${required ? '*' : ''}</span>
                        ${selectHtml(keys.genre, GENDER_OPTIONS, required, 'Choisir le genre')}
                    </label>
                    <label class="rr-field">
                        <span>Date de naissance ${required ? '*' : ''}</span>
                        <input class="rr-input" type="date" name="${keys.dob}" ${required ? 'required' : ''}>
                    </label>
                    ${keys.phone ? `
                    <label class="rr-field">
                        <span>Téléphone ${isPrincipal && required ? '*' : ''}</span>
                        <input class="rr-input" type="tel" name="${keys.phone}" autocomplete="tel" ${isPrincipal && required ? 'required' : ''} placeholder="+1 (555) 000-0000">
                    </label>` : ''}
                    ${keys.email ? `
                    <label class="rr-field">
                        <span>Courriel *</span>
                        <input class="rr-input" type="email" name="${keys.email}" autocomplete="email" required placeholder="Votre@courriel.com">
                    </label>` : ''}
                </div>
            </section>`;
    }

    function kidsSectionHtml() {
        return `
            <section class="rr-card" id="rr-kids-section">
                <div class="rr-card-head">
                    <h3 class="rr-card-title">Enfants / voyageurs additionnels</h3>
                    <button type="button" class="rr-btn-secondary" id="rr-add-kid">+ Ajouter</button>
                </div>
                <p class="rr-hint">Les enfants et tout voyageur au-delà de 5 sont envoyés dans le champ <strong>notes</strong> de GoHighLevel.</p>
                <div id="rr-kids-list" class="rr-stack"></div>
            </section>`;
    }

    function kidRowHtml(i) {
        return `
            <div class="rr-kid-row rr-grid" data-kid-row>
                <label class="rr-field">
                    <span>Prénom</span>
                    <input class="rr-input" type="text" name="kid_prenom_${i}" placeholder="Prénom">
                </label>
                <label class="rr-field">
                    <span>Nom</span>
                    <input class="rr-input" type="text" name="kid_nom_${i}" placeholder="Nom">
                </label>
                <label class="rr-field">
                    <span>Genre</span>
                    ${selectHtml(`kid_genre_${i}`, GENDER_OPTIONS, false, 'Genre')}
                </label>
                <label class="rr-field">
                    <span>Date de naissance</span>
                    <input class="rr-input" type="date" name="kid_dob_${i}">
                </label>
                <button type="button" class="rr-remove-kid" aria-label="Retirer">&times;</button>
            </div>`;
    }

    function formHtml() {
        const countOpts = [1, 2, 3, 4, 5].map(n => ({
            value: String(n),
            label: n === 1 ? '1 passager' : `${n} passagers`
        }));
        return `
            <form id="room-registration-form" class="rr-form" novalidate>
                <section class="rr-card">
                    <h3 class="rr-card-title">Inscription de chambre</h3>
                    <div class="rr-grid">
                        <label class="rr-field">
                            <span>Nombre de passagers dans la chambre *</span>
                            ${selectHtml('nombre_passagers', countOpts, true, 'Choisissez une option')}
                        </label>
                        <label class="rr-field">
                            <span>Dépôt</span>
                            <input class="rr-input rr-input-readonly" type="text" name="depot_display" id="rr-depot-display" readonly tabindex="-1" placeholder="-">
                            <input type="hidden" name="depot" id="rr-depot-value" value="">
                            <span class="rr-field-hint" id="rr-depot-hint"></span>
                        </label>
                    </div>
                </section>

                <div id="rr-passengers"></div>
                ${kidsSectionHtml()}

                <section class="rr-card">
                    <h3 class="rr-card-title">Facturation & assurances</h3>
                    <div class="rr-grid">
                        <label class="rr-field rr-field-full">
                            <span>Adresse civique de facturation *</span>
                            <input class="rr-input" type="text" name="address" required autocomplete="street-address" placeholder="Adresse">
                        </label>
                        <label class="rr-field">
                            <span>Ville *</span>
                            <input class="rr-input" type="text" name="city" required autocomplete="address-level2" placeholder="Ville">
                        </label>
                        <label class="rr-field">
                            <span>Code postal *</span>
                            <input class="rr-input" type="text" name="postal_code" required autocomplete="postal-code" placeholder="Code postal">
                        </label>
                        <label class="rr-field rr-field-full">
                            <span>Assurance voyage (soins médicaux d'urgence) *</span>
                            ${selectHtml('assurance_medicale', YES_NO, true)}
                        </label>
                        <label class="rr-field rr-field-full">
                            <span>Passeport valide 6 mois après le retour *</span>
                            ${selectHtml('passeport_valide', YES_NO, true)}
                        </label>
                        <label class="rr-field rr-field-full">
                            <span>Assurance voyage Annulation *</span>
                            ${selectHtml('assurance_annulation', YES_NO, true)}
                        </label>
                        <label class="rr-field rr-field-full">
                            <span>Responsable du paiement *</span>
                            <input class="rr-input" type="text" name="payment_responsible" required placeholder="Nom complet">
                        </label>
                        <label class="rr-field rr-field-full">
                            <span>Notes additionnelles</span>
                            <textarea class="rr-input rr-textarea" name="notes_extra" rows="3" placeholder="Infos supplémentaires (optionnel)"></textarea>
                        </label>
                    </div>
                </section>

                <section class="rr-card">
                    <label class="rr-check">
                        <input type="checkbox" name="terms_and_conditions" value="true" required>
                        <span>J'ai lu et j'accepte les termes et conditions du document 001-554 et je confirme que toutes les informations sont exactes et identiques aux passeports des voyageurs.</span>
                    </label>
                </section>

                <p id="rr-form-error" class="rr-error hidden" role="alert"></p>
                <div class="rr-actions">
                    <button type="submit" class="rr-btn-primary" id="rr-submit">Envoyer la demande</button>
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

    function formDataToPayload(form) {
        const fd = new FormData(form);
        const get = (name) => String(fd.get(name) || '').trim();
        const count = Math.min(MAX_STRUCTURED_PASSENGERS, Math.max(1, Number(get('nombre_passagers')) || 1));
        const depotRaw = get('depot');

        const payload = {
            nombre_passagers: String(count),
            depot: depotRaw,
            address: get('address'),
            city: get('city'),
            postal_code: get('postal_code'),
            assurance_medicale: get('assurance_medicale'),
            passeport_valide: get('passeport_valide'),
            assurance_annulation: get('assurance_annulation'),
            payment_responsible: get('payment_responsible'),
            terms_and_conditions: form.querySelector('[name="terms_and_conditions"]')?.checked ? 'true' : ''
        };

        for (let i = 1; i <= count; i++) {
            const keys = passengerSlotKeys(i);
            payload[keys.prenom] = get(keys.prenom);
            payload[keys.nom] = get(keys.nom);
            payload[keys.genre] = get(keys.genre);
            payload[keys.dob] = formatDobForGhl(get(keys.dob));
            if (keys.phone) payload[keys.phone] = get(keys.phone);
            if (keys.email) payload[keys.email] = get(keys.email);
        }

        const kidsNotes = collectKidsNotes(form);
        const extra = get('notes_extra');
        payload.notes = [kidsNotes, extra].filter(Boolean).join('\n\n');

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
            passengerBlockHtml(i + 1, { required: true })
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

    function mountForm(root, options = {}) {
        const {
            initialPassengerCount = 2,
            initialKidsCount = 0,
            depositPerPerson = null,
            onSubmit,
            summaryHtml = ''
        } = options;

        const perPerson = depositPerPerson != null && Number.isFinite(Number(depositPerPerson))
            ? Number(depositPerPerson)
            : null;

        root.innerHTML = `
            ${summaryHtml ? `<div class="rr-summary">${summaryHtml}</div>` : ''}
            ${formHtml()}
        `;

        const form = root.querySelector('#room-registration-form');
        const passengersEl = root.querySelector('#rr-passengers');
        const countSelect = form.querySelector('[name="nombre_passagers"]');
        const kidsList = root.querySelector('#rr-kids-list');
        const depotDisplay = form.querySelector('#rr-depot-display');
        const depotValue = form.querySelector('#rr-depot-value');
        const depotHint = form.querySelector('#rr-depot-hint');
        const errorEl = root.querySelector('#rr-form-error');
        let kidSeq = 0;

        function calcPassengerCount() {
            return Math.min(MAX_STRUCTURED_PASSENGERS, Math.max(1, Number(countSelect.value) || 1));
        }

        /** Dépôt = dépôt/pers. × (passagers chambre + lignes enfants) */
        function updateDepot() {
            const structured = calcPassengerCount();
            const kidSlots = form.querySelectorAll('[data-kid-row]').length;
            const people = structured + kidSlots;
            if (perPerson == null) {
                depotDisplay.value = '';
                depotValue.value = '';
                if (depotHint) depotHint.textContent = 'Dépôt non défini pour ce forfait.';
                return;
            }
            const total = Math.round(perPerson * people * 100) / 100;
            depotValue.value = String(total);
            depotDisplay.value = formatMoneyCad(total);
            if (depotHint) {
                depotHint.textContent = `${formatMoneyCad(perPerson)} / pass. × ${people} = ${formatMoneyCad(total)}`;
            }
        }

        function addKid() {
            kidSeq += 1;
            kidsList.insertAdjacentHTML('beforeend', kidRowHtml(kidSeq));
            const row = kidsList.lastElementChild;
            row.querySelector('.rr-remove-kid')?.addEventListener('click', () => {
                row.remove();
                updateDepot();
            });
            row.querySelectorAll('input, select').forEach(el => {
                el.addEventListener('input', updateDepot);
                el.addEventListener('change', updateDepot);
            });
            updateDepot();
        }

        countSelect.value = String(Math.min(5, Math.max(1, initialPassengerCount)));
        renderPassengerBlocks(passengersEl, countSelect.value);
        countSelect.addEventListener('change', () => {
            renderPassengerBlocks(passengersEl, countSelect.value);
            updateDepot();
        });

        root.querySelector('#rr-add-kid')?.addEventListener('click', addKid);
        for (let i = 0; i < initialKidsCount; i++) addKid();
        updateDepot();

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            errorEl.classList.add('hidden');
            errorEl.textContent = '';
            updateDepot();

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const payload = formDataToPayload(form);
            const ghlUrl = buildGhlRoomFormUrl(payload);
            if (!ghlUrl) {
                errorEl.textContent = 'Configuration GHL manquante (GHL_ROOM_FORM_EMBED_URL).';
                errorEl.classList.remove('hidden');
                return;
            }

            if (typeof onSubmit === 'function') {
                onSubmit({ payload, ghlUrl, form });
            } else {
                window.location.href = ghlUrl;
            }
        });

        return {
            form,
            updateDepot,
            rebuildPassengers: (n) => {
                countSelect.value = String(n);
                renderPassengerBlocks(passengersEl, n);
                updateDepot();
            }
        };
    }

    const css = `
.rr-form { display: flex; flex-direction: column; gap: 1rem; }
.rr-summary { background: #F3F7FA; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 0.875rem 1rem; font-size: 0.875rem; color: #374151; margin-bottom: 0.25rem; }
.rr-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 1rem; padding: 1rem 1.1rem; }
.rr-card-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.35rem; }
.rr-card-title { font-size: 1rem; font-weight: 700; color: #025091; margin: 0 0 0.75rem; }
.rr-card-head .rr-card-title { margin: 0; }
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
.rr-kid-row { position: relative; padding-right: 2rem; }
.rr-remove-kid {
  position: absolute; right: 0; top: 1.5rem;
  width: 1.75rem; height: 1.75rem; border-radius: 999px;
  border: 1px solid #e5e7eb; background: #fff; color: #6b7280; cursor: pointer; font-size: 1.1rem; line-height: 1;
}
.rr-check { display: flex; gap: 0.65rem; align-items: flex-start; font-size: 0.8rem; color: #374151; line-height: 1.45; font-weight: 500; }
.rr-check input { margin-top: 0.2rem; accent-color: #F26522; }
.rr-actions { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.25rem; }
.rr-btn-primary {
  background: #F26522; color: #fff; font-weight: 700; border: 0; border-radius: 0.75rem;
  padding: 0.85rem 1.35rem; cursor: pointer; font-size: 0.95rem;
}
.rr-btn-primary:hover { background: #025091; }
.rr-btn-secondary {
  background: #fff; color: #025091; border: 1px solid #02509155; border-radius: 0.65rem;
  padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.rr-error { color: #b91c1c; font-size: 0.85rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.65rem; padding: 0.65rem 0.85rem; }
.rr-error.hidden { display: none; }
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
