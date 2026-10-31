import mongoose from 'mongoose';
import { cleanJson } from './plugins.js';
const { Schema } = mongoose;

// LEGACY ARCHIVE. WordVault is English + Telugu only, and Telugu lives in the main Vocabulary entry, so nothing
// creates or edits these documents any more. The collection is kept (never dropped or migrated) so users do not
// lose translations they saved earlier: they stay in exports and are removed with their word / account.
// `language` is therefore a plain string here: stored values may be codes the app no longer supports.

const tMeaning = new Schema({
  meaning: { type: String, trim: true, maxlength: 400, default: '' },
  explanation: { type: String, trim: true, maxlength: 2000, default: '' },
  examples: { type: [{ type: String, trim: true, maxlength: 600 }], default: [] }, // aligned by index to vocabulary.meanings[i].examples
}, { _id: false });

const translationSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  vocabularyId: { type: Schema.Types.ObjectId, ref: 'Vocabulary', required: true },
  language: { type: String, required: true }, // legacy code, may be unsupported today
  meanings: { type: [tMeaning], default: [] }, // aligned by index to vocabulary.meanings
  status: { type: String, enum: ['completed'], default: 'completed' }, // failed generations are never stored
  origin: { type: String, enum: ['generated', 'manual', 'edited'], required: true },
  reviewed: { type: Boolean, default: false }, // set only by the user; generated text is NOT verified by default
  generation: { provider: String, model: String, generatedAt: Date, _id: false },
}, { timestamps: true });

translationSchema.index({ ownerId: 1, vocabularyId: 1, language: 1 }, { unique: true });
translationSchema.index({ ownerId: 1, language: 1 });
cleanJson(translationSchema, ['ownerId']);
export const Translation = mongoose.model('Translation', translationSchema);
