import assert from 'node:assert/strict';
import test from 'node:test';
import { checkReleaseManifest } from './resolve-release.mjs';

test('attested metadata must bind the requested version to the exact tag commit', () => {
  const commit = 'a'.repeat(40);
  const manifest = { tag: 'v0.1.1', version: '0.1.1', commit };
  assert.deepEqual(checkReleaseManifest(manifest, 'v0.1.1', commit), manifest);
  assert.throws(() => checkReleaseManifest(manifest, 'v0.1.2', commit));
  assert.throws(() =>
    checkReleaseManifest({ ...manifest, version: '0.1.0' }, 'v0.1.1', commit),
  );
  assert.throws(() => checkReleaseManifest(manifest, 'v0.1.1', 'b'.repeat(40)));
  assert.throws(() =>
    checkReleaseManifest({ ...manifest, commit: 'short' }, 'v0.1.1', 'short'),
  );
});
