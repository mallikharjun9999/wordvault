
import { config } from '../config/env.js';
import { forbidden } from '../utils/AppError.js';

const allowedOrigins = new Set([
  ...(config.clientUrls || []),
  'https://wordvaultz.vercel.app'
]);

export function csrfGuard(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const origin = req.get('origin');

  if (!origin || !allowedOrigins.has(origin)) {
    return next(forbidden('Origin not allowed'));
  }

  if (req.get('x-wordvault-client') !== '1') {
    return next(forbidden('Missing CSRF header'));
  }

  next();
}
