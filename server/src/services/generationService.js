import { getClient, parseJsonLoose } from './llm.js';
import { generatedVocabSchema } from '../validators/schemas.js';
import { findByWord, createEntry } from './vocabularyService.js';
import { normalizeWord, cleanDisplayWord } from '../utils/normalize.js';
import { AppError } from '../utils/AppError.js';
import { PARTS_OF_SPEECH, EXAMPLE_CONTEXTS } from '../models/Vocabulary.js';

export const GENERATION_SYSTEM = `You are a careful English lexicographer and Telugu-English bilingual teacher.
Return ONLY one JSON object (no markdown, no commentary). Be accurate; if unsure of a Telugu rendering, prefer a simpler, correct phrase. Never invent usage.
Schema:
{"pronunciation":"easy respelling","ipa":"/.../","meanings":[{"partOfSpeech":one of ${PARTS_OF_SPEECH.join('|')},"simpleExplanation":"plain English","detailedExplanation":"fuller English","teluguMeaning":"short Telugu meaning (Telugu script)","teluguExplanation":"Telugu explanation","examples":[{"en":"English sentence","te":"Telugu translation","context":"general|everyday|professional|educational"}]}],
"synonyms":[{"word":"","difference":"how it differs"}],"antonyms":[""],"collocations":[""],"phrases":[""],"sentencePatterns":[""],
"usageSituations":[{"situation":"","example":""}],"commonMistakes":[{"mistake":"incorrect sentence","correction":"correct sentence","note":""}],
"usageNotes":"","exercises":[{"prompt":"","answer":""}],"tags":[""],"categories":[""]}
antonyms, collocations, phrases, sentencePatterns, tags and categories MUST be arrays of plain strings (never objects).
Include every distinct major meaning, with 2-4 examples each covering everyday, professional and educational contexts where natural. Omit arrays you cannot fill accurately (use []).`;

const STRING_LIST_KEYS = ['antonyms', 'collocations', 'phrases', 'sentencePatterns', 'tags', 'categories'];

function firstString(v) {
  if (typeof v === 'string') return v.trim() ? v : null;
  if (v && typeof v === 'object') {
    for (const k of ['word', 'text', 'value', 'phrase', 'pattern', 'term', 'antonym', 'collocation', 'tag', 'category', 'en']) {
      if (typeof v[k] === 'string' && v[k].trim()) return v[k];
    }
    const hit = Object.values(v).find((x) => typeof x === 'string' && x.trim());
    if (hit) return hit;
  }
  return null;
}

/** Small local models often wrap list items in objects or emit off-list enum values. Coerce to the strict contract. */
export function coerceGeneratedContent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const out = { ...input };
  for (const k of STRING_LIST_KEYS) {
    if (Array.isArray(out[k])) out[k] = out[k].map(firstString).filter(Boolean);
  }
  if (Array.isArray(out.synonyms)) {
    out.synonyms = out.synonyms.map((s) => (typeof s === 'string' ? { word: s, difference: '' } : s));
  }
  if (Array.isArray(out.usageSituations)) {
    out.usageSituations = out.usageSituations.map((s) => (typeof s === 'string' ? { situation: s, example: '' } : s));
  }
  if (Array.isArray(out.meanings)) {
    out.meanings = out.meanings.map((m) => {
      if (!m || typeof m !== 'object') return m;
      const mm = { ...m };
      if (!PARTS_OF_SPEECH.includes(mm.partOfSpeech)) mm.partOfSpeech = 'other';
      if (Array.isArray(mm.examples)) {
        mm.examples = mm.examples.map((ex) => {
          if (typeof ex === 'string') return { en: ex, te: '', context: 'general' };
          if (ex && typeof ex === 'object' && !EXAMPLE_CONTEXTS.includes(ex.context)) return { ...ex, context: 'general' };
          return ex;
        });
      }
      return mm;
    });
  }
  return out;
}

const inflight = new Map(); // `${ownerId}:${normalized}` -> Promise (collapses concurrent identical requests in this process)

export async function generateEntry(ownerId, rawWord) {
  const word = cleanDisplayWord(rawWord);
  const key = `${ownerId}:${normalizeWord(word)}`;
  const existing = await findByWord(ownerId, word);
  if (existing) return { entry: existing, existing: true }; // no provider call for duplicates

  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const client = getClient('ai'); // throws AI_NOT_CONFIGURED honestly
      const text = await client.complete({ system: GENERATION_SYSTEM, user: `English word or expression: "${word}"`, maxTokens: 4500 });
      const parsed = coerceGeneratedContent(parseJsonLoose(text));
      const checked = generatedVocabSchema.safeParse(parsed);
      if (!checked.success) {
        throw new AppError(502, 'PROVIDER_INVALID_CONTENT', 'The AI response did not match the required structure. Nothing was saved; please retry.',
          checked.error.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), message: i.message })));
      }
      // The headword is always the user's input, never the provider's.
      const entry = await createEntry(ownerId, { word, ...checked.data }, { source: 'ai', generation: { provider: client.provider, model: client.model, generatedAt: new Date() } });
      return { entry, existing: false };
    } catch (e) {
      if (e?.code === 'DUPLICATE_WORD') { // another process/request won the race: return the winner
        const winner = await findByWord(ownerId, word);
        if (winner) return { entry: winner, existing: true };
      }
      throw e;
    } finally { inflight.delete(key); }
  })();
  inflight.set(key, p);
  return p;
}
