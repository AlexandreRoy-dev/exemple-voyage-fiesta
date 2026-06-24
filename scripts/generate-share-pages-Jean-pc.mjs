#!/usr/bin/env node
/** Regenerate share/*.html from products.json (no GHL credentials required). */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSharePages } from './share-pages.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const productsPath = resolve(__dirname, '..', 'products.json');
const payload = JSON.parse(readFileSync(productsPath, 'utf8'));
const products = Array.isArray(payload.products) ? payload.products : [];

writeSharePages(products);
