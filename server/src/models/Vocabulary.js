import mongoose from 'mongoose';
import { cleanJson } from './plugins.js';

const { Schema } = mongoose;
export const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'idiom', 'phrasal verb', 'expression', 'other'];
export const EXAMPLE_CONTEXTS = ['general', 'everyday', 'professional', 'educational'];
export const LEARNING_STATUSES = ['documented', 'recognized', 'active', 'mastered'];

const exampleSchema = new Schema({
  en: { type: String, required: true, trim: true, maxlength: 400 },
  te: { type: String, trim: true, maxlength: 600, default: '' },
  context: { type: String, enum: EXAMPLE_CONTEXTS, default: 'general' },
}, { _id: false });

const meaningSchema = new Schema({
  partOfSpeech: { type: String, enum: PARTS_OF_SPEECH, default: 'other' },
  simpleExplanation: { type: String, trim: true, maxlength: 600, default: '' },
  detailedExplanation: { type: String, trim: true, maxlength: 2000, default: '' },
  teluguMeaning: { type: String, trim: true, maxlength: 400, default: '' },
  teluguExplanation: { type: String, trim: true, maxlength: 2000, default: '' },
  examples: { type: [exampleSchema], default: [] },
}, { _id: false });

const vocabularySchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: false },
  word: { type: String, required: true, trim: true, maxlength: 120 },
  normalizedWord: { type: String, required: true, maxlength: 120 },
  pronunciation: { type: String, trim: true, maxlength: 120, default: '' },
  ipa: { type: String, trim: true, maxlength: 120, default: '' },
  meanings: { type: [meaningSchema], default: [] },
  synonyms: { type: [new Schema({ word: { type: String, trim: true, maxlength: 80 }, difference: { type: String, trim: true, maxlength: 400, default: '' } }, { _id: false })], default: [] },
  antonyms: { type: [{ type: String, trim: true, maxlength: 80 }], default: [] },
  collocations: { type: [{ type: String, trim: true, maxlength: 160 }], default: [] },
  phrases: { type: [{ type: String, trim: true, maxlength: 200 }], default: [] },
  sentencePatterns: { type: [{ type: String, trim: true, maxlength: 200 }], default: [] },
  usageSituations: { type: [new Schema({ situation: { type: String, trim: true, maxlength: 200 }, example: { type: String, trim: true, maxlength: 400, default: '' } }, { _id: false })], default: [] },
  commonMistakes: { type: [new Schema({ mistake: { type: String, trim: true, maxlength: 300 }, correction: { type: String, trim: true, maxlength: 300 }, note: { type: String, trim: true, maxlength: 400, default: '' } }, { _id: false })], default: [] },
  usageNotes: { type: String, trim: true, maxlength: 2000, default: '' },
  exercises: { type: [new Schema({ prompt: { type: String, trim: true, maxlength: 400 }, answer: { type: String, trim: true, maxlength: 300 } }, { _id: false })], default: [] },
  tags: { type: [{ type: String, trim: true, lowercase: true, maxlength: 40 }], default: [] },
  categories: { type: [{ type: String, trim: true, lowercase: true, maxlength: 40 }], default: [] },
  favorite: { type: Boolean, default: false },
  notes: { type: String, trim: true, maxlength: 4000, default: '' },
  source: { type: String, enum: ['manual', 'ai'], default: 'manual' },
  generation: { provider: String, model: String, generatedAt: Date, _id: false },

  learningStatus: { type: String, enum: LEARNING_STATUSES, default: 'documented' },
  // Evidence counters used to derive learningStatus (see services/status.js)
  progress: {
    quizCorrect: { type: Number, default: 0 }, quizTotal: { type: Number, default: 0 },
    sentenceCorrect: { type: Number, default: 0 }, sentenceTotal: { type: Number, default: 0 },
    recognizedManual: { type: Boolean, default: false },
  },
  // Spaced-repetition state (see services/srs.js)
  srs: {
    repetitions: { type: Number, default: 0 }, intervalDays: { type: Number, default: 0 },
    easeFactor: { type: Number, default: 2.5 }, lapses: { type: Number, default: 0 },
    dueAt: { type: Date, default: () => new Date() }, lastReviewedAt: { type: Date, default: null },
    lastRating: { type: String, enum: ['again', 'hard', 'good', 'easy', null], default: null },
    reviewCount: { type: Number, default: 0 },
  },
}, { timestamps: true });

// Required: the same user cannot save the same normalized word twice; different users can.
vocabularySchema.index({ ownerId: 1, normalizedWord: 1 }, { unique: true });
vocabularySchema.index({ ownerId: 1, createdAt: -1 });
vocabularySchema.index({ ownerId: 1, 'srs.dueAt': 1 });
vocabularySchema.index({ ownerId: 1, favorite: 1, createdAt: -1 });
vocabularySchema.index({ ownerId: 1, learningStatus: 1 });
vocabularySchema.index({ ownerId: 1, categories: 1 });
vocabularySchema.index({ ownerId: 1, tags: 1 });
vocabularySchema.index({ ownerId: 1, 'srs.lapses': 1 });
cleanJson(vocabularySchema, ['ownerId']);
export const Vocabulary = mongoose.model('Vocabulary', vocabularySchema);
