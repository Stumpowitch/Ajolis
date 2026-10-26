import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function releaseVersion(tag) {
  if (
    typeof tag !== 'string' ||
    tag.trim() !== tag ||
    !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)
  ) {
    throw new Error('Release tags must use stable vMAJOR.MINOR.PATCH syntax.');
  }
  return tag.slice(1);
}

export function verifyRelease(tag, signers, cwd = process.cwd()) {
  const version = releaseVersion(tag);
  if (!signers?.trim()) throw new Error('RELEASE_SIGNERS is required.');
  const git = (...args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const ref = `refs/tags/${tag}`;
  if (git('cat-file', '-t', ref) !== 'tag') {
    throw new Error('Release tags must be annotated and SSH-signed.');
  }
  const temporary = mkdtempSync(join(tmpdir(), 'ajolis-release-'));
  try {
    const allowedSigners = join(temporary, 'allowed_signers');
    writeFileSync(allowedSigners, signers + '\n', { mode: 0o600 });
    git(
      '-c',
      'gpg.format=ssh',
      '-c',
      `gpg.ssh.allowedSignersFile=${allowedSigners}`,
      'verify-tag',
      ref,
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  const commit = git('rev-parse', `${ref}^{commit}`);
  git('merge-base', '--is-ancestor', commit, 'refs/remotes/origin/main');
  const manifest = JSON.parse(git('show', `${ref}:package.json`));
  const lock = JSON.parse(git('show', `${ref}:package-lock.json`));
  if (
    manifest.version !== version ||
    lock.version !== version ||
    lock.packages[''].version !== version
  ) {
    throw new Error(
      'The release tag, package version, and lockfile version must agree.',
    );
  }
  return { tag, version, commit };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const tag = process.argv[2];
  const result = verifyRelease(tag, process.env.RELEASE_SIGNERS);
  // Read the event only when present; direct local verification needs no GitHub context.
  if (process.env.GITHUB_EVENT_NAME === 'release') {
    const { release } = JSON.parse(
      readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'),
    );
    if (release.draft || release.prerelease)
      throw new Error('Only published stable releases can deploy.');
  }
  process.stdout.write(JSON.stringify(result) + '\n');
}
