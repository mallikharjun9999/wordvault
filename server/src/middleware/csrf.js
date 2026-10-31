import { config } from '../config/env.js';
import { forbidden } from '../utils/AppError.js';

// CSRF defence for cookie auth: (1) SameSite=Lax cookie, (2) strict CORS allow-list,
// (3) every state-changing request must carry a custom header (cross-site forms cannot set it and
// cross-origin fetches with it require a CORS preflight that we deny), (4) Origin must match when present.
export function csrfGuard(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !config.clientUrls.includes(origin)) return next(forbidden('Origin not allowed'));
  if (req.get('x-wordvault-client') !== '1') return next(forbidden('Missing CSRF header'));
  next();
}
