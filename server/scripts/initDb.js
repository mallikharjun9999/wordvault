// Safe to rerun: connects, creates any missing indexes, prints them. Never drops data or indexes.
import { connectDb, disconnectDb } from '../src/config/db.js';
import { ALL_MODELS, ensureIndexes } from '../src/models/index.js';
await connectDb();
await ensureIndexes();
for (const m of ALL_MODELS) {
  const idx = await m.collection.indexes();
  console.log(`${m.collection.collectionName}: ${idx.map((i) => i.name + (i.unique ? ' (unique)' : '')).join(', ')}`);
}
await disconnectDb();
console.log('✔ indexes ensured');
