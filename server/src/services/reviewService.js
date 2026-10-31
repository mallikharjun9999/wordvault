import { Vocabulary, ReviewLog } from '../models/index.js';
import { schedule } from './srs.js';
import { deriveStatus } from './status.js';
import { getEntry } from './vocabularyService.js';
import { conflict } from '../utils/AppError.js';

export async function getQueue(ownerId, limit = 30, now = new Date()) {
  const due = { ownerId, 'srs.dueAt': { $lte: now } };
  const [items, dueTotal] = await Promise.all([
    Vocabulary.find(due).sort({ 'srs.dueAt': 1 }).limit(limit),
    Vocabulary.countDocuments(due),
  ]);
  return { items, dueTotal };
}

const snap = (s) => ({ repetitions: s.repetitions, intervalDays: s.intervalDays, easeFactor: s.easeFactor, dueAt: s.dueAt });

/**
 * Idempotent: the same (ownerId, requestId) never creates a second log or re-applies the schedule.
 * Order: insert log (unique index is the lock) -> conditionally update vocab (optimistic check on reviewCount).
 * If the vocab update fails/conflicts, the log is removed so history never disagrees with state.
 */
export async function submitReview(ownerId, { vocabularyId, rating, requestId }, now = new Date()) {
  const prior = await ReviewLog.findOne({ ownerId, requestId });
  if (prior) return { log: prior, entry: await getEntry(ownerId, prior.vocabularyId), duplicate: true };

  const v = await getEntry(ownerId, vocabularyId);
  const prev = v.srs.toObject();
  const next = schedule(prev, rating, now);

  let log;
  try {
    log = await ReviewLog.create({ ownerId, vocabularyId: v._id, requestId, rating, reviewedAt: now, previous: snap(prev), next: snap(next) });
  } catch (e) {
    if (e?.code === 11000) {
      const again = await ReviewLog.findOne({ ownerId, requestId });
      if (again) return { log: again, entry: await getEntry(ownerId, again.vocabularyId), duplicate: true };
    }
    throw e;
  }
  try {
    const merged = { ...v.toObject(), srs: { ...prev, ...next, lastReviewedAt: now, lastRating: rating, reviewCount: (prev.reviewCount || 0) + 1 } };
    const updated = await Vocabulary.findOneAndUpdate(
      { _id: v._id, ownerId, 'srs.reviewCount': prev.reviewCount || 0 },
      { $set: { srs: merged.srs, learningStatus: deriveStatus(merged) } }, { new: true });
    if (!updated) throw conflict('This word was just reviewed elsewhere. Reload and try again.', undefined, 'REVIEW_CONFLICT');
    return { log, entry: updated, duplicate: false };
  } catch (e) {
    await ReviewLog.deleteOne({ _id: log._id, ownerId }).catch(() => {});
    throw e;
  }
}
