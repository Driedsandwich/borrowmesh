import { createApplication } from './app.js';

const port = Number(process.env.PORT ?? 3002);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid TCP port.');
const application = await createApplication({ dataFile: process.env.DATA_FILE });
const address = await application.listen(port);
console.log(`BorrowMesh MCP ready at ${address.url} (protocol 2025-11-25)`);
console.log('Fictional library. Open http://127.0.0.1:5174 for the simulated experience.');
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await application.close();
  process.exit(0);
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
