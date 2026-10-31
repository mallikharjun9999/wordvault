import { describe, it, expect } from 'vitest';
import {
  parsePastedEntry, structuredToForm, formHasContent, mergeForms, countPopulated, MAX_PASTE_LENGTH,
} from '../src/utils/pasteParser.js';

const parse = (text) => parsePastedEntry(text);

const baseEntry = `**English word or expression:** meticulous
**Pronunciation guide:** meh-TIK-yuh-lus
**IPA:** /məˈtɪkjələs/

**Meaning 1**
Part of speech: adjective
Simple English explanation: Extremely careful about details.
Detailed English explanation: Showing great attention to detail.
Telugu meaning (తెలుగు అర్థం): అత్యంత జాగ్రత్తగల
Telugu explanation (తెలుగు వివరణ): చిన్న వివరాలపై ఎక్కువ శ్రద్ధ చూపే.

**Examples**
1. English: She is meticulous about her work.
   Telugu: ఆమె తన పనిలో చాలా జాగ్రత్తగా ఉంటుంది.
   Context: professional
2. The meticulous editor checked every comma. | ప్రతి కామాను పరిశీలించాడు. | everyday`;

describe('paste parser', () => {
  it('1. parses a complete entry with one meaning', () => {
    const r = parse(baseEntry);
    expect(r.ok).toBe(true);
    expect(r.structured.word).toBe('meticulous');
    expect(r.structured.pronunciation).toBe('meh-TIK-yuh-lus');
    expect(r.structured.ipa).toBe('/məˈtɪkjələs/');
    expect(r.structured.meanings).toHaveLength(1);
    expect(r.structured.meanings[0]).toMatchObject({
      partOfSpeech: 'adjective',
      simpleExplanation: 'Extremely careful about details.',
      detailedExplanation: 'Showing great attention to detail.',
    });
  });

  it('2. parses multiple meanings', () => {
    const r = parse(`Word: bank
Meaning 1
Part of speech: noun
Simple English explanation: A financial institution.
Telugu meaning: బ్యాంకు
Meaning 2
Part of speech: noun
Simple English explanation: The side of a river.
Telugu meaning: నది ఒడ్డు`);
    expect(r.structured.meanings).toHaveLength(2);
    expect(r.structured.meanings.map((m) => m.teluguMeaning)).toEqual(['బ్యాంకు', 'నది ఒడ్డు']);
    expect(r.counts.meanings).toBe(2);
  });

  it('3. parses multiple examples under one meaning', () => {
    const r = parse(`Word: brisk
Meaning 1
Simple English explanation: Quick and energetic.
Examples:
- She took a brisk walk.
- The brisk wind chilled us.`);
    expect(r.structured.meanings[0].examples.map((e) => e.en)).toEqual([
      'She took a brisk walk.', 'The brisk wind chilled us.',
    ]);
    expect(r.counts.examples).toBe(2);
  });

  it('4. parses synonyms with pipe-separated differences', () => {
    const r = parse(`Word: frank
Synonyms:
frank | more blunt
candid | honest`);
    expect(r.structured.synonyms).toEqual([
      { word: 'frank', difference: 'more blunt' },
      { word: 'candid', difference: 'honest' },
    ]);
    expect(r.form.synonyms).toBe('frank | more blunt\ncandid | honest');
  });

  it('5. parses multiple antonyms (comma and line separated)', () => {
    const r = parse(`Word: happy
Antonyms: happy, joyful
sad, gloomy`);
    expect(r.structured.antonyms).toEqual(['happy', 'joyful', 'sad', 'gloomy']);
    expect(r.form.antonyms).toBe('happy\njoyful\nsad\ngloomy');
  });

  it('6. parses usage situations with pipe separators', () => {
    const r = parse(`Word: market
Usage situations:
Shopping | I bought vegetables at the market.
Travel | We waited at the station.`);
    expect(r.structured.usageSituations).toEqual([
      { situation: 'Shopping', example: 'I bought vegetables at the market.' },
      { situation: 'Travel', example: 'We waited at the station.' },
    ]);
    expect(r.form.usageSituations).toBe('Shopping | I bought vegetables at the market.\nTravel | We waited at the station.');
  });

  it('7. parses common mistakes with three pipe-separated values', () => {
    const r = parse(`Word: go
Common mistakes:
I goed to school. | I went to school. | Use the past tense went.
He don't like it. | He doesn't like it. | Third person singular.`);
    expect(r.structured.commonMistakes).toHaveLength(2);
    expect(r.structured.commonMistakes[0]).toEqual({
      mistake: 'I goed to school.', correction: 'I went to school.', note: 'Use the past tense went.',
    });
  });

  it('8. parses practice exercises with prompt and answer', () => {
    const r = parse(`Word: eat
Practice exercises:
Fill in the blank: She ___ home. | went
What is the past tense of eat? | ate`);
    expect(r.structured.exercises).toEqual([
      { prompt: 'Fill in the blank: She ___ home.', answer: 'went' },
      { prompt: 'What is the past tense of eat?', answer: 'ate' },
    ]);
  });

  it('9. recognizes Markdown bold labels', () => {
    const r = parse(`**Word:** lucid
**Meaning 1**
**Part of speech:** adjective
**Telugu meaning:** స్పష్టమైన`);
    expect(r.structured.word).toBe('lucid');
    expect(r.structured.meanings[0].partOfSpeech).toBe('adjective');
    expect(r.structured.meanings[0].teluguMeaning).toBe('స్పష్టమైన');
  });

  it('10. recognizes Markdown headings and values on the next line', () => {
    const r = parse(`# Word: lucid
## Meaning 1
### Part of Speech
adjective
### Simple English Explanation
Clear and easy to understand.`);
    expect(r.structured.word).toBe('lucid');
    expect(r.structured.meanings[0]).toMatchObject({ partOfSpeech: 'adjective', simpleExplanation: 'Clear and easy to understand.' });
  });

  it('10b. accepts the word itself as a top-level heading', () => {
    const r = parse(`## Meticulous

### Meaning 1
Part of speech: adjective
Telugu meaning: అత్యంత జాగ్రత్తగల`);
    expect(r.structured.word).toBe('Meticulous');
    expect(r.unknownSections).toEqual([]);
    expect(r.structured.meanings[0].teluguMeaning).toBe('అత్యంత జాగ్రత్తగల');
  });

  it('11. recognizes plain text labels with no colons', () => {
    const r = parse(`Word
meticulous
Pronunciation
meh-TIK-yuh-lus
IPA
/məˈtɪkjələs/`);
    expect(r.structured).toMatchObject({ word: 'meticulous', pronunciation: 'meh-TIK-yuh-lus', ipa: '/məˈtɪkjələs/' });
  });

  it('12. preserves Telugu Unicode exactly', () => {
    const r = parse(baseEntry);
    expect(r.structured.meanings[0].teluguMeaning).toBe('అత్యంత జాగ్రత్తగల');
    expect(r.structured.meanings[0].teluguExplanation).toBe('చిన్న వివరాలపై ఎక్కువ శ్రద్ధ చూపే.');
    expect(r.structured.meanings[0].examples[0].te).toBe('ఆమె తన పనిలో చాలా జాగ్రత్తగా ఉంటుంది.');
  });

  it('13. handles sections in a different order', () => {
    const r = parse(`Synonyms: careful, thorough
Telugu meaning: జాగ్రత్తగల
Word: meticulous
Meaning 1
Simple English explanation: Very careful.`);
    expect(r.structured.word).toBe('meticulous');
    expect(r.structured.meanings).toHaveLength(1);
    expect(r.structured.meanings[0].teluguMeaning).toBe('జాగ్రత్తగల');
    expect(r.structured.meanings[0].simpleExplanation).toBe('Very careful.');
    expect(r.structured.synonyms.map((s) => s.word)).toEqual(['careful', 'thorough']);
  });

  it('14. fills sensible defaults when optional fields are missing', () => {
    const r = parse(`Word: test
Meaning 1
Simple English explanation: A trial.`);
    const m = r.structured.meanings[0];
    expect(m.partOfSpeech).toBe('noun');
    expect(m.examples).toEqual([]);
    expect(r.structured.antonyms).toEqual([]);
    expect(r.form.ipa).toBe('');
    expect(r.form.notes).toBe('');
  });

  it('15. keeps unknown sections and warns about them', () => {
    const r = parse(`Word: test
Meaning 1
Simple English explanation: A trial.
## Etymology
From Latin testum, meaning earthen pot.`);
    expect(r.unknownSections).toEqual(['Etymology']);
    expect(r.structured.notes).toContain('[Etymology]');
    expect(r.structured.notes).toContain('From Latin testum, meaning earthen pot.');
    expect(r.warnings.some((w) => /Etymology/.test(w.message))).toBe(true);
  });

  it('16. rejects empty input', () => {
    expect(parse('   \n \t ')).toMatchObject({ ok: false });
    expect(parse('').error).toMatch(/paste/i);
  });

  it('17. warns (but still fills) when the word is missing', () => {
    const r = parse(`Meaning 1
Simple English explanation: A trial.`);
    expect(r.ok).toBe(true);
    expect(r.form.word).toBe('');
    expect(r.warnings.some((w) => w.section === 'Word')).toBe(true);
  });

  it('18. normalizes invalid contexts and part of speech', () => {
    const r = parse(`Word: cat
Part of speech: adjectiv
Simple English explanation: A small animal.
Examples:
The cat sat. | పిల్లి కూర్చుంది. | randomplace`);
    expect(r.structured.meanings[0].partOfSpeech).toBe('other');
    expect(r.structured.meanings[0].examples[0].context).toBe('general');
    expect(r.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects text that is far too long', () => {
    const r = parse('a'.repeat(MAX_PASTE_LENGTH + 1));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/too long/i);
  });

  it('returns an error when no vocabulary content is recognizable', () => {
    const r = parse('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/could not recognize/i);
  });

  it('parses a pipe-only examples block and normalizes context', () => {
    const r = parse(`Word: run
Meaning 1
Simple English explanation: To move quickly.
Examples:
She runs daily. | ఆమె రోజూ పరిగెత్తుతుంది. | everyday
He ran home. | అతను ఇంటికి పరిగెత్తాడు. | WORK`);
    expect(r.structured.meanings[0].examples.map((e) => e.context)).toEqual(['everyday', 'professional']);
  });
});

describe('form integration helpers', () => {
  const emptyForm = () => structuredToForm({ word: '', pronunciation: '', ipa: '', meanings: [], synonyms: [], antonyms: [], collocations: [], phrases: [], sentencePatterns: [], usageSituations: [], commonMistakes: [], exercises: [], usageNotes: '', categories: [], tags: [], notes: '' });

  it('19. detects existing unsaved form data', () => {
    expect(formHasContent(emptyForm())).toBe(false);
    expect(formHasContent({ ...emptyForm(), word: 'alpha' })).toBe(true);
    const withMeaning = emptyForm();
    withMeaning.meanings[0].teluguMeaning = 'అర్థం';
    expect(formHasContent(withMeaning)).toBe(true);
    const withExample = emptyForm();
    withExample.meanings[0].examples = [{ en: 'A sentence.', te: '', context: 'general' }];
    expect(formHasContent(withExample)).toBe(true);
    expect(formHasContent({ ...emptyForm(), tags: 'one, two' })).toBe(true);
  });

  it('20a. merge keeps existing values and adds parsed ones', () => {
    const existing = { ...emptyForm(), word: 'alpha', meanings: [
      { partOfSpeech: 'noun', simpleExplanation: 'first meaning', detailedExplanation: '', teluguMeaning: 'మొదటి', teluguExplanation: '', examples: [] },
    ], synonyms: 'old | former', notes: 'my note' };
    const incoming = parse(`Word: beta
Meaning 1
Simple English explanation: second meaning
Synonyms:
new | fresh`).form;
    const merged = mergeForms(existing, incoming);
    expect(merged.word).toBe('alpha'); // existing wins for scalars
    expect(merged.meanings).toHaveLength(2);
    expect(merged.meanings[0].simpleExplanation).toBe('first meaning');
    expect(merged.meanings[1].simpleExplanation).toBe('second meaning');
    expect(merged.synonyms).toBe('old | former\nnew | fresh'); // union
    expect(merged.notes).toBe('my note');
  });

  it('20b. merge does not duplicate identical list entries', () => {
    const existing = { ...emptyForm(), antonyms: 'sad' };
    const incoming = { ...emptyForm(), antonyms: 'sad\ngloomy' };
    expect(mergeForms(existing, incoming).antonyms).toBe('sad\ngloomy');
  });

  it('20c. replace uses only the parsed entry', () => {
    const parsed = parse(`Word: gamma
Meaning 1
Simple English explanation: only this one`).form;
    const replaced = mergeForms(null, parsed);
    expect(replaced.word).toBe('gamma');
    expect(replaced.meanings).toHaveLength(1);
    expect(replaced.meanings[0].simpleExplanation).toBe('only this one');
  });

  it('counts populated sections for the success message', () => {
    const r = parse(baseEntry);
    expect(r.counts.fields).toBeGreaterThan(5);
    expect(r.counts.meanings).toBe(1);
    expect(r.counts.examples).toBe(2);
    expect(countPopulated(r.structured)).toEqual(r.counts);
  });
});
