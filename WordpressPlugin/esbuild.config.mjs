import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

const assetsDir = path.resolve('plugin/assets');
const chunkDir = path.join(assetsDir, 'chunks');

async function cleanGeneratedAssets() {
  await mkdir(assetsDir, { recursive: true });
  await rm(chunkDir, { recursive: true, force: true });

  const entries = await readdir(assetsDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.js.map')))
      .map((entry) => rm(path.join(assetsDir, entry.name), { force: true }))
  );
}

await cleanGeneratedAssets();

await build({
  entryPoints: {
    sqmu: 'src/index.jsx'
  },
  bundle: true,
  outdir: 'plugin/assets',
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  format: 'esm',
  splitting: true,
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  minify: false,
  // MetaMask SDK's compiled Stencil fallback keeps a generic import("./**/*.entry.js")
  // branch even when the concrete install modal bundle is already embedded in the split output.
  logOverride: {
    'empty-glob': 'silent'
  }
});
