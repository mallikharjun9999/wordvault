import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const notFoundHandler = (req, _res, next) => next(new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`));

export function errorHandler(err, req, res, _next) {
  let e = err;
  if (err instanceof ZodError) {
    e = new AppError(400, 'VALIDATION_ERROR', 'Invalid request data',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  } else if (err instanceof mongoose.Error.ValidationError) {
    e = new AppError(400, 'VALIDATION_ERROR', 'Invalid data', Object.values(err.errors).map((x) => ({ path: x.path, message: x.message })));
  } else if (err instanceof mongoose.Error.CastError) {
    e = new AppError(400, 'INVALID_ID', 'Invalid identifier');
  } else if (err?.code === 11000) {
    e = new AppError(409, 'DUPLICATE', 'A record with these unique values already exists');
  } else if (err?.type === 'entity.too.large') {
    e = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
  } else if (err?.type === 'entity.parse.failed') {
    e = new AppError(400, 'INVALID_JSON', 'Malformed JSON body');
  } else if (['MongoServerSelectionError', 'MongoNetworkError', 'MongooseServerSelectionError'].includes(err?.name)) {
    e = new AppError(503, 'DATABASE_UNAVAILABLE', 'Database is unavailable. Please try again shortly.');
  }
  if (!(e instanceof AppError)) {
    if (!config.isTest) console.error(`[error] ${req.method} ${req.path}:`, err?.name, err?.message); // no bodies, no secrets
    e = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong');
  }
  res.status(e.status).json({ success: false, error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } });
}
