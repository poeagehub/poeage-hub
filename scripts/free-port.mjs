/**
 * Runs before every `npm run dev`. Makes sure the app's port is usable:
 *  - free                                   -> nothing to do
 *  - held by an old POEAGE HUB dev server   -> stop it (a previous run that was never closed)
 *  - held by anything else                  -> leave it alone and explain, so we never kill another project
 *
 * Usage: node ../scripts/free-port.mjs <port>
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const port = Number(process.argv[2]);
if (!port) process.exit(0);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').toLowerCase();
const isWin = process.platform === 'win32';
const run = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

function listeningPids() {
  if (isWin) {
    const out = run(`powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique"`);
    return out.split(/\s+/).filter(Boolean).map(Number);
  }
  return run(`lsof -ti tcp:${port} -sTCP:LISTEN`).split(/\s+/).filter(Boolean).map(Number);
}

function commandLine(pid) {
  if (isWin) return run(`powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`);
  return run(`ps -p ${pid} -o command=`);
}

const pids = listeningPids();
if (pids.length === 0) process.exit(0);

let blocked = false;
for (const pid of pids) {
  const cmd = commandLine(pid);
  const norm = cmd.toLowerCase().replace(/\\+/g, '/');
  const ours = norm.includes(repoRoot.replace(/\\+/g, '/')) && norm.includes('vite');
  if (ours) {
    try {
      if (isWin) run(`taskkill /PID ${pid} /F`);
      else process.kill(pid, 'SIGTERM');
      console.log(`[dev] Stopped an old POEAGE HUB server on port ${port} (PID ${pid}).`);
    } catch {
      blocked = true;
    }
  } else {
    blocked = true;
    console.error(`\n[dev] Port ${port} is used by another program (PID ${pid}):\n      ${cmd || '(unknown)'}\n      Close it, or change this app's port in its package.json and vite.config.ts.\n`);
  }
}

if (blocked) process.exit(1);
// give the OS a moment to release the socket
await new Promise((r) => setTimeout(r, 600));
