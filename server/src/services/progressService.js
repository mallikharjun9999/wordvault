import { Vocabulary, ReviewLog, QuizAttempt, Sentence } from '../models/index.js';
import { dayKey, shiftDayKey } from '../utils/dates.js';
import { STATUS_DEFINITIONS } from './status.js';

const DIFFICULT = { $or: [{ 'srs.lapses': { $gte: 2 } }, { 'srs.easeFactor': { $lt: 2.0 } }] };

/** Streak = consecutive calendar days (user timezone) with >=1 review, completed quiz, or written sentence. */
export function computeStreak(dayKeys, today) {
  const set = new Set(dayKeys);
  let cur = 0; let d = set.has(today) ? today : shiftDayKey(today, -1);
  while (set.has(d)) { cur += 1; d = shiftDayKey(d, -1); }
  const sorted = [...set].sort(); let longest = 0; let run = 0; let prev = null;
  for (const k of sorted) { run = prev && shiftDayKey(prev, 1) === k ? run + 1 : 1; longest = Math.max(longest, run); prev = k; }
  return { current: cur, longest };
}
function series(dates, tz, days, today) {
  const counts = new Map();
  for (const d of dates) { const k = dayKey(d, tz); counts.set(k, (counts.get(k) || 0) + 1); }
  return Array.from({ length: days }, (_, i) => { const k = shiftDayKey(today, i - (days - 1)); return { date: k, count: counts.get(k) || 0 }; });
}

export async function getStats(ownerId, tz = 'UTC', now = new Date()) {
  const since = new Date(now.getTime() - 400 * 86400000);
  const [total, dueNow, statusAgg, reviewsTotal, quizAgg, revDates, quizDates, sentDates, vocabDates, difficult, recentWords, recentReviews, recentQuizzes] = await Promise.all([
    Vocabulary.countDocuments({ ownerId }),
    Vocabulary.countDocuments({ ownerId, 'srs.dueAt': { $lte: now } }),
    Vocabulary.aggregate([{ $match: { ownerId } }, { $group: { _id: '$learningStatus', n: { $sum: 1 } } }]),
    ReviewLog.countDocuments({ ownerId }),
    QuizAttempt.aggregate([{ $match: { ownerId, status: 'completed' } }, { $group: { _id: null, attempts: { $sum: 1 }, score: { $sum: '$score' }, total: { $sum: '$total' } } }]),
    ReviewLog.find({ ownerId, reviewedAt: { $gte: since } }).select('reviewedAt -_id').lean(),
    QuizAttempt.find({ ownerId, status: 'completed', completedAt: { $gte: since } }).select('completedAt -_id').lean(),
    Sentence.find({ ownerId, createdAt: { $gte: since } }).select('createdAt -_id').lean(),
    Vocabulary.find({ ownerId, createdAt: { $gte: since } }).select('createdAt -_id').lean(),
    Vocabulary.find({ ownerId, ...DIFFICULT }).sort({ 'srs.lapses': -1, 'srs.easeFactor': 1 }).limit(10).select('word srs.lapses srs.easeFactor srs.dueAt meanings.teluguMeaning'),
    Vocabulary.find({ ownerId }).sort({ createdAt: -1 }).limit(5).select('word createdAt learningStatus meanings.teluguMeaning'),
    ReviewLog.find({ ownerId }).sort({ reviewedAt: -1 }).limit(5).populate({ path: 'vocabularyId', select: 'word' }),
    QuizAttempt.find({ ownerId, status: 'completed' }).sort({ completedAt: -1 }).limit(5).select('score total completedAt'),
  ]);
  const today = dayKey(now, tz);
  const counts = { documented: 0, recognized: 0, active: 0, mastered: 0 };
  for (const r of statusAgg) counts[r._id] = r.n;
  const q = quizAgg[0] || { attempts: 0, score: 0, total: 0 };
  const activityDays = [...revDates.map((x) => dayKey(x.reviewedAt, tz)), ...quizDates.map((x) => dayKey(x.completedAt, tz)), ...sentDates.map((x) => dayKey(x.createdAt, tz))];
  const recentActivity = [
    ...recentWords.map((w) => ({ type: 'word_added', at: w.createdAt, label: w.word })),
    ...recentReviews.map((r) => ({ type: 'review', at: r.reviewedAt, label: r.vocabularyId?.word || '(deleted word)', detail: r.rating })),
    ...recentQuizzes.map((x) => ({ type: 'quiz', at: x.completedAt, label: `${x.score}/${x.total}` })),
  ].sort((a, b) => b.at - a.at).slice(0, 10);

  return {
    totalWords: total, dueNow, reviewsCompleted: reviewsTotal,
    quiz: { attempts: q.attempts, questionsAnswered: q.total, correct: q.score, accuracy: q.total ? Math.round((q.score / q.total) * 1000) / 10 : null },
    streak: computeStreak(activityDays, today),
    statusCounts: counts, activeUse: counts.active + counts.mastered, mastered: counts.mastered,
    wordsOverTime: series(vocabDates.map((x) => x.createdAt), tz, 30, today),
    reviewsOverTime: series(revDates.map((x) => x.reviewedAt), tz, 30, today),
    difficultWords: difficult, recentWords, recentActivity, definitions: STATUS_DEFINITIONS, timezone: tz,
  };
}
