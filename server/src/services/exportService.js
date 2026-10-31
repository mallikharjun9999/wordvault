import { User, Vocabulary, Translation, ReviewLog, QuizAttempt, Sentence } from '../models/index.js';

// Legacy translations (saved before the app became English + Telugu only) are still exported so no data is lost.
// Their language codes may no longer be in our language list, so label them via the platform's own language names.
const legacyLanguageName = (code) => { try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code; } catch { return code; } };

const csvCell = (v) => {
  let s = Array.isArray(v) ? v.join(' | ') : v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula-injection guard
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const CSV_COLS = ['word', 'pronunciation', 'ipa', 'partsOfSpeech', 'teluguMeanings', 'simpleExplanations', 'examples', 'synonyms', 'antonyms', 'collocations', 'tags', 'categories', 'status', 'favorite', 'notes', 'createdAt'];

export function toCsv(entries) {
  const rows = entries.map((v) => ({
    word: v.word, pronunciation: v.pronunciation, ipa: v.ipa,
    partsOfSpeech: v.meanings.map((m) => m.partOfSpeech), teluguMeanings: v.meanings.map((m) => m.teluguMeaning),
    simpleExplanations: v.meanings.map((m) => m.simpleExplanation), examples: v.meanings.flatMap((m) => m.examples.map((e) => e.en)),
    synonyms: v.synonyms.map((s) => s.word), antonyms: v.antonyms, collocations: v.collocations, tags: v.tags, categories: v.categories,
    status: v.learningStatus, favorite: v.favorite, notes: v.notes, createdAt: v.createdAt,
  }));
  return '\uFEFF' + [CSV_COLS.join(','), ...rows.map((r) => CSV_COLS.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n'; // BOM so Excel reads UTF-8
}
export function toMarkdown(entries, translationsByVocab = new Map()) {
  const out = ['# WordVault export', ''];
  for (const v of entries) {
    out.push(`## ${v.word}`, '');
    if (v.pronunciation || v.ipa) out.push(`*${[v.pronunciation, v.ipa].filter(Boolean).join(' · ')}*`, '');
    v.meanings.forEach((m, i) => {
      out.push(`### Meaning ${i + 1}${m.partOfSpeech ? ` (${m.partOfSpeech})` : ''}`, '');
      if (m.simpleExplanation) out.push(m.simpleExplanation, '');
      if (m.teluguMeaning) out.push(`**తెలుగు:** ${m.teluguMeaning}`, '');
      if (m.teluguExplanation) out.push(m.teluguExplanation, '');
      m.examples.forEach((e) => out.push(`- ${e.en}${e.te ? `  \n  ${e.te}` : ''}`));
      if (m.examples.length) out.push('');
    });
    if (v.synonyms.length) out.push(`**Synonyms:** ${v.synonyms.map((s) => s.word).join(', ')}`, '');
    if (v.antonyms.length) out.push(`**Antonyms:** ${v.antonyms.join(', ')}`, '');
    for (const t of translationsByVocab.get(String(v._id)) || []) {
      out.push(`### ${legacyLanguageName(t.language)}`, '');
      t.meanings.forEach((m) => out.push(`- ${m.meaning}${m.explanation ? ` — ${m.explanation}` : ''}`));
      out.push('');
    }
    if (v.notes) out.push(`> ${v.notes.replace(/\n/g, '\n> ')}`, '');
  }
  return out.join('\n');
}

export async function exportVocabulary(ownerId, format) {
  const entries = await Vocabulary.find({ ownerId }).sort({ normalizedWord: 1 });
  const translations = await Translation.find({ ownerId });
  const by = new Map(); translations.forEach((t) => { const k = String(t.vocabularyId); by.set(k, [...(by.get(k) || []), t]); });
  if (format === 'csv') return { type: 'text/csv; charset=utf-8', filename: 'wordvault-vocabulary.csv', body: toCsv(entries) };
  if (format === 'md') return { type: 'text/markdown; charset=utf-8', filename: 'wordvault-vocabulary.md', body: toMarkdown(entries, by) };
  return { type: 'application/json; charset=utf-8', filename: 'wordvault-vocabulary.json',
    body: JSON.stringify({ exportedAt: new Date().toISOString(), vocabulary: entries.map((e) => e.toJSON()), translations: translations.map((t) => t.toJSON()) }, null, 2) };
}

export async function exportEverything(userId) {
  const [user, vocabulary, translations, reviewLogs, quizAttempts, sentences] = await Promise.all([
    User.findById(userId), Vocabulary.find({ ownerId: userId }), Translation.find({ ownerId: userId }),
    ReviewLog.find({ ownerId: userId }), QuizAttempt.find({ ownerId: userId }), Sentence.find({ ownerId: userId }),
  ]);
  return {
    format: 'wordvault-account-export', version: 1, exportedAt: new Date().toISOString(),
    account: { email: user.email, displayName: user.displayName, preferences: user.preferences, createdAt: user.createdAt },
    vocabulary, translations, reviewLogs, quizAttempts, sentences,
  };
}
