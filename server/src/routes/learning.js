import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler, ok } from '../utils/asyncHandler.js';
import * as review from '../services/reviewService.js';
import * as quiz from '../services/quizService.js';
import * as sentences from '../services/sentenceService.js';
import { getStats } from '../services/progressService.js';
import { exportVocabulary, exportEverything } from '../services/exportService.js';
import { aiStatus } from '../services/llm.js';
import * as S from '../validators/schemas.js';
import { LANGUAGES } from '../utils/languages.js';

export const reviews = Router();
reviews.get('/queue', asyncHandler(async (req, res) => {
  const { items, dueTotal } = await review.getQueue(req.userId, req.user.preferences.dailyReviewLimit);
  ok(res, { items }, { dueTotal });
}));
reviews.post('/', validate({ body: S.reviewSubmitSchema }), asyncHandler(async (req, res) => {
  const { log, entry, duplicate } = await review.submitReview(req.userId, req.body);
  ok(res, { review: log, entry, duplicate }, undefined, duplicate ? 200 : 201);
}));

export const quizzes = Router();
quizzes.post('/', validate({ body: S.quizGenerateSchema }), asyncHandler(async (req, res) => ok(res, { quiz: quiz.publicAttempt(await quiz.generateQuiz(req.userId, req.body)) }, undefined, 201)));
quizzes.get('/', asyncHandler(async (req, res) => ok(res, { attempts: (await quiz.listAttempts(req.userId)).map((a) => a.toJSON()) })));
quizzes.post('/:id/submit', validate({ params: z.object({ id: S.objectId }), body: S.quizSubmitSchema }),
  asyncHandler(async (req, res) => ok(res, { quiz: quiz.publicAttempt(await quiz.submitQuiz(req.userId, req.params.id, req.body.answers)) })));

export const sentenceRoutes = Router();
sentenceRoutes.post('/', validate({ body: S.sentenceSchema }), asyncHandler(async (req, res) => ok(res, await sentences.addSentence(req.userId, req.body), undefined, 201)));
sentenceRoutes.get('/', validate({ query: z.object({ vocabularyId: S.objectId.optional() }) }),
  asyncHandler(async (req, res) => ok(res, { sentences: await sentences.listSentences(req.userId, req.query.vocabularyId) })));
sentenceRoutes.delete('/:id', validate({ params: z.object({ id: S.objectId }) }), asyncHandler(async (req, res) => { await sentences.deleteSentence(req.userId, req.params.id); ok(res, { deleted: true }); }));

export const progress = Router();
progress.get('/', asyncHandler(async (req, res) => ok(res, await getStats(req.userId, req.user.preferences.timezone))));

export const languages = Router();
languages.get('/', (_req, res) => ok(res, { languages: LANGUAGES })); // English + Telugu: the only supported languages

export const exportRoutes = Router();
exportRoutes.get('/vocabulary', validate({ query: S.exportFormatSchema }), asyncHandler(async (req, res) => {
  const f = await exportVocabulary(req.userId, req.query.format);
  res.set({ 'Content-Type': f.type, 'Content-Disposition': `attachment; filename="${f.filename}"`, 'Cache-Control': 'no-store' }).send(f.body);
}));
exportRoutes.get('/account', asyncHandler(async (req, res) => {
  const data = await exportEverything(req.userId);
  res.set({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="wordvault-account-export.json"', 'Cache-Control': 'no-store' }).send(JSON.stringify(data, null, 2));
}));
export const aiRoutes = Router();
aiRoutes.get('/status', (_req, res) => ok(res, { generation: aiStatus('ai') }));
