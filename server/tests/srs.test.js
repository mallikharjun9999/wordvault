import { describe, it, expect } from 'vitest';
import { schedule, INITIAL_STATE, isDifficult, MAX_INTERVAL_DAYS, MIN_EASE } from '../src/services/srs.js';
import { deriveStatus } from '../src/services/status.js';
import { computeStreak } from '../src/services/progressService.js';

const now = new Date('2026-01-01T00:00:00Z');
const run = (ratings) => ratings.reduce((s, r) => ({ ...s, ...schedule(s, r, now) }), INITIAL_STATE());

describe('SRS scheduler (unit)', () => {
  it('34. again: resets repetitions, +lapse, lowers ease, due in 10 minutes', () => {
    const s = schedule({ repetitions: 4, intervalDays: 20, easeFactor: 2.5, lapses: 0 }, 'again', now);
    expect(s).toMatchObject({ repetitions: 0, intervalDays: 0, lapses: 1, easeFactor: 2.3 });
    expect(s.dueAt.getTime() - now.getTime()).toBe(10 * 60000);
  });
  it('34. good/easy/hard follow the documented first-step intervals', () => {
    expect(run(['good']).intervalDays).toBe(1); expect(run(['good', 'good']).intervalDays).toBe(3);
    expect(run(['easy']).intervalDays).toBe(4); expect(run(['easy', 'easy']).intervalDays).toBe(7);
    expect(run(['hard']).intervalDays).toBe(1);
    expect(run(['good', 'good', 'good']).intervalDays).toBe(Math.round(3 * 2.5)); // 8
  });
  it('35. hard always yields shorter intervals than good, and again is shortest', () => {
    for (const base of [['good'], ['good', 'good'], ['good', 'good', 'good', 'good']]) {
      const st = run(base);
      const [a, h, g, e] = ['again', 'hard', 'good', 'easy'].map((r) => schedule(st, r, now));
      expect(a.dueAt < h.dueAt).toBe(true); expect(h.intervalDays).toBeLessThanOrEqual(g.intervalDays); expect(g.intervalDays).toBeLessThan(e.intervalDays);
    }
  });
  it('36. consistent success grows intervals monotonically, capped at 365 days', () => {
    let s = INITIAL_STATE(); let prev = 0;
    for (let i = 0; i < 25; i++) { s = { ...s, ...schedule(s, 'good', now) }; expect(s.intervalDays).toBeGreaterThanOrEqual(prev); prev = s.intervalDays; }
    expect(prev).toBe(MAX_INTERVAL_DAYS);
  });
  it('ease factor never drops below the floor and easy raises it', () => {
    let s = INITIAL_STATE(); for (let i = 0; i < 20; i++) s = { ...s, ...schedule(s, 'again', now) };
    expect(s.easeFactor).toBe(MIN_EASE);
    expect(schedule(INITIAL_STATE(), 'easy', now).easeFactor).toBe(2.65);
  });
  it('is deterministic and rejects unknown ratings', () => {
    expect(schedule(INITIAL_STATE(), 'good', now)).toEqual(schedule(INITIAL_STATE(), 'good', now));
    expect(() => schedule(INITIAL_STATE(), 'perfect', now)).toThrow();
  });
  it('difficult = 2+ lapses or ease < 2.0', () => {
    expect(isDifficult({ lapses: 2, easeFactor: 2.5 })).toBe(true); expect(isDifficult({ lapses: 0, easeFactor: 1.9 })).toBe(true); expect(isDifficult({ lapses: 1, easeFactor: 2.3 })).toBe(false);
  });
});
describe('learning status & streak (unit)', () => {
  const base = () => ({ progress: {}, srs: { repetitions: 0, intervalDays: 0, lastRating: null } });
  it('41. status is documented by default; viewing/saving never raises it', () => { expect(deriveStatus(base())).toBe('documented'); });
  it('recognized needs explicit evidence', () => {
    expect(deriveStatus({ ...base(), progress: { recognizedManual: true } })).toBe('recognized');
    expect(deriveStatus({ ...base(), progress: { quizCorrect: 1, quizTotal: 1 } })).toBe('documented'); // one lucky answer is not enough
    expect(deriveStatus({ ...base(), progress: { quizCorrect: 2, quizTotal: 2 } })).toBe('recognized');
    expect(deriveStatus({ ...base(), progress: { quizCorrect: 2, quizTotal: 5 } })).toBe('documented'); // <60% accuracy
    expect(deriveStatus({ ...base(), srs: { repetitions: 1, lastRating: 'hard' } })).toBe('documented');
    expect(deriveStatus({ ...base(), srs: { repetitions: 1, lastRating: 'good' } })).toBe('recognized');
  });
  it('active needs a self-assessed-correct sentence', () => {
    expect(deriveStatus({ ...base(), progress: { sentenceCorrect: 1 } })).toBe('active');
  });
  it('mastered is conservative: >=5 reps, >=21 day interval, last rating good/easy', () => {
    const m = (srs) => deriveStatus({ ...base(), srs });
    expect(m({ repetitions: 4, intervalDays: 30, lastRating: 'good' })).not.toBe('mastered');
    expect(m({ repetitions: 5, intervalDays: 20, lastRating: 'good' })).not.toBe('mastered');
    expect(m({ repetitions: 5, intervalDays: 21, lastRating: 'hard' })).not.toBe('mastered');
    expect(m({ repetitions: 5, intervalDays: 21, lastRating: 'easy' })).toBe('mastered');
  });
  it('streak counts consecutive days, tolerates "not yet today"', () => {
    expect(computeStreak(['2026-01-05', '2026-01-04', '2026-01-03'], '2026-01-05')).toEqual({ current: 3, longest: 3 });
    expect(computeStreak(['2026-01-04', '2026-01-03'], '2026-01-05').current).toBe(2);
    expect(computeStreak(['2026-01-01', '2026-01-03'], '2026-01-05')).toEqual({ current: 0, longest: 1 });
    expect(computeStreak([], '2026-01-05')).toEqual({ current: 0, longest: 0 });
  });
});
