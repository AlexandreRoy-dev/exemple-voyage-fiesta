/**
 * Keeps the Facebook multipartage link params (ref, ghl_user, utm_*) for 30 days
 * so any form sent later carries them. Loaded on every page with a form.
 *
 *   window.VFLeadRef.get()            -> stored values or null
 *   window.VFLeadRef.attach(payload)  -> copy of payload with lead_* keys added
 *
 * A new link with ref or ghl_user replaces the stored values (last click).
 * The server validates ghl_user and never reassigns an owned contact.
 */
(function (global) {
    'use strict';

    var KEY = 'vf_lead_ref';
    var MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
    var REF_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
    var USER_RE = /^[A-Za-z0-9]{8,40}$/;
    var UTM_RE = /^[A-Za-z0-9._-]{1,60}$/;

    function clean(value, re) {
        var v = String(value == null ? '' : value).trim();
        return re.test(v) ? v : '';
    }

    function store() {
        try {
            var s = global.localStorage;
            var probe = '__vf_probe';
            s.setItem(probe, '1');
            s.removeItem(probe);
            return s;
        } catch (_) {
            return null;
        }
    }

    function read() {
        var s = store();
        if (!s) return null;
        try {
            var data = JSON.parse(s.getItem(KEY) || 'null');
            if (!data || typeof data !== 'object') return null;
            if (!data.savedAt || Date.now() - data.savedAt > MAX_AGE_MS) {
                s.removeItem(KEY);
                return null;
            }
            return data;
        } catch (_) {
            return null;
        }
    }

    function capture(search) {
        var params;
        try {
            params = new URLSearchParams(search == null ? global.location.search : search);
        } catch (_) {
            return read();
        }
        var ref = clean(String(params.get('ref') || '').toLowerCase(), REF_RE);
        var ghlUser = clean(params.get('ghl_user'), USER_RE);
        if (!ref && !ghlUser) return read();
        var data = {
            ref: ref,
            ghl_user: ghlUser,
            utm_source: clean(params.get('utm_source'), UTM_RE),
            utm_medium: clean(params.get('utm_medium'), UTM_RE),
            utm_campaign: clean(params.get('utm_campaign'), UTM_RE),
            savedAt: Date.now()
        };
        var s = store();
        if (s) {
            try { s.setItem(KEY, JSON.stringify(data)); } catch (_) { /* quota or private mode */ }
        }
        memory = data;
        return data;
    }

    var memory = null;

    function get() {
        return read() || memory;
    }

    function attach(payload) {
        var out = {};
        var key;
        for (key in payload || {}) {
            if (Object.prototype.hasOwnProperty.call(payload, key)) out[key] = payload[key];
        }
        var data = get();
        if (!data) return out;
        var put = function (name, value) {
            if (value && (out[name] === undefined || out[name] === null || out[name] === '')) out[name] = value;
        };
        put('lead_ref', data.ref);
        put('lead_ghl_user', data.ghl_user);
        put('lead_utm_source', data.utm_source);
        put('lead_utm_medium', data.utm_medium);
        put('lead_utm_campaign', data.utm_campaign);
        if (data.savedAt) put('lead_saved_at', new Date(data.savedAt).toISOString());
        return out;
    }

    capture();
    global.VFLeadRef = { get: get, attach: attach, capture: capture, KEY: KEY, MAX_AGE_MS: MAX_AGE_MS };
})(typeof window !== 'undefined' ? window : globalThis);
