import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electron from 'electron';
import { buildMain } from './build.mjs';

await buildMain();
const server = await createServer({ configFile: 'vite.config.ts' });
await server.listen();
const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, ORANGE_CAT_DEV_URL: 'http://127.0.0.1:5173' },
});
let closing = false;
async function close(code = 0) {
  if (closing) return;
  closing = true;
  child.kill();
  await server.close();
  process.exit(code);
}
child.on('exit', (code, signal) => void close(code ?? (signal ? 1 : 0)));
child.on('error', (error) => {
  console.error(error.message);
  void close(1);
});
process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());
