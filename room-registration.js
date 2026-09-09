/**
 * Formulaire de réservation (une page) → GHL Contacts via Cloudflare Worker.
 * Redirection vers une page complète depuis la fiche forfait.
 */
(function (global) {
    'use strict';

    const MAX_STRUCTURED_PASSENGERS = 5;
    const MAX_EXTRA_TRAVELERS = MAX_STRUCTURED_PASSENGERS - 1;
    const DRAFT_KEY_PREFIX = 'vf-reservation-draft-';
    const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
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

    async function submitGhlRoomForm({ payload, redirectUrl } = {}) {
        const apiUrl = String(global.GHL_RESERVATION_API_URL || '').trim();
        if (!apiUrl) {
            throw new Error(
                'Soumission API non configurée. Déployez workers/submit-reservation et définissez GHL_RESERVATION_API_URL dans config.js.'
            );
        }

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ payload })
        });

        let data = null;
        try {
            data = await res.json();
        } catch (_) {
            data = null;
        }

        if (!res.ok || !data?.ok) {
            const detail = data?.error || `Erreur serveur (${res.status})`;
            throw new Error(detail);
        }

        if (redirectUrl) {
            window.location.href = redirectUrl;
            return { ok: true, redirected: true, contactId: data.contactId || null };
        }

        return { ok: true, contactId: data.contactId || null };
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

    function selectHtml(name, options, required, placeholder) {
        const opts = [`<option value="">${escapeHtml(placeholder || 'Choisissez une option')}</option>`]
            .concat(options.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`));
        return `<select id="${escapeHtml(name)}" name="${escapeHtml(name)}" class="rr-input" ${required ? 'required' : ''}>${opts.join('')}</select>`;
    }

    function reqMark() {
        return '<span class="rr-req" aria-hidden="true">*</span><span class="sr-only"> (obligatoire)</span>';
    }

    function extraTravelerHtml(index) {
        const n = Number(index);
        return `
            <article class="rr-extra-card" data-extra-traveler="${n}">
                <div class="rr-extra-head">
                    <h3 class="rr-extra-title">Voyageur ${n + 1}</h3>
                    <button type="button" class="rr-btn-remove" data-remove-traveler aria-label="Retirer ce voyageur">Retirer</button>
                </div>
                <div class="rr-grid">
                    <label class="rr-field" for="extra-prenom-${n}">
                        <span>Prénom ${reqMark()}</span>
                        <input class="rr-input" id="extra-prenom-${n}" type="text" name="extra_prenom_${n}" autocomplete="off" required placeholder="Marie">
                    </label>
                    <label class="rr-field" for="extra-nom-${n}">
                        <span>Nom de famille ${reqMark()}</span>
                        <input class="rr-input" id="extra-nom-${n}" type="text" name="extra_nom_${n}" autocomplete="off" required placeholder="Tremblay">
                    </label>
                    <label class="rr-field" for="extra-dob-${n}">
                        <span>Date de naissance ${reqMark()}</span>
                        <input class="rr-input" id="extra-dob-${n}" type="date" name="extra_dob_${n}" required>
                    </label>
                </div>
            </article>`;
    }

    function kidRowHtml(i) {
        return `
            <div class="rr-kid-row" data-kid-row>
                <h3 class="rr-extra-title">Enfant ${i}</h3>
                <div class="rr-grid">
                    <label class="rr-field" for="kid-prenom-${i}">
                        <span>Prénom ${reqMark()}</span>
                        <input class="rr-input" id="kid-prenom-${i}" type="text" name="kid_prenom_${i}" required placeholder="Prénom">
                    </label>
                    <label class="rr-field" for="kid-nom-${i}">
                        <span>Nom de famille ${reqMark()}</span>
                        <input class="rr-input" id="kid-nom-${i}" type="text" name="kid_nom_${i}" required placeholder="Nom">
                    </label>
                    <label class="rr-field" for="kid-dob-${i}">
                        <span>Date de naissance ${reqMark()}</span>
                        <input class="rr-input" id="kid-dob-${i}" type="date" name="kid_dob_${i}" required>
                    </label>
                </div>
            </div>`;
    }

    function kidsSectionHtml(fixedKidsCount) {
        const n = Math.max(0, Number(fixedKidsCount) || 0);
        if (n <= 0) return '';
        const rows = Array.from({ length: n }, (_, i) => kidRowHtml(i + 1)).join('');
        return `
            <section class="rr-card" id="rr-kids-section" aria-labelledby="rr-kids-title">
                <div class="rr-card-head">
                    <h2 class="rr-card-title" id="rr-kids-title">
                        <i class="fa-solid fa-child-reaching" aria-hidden="true"></i>
                        Enfants (${n})
                    </h2>
                </div>
                <div class="rr-alert" role="note">
                    <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                    <p>Indiquez le nom exactement comme sur leurs passeports.</p>
                </div>
                <div id="rr-kids-list" class="rr-stack">${rows}</div>
            </section>`;
    }

    function formHtml(fixedPassengerCount, fixedKidsCount, hideSubmit) {
        const adults = Math.min(MAX_STRUCTURED_PASSENGERS, Math.max(1, Number(fixedPassengerCount) || 1));
        const kids = Math.max(0, Number(fixedKidsCount) || 0);
        const totalPeople = adults + kids;
        const extraHint = adults > 1
            ? `Ajoutez les autres adultes de la réservation (${adults} adultes).`
            : 'Ajoutez un autre voyageur seulement s’il voyage avec vous.';
        return `
            <form id="room-registration-form" class="rr-form" novalidate>
                <p class="rr-req-legend">Les champs marqués <span class="rr-req">*</span> sont obligatoires.</p>
                <input type="hidden" name="nombre_passagers" value="${totalPeople}">
                <input type="hidden" name="nombre_adultes" value="${adults}">
                <input type="hidden" name="nombre_enfants" value="${kids}">
                <input type="hidden" name="infopassager" id="rr-infopassager" value="Oui">
                <input type="hidden" name="payment_responsible" id="rr-payment-responsible" value="">
                <input type="hidden" name="depot" id="rr-depot-value" value="">

                <section class="rr-card" aria-labelledby="rr-principal-title">
                    <div class="rr-card-head">
                        <h2 class="rr-card-title" id="rr-principal-title">
                            <i class="fa-solid fa-user" aria-hidden="true"></i>
                            Voyageur principal
                        </h2>
                    </div>
                    <div class="rr-alert" role="note" id="rr-passport-hint">
                        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                        <p>Indiquez le nom exactement comme sur votre passeport.</p>
                    </div>
                    <div class="rr-grid">
                        <label class="rr-field" for="contact_prenom">
                            <span>Prénom ${reqMark()}</span>
                            <input class="rr-input" id="contact_prenom" type="text" name="contact_prenom" required autocomplete="given-name" placeholder="Marie" aria-describedby="rr-passport-hint">
                        </label>
                        <label class="rr-field" for="contact_nom">
                            <span>Nom de famille ${reqMark()}</span>
                            <input class="rr-input" id="contact_nom" type="text" name="contact_nom" required autocomplete="family-name" placeholder="Tremblay" aria-describedby="rr-passport-hint">
                        </label>
                        <label class="rr-field" for="p1_dob">
                            <span>Date de naissance ${reqMark()}</span>
                            <input class="rr-input" id="p1_dob" type="date" name="p1_dob" required autocomplete="bday">
                        </label>
                        <label class="rr-field" for="contact_email">
                            <span>Courriel ${reqMark()}</span>
                            <input class="rr-input" id="contact_email" type="email" name="contact_email" required autocomplete="email" placeholder="marie@exemple.com">
                        </label>
                        <label class="rr-field rr-field-full" for="contact_phone">
                            <span>Téléphone ${reqMark()}</span>
                            <input class="rr-input" id="contact_phone" type="tel" name="contact_phone" required autocomplete="tel" placeholder="514-555-0000">
                        </label>
                        <label class="rr-field rr-field-full" for="address">
                            <span>Adresse ${reqMark()}</span>
                            <input class="rr-input" id="address" type="text" name="address" required autocomplete="address-line1" placeholder="123 rue des Érables">
                        </label>
                        <label class="rr-field rr-field-full" for="address2">
                            <span>Adresse 2 (optionnel)</span>
                            <input class="rr-input" id="address2" type="text" name="address2" autocomplete="address-line2" placeholder="Apt 4B">
                        </label>
                    </div>
                    <div class="rr-grid rr-grid-city">
                        <label class="rr-field" for="city">
                            <span>Ville ${reqMark()}</span>
                            <input class="rr-input" id="city" type="text" name="city" required autocomplete="address-level2" placeholder="Montréal">
                        </label>
                        <label class="rr-field" for="province">
                            <span>Province ${reqMark()}</span>
                            <input class="rr-input" id="province" type="text" name="province" required autocomplete="address-level1" placeholder="QC">
                        </label>
                        <label class="rr-field" for="postal_code">
                            <span>Code postal ${reqMark()}</span>
                            <input class="rr-input" id="postal_code" type="text" name="postal_code" required autocomplete="postal-code" placeholder="H2X 1Y3">
                        </label>
                    </div>
                    <div class="rr-stack-fields rr-billing">
                        <p class="rr-hint" id="rr-cc-address-hint">Adresse de facturation telle qu’elle apparaît sur le relevé de la carte de crédit.</p>
                        <label class="rr-check" for="cc-address-same">
                            <input type="checkbox" id="cc-address-same" name="cc_address_same" value="true">
                            <span>Utiliser la même adresse que ci-dessus</span>
                        </label>
                        <label class="rr-field" for="credit_card_address">
                            <span>Adresse de la carte de crédit ${reqMark()}</span>
                            <textarea class="rr-input rr-textarea rr-textarea-short" id="credit_card_address" name="credit_card_address" rows="3" required autocomplete="billing street-address" aria-describedby="rr-cc-address-hint" placeholder="Numéro, rue, ville, province, code postal"></textarea>
                        </label>
                    </div>
                </section>

                <section class="rr-card" aria-labelledby="rr-others-title">
                    <div class="rr-card-head">
                        <h2 class="rr-card-title" id="rr-others-title">
                            <i class="fa-solid fa-user-group" aria-hidden="true"></i>
                            Autres voyageurs
                        </h2>
                        <button type="button" class="rr-btn-add" id="rr-add-traveler">+ Ajouter</button>
                    </div>
                    <div class="rr-alert" role="note">
                        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                        <p>Indiquez le nom exactement comme sur leurs passeports.</p>
                    </div>
                    <p class="rr-hint" id="rr-others-hint">${escapeHtml(extraHint)}</p>
                    <div id="rr-extra-list" class="rr-stack"></div>
                    <p class="rr-empty" id="rr-extra-empty">Aucun autre voyageur ajouté.</p>
                </section>

                ${kidsSectionHtml(kids)}

                <section class="rr-card" aria-labelledby="rr-insurance-title">
                    <div class="rr-card-head">
                        <h2 class="rr-card-title" id="rr-insurance-title">
                            <i class="fa-solid fa-shield-heart" aria-hidden="true"></i>
                            Assurances et documents
                        </h2>
                    </div>
                    <div class="rr-stack-fields">
                        <label class="rr-field" for="assurance_medicale">
                            <span>Tous les voyageurs sont-ils couverts par une assurance voyage incluant les soins médicaux d’urgence ? ${reqMark()}</span>
                            ${selectHtml('assurance_medicale', YES_NO, true)}
                        </label>
                        <label class="rr-field" for="passeport_valide">
                            <span>Le passeport de chaque voyageur est-il valide au moins 6 mois après la date de retour prévue ? ${reqMark()}</span>
                            ${selectHtml('passeport_valide', YES_NO, true)}
                        </label>
                        <label class="rr-field" for="assurance_annulation">
                            <span>Désirez-vous une assurance voyage Annulation ? ${reqMark()}</span>
                            ${selectHtml('assurance_annulation', YES_NO, true)}
                        </label>
                    </div>
                </section>

                <section class="rr-card" aria-labelledby="rr-notes-title">
                    <div class="rr-card-head">
                        <h2 class="rr-card-title" id="rr-notes-title">
                            <i class="fa-solid fa-clipboard" aria-hidden="true"></i>
                            Notes
                        </h2>
                    </div>
                    <div class="rr-stack-fields">
                        <label class="rr-field" for="conseiller_voyage">
                            <span>Si vous avez un conseiller Voyages Fiesta veuillez inscrire son nom</span>
                            <input class="rr-input" id="conseiller_voyage" type="text" name="conseiller_voyage" autocomplete="off" placeholder="Nom de votre conseiller">
                        </label>
                        <label class="rr-field" for="notes_extra">
                            <span>Notes ou demandes particulières</span>
                            <textarea class="rr-input rr-textarea" id="notes_extra" name="notes_extra" rows="4" placeholder="Allergies, besoins spéciaux, questions..."></textarea>
                        </label>
                    </div>
                </section>

                <section class="rr-card rr-card-terms">
                    <label class="rr-check">
                        <input type="checkbox" name="terms_and_conditions" value="true" required>
                        <span>J’ai lu et j’accepte les termes et conditions du document 001-554 et je confirme que toutes les informations fournies sont exactes. ${reqMark()}</span>
                    </label>
                </section>

                <p id="rr-form-error" class="rr-error hidden" role="alert"></p>
                <div class="rr-actions${hideSubmit ? ' hidden' : ''}">
                    <button type="submit" class="rr-btn-primary" id="rr-submit">RÉSERVER MAINTENANT</button>
                </div>
            </form>`;
    }

    function collectKids(form) {
        return [...form.querySelectorAll('[data-kid-row]')].map((row, idx) => ({
            index: idx + 1,
            prenom: row.querySelector('[name^="kid_prenom"]')?.value?.trim() || '',
            nom: row.querySelector('[name^="kid_nom"]')?.value?.trim() || '',
            dob: formatDobForGhl(row.querySelector('[name^="kid_dob"]')?.value)
        })).filter((kid) => kid.prenom || kid.nom || kid.dob);
    }

    function collectKidsNotes(form) {
        return collectKids(form).map((kid) => (
            `Enfant ${kid.index}: ${[kid.prenom, kid.nom].filter(Boolean).join(' ')}` +
            (kid.dob ? ` | ${kid.dob}` : '')
        )).join('\n');
    }

    function collectExtraTravelers(form) {
        return [...form.querySelectorAll('[data-extra-traveler]')].map((card, i) => ({
            index: i + 2,
            prenom: card.querySelector('[name^="extra_prenom_"]')?.value?.trim() || '',
            nom: card.querySelector('[name^="extra_nom_"]')?.value?.trim() || '',
            dob: formatDobForGhl(card.querySelector('[name^="extra_dob_"]')?.value)
        })).filter(t => t.prenom || t.nom || t.dob);
    }

    function formDataToPayload(form) {
        const fd = new FormData(form);
        const get = (name) => String(fd.get(name) || '').trim();
        const count = Math.max(1, Number(get('nombre_passagers')) || 1);
        const extras = collectExtraTravelers(form);

        const payload = {
            nombre_passagers: String(count),
            depot: get('depot'),
            p1_prenom: get('contact_prenom'),
            p1_nom: get('contact_nom'),
            p1_phone: get('contact_phone'),
            p1_email: get('contact_email'),
            p1_dob: formatDobForGhl(get('p1_dob')),
            address: get('address'),
            address2: get('address2'),
            city: get('city'),
            province: get('province'),
            postal_code: get('postal_code'),
            credit_card_address: get('credit_card_address'),
            cc_address_same: form.querySelector('[name="cc_address_same"]')?.checked ? 'true' : '',
            assurance_medicale: get('assurance_medicale'),
            passeport_valide: get('passeport_valide'),
            assurance_annulation: get('assurance_annulation'),
            payment_responsible: get('payment_responsible') || `${get('contact_prenom')} ${get('contact_nom')}`.trim(),
            infopassager: 'Oui',
            terms_and_conditions: form.querySelector('[name="terms_and_conditions"]')?.checked ? 'true' : '',
            conseiller_voyage: get('conseiller_voyage')
        };

        extras.forEach((traveler) => {
            if (traveler.index > MAX_STRUCTURED_PASSENGERS) return;
            payload[`p${traveler.index}_prenom`] = traveler.prenom;
            payload[`p${traveler.index}_nom`] = traveler.nom;
            payload[`p${traveler.index}_dob`] = traveler.dob;
        });

        const kids = collectKids(form);
        payload.nombre_enfants = String(kids.length || get('nombre_enfants') || '0');
        kids.forEach((kid) => {
            payload[`kid_${kid.index}_prenom`] = kid.prenom;
            payload[`kid_${kid.index}_nom`] = kid.nom;
            payload[`kid_${kid.index}_dob`] = kid.dob;
        });

        payload.notes_extra = get('notes_extra');
        payload.notes = payload.notes_extra;

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

    function mergeReservationPayload(formPayload, draft = {}) {
        const bookingContext = draft.bookingContext || {};
        const adults = draft.adults != null ? String(draft.adults) : '';
        const kids = draft.kids != null ? String(draft.kids) : '';
        return {
            ...bookingContext,
            ...formPayload,
            forfait_slug: bookingContext.forfait_slug || draft.productSlug || formPayload.forfait_slug,
            forfait_name: bookingContext.forfait_name || draft.productName || formPayload.forfait_name,
            depot_total: formPayload.depot || bookingContext.depot_total,
            nombre_personnes: formPayload.nombre_passagers || bookingContext.nombre_personnes,
            nombre_adultes: bookingContext.nombre_adultes || adults,
            nombre_enfants_2_12: bookingContext.nombre_enfants_2_12 || kids,
            occupation: bookingContext.occupation || formPayload.occupation || '',
            sommaire: formPayload.sommaire || bookingContext.sommaire || draft.pricingSummary || '',
            conseiller_name: bookingContext.conseiller_name,
            conseiller_email: bookingContext.conseiller_email,
            conseiller_phone: bookingContext.conseiller_phone,
            conseiller_tag: bookingContext.conseiller_tag,
            agent_id: bookingContext.agent_id,
            agent_slug: bookingContext.agent_slug,
            contact_tags: bookingContext.contact_tags,
            conseiller_voyage: formPayload.conseiller_voyage
        };
    }

    function cleanupDrafts() {
        const cutoff = Date.now() - DRAFT_TTL_MS;
        try {
            Object.keys(localStorage).forEach((key) => {
                if (!key.startsWith(DRAFT_KEY_PREFIX)) return;
                try {
                    const data = JSON.parse(localStorage.getItem(key) || '{}');
                    if (!data.savedAt || data.savedAt < cutoff) localStorage.removeItem(key);
                } catch (_) {
                    localStorage.removeItem(key);
                }
            });
        } catch (_) { /* private mode */ }
    }

    function saveReservationDraft(draft) {
        cleanupDrafts();
        const sid = (global.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : `draft-${Date.now()}`;
        try {
            localStorage.setItem(DRAFT_KEY_PREFIX + sid, JSON.stringify({
                ...draft,
                savedAt: Date.now()
            }));
        } catch (_) { /* ignore quota */ }
        return sid;
    }

    function loadReservationDraft(sid) {
        if (!sid) return null;
        try {
            const raw = localStorage.getItem(DRAFT_KEY_PREFIX + sid);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data.savedAt && Date.now() - data.savedAt > DRAFT_TTL_MS) {
                localStorage.removeItem(DRAFT_KEY_PREFIX + sid);
                return null;
            }
            return data;
        } catch (_) {
            return null;
        }
    }

    function reservationPageUrl(draft, sid) {
        const url = new URL('room-registration.html', global.location.href);
        if (sid) url.searchParams.set('sid', sid);
        const slug = draft?.productSlug || '';
        if (slug) {
            url.searchParams.set('slug', slug);
            url.searchParams.set('forfait_slug', slug);
        }
        if (draft?.adults) url.searchParams.set('adults', String(draft.adults));
        if (draft?.kids != null) url.searchParams.set('kids', String(draft.kids));
        return url;
    }

    function isFramed() {
        try {
            return global.self !== global.top;
        } catch (_) {
            return true;
        }
    }

    function clickNavigate(href, target) {
        const a = document.createElement('a');
        a.href = href;
        a.target = target;
        if (target === '_blank') a.rel = 'noopener noreferrer';
        a.setAttribute('aria-hidden', 'true');
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    /**
     * Page pleine sans toucher à WordPress.
     * Dans l’iframe cross-origin (voyagefiesta.com), top.location est bloqué → nouvel onglet.
     */
    function navigateFullPage(url) {
        const href = String(url);

        if (!isFramed()) {
            global.location.assign(href);
            return 'self';
        }

        // Nouvel onglet = page complète sur aubaineexpress, sans script côté WP.
        try {
            clickNavigate(href, '_blank');
            return 'blank';
        } catch (_) { /* ignore */ }

        try {
            const win = global.open(href, '_blank', 'noopener,noreferrer');
            if (win) return 'blank-open';
        } catch (_) { /* ignore */ }

        // Dernier recours : formulaire dans l’iframe
        global.location.assign(href);
        return 'iframe-self';
    }

    function openReservationWindow(draft) {
        const sid = saveReservationDraft(draft || {});
        const url = reservationPageUrl(draft, sid);
        navigateFullPage(url.toString());
        return url;
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
            pricingSummary = '',
            onSubmit,
            summaryHtml = '',
            hideSubmit = false
        } = options;

        const perPerson = depositPerPerson != null && Number.isFinite(Number(depositPerPerson))
            ? Number(depositPerPerson)
            : null;

        root.innerHTML = `
            ${summaryHtml ? `<div class="rr-summary">${summaryHtml}</div>` : ''}
            ${formHtml(initialPassengerCount, initialKidsCount, hideSubmit)}
        `;

        const form = root.querySelector('#room-registration-form');
        const extraList = form.querySelector('#rr-extra-list');
        const extraEmpty = form.querySelector('#rr-extra-empty');
        const addBtn = form.querySelector('#rr-add-traveler');
        const adultsInput = form.querySelector('[name="nombre_adultes"]');
        const totalInput = form.querySelector('[name="nombre_passagers"]');
        const depotValue = form.querySelector('#rr-depot-value');
        const payInput = form.querySelector('#rr-payment-responsible');
        const errorEl = form.querySelector('#rr-form-error');

        const adultCount = Math.min(
            MAX_STRUCTURED_PASSENGERS,
            Math.max(1, Number(adultsInput?.value) || Number(initialPassengerCount) || 1)
        );
        const totalPeople = Math.max(
            adultCount,
            Number(totalInput?.value) || (adultCount + Math.max(0, Number(initialKidsCount) || 0))
        );

        let extraSeq = 0;

        function showError(message) {
            if (!errorEl) return;
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }

        function clearError() {
            if (!errorEl) return;
            errorEl.classList.add('hidden');
            errorEl.textContent = '';
        }

        function updateDepot() {
            if (!depotValue) return;
            if (perPerson == null) {
                depotValue.value = '';
                return;
            }
            depotValue.value = String(Math.round(perPerson * totalPeople * 100) / 100);
        }

        function syncPaymentResponsible() {
            if (!payInput) return;
            const p = form.querySelector('[name="contact_prenom"]')?.value || '';
            const n = form.querySelector('[name="contact_nom"]')?.value || '';
            payInput.value = `${p} ${n}`.trim();
        }

        function composeHomeAddress() {
            const line1 = form.querySelector('[name="address"]')?.value?.trim() || '';
            const line2 = form.querySelector('[name="address2"]')?.value?.trim() || '';
            const city = form.querySelector('[name="city"]')?.value?.trim() || '';
            const province = form.querySelector('[name="province"]')?.value?.trim() || '';
            const postal = form.querySelector('[name="postal_code"]')?.value?.trim() || '';
            return [line1, line2, [city, province].filter(Boolean).join(', '), postal]
                .filter(Boolean)
                .join('\n');
        }

        function syncCreditCardAddress() {
            const same = form.querySelector('#cc-address-same');
            const field = form.querySelector('#credit_card_address');
            if (!same || !field) return;
            if (same.checked) {
                field.value = composeHomeAddress();
                field.readOnly = true;
            } else {
                field.readOnly = false;
            }
        }

        function extraCount() {
            return extraList.querySelectorAll('[data-extra-traveler]').length;
        }

        function refreshExtraState() {
            const n = extraCount();
            extraEmpty?.classList.toggle('hidden', n > 0);
            if (addBtn) addBtn.disabled = n >= MAX_EXTRA_TRAVELERS;
        }

        function addTraveler() {
            if (extraCount() >= MAX_EXTRA_TRAVELERS) return;
            extraSeq += 1;
            extraList.insertAdjacentHTML('beforeend', extraTravelerHtml(extraSeq));
            refreshExtraState();
            extraList.querySelector(`[data-extra-traveler="${extraSeq}"] input`)?.focus();
        }

        extraList?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-remove-traveler]');
            if (!btn) return;
            btn.closest('[data-extra-traveler]')?.remove();
            refreshExtraState();
        });

        addBtn?.addEventListener('click', addTraveler);

        form.querySelector('[name="contact_prenom"]')?.addEventListener('input', syncPaymentResponsible);
        form.querySelector('[name="contact_nom"]')?.addEventListener('input', syncPaymentResponsible);
        form.querySelector('#cc-address-same')?.addEventListener('change', syncCreditCardAddress);
        ['address', 'address2', 'city', 'province', 'postal_code'].forEach((name) => {
            form.querySelector(`[name="${name}"]`)?.addEventListener('input', syncCreditCardAddress);
        });

        updateDepot();
        syncPaymentResponsible();
        syncCreditCardAddress();
        refreshExtraState();

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            clearError();
            syncCreditCardAddress();
            if (!form.checkValidity()) {
                form.reportValidity();
                showError('Veuillez corriger les champs indiqués avant d’envoyer.');
                return;
            }
            syncPaymentResponsible();
            updateDepot();
            const payload = formDataToPayload(form);
            if (pricingSummary) payload.sommaire = pricingSummary;

            if (typeof onSubmit === 'function') {
                onSubmit({
                    payload,
                    ghlUrl: buildGhlRoomFormUrl(payload),
                    form
                });
                return;
            }

            const thankYou = typeof global.buildGhlThankYouUrl === 'function'
                ? global.buildGhlThankYouUrl('')
                : 'thank-you.html';
            submitGhlRoomForm({ payload, redirectUrl: thankYou }).catch((err) => {
                showError(err?.message
                    || 'Le formulaire est temporairement indisponible. Veuillez réessayer plus tard.');
            });
        });

        return { form, updateDepot };
    }

    const css = `
.rr-form { display: flex; flex-direction: column; gap: 1.25rem; }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
.rr-summary {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 1rem;
  padding: 1.1rem 1.25rem; font-size: 0.875rem; color: #374151; line-height: 1.55;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}
.rr-card {
  background: #fff; border: 1px solid #e8eef3; border-radius: 1rem;
  padding: 1.5rem 1.6rem 1.65rem; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}
.rr-card-terms { padding: 1.2rem 1.4rem; background: #F3F7FA; }
.rr-card-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.85rem; margin-bottom: 1rem;
}
.rr-card-title {
  font-size: 1.15rem; font-weight: 700; color: #025091;
  margin: 0; display: flex; align-items: center; gap: 0.65rem;
}
.rr-card-title i { color: #025091; font-size: 1rem; }
.rr-req { color: #dc2626; font-weight: 700; }
.rr-req-legend {
  margin: 0 0 0.15rem; font-size: 0.8rem; font-weight: 500; color: #6b7280;
}
.rr-alert {
  display: flex; gap: 0.7rem; align-items: flex-start;
  background: #FFF6E5; border-radius: 0.75rem; padding: 0.8rem 0.95rem;
  color: #7A5416; font-size: 0.875rem; line-height: 1.45; margin-bottom: 1.15rem;
}
.rr-alert i { color: #E38B2A; margin-top: 0.12rem; }
.rr-alert p { margin: 0; font-weight: 500; }
.rr-hint {
  font-size: 0.8rem; font-weight: 500; color: #6b7280;
  margin: -0.35rem 0 0.9rem; line-height: 1.45;
}
.rr-empty {
  margin: 0.35rem 0 0; font-size: 0.875rem; color: #9ca3af; font-style: italic;
}
.rr-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  column-gap: 1.1rem; row-gap: 1.2rem;
}
.rr-grid-city {
  grid-template-columns: 1.2fr 0.55fr 0.7fr;
  margin-top: 1.2rem;
}
.rr-stack-fields { display: flex; flex-direction: column; gap: 1.2rem; }
.rr-field {
  display: flex; flex-direction: column; gap: 0.45rem;
  font-size: 0.875rem; font-weight: 700; color: #1f3b57;
  line-height: 1.4;
}
.rr-field-full { grid-column: 1 / -1; }
.rr-input, .rr-textarea {
  font-family: inherit; font-size: 0.95rem; font-weight: 500;
  border: 1px solid #d7dee7; border-radius: 0.7rem;
  padding: 0.85rem 0.95rem; background: #fff; color: #1f2937; width: 100%;
  min-height: 2.85rem; line-height: 1.4;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
select.rr-input {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236b7280' d='M1.4.6 6 5.2 10.6.6 12 2 6 8 0 2z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1.05rem center;
  padding-right: 2.5rem;
}
.rr-textarea { min-height: 7rem; resize: vertical; line-height: 1.55; }
.rr-textarea-short { min-height: 5.5rem; }
.rr-billing { margin-top: 1.35rem; padding-top: 1.2rem; border-top: 1px solid #e8eef3; }
.rr-input:focus, .rr-textarea:focus {
  outline: none; border-color: #025091;
  box-shadow: 0 0 0 3px rgba(2, 80, 145, 0.15);
}
.rr-input::placeholder, .rr-textarea::placeholder { color: #9ca3af; font-weight: 400; }
.rr-stack { display: flex; flex-direction: column; gap: 1rem; }
.rr-extra-card, .rr-kid-row {
  background: #F7FAFC; border: 1px solid #e5e7eb; border-radius: 0.85rem;
  padding: 1.1rem 1.15rem;
}
.rr-extra-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.75rem; margin-bottom: 1rem;
}
.rr-extra-title {
  font-size: 0.95rem; font-weight: 700; color: #025091; margin: 0;
}
.rr-check {
  display: flex; gap: 0.85rem; align-items: flex-start;
  font-size: 0.9rem; color: #374151; line-height: 1.55; font-weight: 500;
}
.rr-check input {
  margin-top: 0.2rem; width: 1.15rem; height: 1.15rem; flex-shrink: 0;
  accent-color: #F26522;
}
.rr-actions {
  display: flex; justify-content: flex-end; align-items: center;
  padding: 0.15rem 0 0.5rem;
}
.rr-actions.hidden { display: none !important; }
.rr-btn-primary {
  background: #F26522; color: #fff; font-weight: 600; border: 0;
  border-radius: 0.7rem; padding: 1rem 1.7rem; cursor: pointer;
  font-size: 0.95rem; font-family: inherit;
  transition: background-color 0.15s ease;
}
.rr-btn-primary:hover { background: #025091; }
.rr-btn-add {
  background: #025091; color: #fff; font-weight: 600; border: 0;
  border-radius: 0.55rem; padding: 0.55rem 0.9rem; cursor: pointer;
  font-size: 0.85rem; font-family: inherit; white-space: nowrap;
}
.rr-btn-add:disabled { opacity: 0.45; cursor: not-allowed; }
.rr-btn-remove {
  background: transparent; color: #6b7280; border: 0; cursor: pointer;
  font-size: 0.8rem; font-weight: 600; font-family: inherit;
  text-decoration: underline; text-underline-offset: 2px;
}
.rr-btn-remove:hover { color: #b91c1c; }
.rr-error {
  color: #b91c1c; font-size: 0.875rem; background: #fef2f2;
  border: 1px solid #fecaca; border-radius: 0.65rem; padding: 1rem 1.1rem;
  line-height: 1.45;
}
.rr-error.hidden, .hidden { display: none !important; }
@media (max-width: 640px) {
  .rr-grid, .rr-grid-city { grid-template-columns: 1fr; column-gap: 0; row-gap: 1.05rem; }
  .rr-card { padding: 1.2rem 1.1rem 1.3rem; }
  .rr-card-head { flex-wrap: wrap; }
  .rr-btn-primary, .rr-btn-add { width: 100%; text-align: center; }
  .rr-actions { justify-content: stretch; }
}
@media (prefers-reduced-motion: reduce) {
  .rr-input, .rr-textarea, .rr-btn-primary { transition: none; }
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
        mergeReservationPayload,
        formatDobForGhl,
        injectStyles,
        saveReservationDraft,
        loadReservationDraft,
        openReservationWindow,
        navigateFullPage
    };
})(typeof window !== 'undefined' ? window : globalThis);
