import assert from 'node:assert/strict';
import test from 'node:test';
import { MIRRORED_MEDIA_BASE, catalogImage, nextFallback } from './images.mjs';

const PRIMARY = 'https://api.voyagefiesta.ca/voyage-fiesta-reservation/media';
const LEGACY = 'https://dashboard.codesurmesure.ca/voyage-fiesta-reservation/media';
const NAME = 'abc123def4567890abcd.jpg';
const remote = 'https://vascoinc.com/upimg/bateau/5914_Bateau.jpg';

test('the primary media mirror is api.voyagefiesta.ca', () => {
  assert.equal(MIRRORED_MEDIA_BASE, PRIMARY);
});

test('mirrored photos use the primary mirror, then the old one, then the remote photo', () => {
  const chain = { src: `${PRIMARY}/${NAME}`, fallback: `${LEGACY}/${NAME} ${remote}` };
  assert.deepEqual(catalogImage(`${LEGACY}/${NAME}`, { imageSource: remote }), chain);
  assert.deepEqual(catalogImage(`${PRIMARY}/${NAME}`, { imageSource: remote }), chain);
  assert.deepEqual(catalogImage({ url: `${LEGACY}/${NAME}`, source: remote, alt: 'Navire' }), chain);
  assert.deepEqual(catalogImage(NAME), { src: `${PRIMARY}/${NAME}`, fallback: `${LEGACY}/${NAME}` });
});

test('other photos are left as they are', () => {
  assert.deepEqual(catalogImage(remote), { src: remote, fallback: '' });
  assert.deepEqual(catalogImage('', { imageSource: remote }), { src: remote, fallback: '' });
  assert.deepEqual(catalogImage(''), { src: '', fallback: '' });
  assert.deepEqual(catalogImage('/img/local.jpg'), { src: '/img/local.jpg', fallback: '' });
});

test('a custom apiBases list drives the mirrors', () => {
  const cfg = { apiBases: ['https://a.example/r'] };
  assert.deepEqual(catalogImage(`${LEGACY}/${NAME}`, {}, cfg), { src: `${LEGACY}/${NAME}`, fallback: '' });
  assert.deepEqual(catalogImage(NAME, {}, cfg), { src: `https://a.example/r/media/${NAME}`, fallback: '' });
});

test('nextFallback walks the list and skips the current URL', () => {
  assert.deepEqual(nextFallback('b c', 'a'), { next: 'b', rest: 'c' });
  assert.deepEqual(nextFallback('a b', 'a'), { next: 'b', rest: '' });
  assert.deepEqual(nextFallback('', 'a'), { next: '', rest: '' });
});
