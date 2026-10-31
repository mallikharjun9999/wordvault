import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { config } from '../config/env.js';
import { normalizeEmail } from '../utils/normalize.js';
import { AppError, unauthorized, conflict } from '../utils/AppError.js';

let dummyHash; // constant-time-ish response when the email is unknown
const getDummy = async () => (dummyHash ??= await bcrypt.hash('not-a-real-password', config.bcryptRounds));

export async function register({ email, password, displayName, timezone }) {
  const e = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  try {
    return await User.create({ email: e, passwordHash, displayName: displayName || '', ...(timezone ? { preferences: { timezone } } : {}) });
  } catch (err) {
    if (err?.code === 11000) throw conflict('An account with this email already exists.', undefined, 'EMAIL_TAKEN');
    throw err;
  }
}
export async function login({ email, password }) {
  const user = await User.findOne({ email: normalizeEmail(email) }).select('+passwordHash');
  const hash = user?.passwordHash ?? (await getDummy());
  const okPw = await bcrypt.compare(password, hash);
  if (!user || !okPw) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  return user;
}
export async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError(400, 'WRONG_PASSWORD', 'Current password is incorrect.');
  user.passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  user.tokenVersion += 1; // signs out every other session
  await user.save();
  return user;
}
export async function verifyPassword(userId, password) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw unauthorized('Password is incorrect.');
}
export async function logoutEverywhere(userId) { await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } }); }
export async function updatePreferences(userId, { displayName, ...prefs }) {
  const set = {};
  if (displayName !== undefined) set.displayName = displayName;
  for (const [k, v] of Object.entries(prefs)) set[`preferences.${k}`] = v;
  return User.findByIdAndUpdate(userId, { $set: set }, { new: true, runValidators: true });
}
