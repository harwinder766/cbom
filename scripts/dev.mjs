import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const isWin = process.platform === 'win32';
const backendPython = isWin
  ? path.join(process.cwd(), 'backend', '.venv', 'Scripts', 'python.exe')
  : path.join(process.cwd(), 'backend', '.venv', 'bin', 'python');

console.log('\x1b[36m%s\x1b[0m', '🚀 [ECDAT Engine] Starting FastAPI Backend on http://localhost:8000...');
const backend = spawn(backendPython, ['backend/run.py'], {
  stdio: 'inherit',
  shell: isWin,
});

console.log('\x1b[35m%s\x1b[0m', '⚡ [ECDAT UI] Starting Next.js Frontend on http://localhost:3000...');
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const frontend = spawn(npmCmd, ['run', 'dev'], {
  stdio: 'inherit',
  shell: isWin,
});

function cleanup() {
  console.log('\n🛑 [ECDAT] Shutting down all services gracefully...');
  try { backend.kill(); } catch {}
  try { frontend.kill(); } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
