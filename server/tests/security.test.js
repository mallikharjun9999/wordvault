import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app, H, setupDb, teardownDb, newUser, sampleEntry, legacyTranslation } from './helpers.js';
import { User, Vocabulary, Translation, ReviewLog, QuizAttempt, Sentence } from '../src/models/index.js';

beforeAll(setupDb); afterAll(teardownDb);

describe('cross-user isolation', () => {
  it('42-44. user B cannot read, update, delete or act on user A\'s vocabulary', async () => {
    const a = await newUser(); const b = await newUser();
    const w = (await a.post('/api/vocabulary', sampleEntry('private'))).body.data.entry;
    expect((await b.get(`/api/vocabulary/${w.id}`)).status).toBe(404);
    expect((await b.patch(`/api/vocabulary/${w.id}`, { notes: 'hacked' })).status).toBe(404);
    expect((await b.delete(`/api/vocabulary/${w.id}`)).status).toBe(404);
    expect((await b.post(`/api/vocabulary/${w.id}/recognize`, { recognized: true })).status).toBe(404);
    expect((await b.post('/api/sentences', { vocabularyId: w.id, text: 'Sneaky sentence.', selfAssessment: 'correct' })).status).toBe(404);
    expect((await b.get(`/api/sentences?vocabularyId=${w.id}`)).body.data.sentences).toHaveLength(0);
    const still = await Vocabulary.findById(w.id); expect(still.notes).toBe(''); expect(still.progress.sentenceCorrect).toBe(0);
    expect((await b.get('/api/vocabulary')).body.data.items).toHaveLength(0);
    expect((await a.get(`/api/vocabulary/${w.id}`)).status).toBe(200);
  });
  it('45. exports contain only the requester\'s data and no secrets', async () => {
    const a = await newUser(); const b = await newUser();
    await a.post('/api/vocabulary', sampleEntry('alpha-only')); await b.post('/api/vocabulary', sampleEntry('beta-only'));
    for (const fmt of ['json', 'csv', 'md']) {
      const r = await b.get(`/api/export/vocabulary?format=${fmt}`);
      expect(r.text).toContain('beta-only'); expect(r.text).not.toContain('alpha-only');
    }
    const all = await b.get('/api/export/account'); const text = all.text;
    expect(text).toContain('beta-only'); expect(text).not.toContain('alpha-only'); expect(text).not.toContain(a.email);
    expect(text).not.toMatch(/passwordHash|\$2[aby]\$|tokenVersion|JWT/);
    expect(JSON.parse(text).account.email).toBe(b.email);
    expect((await b.get('/api/export/vocabulary?format=xml')).status).toBe(400);
  });
  it('CSV export neutralises spreadsheet formula injection', async () => {
    const u = await newUser(); await u.post('/api/vocabulary', sampleEntry('=cmd|calc', { notes: '+SUM(A1)' }));
    const csv = (await u.get('/api/export/vocabulary?format=csv')).text;
    expect(csv).toContain("'=cmd|calc"); expect(csv).toContain("'+SUM(A1)");
  });
});

describe('account deletion', () => {
  it('46. removes every owned record, requires password + confirmation, leaves other users intact', async () => {
    const a = await newUser(); const b = await newUser();
    const w = (await a.post('/api/vocabulary', sampleEntry('doomed'))).body.data.entry; await b.post('/api/vocabulary', sampleEntry('survivor'));
    await a.post('/api/vocabulary', sampleEntry('doomed2'));
    await legacyTranslation(a.user.id, w.id); // pre-cleanup data must still be removed with the account
    await a.post('/api/reviews', { vocabularyId: w.id, rating: 'good', requestId: 'delete-req-001' });
    await a.post('/api/sentences', { vocabularyId: w.id, text: 'A doomed sentence.', selfAssessment: 'correct' });
    await a.post('/api/vocabulary', sampleEntry('doomed3')); await a.post('/api/quizzes', { count: 3 });
    expect(await QuizAttempt.countDocuments({ ownerId: a.user.id })).toBe(1);

    expect((await a.post('/api/auth/delete-account', { password: 'wrong-password-9', confirm: 'DELETE' })).status).toBe(401);
    expect((await a.post('/api/auth/delete-account', { password: a.password, confirm: 'yes' })).status).toBe(400);
    expect(await User.countDocuments({ _id: a.user.id })).toBe(1);

    const del = await a.post('/api/auth/delete-account', { password: a.password, confirm: 'DELETE' });
    expect(del.status).toBe(200); expect(del.body.data.deleted).toMatchObject({ vocabulary: 3, translations: 1, reviewLogs: 1, sentences: 1, quizAttempts: 1 });
    for (const M of [Vocabulary, Translation, ReviewLog, QuizAttempt, Sentence]) expect(await M.countDocuments({ ownerId: a.user.id })).toBe(0);
    expect(await User.countDocuments({ _id: a.user.id })).toBe(0);
    expect((await a.get('/api/auth/me')).status).toBe(401);
    expect((await b.get('/api/vocabulary')).body.data.items).toHaveLength(1);
    expect((await request(app).post('/api/auth/login').set(H).send({ email: a.email, password: a.password })).status).toBe(401);
  });
  it('deleting a single word also removes its translations, reviews and sentences', async () => {
    const u = await newUser(); const w = (await u.post('/api/vocabulary', sampleEntry('cascade'))).body.data.entry;
    await legacyTranslation(u.user.id, w.id);
    await u.post('/api/reviews', { vocabularyId: w.id, rating: 'good', requestId: 'cascade-req-01' });
    await u.delete(`/api/vocabulary/${w.id}`);
    expect(await Translation.countDocuments({ vocabularyId: w.id })).toBe(0); expect(await ReviewLog.countDocuments({ vocabularyId: w.id })).toBe(0);
  });
});

