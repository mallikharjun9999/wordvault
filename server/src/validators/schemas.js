import { z } from 'zod';
import { LANGUAGE_CODES } from '../utils/languages.js';
import { PARTS_OF_SPEECH, EXAMPLE_CONTEXTS } from '../models/Vocabulary.js';
import { QUESTION_TYPES } from '../models/QuizAttempt.js';
import { isValidTimezone } from '../utils/dates.js';

const str = (max, min = 0) => z.string().trim().min(min).max(max);
const strList = (itemMax, maxItems) => z.array(str(itemMax, 1)).max(maxItems);
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
// The one language validator. Anything other than English/Telugu fails with a 400 VALIDATION_ERROR naming the supported codes.
export const langCode = z.enum(LANGUAGE_CODES, { error: `Unsupported language. Supported languages: ${LANGUAGE_CODES.join(', ')}.` });

export const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(10, 'Password must be at least 10 characters').max(128)
    .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Password must contain letters and numbers'),
  displayName: str(80).optional(),
  timezone: z.string().refine(isValidTimezone, 'Invalid timezone').optional(),
}).strict();
export const loginSchema = z.object({ email: z.string().trim().max(254), password: z.string().max(128) }).strict();
export const changePasswordSchema = z.object({
  currentPassword: z.string().max(128),
  newPassword: registerSchema.shape.password,
}).strict();
export const deleteAccountSchema = z.object({ password: z.string().max(128), confirm: z.literal('DELETE') }).strict();
export const preferencesSchema = z.object({
  displayName: str(80).optional(),
  explanationLanguage: langCode.optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  timezone: z.string().refine(isValidTimezone, 'Invalid timezone').optional(),
  dailyReviewLimit: z.number().int().min(5).max(200).optional(),
}).strict();

const example = z.object({ en: str(400, 1), te: str(600).default(''), context: z.enum(EXAMPLE_CONTEXTS).default('general') });
const meaning = z.object({
  partOfSpeech: z.enum(PARTS_OF_SPEECH).default('other'),
  simpleExplanation: str(600).default(''), detailedExplanation: str(2000).default(''),
  teluguMeaning: str(400).default(''), teluguExplanation: str(2000).default(''),
  examples: z.array(example).max(12).default([]),
});
const content = {
  pronunciation: str(120).default(''), ipa: str(120).default(''),
  meanings: z.array(meaning).max(10),
  synonyms: z.array(z.object({ word: str(80, 1), difference: str(400).default('') })).max(15),
  antonyms: strList(80, 15), collocations: strList(160, 20), phrases: strList(200, 20), sentencePatterns: strList(200, 10),
  usageSituations: z.array(z.object({ situation: str(200, 1), example: str(400).default('') })).max(10),
  commonMistakes: z.array(z.object({ mistake: str(300, 1), correction: str(300, 1), note: str(400).default('') })).max(10),
  usageNotes: str(2000), exercises: z.array(z.object({ prompt: str(400, 1), answer: str(300, 1) })).max(10),
};
const userFields = {
  tags: strList(40, 30), categories: strList(40, 30), favorite: z.boolean(), notes: str(4000),
};
export const vocabCreateSchema = z.object({
  word: str(120, 1),
  ...Object.fromEntries(Object.entries({ ...content, ...userFields }).map(([k, v]) => [k, v.optional()])),
}).strict();
export const vocabUpdateSchema = vocabCreateSchema.partial().strict();

// Strict contract for AI output: must have usable Telugu-first content.
export const generatedVocabSchema = z.object({
  pronunciation: content.pronunciation, ipa: content.ipa,
  meanings: z.array(meaning.extend({
    simpleExplanation: str(600, 1), teluguMeaning: str(400, 1),
    examples: z.array(example).min(1).max(12),
  })).min(1).max(10),
  synonyms: content.synonyms.default([]), antonyms: content.antonyms.default([]),
  collocations: content.collocations.default([]), phrases: content.phrases.default([]),
  sentencePatterns: content.sentencePatterns.default([]), usageSituations: content.usageSituations.default([]),
  commonMistakes: content.commonMistakes.default([]), usageNotes: content.usageNotes.default(''),
  exercises: content.exercises.default([]),
  tags: strList(40, 10).default([]), categories: strList(40, 10).default([]),
}).strip();

export const generateSchema = z.object({ word: str(120, 1) }).strict();
export const listQuerySchema = z.object({
  q: str(120).optional(), category: str(40).optional(), tag: str(40).optional(),
  status: z.enum(['documented', 'recognized', 'active', 'mastered']).optional(),
  favorite: z.enum(['true', 'false']).optional(), difficult: z.enum(['true', 'false']).optional(),
  sort: z.enum(['alpha', 'newest', 'oldest', 'due']).default('newest'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const reviewSubmitSchema = z.object({
  vocabularyId: objectId, rating: z.enum(['again', 'hard', 'good', 'easy']), requestId: str(80, 8),
}).strict();
export const quizGenerateSchema = z.object({
  count: z.number().int().min(1).max(20).default(10),
  types: z.array(z.enum(QUESTION_TYPES)).min(1).optional(),
}).strict();
export const quizSubmitSchema = z.object({
  answers: z.array(z.object({ qid: str(40, 1), optionId: str(40, 1) })).min(1).max(50),
}).strict();
export const sentenceSchema = z.object({
  vocabularyId: objectId, text: str(500, 3),
  selfAssessment: z.enum(['correct', 'unsure', 'incorrect']), confidence: z.number().int().min(1).max(5).optional(),
}).strict();
export const exportFormatSchema = z.object({ format: z.enum(['json', 'csv', 'md']).default('json') });
