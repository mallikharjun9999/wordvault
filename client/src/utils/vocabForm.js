// Converts between API entries and flat form state (textarea-friendly), and back.
const lines = (t) => String(t || '').split('\n').map((s) => s.trim()).filter(Boolean);
const csv = (t) => String(t || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
const pipe = (line, n) => { const p = line.split('|').map((s) => s.trim()); while (p.length < n) p.push(''); return p; };
export const emptyMeaning = () => ({ partOfSpeech: 'noun', simpleExplanation: '', detailedExplanation: '', teluguMeaning: '', teluguExplanation: '', examples: [{ en: '', te: '', context: 'general' }] });

export function entryToForm(e) {
  return {
    word: e?.word || '', pronunciation: e?.pronunciation || '', ipa: e?.ipa || '',
    meanings: e?.meanings?.length ? e.meanings.map((m) => ({ ...emptyMeaning(), ...m, examples: m.examples?.length ? m.examples : [] })) : [emptyMeaning()],
    synonyms: (e?.synonyms || []).map((s) => (s.difference ? `${s.word} | ${s.difference}` : s.word)).join('\n'),
    antonyms: (e?.antonyms || []).join('\n'), collocations: (e?.collocations || []).join('\n'), phrases: (e?.phrases || []).join('\n'),
    sentencePatterns: (e?.sentencePatterns || []).join('\n'),
    usageSituations: (e?.usageSituations || []).map((u) => `${u.situation} | ${u.example}`).join('\n'),
    commonMistakes: (e?.commonMistakes || []).map((c) => `${c.mistake} | ${c.correction} | ${c.note || ''}`).join('\n'),
    exercises: (e?.exercises || []).map((x) => `${x.prompt} | ${x.answer}`).join('\n'),
    usageNotes: e?.usageNotes || '', tags: (e?.tags || []).join(', '), categories: (e?.categories || []).join(', '),
    notes: e?.notes || '', favorite: !!e?.favorite,
  };
}
export function formToPayload(f) {
  return {
    word: f.word.trim(), pronunciation: f.pronunciation.trim(), ipa: f.ipa.trim(),
    meanings: f.meanings.map((m) => ({ ...m, examples: m.examples.filter((x) => x.en.trim()).map((x) => ({ en: x.en.trim(), te: (x.te || '').trim(), context: x.context })) })),
    synonyms: lines(f.synonyms).map((l) => { const [word, difference] = pipe(l, 2); return { word, difference }; }),
    antonyms: csv(f.antonyms), collocations: lines(f.collocations), phrases: lines(f.phrases), sentencePatterns: lines(f.sentencePatterns),
    usageSituations: lines(f.usageSituations).map((l) => { const [situation, example] = pipe(l, 2); return { situation, example }; }),
    commonMistakes: lines(f.commonMistakes).map((l) => { const [mistake, correction, note] = pipe(l, 3); return { mistake, correction, note }; }).filter((c) => c.mistake && c.correction),
    exercises: lines(f.exercises).map((l) => { const [prompt, answer] = pipe(l, 2); return { prompt, answer }; }).filter((x) => x.prompt && x.answer),
    usageNotes: f.usageNotes.trim(), tags: csv(f.tags), categories: csv(f.categories), notes: f.notes.trim(), favorite: f.favorite,
  };
}