describe('input validation, errors and limits', () => {
  it('47. rejects invalid data across routes with a consistent error shape', async () => {
    const u = await newUser();
    const cases = [
      u.post('/api/vocabulary', { word: 'x', tags: 'notarray' }), u.post('/api/reviews', {}), u.post('/api/quizzes', { count: 500 }),
      u.post('/api/sentences', { vocabularyId: 'bad', text: 'x', selfAssessment: 'correct' }), u.patch('/api/auth/me', { timezone: 'Mars/Base' }),
      u.get('/api/vocabulary?page=0'), u.patch('/api/auth/me', { explanationLanguage: 'zz' }),
    ];
    for (const r of await Promise.all(cases)) { expect(r.status).toBe(400); expect(r.body).toMatchObject({ success: false, error: { code: expect.any(String), message: expect.any(String) } }); }
  });
  it('blocks NoSQL operator injection in login and filters', async () => {
    const u = await newUser();
    expect((await request(app).post('/api/auth/login').set(H).send({ email: { $ne: null }, password: { $ne: null } })).status).toBe(400);
    expect((await u.get('/api/vocabulary?q[$ne]=x')).status).toBe(400);
  });
  it('rejects oversized bodies and malformed JSON', async () => {
    const u = await newUser();
    expect((await u.post('/api/vocabulary', { word: 'big', notes: 'x'.repeat(200_000) })).status).toBe(413);
    const bad = await u.agent.post('/api/vocabulary').set(H).set('Content-Type', 'application/json').send('{"word":');
    expect(bad.status).toBe(400); expect(bad.body.error.code).toBe('INVALID_JSON');
  });
  it('48. database failures return a safe 503 without leaking connection strings or stack traces', async () => {
    const u = await newUser();
    const err = Object.assign(new Error('connect ECONNREFUSED mongodb://admin:SuperSecret@db.internal:27017'), { name: 'MongoServerSelectionError' });
    const spy = vi.spyOn(Vocabulary, 'find').mockImplementationOnce(() => { throw err; });
    const r = await u.get('/api/vocabulary'); spy.mockRestore();
    expect(r.status).toBe(503); expect(r.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(JSON.stringify(r.body)).not.toMatch(/SuperSecret|mongodb:|admin|stack|at .*\.js/);
    const boom = vi.spyOn(Vocabulary, 'countDocuments').mockImplementationOnce(() => { throw new Error('secret-internal-detail /srv/app/x.js:1'); });
    const r2 = await u.get('/api/vocabulary'); boom.mockRestore();
    expect(r2.status).toBe(500); expect(JSON.stringify(r2.body)).not.toMatch(/secret-internal|\/srv/);
  });
  it('health endpoint reports DB status; unknown routes give JSON 404; no admin routes exist', async () => {
    const h = await request(app).get('/api/health'); expect(h.status).toBe(200); expect(h.body.data.db.ok).toBe(true);
    expect((await request(app).get('/api/nope')).body.error.code).toBe('NOT_FOUND');
    const u = await newUser();
    for (const p of ['/api/admin', '/api/admin/users', '/api/users']) expect((await u.get(p)).status).toBe(404);
  });
  it('rate limiting applies to login when enabled', async () => {
    process.env.TEST_RATE_LIMITS = '1';
    const { createApp } = await import('../src/app.js'); const fresh = createApp(); let last;
    for (let i = 0; i < 22; i++) last = await request(fresh).post('/api/auth/login').set(H).send({ email: 'rl@example.com', password: 'whatever-1234' });
    delete process.env.TEST_RATE_LIMITS;
    expect(last.status).toBe(429); expect(last.body.error.code).toBe('RATE_LIMITED');
  });
});
