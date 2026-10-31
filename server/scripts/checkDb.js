import { connectDb, disconnectDb, dbHealth } from '../src/config/db.js';
import { config } from '../src/config/env.js';
try { await connectDb(); const h = await dbHealth(); console.log('✔ MongoDB reachable', h); }
catch (e) { console.error(`✖ Cannot connect to ${config.mongodbUri.replace(/\/\/[^@]*@/, '//***@')}: ${e.message}`); process.exitCode = 1; }
finally { await disconnectDb(); }
