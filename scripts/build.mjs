import { build } from 'esbuild';
import { build as buildUi } from 'vite';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
export async function buildMain() {
  await build({
    entryPoints: ['src/main/index.ts'],
    outfile: 'dist/main/index.js',
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    external: ['electron', 'node:*'],
    logLevel: 'info',
  });
  await build({
    entryPoints: ['src/preload/index.ts'],
    outfile: 'dist/preload/index.cjs',
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    external: ['electron'],
    logLevel: 'info',
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildMain();
  await buildUi({ configFile: 'vite.config.ts' });
}
