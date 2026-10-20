// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BorrowMeshClient } from '../src/client/mcp.js';

const harness = vi.hoisted(() => ({
  terminate: vi.fn(), close: vi.fn(),
  fetch: undefined as undefined | typeof fetch,
}));
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    setRequestHandler() {}
    async connect(transport: { start(): Promise<void> }) { await transport.start(); }
    async listTools() { return { tools: [{ name: 'get_library_state' }] }; }
    close() { return harness.close(); }
  },
}));
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class {
    sessionId = 'browser-test-session';
    onmessage?: (message: unknown) => void;
    constructor(_url: URL, options: { fetch: typeof fetch }) { harness.fetch = options.fetch; }
    async start() { this.onmessage?.({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-11-25' } }); }
    async send() {}
    terminateSession() { return harness.terminate(); }
  },
}));

let client: BorrowMeshClient;
const disconnected = vi.fn<() => void>();
beforeEach(() => {
  harness.terminate.mockReset().mockResolvedValue(undefined);
  harness.close.mockReset().mockResolvedValue(undefined);
  disconnected.mockReset();
  client = new BorrowMeshClient(() => undefined, async () => ({ action: 'cancel' }), disconnected);
});
afterEach(async () => { await client.close(); vi.unstubAllGlobals(); });

it('terminates the MCP session and closes the client on pagehide', async () => {
  await client.connect();
  window.dispatchEvent(new Event('pagehide'));
  await vi.waitFor(() => expect(harness.close).toHaveBeenCalledTimes(1));
  expect(harness.terminate).toHaveBeenCalledTimes(1);
  expect(disconnected).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event('pagehide'));
  expect(harness.terminate).toHaveBeenCalledTimes(1);
  expect(disconnected).toHaveBeenCalledTimes(1);
});

it('keeps the session DELETE request alive when the page unloads', async () => {
  await client.connect();
  const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', request);
  await harness.fetch!('http://localhost/mcp', { method: 'DELETE' });
  expect(request).toHaveBeenLastCalledWith('http://localhost/mcp', { method: 'DELETE', keepalive: true });
  await harness.fetch!('http://localhost/mcp', { method: 'POST', body: '{}' });
  expect(request).toHaveBeenLastCalledWith('http://localhost/mcp', { method: 'POST', body: '{}' });
});
