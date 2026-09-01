/**
 * Fail CI if api.js throws on load (takes the boutique to 0 forfaits).
 * Run: node scripts/check-api-loads.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'api.js'), 'utf8');
const sandbox = {
    window: {
        PRODUCTS_JSON_URL: 'products.json',
        MAX_ADULT_COUNT_SELECT: 5,
        MAX_CHILD_COUNT_SELECT: 3,
        location: { search: '', pathname: '/', origin: 'http://localhost' }
    },
    console
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const api = sandbox.window.VoyageFiestaAPI;
if (!api || typeof api.fetchProducts !== 'function') {
    console.error('check-api-loads: VoyageFiestaAPI.fetchProducts missing after load');
    process.exit(1);
}
if (typeof api.getListingDisplayPrice !== 'function') {
    console.error('check-api-loads: VoyageFiestaAPI incomplete (getListingDisplayPrice)');
    process.exit(1);
}
console.log('check-api-loads: ok');
