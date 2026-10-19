import { randomUUID } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import type { Server as HttpServer } from 'node:http';
import express from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ElicitResultSchema, isInitializeRequest, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { LibraryStore, findCompatibleKits, holdResources, commitBundle, releaseBundle, reportIssue } from '../domain/library.js';
import type { Clock } from '../shared/types.js';

export const PROTOCOL_VERSION = '2025-11-25';
export function localDataPath(filePath = 'data/library.json') {
  const path = resolve(process.cwd(), filePath);
  const relativePath = relative(process.cwd(), path);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) throw new Error('The data file must be inside this project.');
  return path;
}
function result(data: { message: string; [key: string]: unknown }): CallToolResult {
  return { content: [{ type: 'text', text: data.message }], structuredContent: data };
}
function failure(error: unknown): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : 'The operation failed.' }] };
}

export async function createApplication(options: { dataFile?: string; clock?: Clock } = {}) {
  const store = new LibraryStore(localDataPath(options.dataFile), options.clock);
  await store.load();
  const app = createMcpExpressApp({ host: '127.0.0.1' });
  const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();
  let transaction: Promise<unknown> = Promise.resolve();
  function mutate<T>(operation: () => Promise<T>): Promise<T> {
    const next = transaction.then(operation);
    transaction = next.catch(() => undefined);
    return next;
  }
  const allowedOrigins = new Set([3002, 5174, 4174].flatMap(port => [`http://127.0.0.1:${port}`, `http://localhost:${port}`]));
  app.use('/mcp', (req, res, next) => {
    const origin = req.get('origin');
    if (origin && !allowedOrigins.has(origin)) {
      res.status(403).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Origin is not an allowed local demo origin.' } });
      return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, MCP-Protocol-Version');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });
  app.get('/health', (_req, res) => res.json({ name: 'borrowmesh', status: 'ok', protocolVersion: PROTOCOL_VERSION }));

  function makeServer() {
    const server = new McpServer({ name: 'borrowmesh', version: '1.0.0' }, {
      instructions: 'Fictional community tool library. Find complete compatible kits, hold all resources, then commit only the selected hold. Changed requests require explicit form consent. Keep unaffected booking resources when repairing issues.',
    });
    server.registerTool('get_library_state', {
      description: 'Read the fictional catalog, project requirements, availability, holds, bookings and waitlist.', inputSchema: {}, annotations: { readOnlyHint: true },
    }, async () => result({ kind: 'state', message: 'Maple Lane Tool Library: all data is fictional.', state: store.snapshot() }));
    server.registerTool('find_compatible_kit', {
      description: 'Find up to three complete compatible kits and explain substitutions. Times use HH:mm on a 30-minute grid.',
      inputSchema: { project: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) },
      annotations: { readOnlyHint: true },
    }, async input => {
      try { return await mutate(async () => {
        const outcome = findCompatibleKits(store.snapshot(), input);
        await store.save(outcome.state);
        return result({ ...outcome, kind: 'bundles' });
      }); } catch (error) { return failure(error); }
    });
    server.registerTool('hold_resources', {
      description: 'Temporarily hold every item and the bench atomically for ten simulated minutes.', inputSchema: { bundleId: z.string().min(1) }, annotations: { readOnlyHint: false, destructiveHint: false },
    }, async ({ bundleId }) => {
      try { return await mutate(async () => {
        const outcome = holdResources(store.snapshot(), bundleId);
        await store.save(outcome.state);
        return result({ ...outcome, kind: 'hold' });
      }); } catch (error) { return failure(error); }
    });
    server.registerTool('commit_bundle', {
      description: 'Book every resource or nothing. Elicit explicit form consent when a substitution changes the requested setup. Revalidate after consent.',
      inputSchema: { holdId: z.string().min(1) }, annotations: { readOnlyHint: false, destructiveHint: false },
    }, async ({ holdId }, extra) => {
      try {
        const inspected = commitBundle(store.snapshot(), holdId);
        let consent: boolean | undefined;
        if (inspected.needsConsent) {
          const elicitation = server.server.getClientCapabilities()?.elicitation;
          if (!elicitation || (Object.keys(elicitation).length > 0 && !elicitation.form)) {
            return failure(new Error('This substitution requires MCP form elicitation support. Nothing was booked.'));
          }
          const answer = await extra.sendRequest({ method: 'elicitation/create', params: {
            mode: 'form', message: inspected.consentReason ?? inspected.message,
            requestedSchema: { type: 'object', properties: { consent: { type: 'boolean', title: 'I accept the changed setup' } }, required: ['consent'] },
          } }, ElicitResultSchema, { signal: extra.signal, timeout: 120000 });
          consent = answer.action === 'accept' && answer.content?.consent === true;
        }
        return await mutate(async () => {
          if (extra.signal.aborted) throw new Error('The request was cancelled. Nothing was booked.');
          const outcome = commitBundle(store.snapshot(), holdId, consent);
          await store.save(outcome.state);
          return result({ ...outcome, kind: 'commit' });
        });
      } catch (error) { return failure(error); }
    });
    server.registerTool('release_bundle', {
      description: 'Cancel a booking and release all its items and bench together, then serve compatible waitlisted borrowers.', inputSchema: { bookingId: z.string().min(1) }, annotations: { readOnlyHint: false, destructiveHint: true },
    }, async ({ bookingId }) => {
      try { return await mutate(async () => {
        const outcome = releaseBundle(store.snapshot(), bookingId);
        await store.save(outcome.state);
        return result({ ...outcome, kind: 'release' });
      }); } catch (error) { return failure(error); }
    });
    server.registerTool('report_issue', {
      description: 'Report a broken or late item. Replace only that item with a compatible available substitute; preserve the rest of the booking.',
      inputSchema: { bookingId: z.string().min(1), itemId: z.string().min(1), kind: z.enum(['broken', 'late']) }, annotations: { readOnlyHint: false, destructiveHint: false },
    }, async ({ bookingId, itemId, kind }) => {
      try { return await mutate(async () => {
        const outcome = reportIssue(store.snapshot(), bookingId, itemId, kind);
        await store.save(outcome.state);
        return result({ ...outcome, kind: 'issue' });
      }); } catch (error) { return failure(error); }
    });
    server.registerTool('get_booking', {
      description: 'Read a saved booking by ID or mine (the fictional borrower Priya).', inputSchema: { bookingId: z.string().default('mine') }, annotations: { readOnlyHint: true },
    }, async ({ bookingId }) => {
      const state = store.snapshot();
      const booking = state.bookings.find(entry => bookingId === 'mine' ? entry.borrowerId === 'priya' && entry.status === 'booked' : entry.id === bookingId);
      return result({ kind: 'booking', message: booking ? 'Here is your saved booking.' : 'No active booking was found for Priya.', booking, state });
    });
    server.registerTool('reset_demo', {
      description: 'Reset all fictional catalog data, holds, bookings and waitlist to the canonical Saturday scenario.', inputSchema: {}, annotations: { readOnlyHint: false, destructiveHint: true },
    }, async () => {
      try { return await mutate(async () => {
        await store.reset();
        return result({ kind: 'reset', message: 'The fictional Saturday scenario has been reset.', state: store.snapshot() });
      }); } catch (error) { return failure(error); }
    });
    server.registerResource('library-catalog', 'borrowmesh://catalog', { mimeType: 'application/json', description: 'Fictional library catalog and compatibility attributes.' }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(store.snapshot().catalog, null, 2) }] }));
    server.registerResource('current-bookings', 'borrowmesh://bookings', { mimeType: 'application/json', description: 'Current fictional library bookings.' }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(store.snapshot().bookings, null, 2) }] }));
    server.registerPrompt('plan-weekend-project', { description: 'Assemble a complete kit safely for a fictional weekend project.', argsSchema: {} }, async () => ({ messages: [{ role: 'user', content: { type: 'text', text: 'Read get_library_state. Explain requirements, then call find_compatible_kit for the chosen project, date and time window. Compare complete kits, explain each substitution and the return deadline. Hold only the selected bundle. Commit its hold; ask form consent for changed setup. If anything fails, book nothing and offer fresh alternatives. Use get_booking to retrieve persisted bookings and report_issue to replace only an affected item.' } }] }));
    return server;
  }

  app.all('/mcp', async (req, res) => {
    if (!['POST', 'GET', 'DELETE'].includes(req.method)) { res.setHeader('Allow', 'POST, GET, DELETE'); res.sendStatus(405); return; }
    const sessionId = req.get('mcp-session-id');
    try {
      const existing = sessionId ? sessions.get(sessionId) : undefined;
      if (existing) { await existing.transport.handleRequest(req, res, req.body); return; }
      if (sessionId) { res.status(404).json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Session not found; reconnect to initialize.' } }); return; }
      if (req.method !== 'POST' || !isInitializeRequest(req.body)) { res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Initialize first, then provide Mcp-Session-Id.' } }); return; }
      if (sessions.size >= 64) { res.status(503).send('Too many demo sessions.'); return; }
      const server = makeServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: id => { sessions.set(id, { server, transport }); },
        onsessionclosed: async id => { sessions.delete(id); await server.close(); },
      });
      await server.connect(transport);
      const sdkClose = transport.onclose;
      transport.onclose = () => { if (transport.sessionId) sessions.delete(transport.sessionId); sdkClose?.(); };
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: error instanceof Error ? error.message : 'Transport error.' } });
    }
  });
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid request body.' } });
  });
  let listener: HttpServer | undefined;
  return {
    app, store,
    async listen(port = 3002) {
      listener = await new Promise<HttpServer>((accept, reject) => {
        const http = app.listen(port, '127.0.0.1', () => accept(http));
        http.once('error', reject);
      });
      const address = listener.address();
      if (!address || typeof address === 'string') throw new Error('No HTTP address.');
      return { port: address.port, url: `http://127.0.0.1:${address.port}/mcp` };
    },
    async close() {
      await transaction;
      await Promise.allSettled([...sessions.values()].map(session => session.server.close()));
      sessions.clear();
      if (listener) {
        const http = listener;
        const closing = new Promise<void>((accept, reject) => http.close(error => error ? reject(error) : accept()));
        http.closeAllConnections();
        await closing;
      }
    },
  };
}
