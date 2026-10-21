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

async function startFakeGhl() {
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
      if (url.pathname === '/products.json') return send(200, { products: [] });
      if (url.pathname === '/staff.json') {
        return send(200, { agents: [{ slug: 'eric-lacasse', id: 'user-eric' }] });
      }
      if (url.pathname === '/contacts/search/duplicate') {
        const email = url.searchParams.get('email') || '';
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
