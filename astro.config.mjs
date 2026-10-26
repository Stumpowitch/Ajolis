import { defineConfig } from 'astro/config';

const target = process.env.DEPLOY_TARGET ?? 'production';
if (!['production', 'preview'].includes(target)) {
  throw new Error(`Unsupported DEPLOY_TARGET: ${target}`);
}

export default defineConfig({
  site: 'https://ajolis.de',
  base: target === 'preview' ? '/preview' : '/',
  trailingSlash: 'always',
  output: 'static',
  server: { port: 4321 },
  vite: { server: { strictPort: true }, preview: { strictPort: true } },
});
