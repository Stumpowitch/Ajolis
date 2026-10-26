import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { releaseVersion } from './verify-release.mjs';

const directory = process.argv[2];
const { tag, version, commit } = JSON.parse(
  readFileSync(join(directory, 'release.json'), 'utf8'),
);
const repository = process.env.GITHUB_REPOSITORY;
if (
  repository !== 'Stumpowitch/Ajolis' ||
  process.env.GITHUB_REF !== 'refs/heads/main' ||
  commit !== process.env.GITHUB_SHA ||
  releaseVersion(tag) !== version
)
  throw new Error('Invalid release identity.');
const gh = (...args) =>
  execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();
const api = (path, body) =>
  JSON.parse(
    execFileSync(
      'gh',
      [
        'api',
        `repos/${repository}/${path}`,
        ...(body ? ['--method', 'POST', '--input', '-'] : []),
      ],
      { encoding: 'utf8', input: body ? JSON.stringify(body) : undefined },
    ),
  );
if (!api('immutable-releases').enabled)
  throw new Error('Enable immutable releases before publishing.');
if (api('git/ref/heads/main').object.sha !== commit)
  throw new Error('Main changed during validation. Start a new release run.');
const annotated = api('git/tags', {
  tag,
  message: `Release ${version}`,
  object: commit,
  type: 'commit',
});
api('git/refs', { ref: `refs/tags/${tag}`, sha: annotated.sha });
gh(
  'release',
  'create',
  tag,
  '--repo',
  repository,
  '--verify-tag',
  '--draft',
  '--title',
  tag,
  '--notes-file',
  join(directory, 'CHANGELOG.md'),
  join(directory, 'release.json'),
  join(directory, 'ajolis.tar.gz'),
  join(directory, 'SHA256SUMS'),
);
gh('release', 'edit', tag, '--repo', repository, '--draft=false', '--latest');
console.log(`Published https://github.com/${repository}/releases/tag/${tag}`);
