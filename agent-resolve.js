/**
 * Resolves the advisor carried by a shared link (ghl_user, then ref slug)
 * against staff.json. Unknown users are ignored.
 *
 *   VFAgent.prepare(url)     fetch staff and remember the match
 *   VFAgent.current()        matched staff profile or null
 *   VFAgent.resolve(list, hint)
 *   VFAgent.cardHtml(agent, { voyage })
 *   VFAgent.shareUrl(url, agent, utm)
 */
(function (global) {
    'use strict';

    var REF_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
    var USER_RE = /^[A-Za-z0-9]{8,40}$/;
    var UTM_RE = /^[A-Za-z0-9._-]{1,60}$/;
    var currentAgent = null;
    var prepared = null;

    function clean(value, re) {
        var v = String(value == null ? '' : value).trim();
        return re.test(v) ? v : '';
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function readHint(search, stored) {
        var raw = search;
        if (raw == null) raw = global.location ? global.location.search : '';
        var params;
        try {
            params = new URLSearchParams(raw || '');
        } catch (_) {
            params = new URLSearchParams();
        }
        var fromUrl = {
            ghlUser: clean(params.get('ghl_user'), USER_RE),
            ref: clean(String(params.get('ref') || '').toLowerCase(), REF_RE)
        };
        if (fromUrl.ghlUser || fromUrl.ref) return fromUrl;
        var memory = stored || null;
        if (!memory && global.VFLeadRef && typeof global.VFLeadRef.get === 'function') {
            memory = global.VFLeadRef.get();
        }
        if (!memory) return { ghlUser: '', ref: '' };
        return {
            ghlUser: clean(memory.ghl_user || memory.ghlUser, USER_RE),
            ref: clean(String(memory.ref || memory.lead_ref || '').toLowerCase(), REF_RE)
        };
    }

    function byId(agents, id) {
        var wanted = String(id || '');
        if (!wanted) return null;
        var i;
        for (i = 0; i < (agents || []).length; i += 1) {
            if (String(agents[i] && agents[i].id || '') === wanted) return agents[i];
        }
        return null;
    }

    function bySlug(agents, slug) {
        var wanted = String(slug || '').trim().toLowerCase();
        if (!wanted) return null;
        var i;
        for (i = 0; i < (agents || []).length; i += 1) {
            var agentSlug = String(agents[i] && agents[i].slug || '').trim().toLowerCase();
            if (agentSlug && agentSlug === wanted) return agents[i];
        }
        return null;
    }

    function profile(agent) {
        if (!agent || !agent.id || !agent.slug) return null;
        return {
            id: String(agent.id),
            slug: String(agent.slug),
            name: String(agent.name || '').trim(),
            email: String(agent.email || '').trim(),
            phone: String(agent.phone || agent.phoneOverride || '').trim(),
            photo: String(agent.photo || '').trim()
        };
    }

    function resolve(agents, hint) {
        var source = hint || { ghlUser: '', ref: '' };
        if (source.ghlUser) {
            var byUser = profile(byId(agents, source.ghlUser));
            if (byUser) return byUser;
        }
        if (source.ref) {
            var byRef = profile(bySlug(agents, source.ref));
            if (byRef) return byRef;
        }
        return null;
    }

    function firstName(name) {
        var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        return parts[0] || 'moi';
    }

    function initial(name) {
        var word = firstName(name);
        var chars = Array.from(word);
        return chars.length ? chars[0].toLocaleUpperCase('fr-CA') : '?';
    }

    function cardHtml(agent, options) {
        var person = profile(agent);
        if (!person || !person.name) return '';
        var voyage = options && options.voyage ? String(options.voyage).trim() : '';
        var media = person.photo
            ? '<img class="vf-agent__photo" src="' + esc(person.photo) + '" alt="' + esc(person.name) + '">'
            : '<span class="vf-agent__initial" aria-hidden="true">' + esc(initial(person.name)) + '</span>';
        var contacts = '';
        if (person.phone) {
            contacts += '<a href="tel:' + esc(person.phone) + '">' + esc(person.phone) + '</a>';
        }
        if (person.email) {
            contacts += '<a href="mailto:' + esc(person.email) + '">' + esc(person.email) + '</a>';
        }
        var voyageLine = voyage
            ? '<p class="vf-agent__voyage">Voyage: ' + esc(voyage) + '</p>'
            : '';
        return '<section class="vf-agent" aria-labelledby="vf-agent-title">'
            + '<h2 id="vf-agent-title" class="vf-agent__title">Votre conseiller(ère)</h2>'
            + '<div class="vf-agent__row">' + media
            + '<div><p class="vf-agent__name">' + esc(person.name) + '</p>'
            + (contacts ? '<p class="vf-agent__links">' + contacts + '</p>' : '')
            + '</div></div>'
            + voyageLine
            + '<button type="button" class="vf-agent__btn" data-agent-contact>Contacter '
            + esc(firstName(person.name)) + '</button>'
            + '</section>';
    }

    function shareUrl(url, agent, extra) {
        var person = agent ? profile(agent) : null;
        var base;
        try {
            base = new URL(String(url || ''), 'https://aubaineexpress.voyagefiesta.ca/');
        } catch (_) {
            return String(url || '');
        }
        if (!person) return base.href;
        base.searchParams.set('ref', person.slug);
        if (person.id) base.searchParams.set('ghl_user', person.id);
        var utm = extra || {};
        ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (key) {
            var value = clean(utm[key], UTM_RE);
            if (value) base.searchParams.set(key, value);
        });
        return base.href;
    }

    function current() {
        return currentAgent;
    }

    function prepare(staffUrl, search) {
        if (prepared) return prepared;
        var hint = readHint(
            search == null && global.location ? global.location.search : search,
            null
        );
        if (!hint.ghlUser && !hint.ref) {
            currentAgent = null;
            prepared = Promise.resolve(null);
            return prepared;
        }
        prepared = fetch(staffUrl || 'staff.json', { cache: 'no-store' })
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (data) {
                var list = data && Array.isArray(data.agents) ? data.agents : [];
                currentAgent = resolve(list, hint);
                return currentAgent;
            })
            .catch(function () {
                currentAgent = null;
                return null;
            });
        return prepared;
    }

    function resetForTests() {
        currentAgent = null;
        prepared = null;
    }

    global.VFAgent = {
        readHint: readHint,
        resolve: resolve,
        profile: profile,
        firstName: firstName,
        initial: initial,
        cardHtml: cardHtml,
        shareUrl: shareUrl,
        current: current,
        prepare: prepare,
        resetForTests: resetForTests,
        REF_RE: REF_RE,
        USER_RE: USER_RE
    };
})(typeof window !== 'undefined' ? window : globalThis);
