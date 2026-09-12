/** Regenerate staff.json + quickform/*.html from GHL users or an existing staff.json. */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeQuickformPages } from './quickform-pages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const STAFF_PATH = resolve(ROOT, 'staff.json');

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function reserveSlug(base, userId, used) {
  let slug = base || slugify(String(userId || '').slice(0, 8)) || 'agent';
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }
  const suffix = slugify(String(userId || '').slice(-4)) || String(userId || '').slice(-4).toLowerCase();
  slug = `${base}-${suffix}`;
  let n = 2;
  while (used.has(slug)) {
    slug = `${base}-${suffix || n}-${n}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}

async function fetchUsers() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) return null;
  const url = new URL('https://services.leadconnectorhq.com/users/');
  url.searchParams.set('locationId', locationId);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: '2021-07-28',
      Accept: 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`GHL users HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return { locationId, users: data.users || data.data || [] };
}

function profilesFromUsers(users, previous) {
  const used = new Set();
  const prevById = {};
  for (const agent of previous || []) {
    if (agent.id && agent.slug) prevById[agent.id] = agent;
  }
  return users.map((user) => {
    const id = String(user.id || '').trim();
    const first = String(user.firstName || '').trim();
    const last = String(user.lastName || '').trim();
    const name = [first, last].filter(Boolean).join(' ') || user.name || id;
    const previousSlug = prevById[id]?.slug || '';
    const slug = previousSlug && !used.has(previousSlug)
      ? (used.add(previousSlug), previousSlug)
      : reserveSlug(slugify([first, last].filter(Boolean).join(' ')) || slugify(name), id, used);
    return {
      id,
      name,
      email: String(user.email || prevById[id]?.email || '').trim(),
      phone: String(user.phone || user.phoneNumber || prevById[id]?.phone || '').trim(),
      slug
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

const previous = (() => {
  try {
    return JSON.parse(readFileSync(STAFF_PATH, 'utf8')).agents || [];
  } catch {
    return [];
  }
})();

const live = await fetchUsers();
const agents = live
  ? profilesFromUsers(live.users, previous)
  : previous;

if (!agents.length) {
  console.error('No staff profiles. Set GHL_API_KEY + GHL_LOCATION_ID or add staff.json.');
  process.exit(1);
}

writeFileSync(STAFF_PATH, JSON.stringify({
  updatedAt: new Date().toISOString(),
  source: 'ghl',
  locationId: live?.locationId || '',
  agents
}, null, 2) + '\n', 'utf8');
writeQuickformPages(agents);
console.log(`staff.json: ${agents.length} conseiller(s)`);
