import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupDb, teardownDb, newUser, sampleEntry } from './helpers.js';
import { normalizeWord } from '../src/utils/normalize.js';
import { Vocabulary } from '../src/models/index.js';

beforeAll(setupDb); afterAll(teardownDb);

describe('vocabulary CRUD', () => {
  it('9-12. creates, reads, edits and deletes own entry', async () => {
    const u = await newUser();
    const c = await u.post('/api/vocabulary', sampleEntry('Diligent'));
    expect(c.status).toBe(201);
    const id = c.body.data.entry.id;
    expect(c.body.data.entry.normalizedWord).toBe('diligent');
    expect(c.body.data.entry.ownerId).toBeUndefined();
    const g = await u.get(`/api/vocabulary/${id}`); expect(g.status).toBe(200); expect(g.body.data.entry.word).toBe('Diligent');
    const p = await u.patch(`/api/vocabulary/${id}`, { notes: 'my note', favorite: true, tags: ['Work', 'work'] });
    expect(p.body.data.entry.notes).toBe('my note'); expect(p.body.data.entry.favorite).toBe(true); expect(p.body.data.entry.tags).toEqual(['work']);
    expect((await u.delete(`/api/vocabulary/${id}`)).status).toBe(200);
    expect((await u.get(`/api/vocabulary/${id}`)).status).toBe(404);
  });
  it('13. rejects duplicates for the same user (any case/whitespace) and reports the existing id', async () => {
    const u = await newUser();
    const first = await u.post('/api/vocabulary', sampleEntry('Candid'));
    for (const w of ['candid', '  CANDID  ', 'Candid']) {
      const r = await u.post('/api/vocabulary', sampleEntry(w));
      expect(r.status).toBe(409); expect(r.body.error.code).toBe('DUPLICATE_WORD');
      expect(r.body.error.details.existingId).toBe(first.body.data.entry.id);
    }
  });
  it('13b. the unique compound index exists in MongoDB', async () => {
    const idx = await Vocabulary.collection.indexes();
    const u = idx.find((i) => i.unique && JSON.stringify(i.key) === JSON.stringify({ ownerId: 1, normalizedWord: 1 }));
    expect(u).toBeTruthy();
  });
  it('14. different users can save the same word independently', async () => {
    const a = await newUser(); const b = await newUser();
    expect((await a.post('/api/vocabulary', sampleEntry('shared'))).status).toBe(201);
    expect((await b.post('/api/vocabulary', sampleEntry('shared'))).status).toBe(201);
  });
  it('15. normalizes whitespace, case and Unicode form without merging distinct words', () => {
    expect(normalizeWord('  Ice   Cream ')).toBe('ice cream');
    expect(normalizeWord('Cafe\u0301')).toBe(normalizeWord('Caf\u00e9')); // NFC
    expect(normalizeWord('café')).not.toBe(normalizeWord('cafe'));        // accents preserved
    expect(normalizeWord("don't")).not.toBe(normalizeWord('dont'));
  });
  it('16. preserves Unicode and Telugu content exactly', async () => {
    const u = await newUser();
    const entry = sampleEntry('résumé');
    entry.meanings[0].teluguMeaning = 'సారాంశం, పునఃప్రారంభం 🙂'; entry.notes = 'నోట్: ఇది ఒక పరీక్ష';
    const c = await u.post('/api/vocabulary', entry);
    const g = await u.get(`/api/vocabulary/${c.body.data.entry.id}`);
    expect(g.body.data.entry.word).toBe('résumé');
    expect(g.body.data.entry.meanings[0].teluguMeaning).toBe('సారాంశం, పునఃప్రారంభం 🙂');
    expect(g.body.data.entry.notes).toBe('నోట్: ఇది ఒక పరీక్ష');
    const s = await u.get('/api/vocabulary?q=' + encodeURIComponent('సారాంశం'));
    expect(s.body.data.items).toHaveLength(1);
  });
  it('17. pagination, search, filters and sorting are correctly scoped', async () => {
    const a = await newUser(); const b = await newUser();
    for (const w of ['alpha', 'bravo', 'charlie', 'delta', 'echo']) await a.post('/api/vocabulary', sampleEntry(w, { categories: w < 'c' ? ['greek'] : ['other'], tags: ['t1'], favorite: w === 'echo' }));
    await b.post('/api/vocabulary', sampleEntry('foxtrot'));
    const p1 = await a.get('/api/vocabulary?limit=2&page=1&sort=alpha');
    expect(p1.body.data.items.map((i) => i.word)).toEqual(['alpha', 'bravo']);
    expect(p1.body.meta).toMatchObject({ total: 5, pages: 3, page: 1, limit: 2 });
    expect((await a.get('/api/vocabulary?limit=2&page=3&sort=alpha')).body.data.items.map((i) => i.word)).toEqual(['echo']);
    expect((await a.get('/api/vocabulary?category=greek')).body.meta.total).toBe(2);
    expect((await a.get('/api/vocabulary?favorite=true')).body.data.items.map((i) => i.word)).toEqual(['echo']);
    expect((await a.get('/api/vocabulary?q=foxtrot')).body.meta.total).toBe(0); // other user's word invisible
    expect((await a.get('/api/vocabulary?q=' + encodeURIComponent('.*'))).body.meta.total).toBe(0); // regex chars are escaped
    expect((await a.get('/api/vocabulary?limit=1000')).status).toBe(400);
    expect((await a.get('/api/vocabulary?status=mastered')).body.meta.total).toBe(0);
  });
  it('17b. difficult filter works and is scoped', async () => {
    const a = await newUser(); const b = await newUser();
    const w1 = (await a.post('/api/vocabulary', sampleEntry('hard1'))).body.data.entry; await a.post('/api/vocabulary', sampleEntry('easy1'));
    await b.post('/api/vocabulary', sampleEntry('hard1'));
    await Vocabulary.updateOne({ _id: w1.id }, { 'srs.lapses': 3 });
    expect((await a.get('/api/vocabulary?difficult=true')).body.data.items.map((i) => i.word)).toEqual(['hard1']);
    expect((await b.get('/api/vocabulary?difficult=true')).body.data.items).toHaveLength(0);
    expect((await a.get('/api/vocabulary?sort=due')).status).toBe(200);
  });
  it('rejects invalid bodies and ids', async () => {
    const u = await newUser();
    expect((await u.post('/api/vocabulary', { word: '' })).status).toBe(400);
    expect((await u.post('/api/vocabulary', { word: 'x', meanings: [{ partOfSpeech: 'bogus' }] })).status).toBe(400);
    expect((await u.get('/api/vocabulary/not-an-id')).status).toBe(400);
    expect((await u.patch('/api/vocabulary/' + '0'.repeat(24), { notes: 'x' })).status).toBe(404);
    expect((await u.post('/api/vocabulary', { word: 'x', learningStatus: 'mastered' })).status).toBe(400); // can't self-award mastery
  });
});
