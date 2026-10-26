import assert from 'node:assert/strict';
import test from 'node:test';
import { changelog, nextVersion } from './prepare-release.mjs';

test('release numbering uses all reserved stable tags and never reuses a version', () => {
  assert.equal(nextVersion([], 'patch', '0.1.0'), '0.1.0');
  const tags = ['v0.1.9', 'v0.1.10', 'v0.2.0-rc.1', 'feature', 'v00.9.0'];
  assert.equal(nextVersion(tags, 'patch', '0.1.0'), '0.1.11');
  assert.equal(nextVersion(tags, 'minor', '0.1.0'), '0.2.0');
  assert.equal(nextVersion(tags, 'major', '0.1.0'), '1.0.0');
  assert.throws(() => nextVersion([], 'invalid', '0.1.0'));
  assert.throws(() => nextVersion(['v9007199254740992.0.0'], 'patch', '0.1.0'));
});

test('release notes group commits, escape markup, and link the comparison', () => {
  const text = changelog(
    [
      { sha: 'a'.repeat(40), subject: 'feat(site): add navigation' },
      { sha: 'b'.repeat(40), subject: 'fix: escape <script>' },
    ],
    'v0.1.0',
    'v0.1.1',
    'Stumpowitch/Ajolis',
  );
  assert.match(text, /## Features/);
  assert.match(text, /## Fixes/);
  assert.ok(!text.includes('<script>'));
  assert.match(text, /compare\/v0.1.0\.\.\.v0.1.1/);
  assert.throws(() =>
    changelog(
      [{ sha: 'invalid', subject: 'test' }],
      '',
      'v0.1.0',
      'Stumpowitch/Ajolis',
    ),
  );
});
