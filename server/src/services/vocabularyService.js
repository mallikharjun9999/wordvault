import { Vocabulary, Translation, ReviewLog, Sentence } from '../models/index.js';
import { normalizeWord, cleanDisplayWord, escapeRegex } from '../utils/normalize.js';
import { conflict, notFound } from '../utils/AppError.js';
import { deriveStatus } from './status.js';

const lc = (arr) => [...new Set((arr || []).map((s) => s.trim().toLowerCase()).filter(Boolean))];

export const findByWord = (ownerId, word) => Vocabulary.findOne({ ownerId, normalizedWord: normalizeWord(word) });

export async function createEntry(ownerId, input, extra = {}) {
  const word = cleanDisplayWord(input.word);
  const doc = { ...input, ...extra, word, normalizedWord: normalizeWord(word), ownerId };
  if (doc.tags) doc.tags = lc(doc.tags);
  if (doc.categories) doc.categories = lc(doc.categories);
  try { return await Vocabulary.create(doc); }
  catch (e) {
    if (e?.code === 11000) {
      const existing = await findByWord(ownerId, word);
      throw conflict('This word is already in your vault.', { existingId: existing ? String(existing._id) : null }, 'DUPLICATE_WORD');
    }
    throw e;
  }
}

export async function getEntry(ownerId, id) {
  const v = await Vocabulary.findOne({ _id: id, ownerId });
  if (!v) throw notFound('Vocabulary entry not found');
  return v;
}

export async function updateEntry(ownerId, id, patch) {
  const v = await getEntry(ownerId, id);
  const data = { ...patch };
  if (data.word !== undefined) { data.word = cleanDisplayWord(data.word); data.normalizedWord = normalizeWord(data.word); }
  if (data.tags) data.tags = lc(data.tags);
  if (data.categories) data.categories = lc(data.categories);
  v.set(data);
  try { await v.save(); } catch (e) {
    if (e?.code === 11000) throw conflict('Another entry with this word already exists.', undefined, 'DUPLICATE_WORD');
    throw e;
  }
  return v;
}

export async function markRecognized(ownerId, id, recognized = true) {
  const v = await getEntry(ownerId, id);
  v.progress.recognizedManual = recognized;
  v.learningStatus = deriveStatus(v);
  await v.save();
  return v;
}

export async function deleteEntry(ownerId, id) {
  const v = await getEntry(ownerId, id);
  await Promise.all([
    Translation.deleteMany({ ownerId, vocabularyId: v._id }),
    ReviewLog.deleteMany({ ownerId, vocabularyId: v._id }),
    Sentence.deleteMany({ ownerId, vocabularyId: v._id }),
  ]);
  await Vocabulary.deleteOne({ _id: v._id, ownerId });
}

export async function listEntries(ownerId, q) {
  const f = { ownerId };
  const and = [];
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q.normalize('NFC')), 'i');
    and.push({ $or: [{ word: rx }, { 'meanings.simpleExplanation': rx }, { 'meanings.detailedExplanation': rx }, { 'meanings.teluguMeaning': rx }, { 'meanings.teluguExplanation': rx }, { notes: rx }] });
  }
  if (q.category) f.categories = q.category.toLowerCase();
  if (q.tag) f.tags = q.tag.toLowerCase();
  if (q.status) f.learningStatus = q.status;
  if (q.favorite) f.favorite = q.favorite === 'true';
  if (q.difficult === 'true') and.push({ $or: [{ 'srs.lapses': { $gte: 2 } }, { 'srs.easeFactor': { $lt: 2.0 } }] });
  if (and.length) f.$and = and;
  const sort = { alpha: { normalizedWord: 1 }, newest: { createdAt: -1 }, oldest: { createdAt: 1 }, due: { 'srs.dueAt': 1 } }[q.sort];
  const [items, total] = await Promise.all([
    Vocabulary.find(f).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit),
    Vocabulary.countDocuments(f),
  ]);
  return { items, meta: { page: q.page, limit: q.limit, total, pages: Math.max(1, Math.ceil(total / q.limit)) } };
}

export async function facets(ownerId) {
  const [categories, tags] = await Promise.all([Vocabulary.distinct('categories', { ownerId }), Vocabulary.distinct('tags', { ownerId })]);
  return { categories: categories.sort(), tags: tags.sort() };
}
