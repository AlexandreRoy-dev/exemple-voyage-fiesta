import assert from 'node:assert/strict';
import { createServer as createHttp } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createServer } from './server.mjs';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function startFakeGhl({ usersStatus = 200, products = [], staff = null } = {}) {
  const calls = [];
  const server = createHttp((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const body = raw ? JSON.parse(raw) : null;
      const url = new URL(req.url, 'http://127.0.0.1');
      calls.push({ method: req.method, path: url.pathname, search: url.search, body });
      const send = (status, payload) => {
        const data = JSON.stringify(payload);
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(data);
      };
      if (url.pathname === '/products.json') return send(200, { products });
      if (url.pathname === '/staff.json') {
        return send(200, { agents: staff || [{ slug: 'eric-lacasse', id: 'user-eric' }] });
      }
      if (req.method === 'GET' && url.pathname === '/users/') {
        if (usersStatus !== 200) return send(usersStatus, { message: 'nope' });
        return send(200, {
          users: [
            { id: 'userKevin123', name: 'Kevin Watier' },
            { id: 'owner-keep', name: 'Owner' },
            { id: 'userGone1234', name: 'Parti', deleted: true }
          ]
        });
      }
      if (url.pathname === '/contacts/search/duplicate') {
        const email = url.searchParams.get('email') || '';
        if (email.includes('unowned@')) {
          return send(200, { contact: { id: 'c-unowned', email } });
        }
        if (email.includes('owned@')) {
          return send(200, { contact: { id: 'c-owned', assignedTo: 'owner-keep', email } });
        }
        return send(200, { contacts: [] });
      }
      if (req.method === 'POST' && url.pathname === '/contacts/upsert') {
        return send(200, { contact: { id: 'c-new', assignedTo: body?.assignedTo || '' } });
      }
      if (req.method === 'GET' && /^\/contacts\/[^/]+$/.test(url.pathname)) {
        return send(200, { contact: { id: url.pathname.split('/')[2], assignedTo: '' } });
      }
      if (req.method === 'PUT' && /^\/contacts\/[^/]+$/.test(url.pathname)) return send(200, { ok: true });
      if (url.pathname.endsWith('/tags')) return send(200, { tagsAdded: body?.tags || [] });
      if (url.pathname.endsWith('/notes')) return send(200, { ok: true });
      if (url.pathname === '/conversations/messages') return send(200, { id: 'msg-1' });
      if (req.method === 'POST' && url.pathname === '/contacts/') {
        return send(200, { contact: { id: 'c-notify' } });
      }
      send(404, { message: 'unexpected' });
    });
  });
  const port = await listen(server);
  return { server, calls, port };
}

function apiEnv(fake, extra = {}) {
  return {
    GHL_API_KEY: 'pit-test',
    GHL_LOCATION_ID: 'loc-test',
    GHL_API_BASE: `http://127.0.0.1:${fake.port}`,
    GHL_BLOCK_LIVE: '1',
    GHL_TAG_DELAY_MS: '0',
    PRODUCTS_JSON_URL: `http://127.0.0.1:${fake.port}/products.json`,
    STAFF_JSON_URL: `http://127.0.0.1:${fake.port}/staff.json`,
    INTERNAL_NOTIFY_EMAILS: '',
    GHL_GROUPE_NOTIFY: '0',
    GHL_GROUPE_DEFAULT_OWNER: '',
    DRY_RUN: '0',
    ...extra
  };
}

async function post(port, body, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  return { status: response.status, json, headers: response.headers };
}

const groupePayload = {
  request_type: 'demande_groupe',
  groupe_id: '661',
  groupe_titre: 'Noël au Costa Rica, tout inclus',
  groupe_type: 'sud',
  forfait_name: 'Noël au Costa Rica, tout inclus',
  destination: 'Liberia',
  country: 'Costa Rica',
  departure_date: '2026-12-21',
  duration_nights: '7',
  prix_appel: '2959',
  hotel: 'Riu Guanacaste',
  groupe_url: 'https://aubaineexpress.voyagefiesta.ca/groupes/groupe/?id=661',
  full_name: 'Marie Tremblay',
  p1_prenom: 'Marie',
  p1_nom: 'Tremblay',
  email: 'marie@example.com',
  phone: '5145550199',
  message: 'Deux adultes, chambre double.',
  terms_and_conditions: 'true',
  contact_tag: 'demande-prix'
};

