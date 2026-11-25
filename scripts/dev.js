import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localEnv = path.join(root, '.env.local');
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

const children = [
  spawn(process.execPath, [path.join(root, 'scripts', 'api-dev.js')], {
    cwd: root,
    env: { ...process.env, PORT: '3001' },
    stdio: 'inherit',
  }),
  spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0'], {
    cwd: root,
    stdio: 'inherit',
  }),
];

let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  });
  process.exitCode = code;
}

children.forEach((child) => {
  child.on('error', (error) => {
    console.error('Impossible de démarrer un service du mode développement.', error);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code || 0);
  });
});

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
