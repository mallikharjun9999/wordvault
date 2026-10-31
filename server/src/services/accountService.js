import { User, Vocabulary, Translation, ReviewLog, QuizAttempt, Sentence } from '../models/index.js';
import { verifyPassword } from './authService.js';
import { AppError } from '../utils/AppError.js';

const OWNED = [['translations', Translation], ['reviewLogs', ReviewLog], ['quizAttempts', QuizAttempt], ['sentences', Sentence], ['vocabulary', Vocabulary]];

/**
 * Deletes every owned record, then VERIFIES none remain, and only then deletes the user.
 * Order matters: if anything fails part-way the account still exists, so the user can simply retry
 * (every step is idempotent). The API only reports success when the verification count is zero.
 */
export async function deleteAccount(userId, password) {
  await verifyPassword(userId, password);
  const deleted = {};
  for (const [name, Model] of OWNED) deleted[name] = (await Model.deleteMany({ ownerId: userId })).deletedCount;
  const leftovers = {};
  for (const [name, Model] of OWNED) { const n = await Model.countDocuments({ ownerId: userId }); if (n) leftovers[name] = n; }
  if (Object.keys(leftovers).length) throw new AppError(500, 'DELETION_INCOMPLETE', 'Some data could not be removed. Your account was kept; please try again.', leftovers);
  await User.deleteOne({ _id: userId });
  return deleted;
}
