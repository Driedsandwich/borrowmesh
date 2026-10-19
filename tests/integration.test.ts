import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ElicitRequestSchema, LATEST_PROTOCOL_VERSION, type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { createApplication, localDataPath } from '../src/server/app.js';
import type { LibraryState, Bundle, Hold, Booking, CommitResult, FindResult, HoldResult, IssueResult, ReleaseResult } from '../src/shared/types.js';

type App = Awaited<ReturnType<typeof createApplication>>;
let app: App;
let endpoint: string;
let dataFile: string;
const connections: Array<{ client: Client; transport: StreamableHTTPClientTransport }> = [];
const request = { project: 'planter-box', date: '2026-10-24', start: '13:00', end: '17:00' };

async function connect(action: 'accept' | 'decline' | 'cancel' = 'accept', form = true) {
  const traffic: JSONRPCMessage[] = [];
  const elicited: string[] = [];
  const client = new Client({ name: 'borrowmesh-integration', version: '1.0.0' }, { capabilities: form ? { elicitation: { form: {} } } : {} });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint));
  const start = transport.start.bind(transport);
  transport.start = async () => {
    const handler = transport.onmessage;
    transport.onmessage = message => { traffic.push(structuredClone(message)); handler?.(message); };
    await start();
  };
  if (form) client.setRequestHandler(ElicitRequestSchema, async req => {
    elicited.push(req.params.message);
    return action === 'accept' ? { action, content: { consent: true } } : { action };
  });
  await client.connect(transport);
  connections.push({ client, transport });
  async function call<T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error(JSON.stringify(result.content));
    return result.structuredContent as T;
  }
  return { client, transport, traffic, elicited, call };
}
async function choose(call: Awaited<ReturnType<typeof connect>>['call'], corded = true) {
  const found = await call<FindResult>('find_compatible_kit', request);
  expect(found.bundles.length).toBeGreaterThanOrEqual(2);
  expect(found.bundles.length).toBeLessThanOrEqual(3);
  const bundle = found.bundles.find(item => item.requiresConsent === corded)!;
  expect(bundle).toBeDefined();
  const held = await call<HoldResult>('hold_resources', { bundleId: bundle.id });
  expect(held.ok).toBe(true);
  return { bundle, hold: held.hold! };
}
beforeEach(async () => {
  dataFile = `data/tests/http-${randomUUID()}.json`;
  app = await createApplication({ dataFile });
  endpoint = (await app.listen(0)).url;
});
afterEach(async () => {
  for (const { client, transport } of connections.splice(0)) {
    await transport.terminateSession().catch(() => undefined);
    await client.close().catch(() => undefined);
  }
  await app.close();
});

