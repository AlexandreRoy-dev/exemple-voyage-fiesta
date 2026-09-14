#!/usr/bin/env node
/** Build destination/topic SEO pages, robots.txt and sitemap.xml from local JSON. */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSeoPages } from './seo-pages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadAgents(file) {
  try {
    const data = JSON.parse(readFileSync(resolve(ROOT, file), 'utf8'));
    return data.agents || data.staff || data.users || [];
  } catch {
    return [];
  }
}

const products = JSON.parse(readFileSync(resolve(ROOT, 'products.json'), 'utf8')).products || [];
const staff = loadAgents('staff.json');
const agents = staff.length ? staff : loadAgents('agents.json');

writeSeoPages({ products, staff: agents });
