import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('publication preflight is read-only and stale sources cannot create releases', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ajolis-publish-test-'));
  const commit = 'a'.repeat(40);
  try {
    writeFileSync(
      join(directory, 'release.json'),
      JSON.stringify({ tag: 'v0.1.1', version: '0.1.1', commit }),
    );
    // Substitute the external API boundary; no real GitHub writes occur.
    writeFileSync(
      join(directory, 'gh'),
      `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const body = args.includes('--input') ? JSON.parse(fs.readFileSync(0, 'utf8')) : undefined;
fs.appendFileSync(process.env.FIXTURE_LOG, JSON.stringify({args, body}) + '\\n');
if (args[0] === 'api') {
  const path = args[1];
  if (path.endsWith('/git/ref/heads/main')) console.log(JSON.stringify({object:{sha:process.env.FIXTURE_MAIN}}));
  else if (path.endsWith('/git/tags')) console.log(JSON.stringify({sha:'b'.repeat(40)}));
  else if (path.includes('/releases/tags/')) console.log(JSON.stringify({immutable:process.env.FIXTURE_IMMUTABLE === 'true'}));
  else if (path.endsWith('/git/refs')) console.log('{}');
  else process.exit(42);
}
`,
      { mode: 0o700 },
    );
    const execute = (check, overrides = {}) => {
      const log = join(directory, 'calls.jsonl');
      writeFileSync(log, '');
      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('./publish-release.mjs', import.meta.url)),
          directory,
          ...(check ? ['--check'] : []),
        ],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: directory,
            GITHUB_REPOSITORY: 'Stumpowitch/Ajolis',
            GITHUB_REF: 'refs/heads/main',
            GITHUB_SHA: commit,
            FIXTURE_MAIN: commit,
            FIXTURE_IMMUTABLE: 'true',
            FIXTURE_LOG: log,
            ...overrides,
          },
        },
      );
      const calls = readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      return { result, calls };
    };
    const checked = execute(true);
    assert.equal(checked.result.status, 0, checked.result.stderr);
    assert.ok(
      checked.calls.every(
        ({ args }) => args[0] === 'api' && !args.includes('--method'),
      ),
    );
    const stale = execute(false, { FIXTURE_MAIN: 'c'.repeat(40) });
    assert.notEqual(stale.result.status, 0);
    assert.match(stale.result.stderr, /Main changed/);
    assert.ok(stale.calls.every(({ args }) => !args.includes('--method')));
    const branch = execute(false, { GITHUB_REF: 'refs/heads/untrusted' });
    assert.notEqual(branch.result.status, 0);
    assert.equal(branch.calls.length, 0);
    const published = execute(false);
    assert.equal(published.result.status, 0, published.result.stderr);
    assert.equal(
      published.calls.find(({ body }) => body?.type === 'commit').body.object,
      commit,
    );
    const creation = published.calls.findIndex(
      ({ args }) =>
        args[0] === 'release' &&
        args[1] === 'create' &&
        args.includes('--draft'),
    );
    const publication = published.calls.findIndex(
      ({ args }) =>
        args[0] === 'release' &&
        args[1] === 'edit' &&
        args.includes('--draft=false'),
    );
    assert.ok(creation >= 0 && publication > creation);
    const mutable = execute(false, { FIXTURE_IMMUTABLE: 'false' });
    assert.notEqual(mutable.result.status, 0);
    assert.match(mutable.result.stderr, /not immutable/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
