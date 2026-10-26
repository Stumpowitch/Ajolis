import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { releaseVersion, verifyRelease } from './verify-release.mjs';

const repository = 'Stumpowitch/Ajolis';
const legacyCommit = '61a5e392d4e9bf81b4a6aa0bc510f7d64b34965d';

export function checkReleaseManifest(manifest, tag, commit) {
  if (
    !/^[a-f0-9]{40}$/.test(commit) ||
    manifest.commit !== commit ||
    manifest.tag !== tag ||
    manifest.version !== releaseVersion(tag)
  )
    throw new Error(
      'Release metadata does not match the immutable tag and source commit.',
    );
  return { tag, version: manifest.version, commit };
}

export function resolveRelease(tag) {
  releaseVersion(tag);
  const run = (command, ...args) =>
    execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const git = (...args) => run('git', ...args);
  const ref = `refs/tags/${tag}`;
  if (git('cat-file', '-t', ref) !== 'tag')
    throw new Error('Release tags must be annotated.');
  const commit = git('rev-parse', `${ref}^{commit}`);
  git('merge-base', '--is-ancestor', commit, 'refs/remotes/origin/main');
  const release = JSON.parse(
    run('gh', 'api', `repos/${repository}/releases/tags/${tag}`),
  );
  if (release.draft || release.prerelease || !release.immutable)
    throw new Error('Only published immutable stable releases can deploy.');
  run('gh', 'release', 'verify', tag, '--repo', repository);
  // The existing immutable bootstrap release predates workflow attestations.
  // This exact tag and commit retain the original TPM verification requirement.
  if (tag === 'v0.1.0' && commit === legacyCommit)
    return verifyRelease(tag, process.env.RELEASE_SIGNERS);
  const temporary = mkdtempSync(join(tmpdir(), 'ajolis-attestation-'));
  try {
    run(
      'gh',
      'release',
      'download',
      tag,
      '--repo',
      repository,
      '--pattern',
      'release.json',
      '--dir',
      temporary,
    );
    const manifestPath = join(temporary, 'release.json');
    run(
      'gh',
      'release',
      'verify-asset',
      tag,
      manifestPath,
      '--repo',
      repository,
    );
    run(
      'gh',
      'attestation',
      'verify',
      manifestPath,
      '--repo',
      repository,
      '--signer-workflow',
      `${repository}/.github/workflows/release.yml`,
      '--source-ref',
      'refs/heads/main',
      '--source-digest',
      commit,
      '--deny-self-hosted-runners',
    );
    return checkReleaseManifest(
      JSON.parse(readFileSync(manifestPath, 'utf8')),
      tag,
      commit,
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.stdout.write(JSON.stringify(resolveRelease(process.argv[2])) + '\n');
