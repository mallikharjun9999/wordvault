import mongoose from 'mongoose';
import { cleanJson } from './plugins.js';
const { Schema } = mongoose;

const sentenceSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  vocabularyId: { type: Schema.Types.ObjectId, ref: 'Vocabulary', required: true },
  text: { type: String, required: true, trim: true, maxlength: 500 },
  // Honest self-assessment: no automatic grading is performed.
  selfAssessment: { type: String, enum: ['correct', 'unsure', 'incorrect'], required: true },
  confidence: { type: Number, min: 1, max: 5, default: 3 },
}, { timestamps: { createdAt: true, updatedAt: false } });
sentenceSchema.index({ ownerId: 1, createdAt: -1 });
sentenceSchema.index({ ownerId: 1, vocabularyId: 1, createdAt: -1 });
cleanJson(sentenceSchema, ['ownerId']);
export const Sentence = mongoose.model('Sentence', sentenceSchema);
