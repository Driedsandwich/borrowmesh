import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { LibraryStore } from '../src/domain/library.js';
import { localDataPath } from '../src/server/app.js';

// Reset the running server when available; otherwise reset the local file offline.
const port = Number(process.env.PORT ?? 3002);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid TCP port.');
const health = await fetch(`http://127.0.0.1:${port}/health`).catch(() => undefined);
if (health?.ok) {
  if ((await health.json()).name !== 'borrowmesh') throw new Error(`Port ${port} is occupied by a different service.`);
  const client = new Client({ name: 'borrowmesh-reset', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
  try {
    await client.connect(transport);
    const outcome = await client.callTool({ name: 'reset_demo', arguments: {} });
    if (outcome.isError) throw new Error(JSON.stringify(outcome.content));
  } finally { await transport.terminateSession().catch(() => undefined); await client.close(); }
} else {
  const store = new LibraryStore(localDataPath(process.env.DATA_FILE));
  await store.reset();
}
console.log('BorrowMesh fictional Saturday scenario reset.');
