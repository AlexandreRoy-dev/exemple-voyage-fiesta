import assert from 'node:assert/strict';
import test from 'node:test';
import { MIRRORED_MEDIA_BASE, catalogImage } from './images.mjs';

test('mirrored media URLs stay usable and keep the remote URL as fallback', () => {
  const hosted = `${MIRRORED_MEDIA_BASE}/abc123def4567890abcd.jpg`;
  const remote = 'https://vascoinc.com/upimg/bateau/5914_Bateau.jpg';
  assert.deepEqual(catalogImage(hosted, { imageSource: remote }), { src: hosted, fallback: remote });
  assert.deepEqual(catalogImage({ url: hosted, source: remote, alt: 'Navire' }), { src: hosted, fallback: remote });
  assert.deepEqual(catalogImage('abc123def4567890abcd.jpg'), {
    src: `${MIRRORED_MEDIA_BASE}/abc123def4567890abcd.jpg`,
    fallback: ''
  });
  assert.deepEqual(catalogImage(remote), { src: remote, fallback: '' });
  assert.deepEqual(catalogImage(''), { src: '', fallback: '' });
});
