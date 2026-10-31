import { config, assertConfig } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { ensureIndexes } from './models/index.js';
import { createApp } from './app.js';

try { assertConfig(config); } catch (e) { console.error(`\n✖ ${e.message}\n`); process.exit(1); }
try {
  await connectDb();
  await ensureIndexes(); // creates missing indexes only; never drops anything
} catch (e) {
  console.error(`\n✖ Could not connect to MongoDB at ${config.mongodbUri.replace(/\/\/[^@]*@/, '//***@')}\n  ${e.message}\n  Is mongod running? See README → "MongoDB setup & troubleshooting".\n`);
  process.exit(1);
}
const server = createApp().listen(config.port, () => console.log(`✔ WordVault API on http://localhost:${config.port}  (db connected, indexes ensured)`));
const shutdown = async () => { server.close(); await disconnectDb(); process.exit(0); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
