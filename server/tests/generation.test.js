import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupDb, teardownDb, newUser, sampleEntry, fakeProvider, generatedJson, setLlmOverride, config } from './helpers.js';
import { Vocabulary } from '../src/models/index.js';

beforeAll(setupDb); afterAll(teardownDb);
beforeEach(() => setLlmOverride('ai', null));

describe('AI generation', () => {
  it('18-19. detects existing words before calling the provider (never calls it for duplicates)', async () => {
    const u = await newUser(); const p = fakeProvider(() => generatedJson('x')); setLlmOverride('ai', p);
    await u.post('/api/vocabulary', sampleEntry('Lucid'));
    const r = await u.post('/api/vocabulary/generate', { word: '  LUCID ' });
    expect(r.status).toBe(200); expect(r.body.data.existing).toBe(true); expect(r.body.data.entry.word).toBe('Lucid');
    expect(p.calls).toHaveLength(0);
  });
  it('20. validates and saves valid generated content; headword is the user input', async () => {
    const u = await newUser(); setLlmOverride('ai', fakeProvider(() => '```json\n' + generatedJson('Brisk') + '\n```'));
    const r = await u.post('/api/vocabulary/generate', { word: 'Brisk' });
    expect(r.status).toBe(201); expect(r.body.data.existing).toBe(false);
    expect(r.body.data.entry).toMatchObject({ word: 'Brisk', source: 'ai', generation: { provider: 'fake', model: 'fake-1' } });
    expect(r.body.data.entry.meanings[0].teluguMeaning).toBe('అర్థం');
  });
  it('21. provider failure creates no entry and keeps the app usable', async () => {
    const u = await newUser(); setLlmOverride('ai', fakeProvider(() => { const e = new Error('boom'); e.status = 502; throw Object.assign(e, { code: 'PROVIDER_ERROR' }); }));
    const r = await u.post('/api/vocabulary/generate', { word: 'ghost' });
    expect(r.status).toBe(500); // unknown error shape is masked, not leaked
    expect(await Vocabulary.countDocuments({ ownerId: u.user.id })).toBe(0);
    expect((await u.get('/api/vocabulary')).status).toBe(200);
  });
  it('22-23. rejects malformed JSON and schema violations safely, saving nothing', async () => {
    const u = await newUser();
    for (const bad of ['not json at all', '', '{"meanings": []}', '{"meanings":[{"simpleExplanation":"x","teluguMeaning":"","examples":[{"en":"a"}]}]}', '{"meanings":[{"simpleExplanation":"x","teluguMeaning":"అ","examples":[]}]}', '{"meanings":"nope"}']) {
      setLlmOverride('ai', fakeProvider(() => bad));
      const r = await u.post('/api/vocabulary/generate', { word: 'bad' });
      expect(r.status, bad).toBe(502); expect(r.body.error.code).toMatch(/PROVIDER_(INVALID_JSON|INVALID_CONTENT|EMPTY)/);
    }
    expect(await Vocabulary.countDocuments({ ownerId: u.user.id })).toBe(0);
  });
  it('24. after a failure, retrying the same word succeeds (nothing blocks retry)', async () => {
    const u = await newUser(); setLlmOverride('ai', fakeProvider(() => 'garbage'));
    expect((await u.post('/api/vocabulary/generate', { word: 'retry' })).status).toBe(502);
    setLlmOverride('ai', fakeProvider(() => generatedJson('retry')));
    const r = await u.post('/api/vocabulary/generate', { word: 'retry' });
    expect(r.status).toBe(201); expect(r.body.data.entry.word).toBe('retry');
  });
  it('25. concurrent requests for the same new word create exactly one entry (and one provider call)', async () => {
    const u = await newUser(); const p = fakeProvider(async () => { await new Promise((r) => setTimeout(r, 150)); return generatedJson('race'); }); setLlmOverride('ai', p);
    const rs = await Promise.all([1, 2, 3, 4].map(() => u.post('/api/vocabulary/generate', { word: 'race' })));
    expect(rs.every((r) => [200, 201].includes(r.status))).toBe(true);
    expect(new Set(rs.map((r) => r.body.data.entry.id)).size).toBe(1);
    expect(await Vocabulary.countDocuments({ ownerId: u.user.id, normalizedWord: 'race' })).toBe(1);
    expect(p.calls).toHaveLength(1);
  });
  it('25b. losing a cross-process race (unique index) returns the winner instead of failing', async () => {
    const u = await newUser();
    setLlmOverride('ai', fakeProvider(async () => { await Vocabulary.create({ ownerId: u.user.id, word: 'photo', normalizedWord: 'photo' }); return generatedJson('photo'); }));
    const r = await u.post('/api/vocabulary/generate', { word: 'photo' });
    expect(r.status).toBe(200); expect(r.body.data.existing).toBe(true);
    expect(await Vocabulary.countDocuments({ ownerId: u.user.id, normalizedWord: 'photo' })).toBe(1);
  });
  it('26. missing configuration yields an honest 503, and manual entry still works', async () => {
    Object.assign(config.ai, { provider: '', apiKey: '', model: '' });
    const u = await newUser();
    const r = await u.post('/api/vocabulary/generate', { word: 'nokey' });
    expect(r.status).toBe(503); expect(r.body.error.code).toBe('AI_NOT_CONFIGURED'); expect(r.body.error.message).toMatch(/AI_PROVIDER|AI_API_KEY|not configured/i);
    expect((await u.get('/api/ai/status')).body.data.generation.configured).toBe(false);
    expect((await u.post('/api/vocabulary', sampleEntry('nokey'))).status).toBe(201);
  });
  it('rejects absurd input', async () => {
    const u = await newUser(); const p = fakeProvider(() => generatedJson()); setLlmOverride('ai', p);
    expect((await u.post('/api/vocabulary/generate', { word: 'x'.repeat(500) })).status).toBe(400);
    expect((await u.post('/api/vocabulary/generate', { word: '   ' })).status).toBe(400);
    expect(p.calls).toHaveLength(0);
  });
  it('GET on the POST-only generate endpoint gives a clear 405, not a confusing "Invalid id"', async () => {
    const u = await newUser(); const r = await u.get('/api/vocabulary/generate');
    expect(r.status).toBe(405); expect(r.headers.allow).toBe('POST'); expect(r.body.error.code).toBe('METHOD_NOT_ALLOWED');
    expect(r.body.error.message).toMatch(/POST/); expect(JSON.stringify(r.body)).not.toMatch(/Invalid id/);
  });
});
