import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth, signToken, cookieOptions, COOKIE_NAME } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, ok } from '../utils/asyncHandler.js';
import * as auth from '../services/authService.js';
import * as account from '../services/accountService.js';
import * as S from '../validators/schemas.js';

const r = Router();
const setSession = (res, user) => res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
const clear = (res) => { const { maxAge, ...o } = cookieOptions(); res.clearCookie(COOKIE_NAME, o); };

r.post('/register', authLimiter, validate({ body: S.registerSchema }), asyncHandler(async (req, res) => {
  const user = await auth.register(req.body); setSession(res, user); ok(res, { user }, undefined, 201);
}));
r.post('/login', authLimiter, validate({ body: S.loginSchema }), asyncHandler(async (req, res) => {
  const user = await auth.login(req.body); setSession(res, user); ok(res, { user });
}));
r.post('/logout', (_req, res) => { clear(res); ok(res, { loggedOut: true }); });

r.use(requireAuth);
r.get('/me', (req, res) => ok(res, { user: req.user }));
r.patch('/me', validate({ body: S.preferencesSchema }), asyncHandler(async (req, res) => ok(res, { user: await auth.updatePreferences(req.userId, req.body) })));
r.post('/change-password', authLimiter, validate({ body: S.changePasswordSchema }), asyncHandler(async (req, res) => {
  const user = await auth.changePassword(req.userId, req.body.currentPassword, req.body.newPassword);
  setSession(res, user); ok(res, { changed: true });
}));
r.post('/logout-everywhere', asyncHandler(async (req, res) => { await auth.logoutEverywhere(req.userId); clear(res); ok(res, { loggedOut: true }); }));
r.post('/delete-account', authLimiter, validate({ body: S.deleteAccountSchema }), asyncHandler(async (req, res) => {
  const deleted = await account.deleteAccount(req.userId, req.body.password); clear(res); ok(res, { deleted });
}));
export default r;
