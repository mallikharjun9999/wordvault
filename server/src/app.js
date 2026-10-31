import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import { dbHealth } from './config/db.js';
import { csrfGuard } from './middleware/csrf.js';
import { requireAuth } from './middleware/auth.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import vocabRoutes from './routes/vocabulary.js';
import { reviews, quizzes, sentenceRoutes, progress, languages, exportRoutes, aiRoutes } from './routes/learning.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || config.clientUrls.includes(origin)), // allow-list only, never "*"
    credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'X-WordVault-Client'],
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', apiLimiter, csrfGuard);

  app.get('/api/health', async (_req, res) => {
    const db = await dbHealth();
    res.status(db.ok ? 200 : 503).json({ success: db.ok, data: { status: db.ok ? 'ok' : 'degraded', db } });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/vocabulary', requireAuth, vocabRoutes);
  app.use('/api/reviews', requireAuth, reviews);
  app.use('/api/quizzes', requireAuth, quizzes);
  app.use('/api/sentences', requireAuth, sentenceRoutes);
  app.use('/api/progress', requireAuth, progress);
  app.use('/api/languages', requireAuth, languages);
  app.use('/api/export', requireAuth, exportRoutes);
  app.use('/api/ai', requireAuth, aiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
