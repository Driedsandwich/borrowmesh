import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { afterEach, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Booking, CommitResult, FindResult, HoldResult } from '../src/shared/types.js';

let child: ChildProcess | undefined;
async function startServer(dataFile: string) {
  const current = spawn(process.execPath, ['--import', 'tsx', 'src/server/index.ts'], {
    cwd: process.cwd(), env: { ...process.env, PORT: '0', DATA_FILE: dataFile }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child = current;
  return new Promise<string>((resolve, reject) => {
    let output = ''; let errors = '';
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out. ${errors}`)), 10000);
    current.stdout!.on('data', chunk => {
      output += chunk;
      const match = output.match(/ready at (http:\/\/127\.0\.0\.1:\d+\/mcp)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    current.stderr!.on('data', chunk => { errors += chunk; });
    current.once('error', error => { clearTimeout(timeout); reject(error); });
    current.once('exit', code => { clearTimeout(timeout); if (!output.includes('ready at')) reject(new Error(`Server exited ${code}: ${errors}`)); });
  });
}
async function stopServer() {
  const current = child;
  child = undefined;
  if (!current || current.exitCode !== null) return;
  const exited = once(current, 'exit');
  current.kill('SIGTERM');
  await exited;
}
afterEach(stopServer);

it('restores a booked kit and all its resources after an actual Node process restart', async () => {
  const dataFile = `data/tests/process-${randomUUID()}.json`;
  const first = new Client({ name: 'restart-test', version: '1.0.0' }, { capabilities: { elicitation: { form: {} } } });
  const transport = new StreamableHTTPClientTransport(new URL(await startServer(dataFile)));
  first.setRequestHandler(ElicitRequestSchema, async () => ({ action: 'accept', content: { consent: true } }));
  let booking: Booking;
  try {
    await first.connect(transport);
    const found = (await first.callTool({ name: 'find_compatible_kit', arguments: { project: 'planter-box', date: '2026-10-24', start: '13:00', end: '17:00' } })).structuredContent as unknown as FindResult;
    const held = (await first.callTool({ name: 'hold_resources', arguments: { bundleId: found.bundles[0].id } })).structuredContent as unknown as HoldResult;
    const committed = (await first.callTool({ name: 'commit_bundle', arguments: { holdId: held.hold!.id } })).structuredContent as unknown as CommitResult;
    expect(committed.ok).toBe(true);
    booking = committed.booking!;
  } finally { await transport.terminateSession().catch(() => undefined); await first.close(); await stopServer(); }
  const second = new Client({ name: 'restart-test', version: '1.0.0' });
  const restoredTransport = new StreamableHTTPClientTransport(new URL(await startServer(dataFile)));
  try {
    await second.connect(restoredTransport);
    const restored = (await second.callTool({ name: 'get_booking', arguments: { bookingId: 'mine' } })).structuredContent as unknown as { booking: Booking };
    expect(restored.booking).toEqual(booking);
    const alternatives = (await second.callTool({ name: 'find_compatible_kit', arguments: { project: 'planter-box', date: '2026-10-24', start: '13:00', end: '17:00' } })).structuredContent as unknown as FindResult;
    expect(alternatives.bundles).toEqual([]);
  } finally { await restoredTransport.terminateSession().catch(() => undefined); await second.close(); }
});
