import {
  chmodSync,
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function checkPreview(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) checkPreview(path);
    else if (entry.name.endsWith('.html')) {
      const html = readFileSync(path, 'utf8');
      if (!html.includes('content="noindex, nofollow"'))
        throw new Error(`Missing preview noindex: ${path}`);
      for (const [, url] of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
        if (!url.startsWith('/preview/'))
          throw new Error(`Preview link escapes its base path: ${url}`);
      }
    }
  }
}

export function assemblePages(
  production,
  preview,
  output,
  release,
  previewCommit,
) {
  if (
    !/^[a-f0-9]{40}$/.test(release.commit) ||
    !/^[a-f0-9]{40}$/.test(previewCommit)
  ) {
    throw new Error('Build provenance requires full Git commit IDs.');
  }
  if (existsSync(output))
    throw new Error('The output directory must not already exist.');
  if (existsSync(join(production, 'preview')))
    throw new Error('The /preview/ path is reserved.');
  for (const directory of [production, preview]) {
    for (const file of ['index.html', '404.html']) {
      if (!existsSync(join(directory, file)))
        throw new Error(`Missing ${file} in ${directory}`);
    }
  }
  checkPreview(preview);
  const home = readFileSync(join(production, 'index.html'), 'utf8');
  if (
    !home.includes('href="https://ajolis.de/"') ||
    home.includes('content="noindex, nofollow"')
  ) {
    throw new Error(
      'Production must have the root canonical URL and allow indexing.',
    );
  }
  cpSync(production, output, { recursive: true, dereference: true });
  chmodSync(output, 0o755);
  cpSync(preview, join(output, 'preview'), {
    recursive: true,
    dereference: true,
  });
  writeFileSync(join(output, '.nojekyll'), '');
  writeFileSync(
    join(output, 'build-info.json'),
    JSON.stringify(
      { production: release, preview: { commit: previewCommit } },
      null,
      2,
    ) + '\n',
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [production, preview, output, metadata, previewCommit] =
    process.argv.slice(2);
  if (!production || !preview || !output || !metadata)
    throw new Error(
      'Expected production, preview, output, metadata, and preview commit arguments.',
    );
  assemblePages(
    resolve(production),
    resolve(preview),
    resolve(output),
    JSON.parse(readFileSync(metadata, 'utf8')),
    previewCommit,
  );
}
