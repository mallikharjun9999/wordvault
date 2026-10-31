/**
 * Spaced repetition: deterministic, SM-2-inspired. Documented in docs/LEARNING.md.
 * State: repetitions r, intervalDays I, easeFactor EF (init 2.5, min 1.3), lapses.
 *
 *  again: r=0, lapses+1, EF=max(1.3, EF-0.20), I=0, due = now + 10 minutes
 *  hard : EF=max(1.3, EF-0.15); r+=1; I = r==1 ? 1 : max(1, round(I*1.2))
 *  good : r+=1; I = r==1 ? 1 : r==2 ? 3 : round(I*EF)               (EF unchanged)
 *  easy : EF+=0.15; r+=1; I = r==1 ? 4 : r==2 ? 7 : round(I*EF*1.3) (EF updated first)
 * All intervals are clamped to [1, 365] days (except 'again'); due = now + I*24h.
 */
import { addDays, addMinutes } from '../utils/dates.js';

export const MAX_INTERVAL_DAYS = 365;
export const MIN_EASE = 1.3;
export const AGAIN_MINUTES = 10;
export const INITIAL_STATE = () => ({ repetitions: 0, intervalDays: 0, easeFactor: 2.5, lapses: 0 });
const clampInterval = (n) => Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(n)));
const round2 = (n) => Math.round(n * 100) / 100;

export function schedule(state, rating, now = new Date()) {
  const s = { ...INITIAL_STATE(), ...state };
  let { repetitions: r, intervalDays: I, easeFactor: ef, lapses } = s;
  if (rating === 'again') {
    return { repetitions: 0, intervalDays: 0, easeFactor: round2(Math.max(MIN_EASE, ef - 0.2)), lapses: lapses + 1, dueAt: addMinutes(now, AGAIN_MINUTES) };
  }
  if (rating === 'hard') {
    ef = Math.max(MIN_EASE, ef - 0.15); r += 1; I = r === 1 ? 1 : clampInterval(Math.max(1, I * 1.2));
  } else if (rating === 'good') {
    r += 1; I = r === 1 ? 1 : r === 2 ? 3 : clampInterval(I * ef);
  } else if (rating === 'easy') {
    ef += 0.15; r += 1; I = r === 1 ? 4 : r === 2 ? 7 : clampInterval(I * ef * 1.3);
  } else throw new Error(`Unknown rating: ${rating}`);
  I = clampInterval(I);
  return { repetitions: r, intervalDays: I, easeFactor: round2(ef), lapses, dueAt: addDays(now, I) };
}
// A word is "difficult" when it has been forgotten at least twice or its ease factor has dropped below 2.0.
export const isDifficult = (srs) => (srs?.lapses ?? 0) >= 2 || (srs?.easeFactor ?? 2.5) < 2.0;
