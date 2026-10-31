import { User } from './User.js';
import { Vocabulary } from './Vocabulary.js';
import { Translation } from './Translation.js';
import { ReviewLog } from './ReviewLog.js';
import { QuizAttempt } from './QuizAttempt.js';
import { Sentence } from './Sentence.js';

export { User, Vocabulary, Translation, ReviewLog, QuizAttempt, Sentence };
export const ALL_MODELS = [User, Vocabulary, Translation, ReviewLog, QuizAttempt, Sentence];
// Creates missing indexes. Never drops existing indexes or data. Safe to rerun.
export async function ensureIndexes() {
  for (const m of ALL_MODELS) await m.createIndexes();
}
