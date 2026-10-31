import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, PenLine, Quote, Sparkles } from 'lucide-react';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { EmptyState, ErrorBanner, PageHeader, PageSkeleton, StatusBadge } from '../components/ui.jsx';
import { Select } from '../components/Dropdown.jsx';
import { Reveal, Toast } from '../components/visual.jsx';

const SELF = [
  ['correct', 'I used it correctly', 'You are confident this sentence is right.'],
  ['unsure', 'Not sure', 'You wrote it but want to check it later.'],
  ['incorrect', 'I used it wrongly', 'Honest notes are more useful than a perfect score.'],
];

const CONFIDENCE_LABEL = { 1: 'Very unsure', 2: 'Unsure', 3: 'Getting there', 4: 'Fairly sure', 5: 'Very sure' };

export default function Sentences() {
  const words = useAsync(async () => (await api.get('/vocabulary?limit=100&sort=alpha')).data.items, []);
  const recent = useAsync(async () => (await api.get('/sentences')).data.sentences, []);
  const [id, setId] = useState('');
  const [text, setText] = useState('');
  const [self, setSelf] = useState('correct');
  const [conf, setConf] = useState(3);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);

  if (words.loading) return <PageSkeleton label="Loading your writing desk…" />;
  if (words.error) return <ErrorBanner error={words.error} onRetry={words.reload} />;

  if (!words.data.length) return (
    <>
      <PageHeader eyebrow="Practice" title="Write sentences" />
      <EmptyState title="Add a word first" action={<Link to="/words/new" className="btn-primary">Add word</Link>}>
        Sentence practice uses words from your vault.
      </EmptyState>
    </>
  );

  const w = words.data.find((x) => x.id === id);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null); setSaved(null);
    try {
      const r = (await api.post('/sentences', { vocabularyId: id, text, selfAssessment: self, confidence: conf })).data;
      setSaved(r.entry); setText(''); recent.reload();
    } catch (x) { setErr(x); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader
        eyebrow="Practice"
        title="Write sentences"
        sub="Use a word in your own sentence. A sentence you judge correct counts as active use."
      >
        <Link to="/review" className="btn-secondary"><Sparkles className="h-4 w-4" aria-hidden="true" />Review instead</Link>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
        <Reveal>
          <form onSubmit={submit} className="card space-y-5">
            <div className="flex items-start gap-3">
              <span className="icon-tile"><PenLine className="h-4 w-4" aria-hidden="true" /></span>
              <div>
                <h2 className="text-lg font-semibold text-ink">The writing desk</h2>
                <p className="muted mt-0.5 leading-relaxed">Pick a word, write it into a moment that feels real, then judge it honestly.</p>
              </div>
            </div>

            <ErrorBanner error={err} />

            <div>
              <label className="label" htmlFor="sw">Word</label>
              <Select
                id="sw"
                className="input !py-2.5"
                required
                value={id}
                onChange={(e) => { setId(e.target.value); setSaved(null); }}
                options={[
                  { value: '', label: 'Choose a word…' },
                  ...words.data.map((x) => ({ value: x.id, label: x.word })),
                ]}
              />
            </div>

            <div>
              <div className="mb-1 flex items-end justify-between gap-2">
                <label className="label !mb-0" htmlFor="st">Your sentence</label>
                <span className="font-mono text-[10px] tabular-nums text-faint">{text.length}/500</span>
              </div>
              <textarea
                id="st"
                lang="en"
                rows={4}
                className="input resize-y !text-[15px] leading-relaxed"
                required
                minLength={3}
                maxLength={500}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={w ? `Write a sentence using “${w.word}”…` : 'Choose a word above, then write here…'}
              />
            </div>

            <fieldset>
              <legend className="label">Honest self-check (nothing is graded automatically)</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {SELF.map(([k, l, hint]) => {
                  const on = self === k;
                  return (
                    <label
                      key={k}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition-colors ${on ? 'border-brand/45 bg-[var(--surface-hi)] text-ink' : 'border-line bg-[var(--surface)] text-muted hover:text-ink'}`}
                    >
                      <input
                        type="radio"
                        name="self"
                        className="mt-0.5 h-4 w-4 accent-[var(--brand-fill)]"
                        checked={on}
                        onChange={() => setSelf(k)}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium leading-snug">{l}</span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-faint">{hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="rounded-2xl border border-line bg-[var(--surface)] p-4">
              <div className="flex items-baseline justify-between gap-2">
                <label className="label !mb-0" htmlFor="sc">Confidence: {conf}/5</label>
                <span className="text-[11px] font-medium text-muted">{CONFIDENCE_LABEL[conf]}</span>
              </div>
              <input
                id="sc"
                type="range"
                min={1}
                max={5}
                value={conf}
                onChange={(e) => setConf(+e.target.value)}
                className="mt-3 w-full max-w-xs accent-[var(--brand-fill)]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-[11px] text-faint">A short, specific sentence beats a long, vague one.</p>
              <button className="btn-primary" disabled={busy || !id}>{busy ? 'Saving…' : 'Save sentence'}</button>
            </div>
          </form>
        </Reveal>

        <Reveal delay={80}>
          <aside className="card h-full" aria-labelledby="s-preview">
            <p className="eyebrow">The word you chose</p>
            <h2 id="s-preview" className="mt-1 text-lg font-semibold">A quick reminder</h2>

            {w ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p lang="en" className="display text-3xl leading-none text-ink">{w.word}</p>
                  {w.pronunciation && <p className="mt-1.5 font-mono text-[11px] tracking-wide text-faint">/{w.pronunciation}/</p>}
                </div>
                <div className="rounded-2xl border border-line bg-[var(--accent-wash)] p-3.5">
                  <p className="eyebrow mb-1.5 !text-[0.58rem]">తెలుగులో</p>
                  <p lang="te" className="font-semibold leading-relaxed text-ink">
                    {w.meanings?.[0]?.teluguMeaning || <span className="muted">No Telugu meaning saved.</span>}
                  </p>
                </div>
                <div>
                  <p className="eyebrow mb-1.5">In English</p>
                  <p lang="en" className="text-sm leading-relaxed text-ink-soft">{w.meanings?.[0]?.simpleExplanation}</p>
                </div>
                {w.meanings?.[0]?.examples?.[0]?.en && (
                  <div className="border-t border-line pt-3">
                    <p className="eyebrow mb-1.5">An example</p>
                    <p lang="en" className="flex gap-2 text-sm italic leading-relaxed text-muted">
                      <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
                      {w.meanings[0].examples[0].en}
                    </p>
                  </div>
                )}
                <Link to={`/words/${w.id}`} className="btn-secondary w-full !text-xs">Open the full entry</Link>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-line px-4 py-8 text-center">
                <BookOpen className="mx-auto h-5 w-5 text-faint" aria-hidden="true" />
                <p className="muted mt-3 leading-relaxed">Choose a word and its meaning will appear here while you write.</p>
              </div>
            )}
          </aside>
        </Reveal>
      </div>

      <section className="mt-7" aria-labelledby="rs">
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <p className="eyebrow">Your notebook</p>
            <h2 id="rs" className="mt-1 text-xl font-semibold">Recent sentences</h2>
          </div>
          {recent.data?.length > 0 && <span className="chip">{Math.min(recent.data.length, 10)} latest</span>}
        </div>

        {recent.data?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recent.data.slice(0, 10).map((s, i) => {
              const tone = s.selfAssessment === 'correct' ? 'text-good' : s.selfAssessment === 'incorrect' ? 'text-bad' : 'text-warn';
              return (
                <Reveal key={s.id} delay={Math.min(i, 6) * 40} as="li" className="h-full">
                  <div className="card h-full !p-4">
                    <p lang="en" className="text-sm leading-relaxed text-ink">{s.text}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${tone}`}>{s.selfAssessment}</span>
                      <span className="flex items-center gap-1.5" aria-label={`Confidence ${s.confidence} of 5`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: n <= s.confidence ? 'var(--brand)' : 'var(--line-strong)' }}
                            aria-hidden="true"
                          />
                        ))}
                        <span className="ml-1 font-mono text-[10px] text-faint">{s.confidence}/5</span>
                      </span>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </ul>
        ) : (
          <div className="card !border-dashed py-10 text-center">
            <p className="muted leading-relaxed">Nothing written yet. Your sentences will collect here.</p>
          </div>
        )}
      </section>

      <Toast open={!!saved} onClose={() => setSaved(null)}>
        {saved && (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            Sentence saved. “{saved.word}” is now <StatusBadge status={saved.learningStatus} />.
          </span>
        )}
      </Toast>
    </>
  );
}
