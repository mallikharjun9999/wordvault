import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupDb, teardownDb, newUser, sampleEntry } from './helpers.js';
import { Vocabulary, ReviewLog, QuizAttempt } from '../src/models/index.js';

beforeAll(setupDb); afterAll(teardownDb);
const seed = async (u, words) => { const out = []; for (const w of words) out.push((await u.post('/api/vocabulary', sampleEntry(w))).body.data.entry); return out; };

describe('reviews', () => {
  it('queue shows due words only, scoped to the user; empty state is a valid response', async () => {
    const a = await newUser(); const b = await newUser();
    expect((await a.get('/api/reviews/queue')).body.data.items).toHaveLength(0);
    const [w1, w2] = await seed(a, ['one', 'two']); await seed(b, ['other']);
    await Vocabulary.updateOne({ _id: w2.id }, { 'srs.dueAt': new Date(Date.now() + 5 * 86400000) });
    const q = await a.get('/api/reviews/queue');
    expect(q.body.data.items.map((i) => i.word)).toEqual(['one']); expect(q.body.meta.dueTotal).toBe(1); expect(w1.id).toBeTruthy();
  });
  it('34/36. rating updates persisted schedule and writes history with previous/next state', async () => {
    const u = await newUser(); const [w] = await seed(u, ['steady']);
    const r = await u.post('/api/reviews', { vocabularyId: w.id, rating: 'good', requestId: 'req-00000001' });
    expect(r.status).toBe(201); expect(r.body.data.entry.srs).toMatchObject({ repetitions: 1, intervalDays: 1, lastRating: 'good', reviewCount: 1 });
    const log = await ReviewLog.findOne({ ownerId: u.user.id });
    expect(log).toMatchObject({ rating: 'good' }); expect(log.previous.intervalDays).toBe(0); expect(log.next.intervalDays).toBe(1);
    const q = await u.get('/api/reviews/queue'); expect(q.body.data.items).toHaveLength(0); // no longer due
    const again = await u.post('/api/reviews', { vocabularyId: w.id, rating: 'again', requestId: 'req-00000002' });
    expect(again.body.data.entry.srs.lapses).toBe(1); expect(again.body.data.entry.srs.repetitions).toBe(0);
  });
  it('37. repeated/concurrent submissions with one requestId create one log and apply once', async () => {
    const u = await newUser(); const [w] = await seed(u, ['dup']);
    const rs = await Promise.all(Array.from({ length: 5 }, () => u.post('/api/reviews', { vocabularyId: w.id, rating: 'easy', requestId: 'same-request-id' })));
    expect(rs.every((r) => [200, 201].includes(r.status))).toBe(true);
    expect(await ReviewLog.countDocuments({ ownerId: u.user.id })).toBe(1);
    const e = await Vocabulary.findById(w.id); expect(e.srs.reviewCount).toBe(1); expect(e.srs.repetitions).toBe(1); expect(e.srs.intervalDays).toBe(4);
  });
  it("cannot review someone else's word, nor reuse a requestId across users", async () => {
    const a = await newUser(); const b = await newUser(); const [w] = await seed(a, ['mine']);
    expect((await b.post('/api/reviews', { vocabularyId: w.id, rating: 'good', requestId: 'cross-user-1' })).status).toBe(404);
    expect(await ReviewLog.countDocuments({ ownerId: b.user.id })).toBe(0);
    expect((await a.post('/api/reviews', { vocabularyId: w.id, rating: 'bogus', requestId: 'cross-user-2' })).status).toBe(400);
  });
});

describe('quizzes', () => {
  it('rejects quiz generation with too little data instead of fabricating questions', async () => {
    const u = await newUser(); const r = await u.post('/api/quizzes', {});
    expect(r.status).toBe(422); expect(r.body.error.code).toBe('NOT_ENOUGH_DATA');
    await seed(u, ['solo']); expect((await u.post('/api/quizzes', {})).status).toBe(422);
  });
  it('39. questions have unique options, exactly one correct, and never leak answers before submission', async () => {
    const u = await newUser(); await seed(u, ['aa', 'bb', 'cc', 'dd', 'ee', 'ff']);
    for (let i = 0; i < 5; i++) {
      const r = await u.post('/api/quizzes', { count: 6 }); expect(r.status).toBe(201);
      const qs = r.body.data.quiz.questions; expect(qs.length).toBeGreaterThan(0);
      for (const q of qs) {
        const texts = q.options.map((o) => o.text.toLowerCase().trim());
        expect(new Set(texts).size).toBe(texts.length); expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.correctOptionId).toBeUndefined(); expect(q.explanation).toBeUndefined();
      }
      const stored = await QuizAttempt.findById(r.body.data.quiz.id);
      for (const q of stored.questions) expect(q.options.filter((o) => o.id === q.correctOptionId)).toHaveLength(1);
    }
  });
  it('38. grades server-side, stores the attempt under the right user, updates evidence, blocks resubmission', async () => {
    const u = await newUser(); const other = await newUser(); await seed(u, ['qa', 'qb', 'qc', 'qd']);
    const quiz = (await u.post('/api/quizzes', { count: 4, types: ['en_to_te', 'te_to_en'] })).body.data.quiz;
    const stored = await QuizAttempt.findById(quiz.id);
    const answers = quiz.questions.map((q, i) => ({ qid: q.qid, optionId: i === 0 ? stored.questions[0].correctOptionId : q.options.find((o) => o.id !== stored.questions[i].correctOptionId).id }));
    expect((await other.post(`/api/quizzes/${quiz.id}/submit`, { answers })).status).toBe(404);
    const res = await u.post(`/api/quizzes/${quiz.id}/submit`, { answers });
    expect(res.status).toBe(200); expect(res.body.data.quiz.score).toBe(1); expect(res.body.data.quiz.questions[0]).toMatchObject({ correct: true });
    expect(res.body.data.quiz.questions[1]).toMatchObject({ correct: false }); expect(res.body.data.quiz.questions[1].correctOptionId).toBeTruthy();
    expect(String(stored.ownerId)).toBe(u.user.id);
    expect((await u.post(`/api/quizzes/${quiz.id}/submit`, { answers })).status).toBe(409);
    const v = await Vocabulary.findById(stored.questions[0].vocabularyId); expect(v.progress.quizTotal).toBe(1); expect(v.progress.quizCorrect).toBe(1);
    expect(v.learningStatus).toBe('documented'); // one correct answer is not recognition
    expect((await other.get('/api/quizzes')).body.data.attempts).toHaveLength(0);
  });
});