describe('real MCP over Streamable HTTP', () => {
  it.each([
    ['2025-11-25', '2025-11-25'], ['2026-07-28', '2025-11-25'], ['2025-03-26', '2025-03-26'],
  ])('negotiates requested %s to %s through the SDK', async (requested, expected) => {
    expect(LATEST_PROTOCOL_VERSION).toBe('2025-11-25');
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: requested, capabilities: {}, clientInfo: { name: 'raw-test', version: '1.0.0' } },
    }) });
    expect(response.status).toBe(200);
    const text = await response.text();
    const messages = text.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
    expect(messages.find(message => message.result)?.result.protocolVersion).toBe(expected);
    const session = response.headers.get('mcp-session-id');
    expect(session).toBeTruthy();
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'Mcp-Session-Id': session!, 'MCP-Protocol-Version': expected };
    expect((await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) })).status).toBe(202);
    const listed = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) });
    expect(await listed.text()).toContain('get_library_state');
  });

  it('advertises exactly eight tools, catalog/bookings resources and the planning prompt', async () => {
    const { client, transport, traffic } = await connect();
    const initialized = traffic.find(message => 'result' in message && message.result.protocolVersion);
    expect(initialized && 'result' in initialized ? initialized.result.protocolVersion : undefined).toBe('2025-11-25');
    expect(transport.sessionId).toBeTruthy();
    const names = (await client.listTools()).tools.map(tool => tool.name);
    expect(names.sort()).toEqual(['get_library_state', 'find_compatible_kit', 'hold_resources', 'commit_bundle', 'release_bundle', 'report_issue', 'get_booking', 'reset_demo'].sort());
    expect(names).not.toContain('check_in_bundle');
    expect((await client.listResources()).resources.map(resource => resource.uri)).toEqual(['borrowmesh://catalog', 'borrowmesh://bookings']);
    const catalog = await client.readResource({ uri: 'borrowmesh://catalog' });
    expect('text' in catalog.contents[0] && JSON.parse(catalog.contents[0].text)).toHaveLength(15);
    expect((await client.listPrompts()).prompts.map(prompt => prompt.name)).toEqual(['plan-weekend-project']);
    expect((await client.getPrompt({ name: 'plan-weekend-project' })).messages).toHaveLength(1);
    const sessionId = transport.sessionId!;
    await transport.terminateSession();
    expect((await fetch(endpoint, { method: 'DELETE', headers: { 'Mcp-Session-Id': sessionId } })).status).toBe(404);
  });

  it('runs canonical flow with consent, persisted retrieval, clamp repair and cancellation serving Jonas', async () => {
    const first = await connect();
    const initial = await first.call<{ state: LibraryState }>('get_library_state');
    expect(initial.state.fictional).toBe(true);
    const { bundle, hold } = await choose(first.call);
    const committed = await first.call<CommitResult>('commit_bundle', { holdId: hold.id });
    expect(committed.ok).toBe(true);
    expect(committed.booking?.bundle.itemIds).toEqual(bundle.itemIds);
    expect(first.elicited).toHaveLength(1);
    expect(first.elicited[0]).toContain('outlet bench');
    await first.transport.terminateSession(); await first.client.close(); connections.splice(0, 1);
    await app.close();
    app = await createApplication({ dataFile });
    endpoint = (await app.listen(0)).url;
    const second = await connect();
    const restored = await second.call<{ booking: Booking }>('get_booking', { bookingId: 'mine' });
    expect(restored.booking).toEqual(committed.booking);
    const clamp = bundle.items.find(item => item.category === 'holding')!;
    const fixed = await second.call<IssueResult>('report_issue', { bookingId: restored.booking.id, itemId: clamp.id, kind: 'broken' });
    expect(fixed.ok).toBe(true);
    expect(fixed.replacement?.id).not.toBe(clamp.id);
    expect(fixed.booking!.bundle.itemIds.filter(id => id !== fixed.replacement!.id)).toEqual(bundle.itemIds.filter(id => id !== clamp.id));
    expect(fixed.booking!.bundle.bench).toEqual(bundle.bench);
    const released = await second.call<ReleaseResult>('release_bundle', { bookingId: restored.booking.id });
    expect(released.ok).toBe(true);
    expect(released.released?.status).toBe('cancelled');
    expect(released.waitlistServed.some(booking => booking.borrowerId === 'jonas')).toBe(true);
    expect(released.state.holds.filter(entry => entry.status === 'active')).toHaveLength(0);
    expect((await second.call<{ booking?: Booking }>('get_booking', { bookingId: 'mine' })).booking).toBeUndefined();
    const reset = await second.call<{ state: LibraryState }>('reset_demo');
    expect(reset.state.bookings).toEqual([]);
    expect(reset.state.waitlist[0].status).toBe('waiting');
  });

  it.each(['decline', 'cancel'] as const)('%s during elicitation books nothing on disk or in memory', async action => {
    const connection = await connect(action);
    const { hold } = await choose(connection.call);
    const before = await connection.call<{ state: LibraryState }>('get_library_state');
    const outcome = await connection.call<CommitResult>('commit_bundle', { holdId: hold.id });
    expect(outcome.ok).toBe(false);
    expect(outcome.state.bookings).toEqual(before.state.bookings);
    expect(JSON.parse(await readFile(dataFile, 'utf8')).bookings).toEqual([]);
    expect(connection.elicited).toHaveLength(1);
  });

  it('a resource taken mid-hold causes zero partial reservations and offers alternatives', async () => {
    const connection = await connect();
    const { bundle, hold } = await choose(connection.call);
    const state = app.store.snapshot();
    state.loans.push({ id: 'injected-mid-hold', borrowerId: 'mei', itemIds: [bundle.items.find(item => item.category === 'cutting')!.id], start: `${bundle.bench.date}T00:00:00Z`, end: `${bundle.bench.date}T23:59:59Z` });
    await app.store.save(state);
    const outcome = await connection.call<CommitResult>('commit_bundle', { holdId: hold.id });
    expect(outcome.ok).toBe(false);
    expect(outcome.conflicts?.length).toBeGreaterThan(0);
    expect(outcome.alternatives?.length).toBeGreaterThan(0);
    expect(outcome.state.bookings).toHaveLength(0);
    expect(outcome.state.benchReservations).toEqual(state.benchReservations);
    expect(outcome.state.loans).toEqual(state.loans);
  });

  it('serializes competing sessions so only one complete overlapping hold wins', async () => {
    const first = await connect();
    const second = await connect();
    const found = await first.call<FindResult>('find_compatible_kit', request);
    const outcomes = await Promise.all([first, second].map(connection => connection.call<HoldResult>('hold_resources', { bundleId: found.bundles[0].id })));
    expect(outcomes.filter(outcome => outcome.ok)).toHaveLength(1);
    const state = app.store.snapshot();
    expect(state.holds.filter(hold => hold.status === 'active')).toHaveLength(1);
    expect(state.bookings).toHaveLength(0);
  });

  it('persists a reported broken item truthfully when there is no compatible spare', async () => {
    const connection = await connect();
    const { hold } = await choose(connection.call);
    const committed = await connection.call<CommitResult>('commit_bundle', { holdId: hold.id });
    const issue = await connection.call<IssueResult>('report_issue', { bookingId: committed.booking!.id, itemId: 'bit-3', kind: 'broken' });
    expect(issue.ok).toBe(false);
    expect(issue.booking!.bundle.itemIds).toEqual(committed.booking!.bundle.itemIds);
    const restored = await connection.call<{ booking: Booking }>('get_booking', { bookingId: 'mine' });
    expect(restored.booking.bundle.items.find(item => item.id === 'bit-3')?.condition).toBe('broken');
    const saved = JSON.parse(await readFile(dataFile, 'utf8')) as LibraryState;
    expect(saved.bookings[0].bundle.items.find(item => item.id === 'bit-3')?.condition).toBe('broken');
  });

  it('revalidates after pending consent and never commits an obsolete hold after reset', async () => {
    const connection = await connect();
    const { hold } = await choose(connection.call);
    let reached!: () => void; let release!: () => void;
    const waiting = new Promise<void>(resolve => { reached = resolve; });
    const proceed = new Promise<void>(resolve => { release = resolve; });
    connection.client.setRequestHandler(ElicitRequestSchema, async () => { reached(); await proceed; return { action: 'accept', content: { consent: true } }; });
    const pending = connection.call<CommitResult>('commit_bundle', { holdId: hold.id });
    await waiting;
    const other = await connect();
    await other.call('reset_demo');
    release();
    const outcome = await pending;
    expect(outcome.ok).toBe(false);
    expect(outcome.state.bookings).toHaveLength(0);
  });

  it('rejects missing form support for changed setups; unchanged alternatives need no elicitation', async () => {
    const connection = await connect('accept', false);
    const { hold } = await choose(connection.call);
    await expect(connection.call('commit_bundle', { holdId: hold.id })).rejects.toThrow(/form elicitation/);
    await connection.call('reset_demo');
    const standard = await choose(connection.call, false);
    const committed = await connection.call<CommitResult>('commit_bundle', { holdId: standard.hold.id });
    expect(committed.ok).toBe(true);
  });

  it('validates browser origins, Host, protocol version, methods and session IDs', async () => {
    for (const method of ['POST', 'GET', 'DELETE']) {
      expect((await fetch(endpoint, { method, headers: { Origin: 'https://untrusted.example' } })).status).toBe(403);
    }
    expect((await fetch(endpoint, { method: 'POST', headers: { Origin: 'null' } })).status).toBe(403);
    expect((await fetch(endpoint, { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:5174' } })).headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5174');
    const hostStatus = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(endpoint, { method: 'POST', headers: { Host: 'untrusted.example' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    expect(hostStatus).toBe(403);
    const { transport } = await connect();
    expect((await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'Mcp-Session-Id': transport.sessionId!, 'MCP-Protocol-Version': '1900-01-01' }, body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }) })).status).toBe(400);
    expect((await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })).status).toBe(400);
    expect((await fetch(endpoint, { method: 'PUT' })).status).toBe(405);
    expect(() => localDataPath('../outside.json')).toThrow(/inside/);
  });
});