test('dry_run returns the groupe payload and never calls GHL', async () => {
  const fake = await startFakeGhl();
  const api = createServer(apiEnv(fake, { DRY_RUN: '1', GHL_GROUPE_DEFAULT_OWNER: 'user-default' }));
  const port = await listen(api);
  try {
    const { status, json } = await post(port, { payload: groupePayload });
    assert.equal(status, 200);
    assert.equal(json.dryRun, true);
    assert.equal(json.requestType, 'demande_groupe');
    assert.deepEqual(json.tags, ['demande-groupe', 'groupe-661']);
    assert.equal(json.tags.includes('demande-prix'), false);
    assert.equal(json.contact.source, 'Site groupes Atrium');
    assert.equal(json.contact.assignedTo, 'user-default');
    assert.match(json.note, /Source: Site groupes Atrium/);
    assert.match(json.note, /Noël au Costa Rica/);
    assert.match(json.note, /2959/);
    assert.equal(json.notify, false);
    assert.equal(fake.calls.length, 0);
  } finally {
    await close(api);
    await close(fake.server);
  }
});

test('request flag dry_run works even when the server is live-configured', async () => {
  const fake = await startFakeGhl();
  const api = createServer(apiEnv(fake));
  const port = await listen(api);
  try {
    const { json } = await post(port, { payload: { ...groupePayload, dry_run: true } });
    assert.equal(json.dryRun, true);
    assert.equal(fake.calls.length, 0);
  } finally {
    await close(api);
    await close(fake.server);
  }
});

test('demande_groupe adds both tags, keeps an existing owner, and skips demande-prix', async () => {
  const fake = await startFakeGhl();
  const api = createServer(apiEnv(fake, {
    GHL_GROUPE_DEFAULT_OWNER: 'user-default',
    GHL_GROUPE_NOTIFY: '1',
    INTERNAL_NOTIFY_EMAILS: 'alex@example.com'
  }));
  const port = await listen(api);
  try {
    const { status, json } = await post(port, {
      payload: { ...groupePayload, email: 'owned@example.com' }
    });
    assert.equal(status, 200);
    assert.equal(json.dryRun, undefined);
    assert.equal(json.assignedTo, 'owner-keep');
    assert.deepEqual(json.tags, ['demande-groupe', 'groupe-661']);
    const upsert = fake.calls.find((call) => call.path === '/contacts/upsert');
    assert.equal(upsert.body.assignedTo, undefined);
    assert.equal(upsert.body.source, 'Site groupes Atrium');
    const tagPosts = fake.calls.filter((call) => call.method === 'POST' && call.path.endsWith('/tags'));
    const applied = tagPosts.flatMap((call) => call.body.tags);
    assert.deepEqual(applied, ['demande-groupe', 'groupe-661']);
    const dumped = JSON.stringify(fake.calls);
    assert.equal(dumped.includes('demande-prix'), false);
    assert.equal(dumped.includes('leadconnectorhq.com'), false);
    assert.ok(fake.calls.some((call) => call.path === '/conversations/messages'));
  } finally {
    await close(api);
    await close(fake.server);
  }
});

test('GHL_GROUPE_NOTIFY=0 skips the internal email and assigns the default owner only when free', async () => {
  const fake = await startFakeGhl();
  const api = createServer(apiEnv(fake, {
    GHL_GROUPE_DEFAULT_OWNER: 'user-default',
    GHL_GROUPE_NOTIFY: '0',
    INTERNAL_NOTIFY_EMAILS: 'alex@example.com'
  }));
  const port = await listen(api);
  try {
    const { json } = await post(port, {
      payload: { ...groupePayload, email: 'fresh@example.com', contact_tag: '' }
    });
    assert.equal(json.assignedTo, 'user-default');
    assert.deepEqual(json.notifyEmails, []);
    assert.equal(fake.calls.some((call) => call.path === '/conversations/messages'), false);
    const upsert = fake.calls.find((call) => call.path === '/contacts/upsert');
    assert.equal(upsert.body.assignedTo, 'user-default');
  } finally {
    await close(api);
    await close(fake.server);
  }
});

