import mongoose from 'mongoose';
import { cleanJson } from './plugins.js';
import { LANGUAGE_CODES, DEFAULT_LANGUAGE, toSupportedLanguage } from '../utils/languages.js';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  displayName: { type: String, trim: true, maxlength: 80, default: '' },
  // Single role for every account. No admin concept exists anywhere in the app.
  role: { type: String, enum: ['user'], default: 'user', immutable: true },
  tokenVersion: { type: Number, default: 0 }, // bump to invalidate all existing sessions
  preferences: {
    explanationLanguage: { type: String, enum: [...LANGUAGE_CODES], default: DEFAULT_LANGUAGE }, // 'en' | 'te'
    theme: { type: String, enum: ['system', 'light', 'dark'], default: 'system' },
    timezone: { type: String, default: 'UTC', maxlength: 64 },
    dailyReviewLimit: { type: Number, min: 5, max: 200, default: 30 },
  },
}, { timestamps: true });
cleanJson(userSchema, ['passwordHash', 'tokenVersion']);

// Backward compatibility: accounts created while more languages existed may still store e.g. "hi".
// Report a supported value to clients WITHOUT touching the stored document (no migration, no data loss).
const baseToJson = userSchema.get('toJSON');
userSchema.set('toJSON', {
  ...baseToJson,
  transform(doc, ret, options) {
    const out = baseToJson.transform(doc, ret, options);
    if (out.preferences) out.preferences.explanationLanguage = toSupportedLanguage(out.preferences.explanationLanguage);
    return out;
  },
});
export const User = mongoose.model('User', userSchema);
