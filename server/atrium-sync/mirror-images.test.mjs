import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { collectImageUrls, mirrorImages } from './mirror-images.mjs';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

test('remote voyage and group URLs are collected once', () => {
  const urls = collectImageUrls({
    catalog: {
      groups: [{
        image: 'https://cdn.example/a.jpg',
        images: [{ url: 'https://cdn.example/a.jpg' }, { url: 'https://cdn.example/b.jpg' }],
        hotelDetail: { image: '/assets/local.jpg' }
      }]
    },
    products: [{ img: 'assets/forfaits/x.jpg', imgRoom: 'https://cdn.example/room.png' }]
  });
  assert.deepEqual(urls.sort(), [
    'https://cdn.example/a.jpg',
    'https://cdn.example/b.jpg',
    'https://cdn.example/room.png'
  ]);
});

test('copies new images, skips unchanged bytes, and keeps the remote URL after a failure', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const server = createServer((req, res) => {
    if (req.url === '/missing.jpg') {
      res.writeHead(404);
      res.end('no');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'image/png',
      ETag: '"same"'
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(png);
  });
  const port = await listen(server);
  const mediaDir = mkdtempSync(join(tmpdir(), 'vf-mirror-'));
  const catalog = {
    groups: [{
      id: 1,
      image: `http://127.0.0.1:${port}/beach.png`,
      images: [
        { url: `http://127.0.0.1:${port}/beach.png`, alt: '' },
        { url: `http://127.0.0.1:${port}/missing.jpg`, alt: '' }
      ]
    }]
  };
  try {
    const first = await mirrorImages({
      catalog,
      mediaDir,
      publicBase: 'https://dashboard.example/media'
    });
    assert.equal(first.report.copied, 1);
    assert.equal(first.report.failed, 1);
    assert.equal(first.report.bytes, png.length);
    assert.equal(first.report.totalBytes, png.length);
    assert.equal(first.catalog.groups[0].image, 'https://dashboard.example/media/' + createHash('sha256').update(`http://127.0.0.1:${port}/beach.png`).digest('hex').slice(0, 20) + '.png');
    assert.equal(first.catalog.groups[0].images[1].url, `http://127.0.0.1:${port}/missing.jpg`);
    const file = join(mediaDir, JSON.parse(readFileSync(join(mediaDir, 'manifest.json'), 'utf8')).files[`http://127.0.0.1:${port}/beach.png`].file);
    assert.equal(statSync(file).size, png.length);

    const second = await mirrorImages({ catalog, mediaDir, publicBase: 'https://dashboard.example/media' });
    assert.equal(second.report.copied, 0);
    assert.equal(second.report.unchanged, 1);
    assert.equal(second.report.failed, 1);
    assert.equal(second.report.totalBytes, png.length);
  } finally {
    await close(server);
  }
});
