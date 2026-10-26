import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { releaseVersion } from './verify-release.mjs';

export function nextVersion(tags, bump, initial) {
  if (!['patch', 'minor', 'major'].includes(bump))
    throw new Error('Invalid version increment.');
  const versions = tags
    .filter((tag) => /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag))
    .map((tag) => releaseVersion(tag).split('.').map(Number));
  if (
    versions.some((parts) => parts.some((part) => !Number.isSafeInteger(part)))
  )
    throw new Error('Version components must be safe integers.');
  if (!versions.length) return releaseVersion(`v${initial}`);
  versions.sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);
  const parts = [...versions[0]];
  const index = ['major', 'minor', 'patch'].indexOf(bump);
  parts[index] += 1;
  for (let i = index + 1; i < parts.length; i++) parts[i] = 0;
  if (!parts.every(Number.isSafeInteger)) throw new Error('Version overflow.');
  return parts.join('.');
}

export function changelog(commits, previous, tag, repository) {
  const sections = new Map();
  for (const { sha, subject } of commits) {
    if (!/^[a-f0-9]{40}$/.test(sha))
      throw new Error('Invalid changelog commit.');
    const category = subject.match(/^(\w+)(?:\([^)]*\))?!?: /)?.[1];
    const heading =
      {
        feat: 'Features',
        fix: 'Fixes',
        docs: 'Documentation',
        test: 'Tests',
        refactor: 'Refactoring',
      }[category] ?? 'Maintenance';
    if (!sections.has(heading)) sections.set(heading, []);
    const title = subject.replace(/[\\`*_{}[\]<>()#!|]/g, '\\$&');
    sections
      .get(heading)
      .push(
        `- ${title} ([${sha.slice(0, 7)}](https://github.com/${repository}/commit/${sha}))`,
      );
  }
  const body = [...sections]
    .map(([heading, lines]) => `## ${heading}\n\n${lines.join('\n')}`)
    .join('\n\n');
  return `${body}\n\n${previous ? `[Full diff](https://github.com/${repository}/compare/${previous}...${tag})` : 'Initial release.'}\n`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [bump, output] = process.argv.slice(2);
  const repository = process.env.GITHUB_REPOSITORY;
  if (
    repository !== 'Stumpowitch/Ajolis' ||
    process.env.GITHUB_REF !== 'refs/heads/main'
  )
    throw new Error('Releases must run from Stumpowitch/Ajolis main.');
  const git = (...args) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const commit = git('rev-parse', 'HEAD');
  if (commit !== process.env.GITHUB_SHA)
    throw new Error('Checkout differs from the workflow source.');
  const version = nextVersion(
    git('tag', '--list').split('\n'),
    bump,
    JSON.parse(readFileSync('package.json', 'utf8')).version,
  );
  const tag = `v${version}`;
  let previous = '';
  try {
    previous = JSON.parse(
      execFileSync('gh', ['api', `repos/${repository}/releases/latest`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    ).tag_name;
    releaseVersion(previous);
  } catch (error) {
    let response;
    try {
      response = JSON.parse(error.stdout);
    } catch {
      throw error;
    }
    if (String(response.status) !== '404') throw error;
  }
  if (previous) {
    git(
      'merge-base',
      '--is-ancestor',
      `refs/tags/${previous}^{commit}`,
      commit,
    );
    if (git('rev-parse', `refs/tags/${previous}^{commit}`) === commit)
      throw new Error('The latest release already contains this commit.');
  }
  const log = git(
    'log',
    '--no-merges',
    '--format=%H%x09%s',
    previous ? `${previous}..${commit}` : commit,
  );
  const commits = log
    ? log
        .split('\n')
        .map((line) => ({ sha: line.slice(0, 40), subject: line.slice(41) }))
    : [];
  mkdirSync(output, { recursive: true });
  writeFileSync(
    join(output, 'release.json'),
    JSON.stringify({ tag, version, commit }, null, 2) + '\n',
  );
  writeFileSync(
    join(output, 'CHANGELOG.md'),
    changelog(commits, previous, tag, repository),
  );
  console.log(JSON.stringify({ tag, version, commit }));
}