describe('sentences, status and progress', () => {
  it('sentence self-assessment drives "active"; viewing a word never changes status (41)', async () => {
    const u = await newUser(); const [w] = await seed(u, ['usage']);
    await u.get(`/api/vocabulary/${w.id}`); await u.get(`/api/vocabulary/${w.id}`);
    expect((await Vocabulary.findById(w.id)).learningStatus).toBe('documented');
    const bad = await u.post('/api/sentences', { vocabularyId: w.id, text: 'Unsure sentence here', selfAssessment: 'unsure' });
    expect(bad.body.data.entry.learningStatus).toBe('documented');
    const good = await u.post('/api/sentences', { vocabularyId: w.id, text: 'I used usage correctly.', selfAssessment: 'correct', confidence: 4 });
    expect(good.body.data.entry.learningStatus).toBe('active');
    expect((await u.post(`/api/vocabulary/${w.id}/recognize`, { recognized: true })).status).toBe(200);
    expect((await u.get('/api/sentences')).body.data.sentences).toHaveLength(2);
  });
  it('mastery is only reached through sustained review history', async () => {
    const u = await newUser(); const [w] = await seed(u, ['enduring']);
    let last;
    for (let i = 0; i < 4; i++) { last = await u.post('/api/reviews', { vocabularyId: w.id, rating: 'easy', requestId: `mastery-req-${i}` }); }
    expect(last.body.data.entry.learningStatus).not.toBe('mastered');
    last = await u.post('/api/reviews', { vocabularyId: w.id, rating: 'easy', requestId: 'mastery-req-5' });
    expect(last.body.data.entry.srs.repetitions).toBe(5); expect(last.body.data.entry.srs.intervalDays).toBeGreaterThanOrEqual(21);
    expect(last.body.data.entry.learningStatus).toBe('mastered');
    const forget = await u.post('/api/reviews', { vocabularyId: w.id, rating: 'again', requestId: 'mastery-req-6' });
    expect(forget.body.data.entry.learningStatus).not.toBe('mastered');
  });
  it('40. progress statistics equal the persisted records; empty accounts return zeros', async () => {
    const empty = await newUser(); const e = (await empty.get('/api/progress')).body.data;
    expect(e).toMatchObject({ totalWords: 0, dueNow: 0, reviewsCompleted: 0, streak: { current: 0, longest: 0 }, quiz: { accuracy: null, attempts: 0 } });
    expect(e.wordsOverTime).toHaveLength(30);
    const u = await newUser(); const ws = await seed(u, ['p1', 'p2', 'p3', 'p4']);
    await u.post('/api/reviews', { vocabularyId: ws[0].id, rating: 'good', requestId: 'prog-req-0001' });
    await u.post('/api/reviews', { vocabularyId: ws[1].id, rating: 'again', requestId: 'prog-req-0002' });
    await u.post('/api/reviews', { vocabularyId: ws[1].id, rating: 'again', requestId: 'prog-req-0003' });
    const quiz = (await u.post('/api/quizzes', { count: 4, types: ['te_to_en'] })).body.data.quiz;
    const st = await QuizAttempt.findById(quiz.id);
    await u.post(`/api/quizzes/${quiz.id}/submit`, { answers: quiz.questions.map((q, i) => ({ qid: q.qid, optionId: st.questions[i].correctOptionId })) });
    const p = (await u.get('/api/progress')).body.data;
    expect(p.totalWords).toBe(await Vocabulary.countDocuments({ ownerId: u.user.id }));
    expect(p.reviewsCompleted).toBe(3);
    expect(p.dueNow).toBe(await Vocabulary.countDocuments({ ownerId: u.user.id, 'srs.dueAt': { $lte: new Date() } }));
    expect(p.quiz).toMatchObject({ attempts: 1, questionsAnswered: quiz.questions.length, correct: quiz.questions.length, accuracy: 100 });
    expect(p.streak.current).toBe(1);
    expect(p.wordsOverTime.reduce((s, d) => s + d.count, 0)).toBe(4); expect(p.reviewsOverTime.reduce((s, d) => s + d.count, 0)).toBe(3);
    expect(p.difficultWords.map((d) => d.word)).toEqual(['p2']);
    expect(Object.values(p.statusCounts).reduce((a, b) => a + b, 0)).toBe(4);
    expect(p.recentActivity.length).toBeGreaterThan(0);
  });
});
