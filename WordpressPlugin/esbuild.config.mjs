import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.jsx'],
  bundle: true,
  outfile: 'plugin/assets/sqmu.js',
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  globalName: 'SQMUWP',
  sourcemap: true,
  minify: false
});
