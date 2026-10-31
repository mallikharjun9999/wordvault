/**
 * Paste & Auto-Fill parser.
 *
 * Turns a pasted vocabulary entry (Markdown, plain text, bold labels, bullets,
 * numbered lists, Telugu Unicode) into the exact form state used by VocabForm.
 * Runs entirely in the browser: no network, no AI call.
 *
 * The flat `form` shape mirrors client/src/utils/vocabForm.js (textarea-friendly
 * strings), while `structured` mirrors the API payload shape.
 */
import { POS, CONTEXTS } from './languages.js';

export const MAX_PASTE_LENGTH = 100000;

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
const normSpace = (s) => String(s ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
const clip = (s, max) => String(s ?? '').trim().slice(0, max).trim();
const hasTelugu = (s) => /[\u0C00-\u0C7F]/.test(s);
const joinText = (a, b, sep = ' ') => {
  const x = String(a ?? '').trim(); const y = String(b ?? '').trim();
  if (!x) return y; if (!y) return x; return `${x}${sep}${y}`;
};
const looksLikeWord = (s) => {
  const w = normSpace(s).replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').replace(/[.:;]+$/, '');
  if (!w || w.length > 120) return false;
  const words = w.split(/\s+/);
  if (words.length > 8) return false;
  if (/[.!?]$/.test(w) && words.length > 2) return false;
  return true;
};
const cleanWord = (s) => normSpace(String(s ?? '').replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').replace(/[.:;]+$/, ''));

function stripMarkdown(s) {
  return String(s ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,;:!?])/g, '$1$2')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,;:!?])/g, '$1$2');
}
function stripListMarker(s) {
  return String(s ?? '').replace(/^(?:[-*+•·]\s+|\d{1,3}[.)]\s+)/, '');
}
function stripParen(s) {
  return normSpace(String(s ?? '').replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/[.,;!?]+$/, ''));
}
function labelKeyText(raw) {
  let s = stripMarkdown(raw);
  s = s.replace(/^>\s*/, '').replace(/^#{1,6}\s*/, '');
  s = stripListMarker(s);
  s = s.replace(/[:：]\s*$/, '').replace(/[*_`]/g, '');
  s = s.replace(/[–—]/g, '-').replace(/[/&]/g, ' ');
  return normSpace(s).toLowerCase();
}
function splitPipes(line, n) {
  const parts = String(line ?? '').split('|').map((s) => normSpace(s));
  if (parts.length > n) return [...parts.slice(0, n - 1), parts.slice(n - 1).join(' | ')];
  while (parts.length < n) parts.push('');
  return parts;
}
function dedupe(values) {
  const seen = new Set(); const out = [];
  for (const v of values) { const k = normSpace(v).toLowerCase(); if (!k || seen.has(k)) continue; seen.add(k); out.push(normSpace(v)); }
  return out;
}
function dedupeObjects(values, keyOf) {
  const seen = new Set(); const out = [];
  for (const v of values) { const k = keyOf(v).toLowerCase(); if (!k || seen.has(k)) continue; seen.add(k); out.push(v); }
  return out;
}

// ---------------------------------------------------------------------------
// label dictionaries
// ---------------------------------------------------------------------------
const LABELS = new Map();
const alias = (key, names) => names.forEach((n) => LABELS.set(labelKeyText(n), key));

alias('word', ['word', 'english word', 'english word or expression', 'headword', 'vocabulary word', 'entry word', 'term', 'word or expression', 'english term']);
alias('pronunciation', ['pronunciation', 'pronunciation guide', 'easy respelling', 'respelling', 'pronunciation respelling', 'how to say', 'how to pronounce']);
alias('ipa', ['ipa', 'ipa pronunciation', 'ipa transcription', 'phonetic', 'phonetics', 'phonetic transcription', 'phonetic spelling']);
alias('partOfSpeech', ['part of speech', 'part-of-speech', 'partofspeech', 'pos', 'word class', 'grammatical class', 'type of word']);
alias('simpleExplanation', ['simple explanation', 'simple english explanation', 'simple meaning', 'simple definition', 'simple english meaning', 'easy explanation', 'easy meaning', 'short explanation', 'short meaning', 'basic meaning', 'plain explanation']);
alias('detailedExplanation', ['detailed explanation', 'detailed english explanation', 'detailed meaning', 'detailed definition', 'full explanation', 'full meaning', 'complete explanation', 'in depth explanation', 'in-depth explanation', 'long explanation']);
alias('teluguMeaning', ['telugu meaning', 'meaning in telugu', 'telugu artham', 'telugu word', 'telugu', 'తెలుగు అర్థం', 'తెలుగు అర్ధం']);
alias('teluguExplanation', ['telugu explanation', 'explanation in telugu', 'telugu vivarana', 'telugu detail', 'telugu details', 'telugu description', 'తెలుగు వివరణ']);
alias('examples', ['examples', 'example', 'example sentences', 'example sentence', 'usage examples', 'usage example', 'sentences', 'sentence examples', 'sentence example', 'examples sentences']);
alias('synonyms', ['synonyms', 'synonym', 'similar words', 'words with similar meaning', 'near synonyms']);
alias('antonyms', ['antonyms', 'antonym', 'opposites', 'opposite words', 'words with opposite meaning']);
alias('collocations', ['collocations', 'collocation', 'word combinations', 'common collocations', 'word partners', 'word pairs']);
alias('phrases', ['common phrases', 'phrases', 'phrase', 'common phrase', 'expressions', 'common expressions', 'idiomatic phrases']);
alias('sentencePatterns', ['sentence patterns', 'sentence pattern', 'patterns', 'pattern', 'sentence structures', 'sentence structure']);
alias('usageSituations', ['usage situations', 'usage situation', 'situations', 'situation', 'when to use', 'usage contexts', 'usage context']);
alias('commonMistakes', ['common mistakes', 'common mistake', 'mistakes', 'mistake', 'common errors', 'common error', 'errors', 'error']);
alias('exercises', ['practice exercises', 'practice exercise', 'exercises', 'exercise', 'practice', 'practice questions', 'practice question', 'questions']);
alias('usageNotes', ['usage notes', 'usage note', 'notes on usage', 'note on usage', 'usage tips', 'usage tip']);
alias('categories', ['categories', 'category', 'topics', 'topic', 'themes', 'theme', 'subject', 'subjects']);
alias('tags', ['tags', 'tag', 'keywords', 'keyword', 'labels', 'label']);
alias('notes', ['personal notes', 'personal note', 'notes', 'note', 'my notes', 'notes to self']);

// Parent headings that carry no value of their own.
const IGNORED = new Set([
  'usage details', 'usage information', 'word information', 'word details', 'basic information',
  'vocabulary entry', 'entry details', 'organization', 'organisation', 'meanings', 'meaning sections',
  'overview', 'word', 'vocabulary', 'details', 'information',
].map(labelKeyText));

const MEANING_FIELDS = ['partOfSpeech', 'simpleExplanation', 'detailedExplanation', 'teluguMeaning', 'teluguExplanation'];
const GLOBAL_KEYS = ['synonyms', 'antonyms', 'collocations', 'phrases', 'sentencePatterns', 'usageSituations', 'commonMistakes', 'exercises', 'usageNotes', 'categories', 'tags', 'notes'];
const POS_ALIASES = {
  n: 'noun', noun: 'noun', v: 'verb', verb: 'verb', adj: 'adjective', adjective: 'adjective',
  adv: 'adverb', adverb: 'adverb', pron: 'pronoun', pronoun: 'pronoun', prep: 'preposition',
  preposition: 'preposition', conj: 'conjunction', conjunction: 'conjunction', interj: 'interjection',
  interjection: 'interjection', idiom: 'idiom', 'phrasal verb': 'phrasal verb', phrasal: 'phrasal verb',
  phrase: 'expression', expr: 'expression', expression: 'expression', other: 'other',
};
const CONTEXT_ALIASES = {
  general: 'general', everyday: 'everyday', daily: 'everyday', common: 'everyday', casual: 'everyday', informal: 'everyday',
  professional: 'professional', work: 'professional', business: 'professional', office: 'professional', formal: 'professional',
  educational: 'educational', academic: 'educational', school: 'educational', study: 'educational', education: 'educational',
};

const MEANING_RE = /^(?:meaning|sense|అర్థం|అర్ధం)\s*#?\s*(\d+)?$/;
const EXAMPLE_HEADING_RE = /^(?:example|examples|sentence|sentences)\s*#?\s*\d+$/;
const EXAMPLE_LABELS = new Map();
const exAlias = (key, names) => names.forEach((n) => EXAMPLE_LABELS.set(labelKeyText(n), key));
exAlias('en', ['english', 'english sentence', 'english example', 'en', 'sentence', 'example sentence', 'example', 'english version']);
exAlias('te', ['telugu', 'telugu translation', 'telugu sentence', 'te', 'translation', 'telugu version']);
exAlias('context', ['context', 'usage context', 'register', 'style', 'usage', 'situation']);

function meaningHeading(raw) {
  const key = stripParen(labelKeyText(raw));
  const m = key.match(MEANING_RE);
  if (!m) return null;
  return { number: m[1] ? Number(m[1]) : null };
}
function exampleHeading(raw) {
  const key = stripParen(labelKeyText(raw));
  return EXAMPLE_HEADING_RE.test(key);
}
function canonicalKey(raw) {
  const key = labelKeyText(raw);
  if (!key) return null;
  if (key.includes('తెలుగు అర్థం') || key.includes('తెలుగు అర్ధం')) return 'teluguMeaning';
  if (key.includes('తెలుగు వివరణ')) return 'teluguExplanation';
  return LABELS.get(stripParen(key)) || null;
}
function exampleKey(raw) {
  const key = labelKeyText(raw);
  if (!key) return null;
  return EXAMPLE_LABELS.get(stripParen(key)) || null;
}
function looksLikeSectionLabel(raw) {
  const t = normSpace(stripMarkdown(raw));
  if (!t || t.length > 50) return false;
  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .,'’()\-&/]*$/u.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 3) return false;
  if (!/^[\p{Lu}]/u.test(t)) return false;
  if (/[.!?]$/.test(t) && words.length > 1) return false;
  return true;
}
const emptyFormMeaning = () => ({ partOfSpeech: 'noun', simpleExplanation: '', detailedExplanation: '', teluguMeaning: '', teluguExplanation: '', examples: [] });

// ---------------------------------------------------------------------------
// parser
// ---------------------------------------------------------------------------
export function parsePastedEntry(text) {
  const rawText = String(text ?? '');
  if (!rawText.trim()) return { ok: false, error: 'Please paste a vocabulary entry first.' };
  if (rawText.length > MAX_PASTE_LENGTH) return { ok: false, error: `That entry is too long (maximum ${MAX_PASTE_LENGTH.toLocaleString()} characters).` };

  const warnings = []; const seenWarnings = new Set();
  const warn = (section, message) => {
    const k = `${section}|${message}`;
    if (seenWarnings.has(k)) return;
    seenWarnings.add(k); warnings.push({ section, message });
  };

  const state = {
    word: '', pronunciation: '', ipa: '', meanings: [],
    synonyms: [], antonyms: [], collocations: [], phrases: [], sentencePatterns: [],
    usageSituations: [], commonMistakes: [], exercises: [], usageNotes: [],
    categories: [], tags: [], notes: [], unknown: [],
  };
  let active = null;
  let lastMeaningHeaded = false;

  const newMeaning = () => ({ partOfSpeech: 'noun', simpleExplanation: '', detailedExplanation: '', teluguMeaning: '', teluguExplanation: '', examples: [] });
  const ensureMeaning = () => {
    if (!state.meanings.length) { state.meanings.push(newMeaning()); lastMeaningHeaded = false; }
    return state.meanings[state.meanings.length - 1];
  };
  const pushExample = (ex = {}) => {
    const m = ensureMeaning();
    m.examples.push({ en: '', te: '', context: 'general', ...ex });
    return m.examples.length - 1;
  };
  function normalizeContext(raw, section) {
    const v = normSpace(raw).toLowerCase().replace(/[.,;!?]+$/, '');
    if (!v) return 'general';
    const mapped = CONTEXT_ALIASES[v];
    if (mapped) return mapped;
    warn(section, `“${normSpace(raw)}” is not a supported context — used “general”.`);
    return 'general';
  }
  function normalizePos(raw) {
    const v = normSpace(raw).toLowerCase().replace(/[.,;]+$/, '').replace(/-/g, ' ');
    if (!v) return 'noun';
    const mapped = POS_ALIASES[v] || v;
    if (POS.includes(mapped)) return mapped;
    warn('Part of speech', `“${normSpace(raw)}” is not a recognized part of speech — used “other”.`);
    return 'other';
  }
  function addGlobal(key, rawValue) {
    const v = normSpace(rawValue);
    if (!v) return;
    switch (key) {
      case 'synonyms': {
        const items = v.includes('|') ? [v] : v.split(',').map(normSpace).filter(Boolean);
        for (const item of items) {
          const [word, difference] = splitPipes(item, 2);
          if (word) state.synonyms.push({ word, difference });
        }
        break;
      }
      case 'antonyms':
        v.split(/[,;]/).map(normSpace).filter(Boolean).forEach((x) => state.antonyms.push(x));
        break;
      case 'collocations': state.collocations.push(v); break;
      case 'phrases': state.phrases.push(v); break;
      case 'sentencePatterns': state.sentencePatterns.push(v); break;
      case 'usageSituations': {
        const [situation, example] = splitPipes(v, 2);
        if (situation) state.usageSituations.push({ situation, example });
        break;
      }
      case 'commonMistakes': {
        const [mistake, correction, note] = splitPipes(v, 3);
        if (mistake || correction) state.commonMistakes.push({ mistake, correction, note });
        if (!correction) warn('Common mistakes', `“${mistake || v}” has no correction (use “wrong | correct | note”).`);
        break;
      }
      case 'exercises': {
        const [prompt, answer] = splitPipes(v, 2);
        if (prompt) state.exercises.push({ prompt, answer });
        if (!answer) warn('Practice exercises', `“${prompt || v}” has no answer (use “prompt | answer”).`);
        break;
      }
      case 'usageNotes': state.usageNotes.push(v); break;
      case 'categories': v.split(/[,;]/).map(normSpace).filter(Boolean).forEach((x) => state.categories.push(x)); break;
      case 'tags': v.split(/[,;]/).map(normSpace).filter(Boolean).forEach((x) => state.tags.push(x)); break;
      case 'notes': state.notes.push(v); break;
      default: break;
    }
  }
  function pushExampleLine(rawValue) {
    const v = normSpace(rawValue);
    if (!v) return;
    if (v.includes('|')) {
      const [en, te, ctx] = splitPipes(v, 3);
      active.example = pushExample({ en, te, context: normalizeContext(ctx, 'Examples') });
      return;
    }
    if (hasTelugu(v)) { active.example = pushExample({ te: v }); return; }
    active.example = pushExample({ en: v });
  }
  function setExampleField(field, rawValue) {
    const m = ensureMeaning();
    if (active.example == null || !m.examples[active.example]) active.example = pushExample();
    const ex = m.examples[active.example];
    if (!ex) return;
    const value = normSpace(rawValue);
    if (field === 'context') {
      if (value) ex.context = normalizeContext(value, 'Examples');
      else active.field = 'context';
      return;
    }
    if (value) ex[field] = joinText(ex[field], value, ' ');
    else active.field = field;
  }
  function exampleContentLine(rawLine) {
    const m = ensureMeaning();
    if (active.example == null) active.example = pushExample();
    const ex = m.examples[active.example];
    if (!ex) return;
    if (active.field) {
      const field = active.field; active.field = null;
      if (field === 'context') { ex.context = normalizeContext(rawLine, 'Examples'); return; }
      ex[field] = joinText(ex[field], normSpace(rawLine), ' ');
      return;
    }
    if (rawLine.includes('|')) {
      const [en, te, ctx] = splitPipes(rawLine, 3);
      active.example = pushExample({ en, te, context: normalizeContext(ctx, 'Examples') });
      return;
    }
    const ctxKey = CONTEXT_ALIASES[normSpace(rawLine).toLowerCase().replace(/[.,;!?]+$/, '')];
    if (ctxKey && (ex.en || ex.te)) { ex.context = ctxKey; return; }
    if (hasTelugu(rawLine) && !ex.te.trim()) { ex.te = normSpace(rawLine); return; }
    if (!ex.en.trim()) { ex.en = normSpace(rawLine); return; }
    active.example = pushExample({ en: normSpace(rawLine) });
  }
  function handleKey(key, value) {
    if (key === 'word' || key === 'pronunciation' || key === 'ipa') {
      if (value) state[key] = joinText(state[key], value, ' ');
      active = { scope: 'field', key };
      return;
    }
    if (MEANING_FIELDS.includes(key)) {
      const m = ensureMeaning();
      if (key === 'partOfSpeech') { if (value) m[key] = normalizePos(value); }
      else if (value) m[key] = joinText(m[key], value, ' ');
      active = { scope: 'meaning', key };
      return;
    }
    if (key === 'examples') {
      ensureMeaning();
      active = { scope: 'examples', example: null, field: null };
      if (value) pushExampleLine(value);
      return;
    }
    if (GLOBAL_KEYS.includes(key)) {
      if (value) addGlobal(key, value);
      active = { scope: 'global', key };
    }
  }
  function pushContent(rawLine) {
    const line = normSpace(rawLine);
    if (!line) return;
    if (!active) {
      if (!state.word && looksLikeWord(line)) state.word = cleanWord(line);
      return;
    }
    switch (active.scope) {
      case 'field': state[active.key] = joinText(state[active.key], line, ' '); break;
      case 'meaning': {
        const m = ensureMeaning();
        if (active.key === 'partOfSpeech') m.partOfSpeech = normalizePos(line);
        else m[active.key] = joinText(m[active.key], line, ' ');
        break;
      }
      case 'examples': exampleContentLine(line); break;
      case 'global': addGlobal(active.key, line); break;
      case 'unknown': active.entry.lines.push(line); break;
      default: break;
    }
  }

  const lines = rawText.replace(/\r\n?/g, '\n').split('\n');
  for (const rawLine of lines) {
    const trimmed = rawLine.replace(/\u00a0/g, ' ').replace(/\t/g, ' ').trim();
    if (!trimmed) continue;
    const isHeading = /^#{1,6}\s+/.test(trimmed);
    const wasBold = /\*\*[^*]+\*\*|__[^_]+__/.test(trimmed);
    let body = trimmed.replace(/^#{1,6}\s+/, '').replace(/^>\s*/, '');
    body = stripMarkdown(body).trim();
    if (!body) continue;
    const line = stripListMarker(body).trim();
    if (!line) continue;

    const colon = line.match(/^([^:：]{1,60})[：:]\s*(.*)$/);
    const label = colon ? colon[1].trim() : line;
    const value = colon ? colon[2].trim() : '';
    const hasColon = !!colon;

    // Example sub-labels only make sense while collecting an Examples block.
    if (active?.scope === 'examples') {
      const exk = exampleKey(label);
      if (exk) { setExampleField(exk, value); continue; }
    }

    const mh = meaningHeading(label);
    if (mh) {
      const last = state.meanings[state.meanings.length - 1];
      if (!last || lastMeaningHeaded) state.meanings.push(newMeaning());
      lastMeaningHeaded = true;
      active = null;
      if (value) {
        const m = state.meanings[state.meanings.length - 1];
        m.simpleExplanation = value;
        active = { scope: 'meaning', key: 'simpleExplanation' };
      }
      continue;
    }

    const key = canonicalKey(label);
    if (key) { handleKey(key, value); continue; }

    if (exampleHeading(label)) { handleKey('examples', value); continue; }

    if (IGNORED.has(labelKeyText(label))) { active = null; continue; }

    const atGlobal = !active || active.scope === 'global' || active.scope === 'unknown';

    // A lone heading such as "## Meticulous" is the headword, not an unknown section.
    if (!hasColon && isHeading && !state.word && looksLikeWord(label)) {
      state.word = cleanWord(label);
      active = null;
      continue;
    }

    const unknownCandidate = isHeading || wasBold || (hasColon && atGlobal && looksLikeSectionLabel(label));
    if (unknownCandidate) {
      const entry = { label: normSpace(stripMarkdown(label)), lines: value ? [value] : [] };
      state.unknown.push(entry);
      active = { scope: 'unknown', entry };
      continue;
    }

    pushContent(line);
  }

  // Unrecognized sections are preserved in Personal notes rather than dropped.
  if (state.unknown.length) {
    const blocks = state.unknown.map((u) => `[${u.label}]${u.lines.length ? `\n${u.lines.join('\n')}` : ''}`).join('\n\n');
    state.notes.push(blocks);
    for (const u of state.unknown) warn(u.label, `“${u.label}” is not a known section — its content was kept in Personal notes.`);
  }

  if (!state.meanings.length) state.meanings.push(newMeaning());
  if (!state.word) warn('Word', 'No English word or expression was found — please fill it in before saving.');

  const anything = state.word
    || state.meanings.some((m) => m.simpleExplanation || m.detailedExplanation || m.teluguMeaning || m.teluguExplanation || m.examples.some((e) => e.en || e.te))
    || GLOBAL_KEYS.some((k) => state[k].length)
    || state.unknown.length;
  if (!anything) {
    return { ok: false, error: 'Could not recognize any vocabulary sections. Check the labels and try again.' };
  }

  const rawNotes = state.notes.join('\n');
  if (rawNotes.length > 4000) warn('Personal notes', 'Personal notes were shortened to 4,000 characters.');

  const structured = {
    word: clip(state.word, 120),
    pronunciation: clip(normSpace(state.pronunciation), 120),
    ipa: clip(normSpace(state.ipa), 120),
    meanings: state.meanings.slice(0, 10).map((m) => ({
      partOfSpeech: POS.includes(m.partOfSpeech) ? m.partOfSpeech : 'noun',
      simpleExplanation: clip(normSpace(m.simpleExplanation), 600),
      detailedExplanation: clip(normSpace(m.detailedExplanation), 2000),
      teluguMeaning: clip(normSpace(m.teluguMeaning), 400),
      teluguExplanation: clip(normSpace(m.teluguExplanation), 2000),
      examples: m.examples.filter((e) => normSpace(e.en) || normSpace(e.te)).slice(0, 12).map((e) => ({
        en: clip(normSpace(e.en), 400), te: clip(normSpace(e.te), 600), context: CONTEXTS.includes(e.context) ? e.context : 'general',
      })),
    })),
    synonyms: dedupeObjects(state.synonyms, (x) => x.word).slice(0, 15).map((x) => ({ word: clip(x.word, 80), difference: clip(x.difference, 400) })),
    antonyms: dedupe(state.antonyms).slice(0, 15).map((x) => clip(x, 80)),
    collocations: dedupe(state.collocations).slice(0, 20).map((x) => clip(x, 160)),
    phrases: dedupe(state.phrases).slice(0, 20).map((x) => clip(x, 200)),
    sentencePatterns: dedupe(state.sentencePatterns).slice(0, 10).map((x) => clip(x, 200)),
    usageSituations: state.usageSituations.slice(0, 10).map((x) => ({ situation: clip(x.situation, 200), example: clip(x.example, 400) })),
    commonMistakes: state.commonMistakes.slice(0, 10).map((x) => ({ mistake: clip(x.mistake, 300), correction: clip(x.correction, 300), note: clip(x.note, 400) })),
    exercises: state.exercises.slice(0, 10).map((x) => ({ prompt: clip(x.prompt, 400), answer: clip(x.answer, 300) })),
    usageNotes: clip(state.usageNotes.join(' '), 2000),
    categories: dedupe(state.categories).slice(0, 30).map((x) => clip(x, 40)),
    tags: dedupe(state.tags).slice(0, 30).map((x) => clip(x, 40)),
    notes: clip(rawNotes, 4000),
  };

  return {
    ok: true,
    structured,
    form: structuredToForm(structured),
    warnings,
    unknownSections: state.unknown.map((u) => u.label),
    counts: countPopulated(structured),
  };
}

// ---------------------------------------------------------------------------
// structured <-> form helpers
// ---------------------------------------------------------------------------
export function structuredToForm(s) {
  const meanings = (s.meanings?.length ? s.meanings : [emptyFormMeaning()]).map((m) => ({
    partOfSpeech: POS.includes(m.partOfSpeech) ? m.partOfSpeech : 'noun',
    simpleExplanation: m.simpleExplanation || '', detailedExplanation: m.detailedExplanation || '',
    teluguMeaning: m.teluguMeaning || '', teluguExplanation: m.teluguExplanation || '',
    examples: (m.examples || []).map((e) => ({ en: e.en || '', te: e.te || '', context: CONTEXTS.includes(e.context) ? e.context : 'general' })),
  }));
  return {
    word: s.word || '', pronunciation: s.pronunciation || '', ipa: s.ipa || '', meanings,
    synonyms: (s.synonyms || []).map((x) => (x.difference ? `${x.word} | ${x.difference}` : x.word)).join('\n'),
    antonyms: (s.antonyms || []).join('\n'),
    collocations: (s.collocations || []).join('\n'),
    phrases: (s.phrases || []).join('\n'),
    sentencePatterns: (s.sentencePatterns || []).join('\n'),
    usageSituations: (s.usageSituations || []).map((x) => `${x.situation} | ${x.example || ''}`).join('\n'),
    commonMistakes: (s.commonMistakes || []).map((x) => `${x.mistake} | ${x.correction || ''} | ${x.note || ''}`).join('\n'),
    exercises: (s.exercises || []).map((x) => `${x.prompt} | ${x.answer || ''}`).join('\n'),
    usageNotes: s.usageNotes || '', tags: (s.tags || []).join(', '), categories: (s.categories || []).join(', '),
    notes: s.notes || '', favorite: false,
  };
}

export function countPopulated(s) {
  const has = (v) => typeof v === 'string' && v.trim() !== '';
  let fields = 0;
  for (const k of ['word', 'pronunciation', 'ipa', 'usageNotes', 'notes']) if (has(s[k])) fields += 1;
  for (const k of ['synonyms', 'antonyms', 'collocations', 'phrases', 'sentencePatterns', 'usageSituations', 'commonMistakes', 'exercises', 'categories', 'tags']) {
    if ((s[k] || []).length) fields += 1;
  }
  let meanings = 0; let examples = 0;
  for (const m of s.meanings || []) {
    const content = ['simpleExplanation', 'detailedExplanation', 'teluguMeaning', 'teluguExplanation'].some((k) => has(m[k]));
    if (content || (m.examples || []).some((e) => has(e.en) || has(e.te))) meanings += 1;
    if (content) fields += ['simpleExplanation', 'detailedExplanation', 'teluguMeaning', 'teluguExplanation'].filter((k) => has(m[k])).length;
    if ((m.examples || []).some((e) => has(e.en) || has(e.te))) fields += 1;
    examples += (m.examples || []).filter((e) => has(e.en) || has(e.te)).length;
  }
  return { fields, meanings, examples };
}

/** True when the form already holds anything worth protecting from a silent overwrite. */
export function formHasContent(f) {
  if (!f) return false;
  const has = (v) => typeof v === 'string' && v.trim() !== '';
  for (const k of ['word', 'pronunciation', 'ipa', 'usageNotes', 'notes', 'synonyms', 'antonyms', 'collocations', 'phrases', 'sentencePatterns', 'usageSituations', 'commonMistakes', 'exercises', 'tags', 'categories']) {
    if (has(f[k])) return true;
  }
  if (f.favorite) return true;
  return (f.meanings || []).some((m) => m && (has(m.simpleExplanation) || has(m.detailedExplanation) || has(m.teluguMeaning) || has(m.teluguExplanation)
    || (m.examples || []).some((e) => has(e.en) || has(e.te))));
}

const formMeaningHasContent = (m) => !!m && (normSpace(m.simpleExplanation) || normSpace(m.detailedExplanation) || normSpace(m.teluguMeaning) || normSpace(m.teluguExplanation)
  || (m.examples || []).some((e) => normSpace(e.en) || normSpace(e.te)));
const cloneForm = (f) => JSON.parse(JSON.stringify(f));

/** Merge parsed content into the current form without destroying existing values. */
export function mergeForms(existing, incoming) {
  if (!existing) return cloneForm(incoming);
  const mergeLines = (a, b) => {
    const seen = new Set(); const out = [];
    for (const v of [...String(a ?? '').split('\n'), ...String(b ?? '').split('\n')]) {
      const t = normSpace(v); const k = t.toLowerCase();
      if (!t || seen.has(k)) continue;
      seen.add(k); out.push(t);
    }
    return out.join('\n');
  };
  const mergeCsv = (a, b) => mergeLines(String(a ?? '').replace(/,/g, '\n'), String(b ?? '').replace(/,/g, '\n')).split('\n').filter(Boolean).join(', ');
  const text = (a, b) => {
    const x = String(a ?? '').trim(); const y = String(b ?? '').trim();
    if (x && y) return `${x}\n\n${y}`;
    return x || y;
  };
  const existingMeanings = (existing.meanings || []).filter(formMeaningHasContent);
  const incomingMeanings = (incoming.meanings || []).filter(formMeaningHasContent);
  const meanings = (existingMeanings.length ? [...existingMeanings, ...incomingMeanings] : (incomingMeanings.length ? incomingMeanings : [emptyFormMeaning()])).slice(0, 10);
  return {
    word: normSpace(existing.word) ? existing.word : incoming.word,
    pronunciation: normSpace(existing.pronunciation) ? existing.pronunciation : incoming.pronunciation,
    ipa: normSpace(existing.ipa) ? existing.ipa : incoming.ipa,
    meanings,
    synonyms: mergeLines(existing.synonyms, incoming.synonyms),
    antonyms: mergeLines(existing.antonyms, incoming.antonyms),
    collocations: mergeLines(existing.collocations, incoming.collocations),
    phrases: mergeLines(existing.phrases, incoming.phrases),
    sentencePatterns: mergeLines(existing.sentencePatterns, incoming.sentencePatterns),
    usageSituations: mergeLines(existing.usageSituations, incoming.usageSituations),
    commonMistakes: mergeLines(existing.commonMistakes, incoming.commonMistakes),
    exercises: mergeLines(existing.exercises, incoming.exercises),
    usageNotes: text(existing.usageNotes, incoming.usageNotes),
    tags: mergeCsv(existing.tags, incoming.tags),
    categories: mergeCsv(existing.categories, incoming.categories),
    notes: text(existing.notes, incoming.notes),
    favorite: !!(existing.favorite || incoming.favorite),
  };
}

export { cloneForm };