test('quickform and demande_prix still route tags, source, and agent_slug', async () => {
  const fake = await startFakeGhl();
  const api = createServer(apiEnv(fake));
  const port = await listen(api);
  try {
    const quick = await post(port, {
      payload: {
        request_type: 'quickform',
        full_name: 'Paul Roy',
        p1_prenom: 'Paul',
        p1_nom: 'Roy',
        email: 'paul@example.com',
        agent_slug: 'eric-lacasse'
      }
    });
    assert.equal(quick.json.requestType, 'quickform');
    assert.deepEqual(quick.json.tags, ['quickform']);
    assert.equal(quick.json.assignedTo, 'user-eric');
    const quickUpsert = fake.calls.find((call) => call.path === '/contacts/upsert');
    assert.equal(quickUpsert.body.source, 'Site formulaire rapide');

    fake.calls.length = 0;
    const price = await post(port, {
      payload: {
        request_type: 'demande_prix',
        full_name: 'Lucie Gagnon',
        email: 'lucie@example.com',
        forfait_name: 'Majestic',
        contact_tag: 'demande-prix',
        contact_tags: ['suivi-manuel']
      }
    });
    assert.equal(price.json.requestType, 'demande_prix');
    assert.deepEqual(price.json.tags, ['demande-prix', 'suivi-manuel']);
    const priceUpsert = fake.calls.find((call) => call.path === '/contacts/upsert');
    assert.equal(priceUpsert.body.source, 'Site demande de prix');
  } finally {
    await close(api);
    await close(fake.server);
  }
});

test('default origins allow the Fiesta sites and serve groupes.json', async () => {
  const fake = await startFakeGhl();
  const dir = mkdtempSync(join(tmpdir(), 'groupes-json-'));
  const file = join(dir, 'groupes.json');
  const api = createServer(apiEnv(fake, { GROUPES_JSON_PATH: file, ALLOWED_ORIGINS: '' }));
  const port = await listen(api);
  try {
    const allowed = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: { Origin: 'https://www.voyagefiesta.com' }
    });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://www.voyagefiesta.com');
    const blocked = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: { Origin: 'https://evil.example' }
    });
    assert.notEqual(blocked.headers.get('access-control-allow-origin'), 'https://evil.example');
    const missing = await fetch(`http://127.0.0.1:${port}/groupes.json`);
    assert.equal(missing.status, 404);
    writeFileSync(file, JSON.stringify({ groups: [{ id: 661 }] }));
    const ready = await fetch(`http://127.0.0.1:${port}/groupes.json`);
    assert.equal(ready.status, 200);
    const body = await ready.json();
    assert.equal(body.groups[0].id, 661);
  } finally {
    await close(api);
    await close(fake.server);
  }
});

const fbLead = {
  lead_ref: 'kevin-watier',
  lead_ghl_user: 'userKevin123',
  lead_utm_source: 'facebook',
  lead_utm_medium: 'page',
  lead_utm_campaign: 'fb-2026-10-22'
};

const reservationPayload = {
  request_type: 'demande_prix',
  p1_prenom: 'Julie',
  p1_nom: 'Gagnon',
  forfait_slug: 'forfait-x',
  forfait_name: 'Forfait X',
  agent_slug: 'eric-lacasse'
};

async function runSubmit(payload, fakeOpts = {}) {
  const { defaultOwner, ...ghlOpts } = fakeOpts;
  const fake = await startFakeGhl(ghlOpts);
  const api = createServer(apiEnv(fake, defaultOwner ? { GHL_GROUPE_DEFAULT_OWNER: 'user-default' } : {}));
  const port = await listen(api);
  try {
    const result = await post(port, { payload });
    return { ...result, calls: fake.calls };
  } finally {
    await close(api);
    await close(fake.server);
  }
}

