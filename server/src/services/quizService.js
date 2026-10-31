import crypto from 'node:crypto';
import { Vocabulary, QuizAttempt } from '../models/index.js';
import { deriveStatus } from './status.js';
import { QUESTION_TYPES } from '../models/QuizAttempt.js';
import { AppError, notFound, conflict } from '../utils/AppError.js';
import { escapeRegex } from '../utils/normalize.js';

const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const key = (s) => String(s).normalize('NFC').trim().toLowerCase();
const first = (v) => v.meanings[0];

/** Picks up to n distinct distractor texts, never equal to `correct` or any `avoid` text. */
function pick(pool, correct, avoid = [], n = 3) {
  const seen = new Set([key(correct), ...avoid.map(key)]);
  const out = [];
  for (const t of shuffle(pool)) { const k = key(t); if (t && k && !seen.has(k)) { seen.add(k); out.push(t); if (out.length === n) break; } }
  return out;
}
function build(type, v, others, text, explanation, correct, distractors, min = 2) {
  if (!correct || distractors.length < min) return null;
  const texts = shuffle([correct, ...distractors]);
  const options = texts.map((t, i) => ({ id: 'abcdef'[i], text: t }));
  return { qid: crypto.randomUUID().slice(0, 8), type, vocabularyId: v._id, prompt: text, options,
    correctOptionId: options.find((o) => key(o.text) === key(correct)).id, explanation };
}

const BUILDERS = {
  meaning: (v, o) => { const m = first(v); const c = m?.simpleExplanation;
    return build('meaning', v, o, `What does “${v.word}” mean?`, `“${v.word}”: ${c}`, c, pick(o.flatMap((x) => x.meanings.slice(0, 1).map((mm) => mm.simpleExplanation)), c)); },
  fill_blank: (v, o) => {
    const rx = new RegExp(`\\b${escapeRegex(v.word)}\\b`, 'i');
    const ex = v.meanings.flatMap((m) => m.examples).find((e) => rx.test(e.en));
    if (!ex) return null;
    return build('fill_blank', v, o, `Fill in the blank: ${ex.en.replace(rx, '_____')}`, `Full sentence: ${ex.en}`, v.word, pick(o.map((x) => x.word), v.word));
  },
  correct_sentence: (v, o) => { const cm = v.commonMistakes[0]; if (!cm) return null;
    return build('correct_sentence', v, o, `Which sentence is correct? (word: “${v.word}”)`, cm.note || `Correct: ${cm.correction}`, cm.correction, [cm.mistake], 1); },
  synonym: (v, o) => { const c = v.synonyms[0]?.word;
    return build('synonym', v, o, `Which word is closest in meaning to “${v.word}”?`, `“${c}” is a synonym of “${v.word}”.`, c,
      pick([...v.antonyms, ...o.flatMap((x) => x.synonyms.map((s) => s.word))], c, v.synonyms.map((s) => s.word))); },
  antonym: (v, o) => { const c = v.antonyms[0];
    return build('antonym', v, o, `Which word is the opposite of “${v.word}”?`, `“${c}” is an antonym of “${v.word}”.`, c,
      pick([...v.synonyms.map((s) => s.word), ...o.flatMap((x) => x.antonyms)], c, v.antonyms)); },
  context_word: (v, o) => { const u = v.usageSituations[0]; if (!u) return null;
    return build('context_word', v, o, `Which word best fits this situation? ${u.situation}`, u.example ? `Example: ${u.example}` : `“${v.word}” fits this situation.`, v.word, pick(o.map((x) => x.word), v.word)); },
  en_to_te: (v, o) => { const c = first(v)?.teluguMeaning;
    return build('en_to_te', v, o, `Choose the Telugu meaning of “${v.word}”`, `“${v.word}” = ${c}`, c, pick(o.map((x) => first(x)?.teluguMeaning), c)); },
  te_to_en: (v, o) => { const t = first(v)?.teluguMeaning; if (!t) return null;
    return build('te_to_en', v, o, `Which English word means “${t}”?`, `${t} = “${v.word}”`, v.word, pick(o.map((x) => x.word), v.word)); },
};

export const publicAttempt = (a) => {
  const j = a.toJSON();
  const done = a.status === 'completed';
  j.questions = j.questions.map((q) => done ? q : { qid: q.qid, type: q.type, vocabularyId: q.vocabularyId, prompt: q.prompt, options: q.options });
  return j;
};

export async function generateQuiz(ownerId, { count = 10, types } = {}) {
  const pool = await Vocabulary.find({ ownerId }).sort({ 'srs.dueAt': 1 }).limit(300);
  if (pool.length < 2) throw new AppError(422, 'NOT_ENOUGH_DATA', 'Save at least 3 words with meanings and examples to start a quiz.');
  const allowed = (types?.length ? types : QUESTION_TYPES).filter((t) => QUESTION_TYPES.includes(t));
  const questions = [];
  for (const v of shuffle(pool)) {
    if (questions.length >= count) break;
    const others = pool.filter((x) => !x._id.equals(v._id));
    for (const t of shuffle(allowed)) { const q = BUILDERS[t](v, others); if (q) { questions.push(q); break; } }
  }
  if (!questions.length) throw new AppError(422, 'NOT_ENOUGH_DATA', 'Your saved words don\'t have enough content (meanings, examples, synonyms…) for the selected question types. Add more detail or choose other types.');
  const attempt = await QuizAttempt.create({ ownerId, questions, total: questions.length });
  return attempt;
}

export async function submitQuiz(ownerId, attemptId, answers) {
  const a = await QuizAttempt.findOne({ _id: attemptId, ownerId });
  if (!a) throw notFound('Quiz not found');
  if (a.status === 'completed') throw conflict('This quiz was already submitted.', undefined, 'ALREADY_SUBMITTED');
  const byQ = new Map(answers.map((x) => [x.qid, x.optionId]));
  let score = 0;
  for (const q of a.questions) {
    const given = byQ.get(q.qid);
    q.answerOptionId = given && q.options.some((o) => o.id === given) ? given : null;
    q.correct = q.answerOptionId === q.correctOptionId;
    if (q.correct) score += 1;
  }
  const done = await QuizAttempt.findOneAndUpdate({ _id: a._id, ownerId, status: 'in_progress' },
    { $set: { questions: a.questions.map((q) => q.toObject()), score, status: 'completed', completedAt: new Date() } }, { new: true });
  if (!done) throw conflict('This quiz was already submitted.', undefined, 'ALREADY_SUBMITTED');

  for (const q of done.questions.filter((x) => x.answerOptionId)) { // only answered questions count as evidence
    const v = await Vocabulary.findOneAndUpdate({ _id: q.vocabularyId, ownerId },
      { $inc: { 'progress.quizTotal': 1, 'progress.quizCorrect': q.correct ? 1 : 0 } }, { new: true });
    if (v) { const s = deriveStatus(v); if (s !== v.learningStatus) await Vocabulary.updateOne({ _id: v._id, ownerId }, { $set: { learningStatus: s } }); }
  }
  return done;
}
export const listAttempts = (ownerId, limit = 20) => QuizAttempt.find({ ownerId, status: 'completed' }).sort({ completedAt: -1 }).limit(limit);
