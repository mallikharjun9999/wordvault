import { Sentence, Vocabulary } from '../models/index.js';
import { getEntry } from './vocabularyService.js';
import { deriveStatus } from './status.js';

export async function addSentence(ownerId, { vocabularyId, text, selfAssessment, confidence }) {
  const v = await getEntry(ownerId, vocabularyId);
  const s = await Sentence.create({ ownerId, vocabularyId: v._id, text, selfAssessment, confidence: confidence ?? 3 });
  v.progress.sentenceTotal += 1;
  if (selfAssessment === 'correct') v.progress.sentenceCorrect += 1;
  v.learningStatus = deriveStatus(v);
  await v.save();
  return { sentence: s, entry: v };
}
export const listSentences = (ownerId, vocabularyId, limit = 50) =>
  Sentence.find({ ownerId, ...(vocabularyId ? { vocabularyId } : {}) }).sort({ createdAt: -1 }).limit(limit);
export async function deleteSentence(ownerId, id) {
  await Sentence.deleteOne({ _id: id, ownerId });
}
export { Vocabulary };
