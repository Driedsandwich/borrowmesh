import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { afterEach, expect, it } from 'vitest';
import { DEMO_NOW } from '../src/domain/library.js';

const files: string[] = [];
afterEach(async () => { await Promise.all(files.splice(0).map(file => rm(file, { force: true }))); });
async function stateFile(content: string) {
  await mkdir('data/tests', { recursive: true });
  const file = `data/tests/startup-${randomUUID()}.json`;
  files.push(file);
  await writeFile(file, content);
  return file;
}
async function run(command: string, args: string[], env: Record<string, string>) {
  const child = spawn(command, args, { cwd: process.cwd(), env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Startup command timed out.')); }, 10000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', code => { clearTimeout(timeout); resolve({ code, stdout, stderr }); });
  });
}

it('reports malformed saved JSON in one line with recovery instructions', async () => {
  const file = await stateFile('{ invalid json');
  const result = await run(process.execPath, ['--import', 'tsx', 'src/server/index.ts'], { PORT: '0', DATA_FILE: file });
  expect(result.code).toBe(1);
  expect(result.stderr.trim().split('\n')).toHaveLength(1);
  expect(result.stderr).toContain('Cannot parse BorrowMesh data file');
  expect(result.stderr).toContain(file);
  expect(result.stderr).toContain('npm run demo:reset');
  expect(result.stderr).toContain('delete the file');
  expect(await readFile(file, 'utf8')).toBe('{ invalid json');
});

it('npm run demo:reset recovers malformed JSON offline', async () => {
  const file = await stateFile('{ invalid json');
  const result = await run('npm', ['run', 'demo:reset'], { PORT: '0', DATA_FILE: file });
  expect(result.code).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain('fictional Saturday scenario reset');
  const state = JSON.parse(await readFile(file, 'utf8'));
  expect(state.schemaVersion).toBe(1);
  expect(state.simulatedNow.slice(0, 16)).toBe(DEMO_NOW.slice(0, 16));
  expect(state.bookings).toEqual([]);
  expect(state.holds).toEqual([]);
  expect(state.waitlist[0].status).toBe('waiting');
});

it('reports an occupied port in one line naming the port and PORT variable', async () => {
  const busy = createServer();
  await new Promise<void>(resolve => { busy.listen(0, '127.0.0.1', resolve); });
  try {
    const address = busy.address();
    if (!address || typeof address === 'string') throw new Error('No test port.');
    const file = `data/tests/startup-${randomUUID()}.json`;
    files.push(file);
    const result = await run(process.execPath, ['--import', 'tsx', 'src/server/index.ts'], { PORT: String(address.port), DATA_FILE: file });
    expect(result.code).toBe(1);
    expect(result.stderr.trim().split('\n')).toHaveLength(1);
    expect(result.stderr).toContain(`port ${address.port} is already in use`);
    expect(result.stderr).toContain('set PORT');
  } finally { await new Promise<void>((resolve, reject) => busy.close(error => error ? reject(error) : resolve())); }
});
