import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.js'],
  bundle: true,
  outfile: 'dist/sqmu.js',
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  globalName: 'SQMUWP',
  sourcemap: true,
  minify: false
});
