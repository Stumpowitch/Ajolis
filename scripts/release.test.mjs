import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { releaseVersion, verifyRelease } from './verify-release.mjs';

test('release names accept stable semantic versions only', () => {
  assert.equal(releaseVersion('v0.1.0'), '0.1.0');
  for (const value of [
    '1.0.0',
    'v01.2.3',
    'v1.2.3-rc.1',
    'v1.2',
    '../main',
    'v1.2.3\n',
  ]) {
    assert.throws(() => releaseVersion(value));
  }
});

test('release verification checks signatures, ancestry, and version consistency', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ajolis-release-test-'));
  const run = (command, ...args) =>
    execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
      },
    }).trim();
  const git = (...args) => run('git', ...args);
  try {
    // This temporary fixture key never signs project history or release tags.
    run(
      'ssh-keygen',
      '-q',
      '-t',
      'ed25519',
      '-N',
      '',
      '-f',
      join(cwd, 'fixture-key'),
    );
    git('init', '-b', 'main');
    git('config', 'user.name', 'Release test');
    git('config', 'user.email', 'fixture@example.invalid');
    git('config', 'gpg.format', 'ssh');
    git('config', 'user.signingkey', join(cwd, 'fixture-key'));
    git('config', 'commit.gpgsign', 'true');
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify({ version: '0.1.0' }),
    );
    writeFileSync(
      join(cwd, 'package-lock.json'),
      JSON.stringify({
        version: '0.1.0',
        packages: { '': { version: '0.1.0' } },
      }),
    );
    git('add', 'package.json', 'package-lock.json');
    git('commit', '-m', 'test: create release fixture');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('tag', '-s', 'v0.1.0', '-m', 'Release fixture');
    const signers = `fixture@example.invalid namespaces="git" ${readFileSync(join(cwd, 'fixture-key.pub'), 'utf8').trim()}`;
    assert.equal(
      verifyRelease('v0.1.0', signers, cwd).commit,
      git('rev-parse', 'HEAD'),
    );
    assert.throws(() => verifyRelease('v0.1.0', '', cwd), /RELEASE_SIGNERS/);
    assert.throws(() => verifyRelease('v0.1.0', 'untrusted invalid-key', cwd));
    git('tag', 'v0.2.0');
    assert.throws(() => verifyRelease('v0.2.0', signers, cwd), /annotated/);
    git('tag', '-s', 'v0.2.1', '-m', 'Mismatched version');
    assert.throws(() => verifyRelease('v0.2.1', signers, cwd), /must agree/);
    git('switch', '-c', 'unmerged');
    writeFileSync(join(cwd, 'feature.txt'), 'Unmerged work');
    git('add', 'feature.txt');
    git('commit', '-m', 'test: create unmerged release fixture');
    git('tag', '-s', 'v0.1.1', '-m', 'Unmerged release');
    assert.throws(() => verifyRelease('v0.1.1', signers, cwd));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
