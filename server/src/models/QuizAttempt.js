import mongoose from 'mongoose';
import { cleanJson } from './plugins.js';
const { Schema } = mongoose;

export const QUESTION_TYPES = ['meaning', 'fill_blank', 'correct_sentence', 'synonym', 'antonym', 'context_word', 'en_to_te', 'te_to_en'];
const question = new Schema({
  qid: String, type: { type: String, enum: QUESTION_TYPES }, vocabularyId: Schema.Types.ObjectId,
  prompt: String, options: [{ id: String, text: String, _id: false }],
  correctOptionId: String, explanation: String, // never sent to the client before submission
  answerOptionId: { type: String, default: null }, correct: { type: Boolean, default: null },
}, { _id: false });

const quizSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
  questions: { type: [question], default: [] },
  score: { type: Number, default: 0 }, total: { type: Number, default: 0 },
  completedAt: Date,
}, { timestamps: true });
quizSchema.index({ ownerId: 1, createdAt: -1 });
quizSchema.index({ ownerId: 1, status: 1, completedAt: -1 });
cleanJson(quizSchema, ['ownerId']);
export const QuizAttempt = mongoose.model('QuizAttempt', quizSchema);