test('fb link: new contact is assigned to the validated ghl_user, tagged and noted', async () => {
  const { status, json, calls } = await runSubmit({ ...reservationPayload, ...fbLead, email: 'new@example.com' });
  assert.equal(status, 200);
  assert.equal(json.assignedTo, 'userKevin123');
  assert.ok(json.tags.includes('fb-kevin-watier'));
  assert.ok(json.tags.includes('demande-prix'));
  const upsert = calls.find((c) => c.path === '/contacts/upsert');
  assert.equal(upsert.body.assignedTo, 'userKevin123');
  const note = calls.find((c) => c.path.endsWith('/notes'));
  assert.match(note.body.body, /Page Facebook \(ref\): kevin-watier/);
  assert.match(note.body.body, /UTM: facebook \/ page \/ fb-2026-10-22/);
  assert.ok(calls.some((c) => c.path === '/users/' && c.search.includes('locationId=loc-test')));
});

test('fb link: an existing owner is never reassigned', async () => {
  const { json, calls } = await runSubmit({ ...reservationPayload, ...fbLead, email: 'owned@example.com' });
  assert.equal(json.assignedTo, 'owner-keep');
  const upsert = calls.find((c) => c.path === '/contacts/upsert');
  assert.equal(upsert.body.assignedTo, undefined);
  assert.ok(!calls.some((c) => c.method === 'PUT'));
  assert.ok(json.tags.includes('fb-kevin-watier'));
});

test('fb link: existing contact without owner gets the ghl_user', async () => {
  const { json, calls } = await runSubmit({ ...reservationPayload, ...fbLead, email: 'unowned@example.com' });
  assert.equal(json.assignedTo, 'userKevin123');
  const upsert = calls.find((c) => c.path === '/contacts/upsert');
  assert.equal(upsert.body.assignedTo, 'userKevin123');
});

test('fb link: unknown, deleted or malformed ghl_user falls back to the usual owner', async () => {
  for (const ghlUser of ['userNotHere1', 'userGone1234', 'bad id!']) {
    const { json, calls } = await runSubmit({ ...reservationPayload, ...fbLead, lead_ghl_user: ghlUser, email: 'new@example.com' });
    // staff.json maps eric-lacasse to user-eric (the behaviour before this change).
    assert.equal(json.assignedTo, 'user-eric', ghlUser);
    assert.equal(calls.find((c) => c.path === '/contacts/upsert').body.assignedTo, 'user-eric');
  }
});

test('fb link: users lookup failure is ignored, lead still created', async () => {
  const { status, json } = await runSubmit({ ...reservationPayload, ...fbLead, email: 'new@example.com' }, { usersStatus: 401 });
  assert.equal(status, 200);
  assert.equal(json.assignedTo, 'user-eric');
  assert.ok(json.tags.includes('fb-kevin-watier'));
});

test('no fb link: same tags, owner and note as before, and no users lookup', async () => {
  const { json, calls } = await runSubmit({ ...reservationPayload, email: 'new@example.com' });
  assert.deepEqual(json.tags, ['demande-prix']);
  assert.equal(json.assignedTo, 'user-eric');
  assert.ok(!calls.some((c) => c.path === '/users/'));
  const note = calls.find((c) => c.path.endsWith('/notes'));
  assert.doesNotMatch(note.body.body, /Provenance/);
});

test('fb link on demande_groupe assigns the agent and adds the fb tag', async () => {
  const { json } = await runSubmit({ ...groupePayload, ...fbLead, email: 'new@example.com' });
  assert.equal(json.assignedTo, 'userKevin123');
  assert.ok(json.tags.includes('demande-groupe'));
  assert.ok(json.tags.includes('fb-kevin-watier'));
  assert.ok(!json.tags.includes('demande-prix'));
});

test('demande_groupe honors agent_slug and keeps an existing owner', async () => {
  const assigned = await runSubmit({
    ...groupePayload,
    email: 'fresh@example.com',
    agent_slug: 'eric-lacasse'
  }, { defaultOwner: true });
  assert.equal(assigned.json.assignedTo, 'user-eric');

  const kept = await runSubmit({
    ...groupePayload,
    email: 'owned@example.com',
    agent_slug: 'eric-lacasse',
    lead_ghl_user: 'userKevin123',
    lead_ref: 'kevin-watier'
  });
  assert.equal(kept.json.assignedTo, 'owner-keep');
  assert.equal(kept.calls.find((call) => call.path === '/contacts/upsert').body.assignedTo, undefined);
});

