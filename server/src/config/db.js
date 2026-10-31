import mongoose from 'mongoose';
import { config } from './env.js';

mongoose.set('strictQuery', true);
// NOTE: we deliberately do NOT use sanitizeFilter: it rewrites our own internal $lte/$in operators.
// Injection defence = every external value is parsed by a strict zod schema into a primitive (string/number/enum/ObjectId)
// BEFORE it reaches a query (see validators/schemas.js and the injection tests in tests/security.test.js).

export async function connectDb(uri = config.mongodbUri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10, autoIndex: !config.isProd });
  return mongoose.connection;
}
export const disconnectDb = () => mongoose.disconnect();

export async function dbHealth() {
  try {
    if (mongoose.connection.readyState !== 1) return { ok: false, state: mongoose.STATES[mongoose.connection.readyState] };
    const t = Date.now();
    await mongoose.connection.db.admin().ping();
    return { ok: true, state: 'connected', latencyMs: Date.now() - t, database: mongoose.connection.name };
  } catch { return { ok: false, state: 'error' }; }
}
