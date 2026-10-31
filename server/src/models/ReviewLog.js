import mongoose from 'mongoose';
import { cleanJson } from './plugins.js';
const { Schema } = mongoose;
const state = new Schema({ repetitions: Number, intervalDays: Number, easeFactor: Number, dueAt: Date }, { _id: false });

const reviewLogSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  vocabularyId: { type: Schema.Types.ObjectId, ref: 'Vocabulary', required: true },
  requestId: { type: String, required: true, maxlength: 80 }, // client-generated idempotency key
  rating: { type: String, enum: ['again', 'hard', 'good', 'easy'], required: true },
  reviewedAt: { type: Date, required: true },
  previous: state, next: state,
}, { timestamps: false });
reviewLogSchema.index({ ownerId: 1, requestId: 1 }, { unique: true }); // idempotency
reviewLogSchema.index({ ownerId: 1, reviewedAt: -1 });
reviewLogSchema.index({ ownerId: 1, vocabularyId: 1, reviewedAt: -1 });
cleanJson(reviewLogSchema, ['ownerId']);
export const ReviewLog = mongoose.model('ReviewLog', reviewLogSchema);
