import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.js'],
  bundle: true,
  outfile: 'dist/metamask-dapp.js',
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  globalName: 'MetaMaskWP',
  sourcemap: true,
  minify: false
});
