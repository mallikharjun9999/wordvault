import { useEffect, useState } from 'react';
import { BookOpen, Plus, Sparkles, Trash2 } from 'lucide-react';
import { ErrorBanner, Field } from './ui.jsx';
import { Select } from './Dropdown.jsx';
import { POS, CONTEXTS } from '../utils/languages.js';
import { entryToForm, formToPayload, emptyMeaning } from '../utils/vocabForm.js';
import { mergeForms, cloneForm, formHasContent } from '../utils/pasteParser.js';

const SectionHead = ({ index, title, hint, action }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex items-start gap-3">
      {index && <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-[var(--surface)] font-mono text-[11px] font-semibold text-brand">{index}</span>}
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {hint && <p className="muted mt-0.5 leading-relaxed">{hint}</p>}
      </div>
    </div>
    {action}
  </div>
);

export default function VocabForm({ initial, onSubmit, submitLabel = 'Save word', lockWord = false, incoming, onDirtyChange }) {
  const [f, setF] = useState(() => entryToForm(initial)); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  // Apply a Paste & Auto-Fill result. `incoming.token` changes only when a new paste is applied,
  // so ordinary typing never triggers this effect.
  useEffect(() => {
    if (!incoming?.token) return;
    setF((cur) => (incoming.mode === 'merge' ? mergeForms(cur, incoming.form) : cloneForm(incoming.form)));
  }, [incoming?.token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onDirtyChange?.(formHasContent(f)); }, [f, onDirtyChange]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setMeaning = (i, patch) => setF((s) => ({ ...s, meanings: s.meanings.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  const setExample = (i, j, patch) => setMeaning(i, { examples: f.meanings[i].examples.map((x, k) => (k === j ? { ...x, ...patch } : x)) });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await onSubmit(formToPayload(f)); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  const ta = (label, key, hint, rows = 3, placeholder) => (
    <Field label={label} hint={hint}>{(p) => <textarea {...p} rows={rows} className="input resize-y" placeholder={placeholder} value={f[key]} onChange={set(key)} />}</Field>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      <ErrorBanner error={err} />

      <section className="card space-y-4" aria-labelledby="f-basic">
        <SectionHead index="01" title="The word" hint="Start with the word exactly as you want to remember it." />
        <div>
          <label htmlFor="vf-word" className="label">English word or expression</label>
          <input id="vf-word" lang="en" className="input !py-3 !text-lg font-semibold" required maxLength={120} value={f.word} onChange={set('word')} readOnly={!!lockWord} placeholder="e.g. meticulous" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pronunciation guide">{(p) => <input {...p} className="input" value={f.pronunciation} onChange={set('pronunciation')} placeholder="meh-TIK-yuh-lus" />}</Field>
          <Field label="IPA">{(p) => <input {...p} className="input" value={f.ipa} onChange={set('ipa')} placeholder="/məˈtɪkjələs/" />}</Field>
        </div>
      </section>

      {f.meanings.map((m, i) => (
        <section key={i} className="card space-y-4" aria-labelledby={`m-${i}`}>
          <SectionHead
            index={String(i + 1).padStart(2, '0')}
            title={`Meaning ${i + 1}`}
            hint="Keep the English sense and the Telugu meaning together."
            action={f.meanings.length > 1 && (
              <button type="button" className="btn-ghost !min-h-8 !px-2 !text-xs !text-bad" onClick={() => setF((s) => ({ ...s, meanings: s.meanings.filter((_, j) => j !== i) }))}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Remove
              </button>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-[.45fr_1fr]">
            <Field label="Part of speech">{(p) => <Select {...p} className="input" value={m.partOfSpeech} onChange={(e) => setMeaning(i, { partOfSpeech: e.target.value })} options={POS} />}</Field>
            <Field label="Simple English explanation">{(p) => <input {...p} lang="en" className="input" value={m.simpleExplanation} onChange={(e) => setMeaning(i, { simpleExplanation: e.target.value })} placeholder="A short, plain-English definition" />}</Field>
          </div>
          <Field label="Detailed English explanation">{(p) => <textarea {...p} lang="en" rows={3} className="input resize-y" value={m.detailedExplanation} onChange={(e) => setMeaning(i, { detailedExplanation: e.target.value })} placeholder="Nuance, register, when to use it…" />}</Field>
          <div className="grid gap-4 rounded-2xl border border-line bg-[var(--accent-wash)] p-3.5 sm:grid-cols-2">
            <Field label="Telugu meaning (తెలుగు అర్థం)">{(p) => <input {...p} lang="te" className="input" value={m.teluguMeaning} onChange={(e) => setMeaning(i, { teluguMeaning: e.target.value })} placeholder="అర్థం" />}</Field>
            <Field label="Telugu explanation (తెలుగు వివరణ)">{(p) => <textarea {...p} lang="te" rows={2} className="input resize-y" value={m.teluguExplanation} onChange={(e) => setMeaning(i, { teluguExplanation: e.target.value })} placeholder="వివరణ" />}</Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="label !mb-2">Examples</legend>
            {m.examples.map((x, j) => (
              <div key={j} className="space-y-3 rounded-2xl border border-line bg-[var(--surface)] p-3.5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Example {j + 1}</p>
                  <button type="button" className="btn-ghost !min-h-7 !px-1.5 !text-bad" aria-label={`Remove example ${j + 1}`} onClick={() => setMeaning(i, { examples: m.examples.filter((_, k) => k !== j) })}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <Field label={`English sentence ${j + 1}`}>{(p) => <input {...p} lang="en" className="input" value={x.en} onChange={(e) => setExample(i, j, { en: e.target.value })} placeholder="A sentence that makes the meaning obvious" />}</Field>
                <Field label="Telugu translation">{(p) => <input {...p} lang="te" className="input" value={x.te} onChange={(e) => setExample(i, j, { te: e.target.value })} placeholder="తెలుగు అనువాదం" />}</Field>
                <Field label="Context">{(p) => <Select {...p} className="input" value={x.context} onChange={(e) => setExample(i, j, { context: e.target.value })} options={CONTEXTS} />}</Field>
              </div>
            ))}
            <button type="button" className="btn-secondary !min-h-9 !text-xs" onClick={() => setMeaning(i, { examples: [...m.examples, { en: '', te: '', context: 'general' }] })}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />Add example
            </button>
          </fieldset>
        </section>
      ))}

      <button type="button" className="btn-secondary w-full !border-dashed" onClick={() => setF((s) => ({ ...s, meanings: [...s.meanings, emptyMeaning()] }))}>
        <Plus className="h-4 w-4" aria-hidden="true" />Add another meaning
      </button>

      <section className="card space-y-4" aria-labelledby="f-more">
        <SectionHead index="03" title="Usage details" hint="Optional context that makes a word feel lived-in. One item per line." />
        <div className="grid gap-4 sm:grid-cols-2">
          {ta('Synonyms', 'synonyms', 'One per line. Optional difference after a “|”, e.g. frank | more blunt')}
          {ta('Antonyms', 'antonyms', 'Comma or line separated', 2)}
          {ta('Collocations', 'collocations', 'One per line', 2)}
          {ta('Common phrases', 'phrases', 'One per line', 2)}
          {ta('Sentence patterns', 'sentencePatterns', 'One per line', 2)}
          {ta('Usage situations', 'usageSituations', 'One per line: situation | example sentence', 2)}
          {ta('Common mistakes', 'commonMistakes', 'One per line: wrong sentence | correct sentence | note', 2)}
          {ta('Practice exercises', 'exercises', 'One per line: prompt | answer', 2)}
        </div>
        {ta('Usage notes', 'usageNotes', 'Anything that helps you use the word naturally.', 3)}
      </section>

      <section className="card space-y-4" aria-labelledby="f-org">
        <SectionHead index="04" title="Organize" hint="A category or a tag makes the library easier to wander through." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categories" hint="Comma separated">{(p) => <input {...p} className="input" value={f.categories} onChange={set('categories')} placeholder="C1, professional" />}</Field>
          <Field label="Tags" hint="Comma separated">{(p) => <input {...p} className="input" value={f.tags} onChange={set('tags')} placeholder="adjective, emotion" />}</Field>
        </div>
        {ta('Personal notes', 'notes', 'Your own memory hook — a story, a rhyme, a moment.', 3)}
        <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" className="h-4 w-4 accent-[var(--brand-fill)]" checked={f.favorite} onChange={(e) => setF({ ...f, favorite: e.target.checked })} />
          Mark as favorite
        </label>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-[var(--surface)] px-4 py-3">
        <p className="flex items-center gap-2 text-xs text-muted">
          <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
          Your draft stays on this page until you save.
        </p>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-faint"><BookOpen className="h-3 w-3" aria-hidden="true" />Only the fields you filled are saved.</p>
    </form>
  );
}
