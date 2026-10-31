import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/index.js';
import { unauthorized } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const COOKIE_NAME = 'wv_token';

export const cookieOptions = () => ({
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: config.isProd ? 'none' : 'lax',
  path: '/',
  maxAge: config.sessionDays * 86400000,
});

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id), tv: user.tokenVersion }, config.jwtSecret, { expiresIn: `${config.sessionDays}d`, algorithm: 'HS256' });

// Derives identity ONLY from the verified cookie. Any userId in body/params/query is ignored.
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw unauthorized();
  let payload;
  try { payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }); } catch { throw unauthorized('Session expired or invalid'); }
  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tv) throw unauthorized('Session expired or invalid');
  req.user = user;
  req.userId = user._id;
  next();
});
