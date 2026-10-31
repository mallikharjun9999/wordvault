import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, ok } from '../utils/asyncHandler.js';
import * as vocab from '../services/vocabularyService.js';
import { generateEntry } from '../services/generationService.js';
import * as S from '../validators/schemas.js';

const r = Router();
const idParam = z.object({ id: S.objectId });

r.get('/', validate({ query: S.listQuerySchema }), asyncHandler(async (req, res) => {
  const { items, meta } = await vocab.listEntries(req.userId, req.query); ok(res, { items }, meta);
}));
r.get('/facets', asyncHandler(async (req, res) => ok(res, await vocab.facets(req.userId))));
r.post('/', validate({ body: S.vocabCreateSchema }), asyncHandler(async (req, res) => ok(res, { entry: await vocab.createEntry(req.userId, req.body) }, undefined, 201)));
r.post('/generate', aiLimiter(), validate({ body: S.generateSchema }), asyncHandler(async (req, res) => {
  const { entry, existing } = await generateEntry(req.userId, req.body.word);
  ok(res, { entry, existing, message: existing ? 'This word is already in your vault.' : undefined }, undefined, existing ? 200 : 201);
}));
// Friendly answer when someone opens the POST-only endpoint in a browser tab (a GET would otherwise fall through to /:id).
r.get('/generate', (_req, res) => res.status(405).set('Allow', 'POST').json({ success: false, error: { code: 'METHOD_NOT_ALLOWED',
  message: 'This endpoint only accepts POST with {"word": "..."}. Use the Generate with AI button in the app (Add word page).' } }));
r.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, { entry: await vocab.getEntry(req.userId, req.params.id) })));
r.patch('/:id', validate({ params: idParam, body: S.vocabUpdateSchema }), asyncHandler(async (req, res) => ok(res, { entry: await vocab.updateEntry(req.userId, req.params.id, req.body) })));
r.delete('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => { await vocab.deleteEntry(req.userId, req.params.id); ok(res, { deleted: true }); }));
r.post('/:id/recognize', validate({ params: idParam, body: z.object({ recognized: z.boolean().default(true) }).strict() }),
  asyncHandler(async (req, res) => ok(res, { entry: await vocab.markRecognized(req.userId, req.params.id, req.body.recognized) })));

export default r;
