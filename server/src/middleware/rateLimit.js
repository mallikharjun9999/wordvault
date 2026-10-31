import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

const make = (opts) => rateLimit({
  standardHeaders: true, legacyHeaders: false,
  skip: () => config.isTest && !process.env.TEST_RATE_LIMITS,
  handler: (_req, res) => res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down and try again later.' } }),
  ...opts,
});
export const apiLimiter = make({ windowMs: 15 * 60_000, limit: 600 });
export const authLimiter = make({ windowMs: 15 * 60_000, limit: 20 }); // login/register brute-force guard
export const aiLimiter = () => make({ windowMs: 60 * 60_000, limit: config.aiGenerationsPerHour, keyGenerator: (req) => String(req.userId || req.ip) });
