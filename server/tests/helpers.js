import request from 'supertest';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { ensureIndexes, ALL_MODELS, Translation } from '../src/models/index.js';
import { createApp } from '../src/app.js';
import { config, reloadConfig } from '../src/config/env.js';
import { setLlmOverride } from '../src/services/llm.js';

export const app = createApp();
export const H = { 'X-WordVault-Client': '1' };

export async function setupDb() {
  reloadConfig();
  await connectDb(config.mongodbUri);
  // SAFETY: never run destructive test cleanup against a non-test database.
  if (!mongoose.connection.name.endsWith('_test')) {
    await disconnectDb();
    throw new Error(`Refusing to run tests: database "${mongoose.connection.name}" does not end in _test`);
  }
  await ensureIndexes();
  await cleanDb();
}
export async function cleanDb() { for (const m of ALL_MODELS) await m.deleteMany({}); }
export async function teardownDb() { setLlmOverride('ai', null); await cleanDb(); await disconnectDb(); }

let n = 0;
export async function newUser(email = `user${++n}-${Date.now()}@example.com`, password = 'password-1234') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').set(H).send({ email, password });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const c = { agent, email, password, user: res.body.data.user };
  for (const m of ['get', 'post', 'put', 'patch', 'delete']) c[m] = (url, body) => { const r = agent[m](url).set(H); return body === undefined ? r : r.send(body); };
  return c;
}

export const sampleEntry = (word, extra = {}) => ({
  word,
  meanings: [{ partOfSpeech: 'adjective', simpleExplanation: `Simple explanation of ${word}.`, teluguMeaning: `${word}-తెలుగు`, teluguExplanation: 'తెలుగు వివరణ',
    examples: [{ en: `This is a ${word} example.`, te: 'ఇది ఒక ఉదాహరణ', context: 'everyday' }] }],
  synonyms: [{ word: `${word}-syn`, difference: '' }], antonyms: [`${word}-ant`],
  usageSituations: [{ situation: `A situation for ${word}`, example: `Using ${word}` }],
  commonMistakes: [{ mistake: `Wrong ${word}`, correction: `Right ${word}`, note: 'note' }],
  ...extra,
});
export const generatedJson = (word = 'x') => JSON.stringify({
  pronunciation: 'pro-nun', ipa: '/x/',
  meanings: [{ partOfSpeech: 'noun', simpleExplanation: `About ${word}`, detailedExplanation: '', teluguMeaning: 'అర్థం', teluguExplanation: 'వివరణ',
    examples: [{ en: `A sentence with ${word}.`, te: 'వాక్యం', context: 'general' }] }],
  synonyms: [], antonyms: [], tags: ['test'],
});
// Simulates data saved before WordVault became English + Telugu only (the API can no longer create these).
export const legacyTranslation = (ownerId, vocabularyId, language = 'hi', meaning = 'अर्थ') =>
  Translation.create({ ownerId, vocabularyId, language, origin: 'manual', meanings: [{ meaning, explanation: '', examples: [] }] });
export const fakeProvider = (impl) => {
  const calls = []; const client = { provider: 'fake', model: 'fake-1', calls, async complete(args) { calls.push(args); return impl(args, calls.length); } };
  return client;
};
export { setLlmOverride, config };
