import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assemblePages } from './assemble-pages.mjs';

test('assembly isolates preview files and rejects unsafe publication inputs', () => {
  const root = mkdtempSync(join(tmpdir(), 'ajolis-pages-test-'));
  const production = join(root, 'production');
  const preview = join(root, 'preview');
  const output = join(root, 'site');
  const release = { tag: 'v0.1.0', version: '0.1.0', commit: 'a'.repeat(40) };
  const previewCommit = 'b'.repeat(40);
  const previewHtml =
    '<meta name="robots" content="noindex, nofollow"><a href="/preview/">Home</a>';
  try {
    mkdirSync(production);
    mkdirSync(preview);
    writeFileSync(
      join(production, 'index.html'),
      '<link rel="canonical" href="https://ajolis.de/">Production',
    );
    writeFileSync(join(production, '404.html'), 'Production 404');
    writeFileSync(join(preview, 'index.html'), previewHtml);
    writeFileSync(join(preview, '404.html'), previewHtml);
    assemblePages(production, preview, output, release, previewCommit);
    assert.match(
      readFileSync(join(output, 'index.html'), 'utf8'),
      /Production/,
    );
    assert.equal(
      readFileSync(join(output, 'preview', 'index.html'), 'utf8'),
      previewHtml,
    );
    assert.equal(
      JSON.parse(readFileSync(join(output, 'build-info.json'), 'utf8'))
        .production.commit,
      release.commit,
    );
    assert.throws(
      () => assemblePages(production, preview, output, release, previewCommit),
      /already exist/,
    );
    rmSync(output, { recursive: true });
    writeFileSync(
      join(preview, 'index.html'),
      previewHtml.replace('/preview/', '/'),
    );
    assert.throws(
      () => assemblePages(production, preview, output, release, previewCommit),
      /escapes/,
    );
    writeFileSync(
      join(preview, 'index.html'),
      '<h1>Missing indexing policy</h1>',
    );
    assert.throws(
      () => assemblePages(production, preview, output, release, previewCommit),
      /noindex/,
    );
    writeFileSync(join(preview, 'index.html'), previewHtml);
    mkdirSync(join(production, 'preview'));
    assert.throws(
      () => assemblePages(production, preview, output, release, previewCommit),
      /reserved/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
