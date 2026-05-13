import { spawn } from 'node:child_process';

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const dev = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '3000'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
});

const waitForServer = async (timeoutMs = 60000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(baseUrl + '/login');
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Dev server did not become ready in time');
};

const assertOneOfStatuses = async (path, expectedStatuses) => {
  const res = await fetch(baseUrl + path, { redirect: 'manual' });
  if (!expectedStatuses.includes(res.status)) {
    throw new Error(`${path}: expected one of [${expectedStatuses.join(', ')}], got ${res.status}`);
  }
  console.log(`OK ${path} -> ${res.status}`);
};

try {
  await waitForServer();
  await assertOneOfStatuses('/login', [200]);
  await assertOneOfStatuses('/register', [200]);
  await assertOneOfStatuses('/', [307]);
  console.log('E2E smoke tests completed.');
} finally {
  dev.kill('SIGINT');
}
