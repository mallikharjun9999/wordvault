/**
 * Learning status derivation (documented in docs/LEARNING.md). Highest satisfied level wins.
 *  documented: entry saved.
 *  recognized: user explicitly marked "I recognize this", OR >=2 correct quiz answers AND accuracy >=60%
 *              (quiz-only evidence), OR at least one 'good'/'easy' review. Opening an entry never counts.
 *  active    : >=1 user-written sentence self-assessed "correct" (and recognized criteria met or not required).
 *  mastered  : >=5 successful consecutive reviews (repetitions>=5), interval >=21 days, last rating good/easy.
 */
export function deriveStatus(v) {
  const p = v.progress || {}; const s = v.srs || {};
  const lastGood = s.lastRating === 'good' || s.lastRating === 'easy';
  if ((s.repetitions ?? 0) >= 5 && (s.intervalDays ?? 0) >= 21 && lastGood) return 'mastered';
  if ((p.sentenceCorrect ?? 0) >= 1) return 'active';
  const quizOk = (p.quizCorrect ?? 0) >= 2 && (p.quizTotal ? p.quizCorrect / p.quizTotal >= 0.6 : false);
  if (p.recognizedManual || quizOk || ((s.repetitions ?? 0) >= 1 && lastGood)) return 'recognized';
  return 'documented';
}
export const STATUS_DEFINITIONS = {
  documented: 'Saved in your vault.',
  recognized: 'You marked it as recognized, answered quiz questions on it correctly (2+ correct, 60%+), or recalled it in a review.',
  active: 'You wrote at least one sentence with it and judged it correct.',
  mastered: 'Recalled successfully 5 times in a row with an interval of 21+ days, and your last recall was Good or Easy.',
};