test('shared-link ref slug wins over the voyage owner and over agent_slug', async () => {
  const { json } = await runSubmit({
    ...reservationPayload,
    email: 'new@example.com',
    lead_ref: 'eric-lacasse',
    lead_ghl_user: '',
    agent_slug: 'other-agent',
    forfait_slug: 'forfait-x'
  }, {
    products: [{ slug: 'forfait-x', ownerId: 'user-voyage' }]
  });
  assert.equal(json.assignedTo, 'user-eric');
});

test('demande_groupe: shared-link agent wins over agent_slug, unknown slug uses the default', async () => {
  const shared = await runSubmit({
    ...groupePayload,
    email: 'fresh@example.com',
    lead_ref: 'eric-lacasse',
    agent_slug: 'other-agent'
  }, { defaultOwner: true });
  assert.equal(shared.json.assignedTo, 'user-eric');

  const fallback = await runSubmit({
    ...groupePayload,
    email: 'fresh2@example.com',
    agent_slug: 'personne-inconnue'
  }, { defaultOwner: true });
  assert.equal(fallback.json.assignedTo, 'user-default');
});

test('dry_run groupe with agent_slug resolves staff and does not call GHL contacts', async () => {
  const fake = await startFakeGhl();
  const api = createServer(apiEnv(fake, { DRY_RUN: '1', GHL_GROUPE_DEFAULT_OWNER: 'user-default' }));
  const port = await listen(api);
  try {
    const { json } = await post(port, {
      payload: { ...groupePayload, agent_slug: 'eric-lacasse' }
    });
    assert.equal(json.dryRun, true);
    assert.equal(json.assignedTo, 'user-eric');
    assert.equal(fake.calls.some((call) => call.path.startsWith('/contacts')), false);
  } finally {
    await close(api);
    await close(fake.server);
  }
});

test('dry_run shows the fb link values without calling GHL', async () => {
  const fake = await startFakeGhl();
  const api = createServer(apiEnv(fake, { DRY_RUN: '1' }));
  const port = await listen(api);
  try {
    const { json } = await post(port, { payload: { ...reservationPayload, ...fbLead, email: 'new@example.com' } });
    assert.equal(json.dryRun, true);
    assert.equal(json.assignedTo, 'userKevin123');
    assert.deepEqual(json.leadRef, { ref: 'kevin-watier', ghlUser: 'userKevin123', validated: false });
    assert.ok(json.tags.includes('fb-kevin-watier'));
    assert.equal(fake.calls.length, 0);
  } finally {
    await close(api);
    await close(fake.server);
  }
});

test('quickform notes keep the trip request and consent without the room form', async () => {
  const fake = await startFakeGhl();
  const api = createServer(apiEnv(fake));
  const port = await listen(api);
  try {
    await post(port, {
      payload: {
        request_type: 'quickform',
        p1_prenom: 'Paul',
        p1_nom: 'Roy',
        p1_email: 'paul@example.com',
        p1_phone: '5145550100',
        destination: 'Portugal',
        departure_date: '2027-05-01',
        return_date: '2027-05-10',
        nombre_adultes: '2',
        nombre_enfants: '1',
        message: 'Une semaine en mai.',
        terms_and_conditions: 'true',
        agent_slug: 'eric-lacasse',
        agent_id: 'user-eric'
      }
    });
    const upsert = fake.calls.find((call) => call.path === '/contacts/upsert');
    const note = (upsert.body.customFields || []).find((field) => field.key === 'note_reservation_interne');
    assert.ok(note);
    assert.match(note.field_value, /Portugal/);
    assert.match(note.field_value, /2027-05-01/);
    assert.match(note.field_value, /Une semaine en mai/);
    assert.match(note.field_value, /case cochée/);
    assert.equal(note.field_value.includes('Adresse'), false);
    assert.equal(upsert.body.assignedTo, 'user-eric');
  } finally {
    await close(api);
    await close(fake.server);
  }
});
