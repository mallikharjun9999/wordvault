import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, RotateCcw, SkipForward, Sparkles } from 'lucide-react';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { EmptyState, ErrorBanner, PageHeader, PageSkeleton } from '../components/ui.jsx';
import { ProgressBar } from '../components/visual.jsx';
import { newRequestId, normalizeLanguage } from '../utils/languages.js';

const RATINGS = [
  ['again', 'Again', 'rating-again', 'Not yet'],
  ['hard', 'Hard', 'rating-hard', 'Shaky'],
  ['good', 'Good', 'rating-good', 'Got it'],
  ['easy', 'Easy', 'rating-easy', 'Effortless'],
];

function Card({ entry, lang, onRate, onSkip, busy, error }) {
  const [step, setStep] = useState(0); // 0 word, 1 meaning, 2 examples
  const requestId = useMemo(newRequestId, [entry.id, entry.srs.reviewCount]); // stable across retries of the same card => idempotent
  const showTe = lang === 'te'; // 'en' = English-only review
  const m = entry.meanings[0] || {};
  const ref = useRef(null);
  useEffect(() => { setStep(0); ref.current?.focus(); }, [entry.id]);
  useEffect(() => {
    const h = (e) => {
      if (e.target.closest?.('input,textarea,select')) return;
      if (e.key === ' ' && step < 2) { e.preventDefault(); setStep((s) => s + 1); }
      if (step >= 1 && ['1', '2', '3', '4'].includes(e.key)) onRate(RATINGS[+e.key - 1][0], requestId);
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [step, requestId, onRate]);

  return (
    <div className="mx-auto max-w-2xl" ref={ref} tabIndex={-1}>
      <div className="flashcard">
        <div className={`flashcard-inner ${step >= 1 ? 'is-flipped' : ''}`}>
          {/* Front */}
          <div className="flashcard-face">
            {step === 0 && (
              <div className="card relative overflow-hidden !p-0 text-center">
                <div className="relative px-6 py-12 sm:px-10 sm:py-16">
                  <p className="eyebrow">Say it aloud first</p>
                  <h2 lang="en" className="display mt-5 text-5xl leading-none text-ink sm:text-6xl">{entry.word}</h2>
                  {(entry.pronunciation || entry.ipa) && (
                    <p className="mt-4 font-mono text-xs tracking-wide text-faint">{[entry.pronunciation, entry.ipa].filter(Boolean).join('  ·  ')}</p>
                  )}
                  <div className="mt-8 flex flex-wrap justify-center gap-2">
                    <span className="chip capitalize">{m.partOfSpeech}</span>
                    {entry.categories?.slice(0, 2).map((c) => <span key={c} className="chip">{c}</span>)}
                  </div>
                  <button className="btn-primary mx-auto mt-9 w-full max-w-xs" onClick={() => setStep(1)}>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />Reveal meaning <kbd className="ml-1 hidden text-[10px] opacity-80 sm:inline">Space</kbd>
                  </button>
                  <p className="mt-4 text-[11px] text-faint">Try to recall the meaning before you flip the card.</p>
                </div>
                <div className="relative flex justify-center border-t border-line py-3">
                  <button className="btn-ghost !min-h-8 !text-xs" onClick={onSkip} disabled={busy}><SkipForward className="h-3.5 w-3.5" aria-hidden="true" />Skip for now</button>
                </div>
              </div>
            )}
          </div>

          {/* Back */}
          <div className="flashcard-face is-back">
            {step >= 1 && (
              <div className="card !p-0">
                <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
                  <button className="btn-ghost !min-h-8 !px-2 !text-xs" onClick={() => setStep(0)}><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Back to word</button>
                  <span className="eyebrow !text-[0.58rem]">Meaning reveal</span>
                </div>
                <div className="space-y-4 px-5 py-5 sm:px-7" aria-live="polite">
                  <div>
                    <p className="eyebrow mb-2">In English</p>
                    <p lang="en" className="text-xl leading-relaxed text-ink">{m.simpleExplanation}</p>
                    {m.detailedExplanation && <p lang="en" className="muted mt-2 leading-relaxed">{m.detailedExplanation}</p>}
                  </div>

                  {showTe && m.teluguMeaning && (
                    <div className="rounded-2xl border border-line bg-[var(--accent-wash)] p-4">
                      <p className="eyebrow mb-1.5 !text-[0.58rem]">తెలుగులో</p>
                      <p lang="te" className="text-lg font-semibold leading-relaxed text-ink">{m.teluguMeaning}</p>
                    </div>
                  )}

                  {step >= 2 && (
                    <div className="animate-rise">
                      <p className="eyebrow mb-2">In context</p>
                      <ul className="space-y-2">
                        {m.examples?.slice(0, 3).map((x, i) => (
                          <li key={i} className="rounded-xl border-l-2 border-brand bg-[var(--surface)] py-2 pl-3 text-sm">
                            <p lang="en" className="leading-relaxed text-ink">{x.en}</p>
                            {showTe && x.te && <p lang="te" className="mt-0.5 leading-relaxed text-muted">{x.te}</p>}
                          </li>
                        ))}
                        {!m.examples?.length && <li className="muted text-sm">No examples saved for this word.</li>}
                      </ul>
                    </div>
                  )}

                  {step === 1 && m.examples?.length > 0 && (
                    <button className="btn-secondary !min-h-9 !text-xs" onClick={() => setStep(2)}><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />Show examples</button>
                  )}

                  <ErrorBanner error={error} />

                  <div>
                    <p className="mb-2 text-center text-[11px] font-medium text-muted">How well did you recall it?</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="How well did you recall it?">
                      {RATINGS.map(([k, label, cls, hint], i) => (
                        <button key={k} disabled={busy} onClick={() => onRate(k, requestId)} className={`btn min-h-12 ${cls}`}>
                          <span className="flex flex-col items-center leading-tight">
                            <span>{label}</span>
                            <span className="text-[9px] font-normal opacity-70">{hint}</span>
                          </span>
                          <kbd className="hidden text-[9px] opacity-60 sm:inline">{i + 1}</kbd>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="btn-ghost mx-auto !min-h-8 !text-xs" onClick={onSkip} disabled={busy}><SkipForward className="h-3.5 w-3.5" aria-hidden="true" />Skip for now</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Review() {
  const { user } = useAuth(); const lang = normalizeLanguage(user.preferences.explanationLanguage);
  const q = useAsync(async () => { const r = await api.get('/reviews/queue'); return { items: r.data.items, dueTotal: r.meta.dueTotal }; }, []);
  const [queue, setQueue] = useState(null); const [done, setDone] = useState({ again: 0, hard: 0, good: 0, easy: 0, skipped: 0 });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [retry, setRetry] = useState([]);
  useEffect(() => { if (q.data) setQueue(q.data.items); }, [q.data]);

  const rate = useCallback(async (rating, requestId) => {
    if (busy || !queue?.length) return;
    const cur = queue[0]; setBusy(true); setErr(null);
    try {
      const r = (await api.post('/reviews', { vocabularyId: cur.id, rating, requestId })).data;
      setDone((d) => ({ ...d, [rating]: d[rating] + 1 }));
      setQueue((qq) => { const rest = qq.slice(1); return rating === 'again' ? [...rest, r.entry] : rest; }); // difficult words come back this session
      if (rating === 'again') setRetry((x) => (x.includes(cur.id) ? x : [...x, cur.id]));
    } catch (x) { setErr(x); } finally { setBusy(false); }
  }, [busy, queue]);
  const skip = () => { setDone((d) => ({ ...d, skipped: d.skipped + 1 })); setQueue((qq) => [...qq.slice(1)]); };

  if (q.loading || !queue) return q.error ? <ErrorBanner error={q.error} onRetry={q.reload} /> : <PageSkeleton label="Preparing your review…" />;
  const reviewed = done.again + done.hard + done.good + done.easy;
  const total = reviewed + queue.length + done.skipped;
  const pct = total > 0 ? (reviewed / total) * 100 : 0;

  return (
    <>
      <PageHeader
        eyebrow="Spaced review"
        title="Daily review"
        sub={queue.length ? `${queue.length} left in this session${q.data.dueTotal > q.data.items.length ? ` (${q.data.dueTotal} due in total)` : ''}. Reveal, recall, then rate honestly.` : undefined}
      >
        <Link to="/quiz" className="btn-secondary">Practise with a quiz</Link>
      </PageHeader>

      {queue.length > 0 && (
        <div className="mx-auto mb-4 max-w-2xl">
          <ProgressBar value={reviewed} max={Math.max(1, total)} label="Session progress" right={`${reviewed} / ${Math.max(1, total)}`} />
        </div>
      )}

      {queue.length > 0 ? (
        <Card key={queue[0].id + reviewed} entry={queue[0]} lang={lang} onRate={rate} onSkip={skip} busy={busy} error={err} />
      ) : reviewed === 0 && done.skipped === 0 ? (
        <EmptyState title="Nothing due right now" action={<Link to="/quiz" className="btn-secondary">Try a quiz instead</Link>}>
          You’re all caught up. New words are due immediately after you add them.
        </EmptyState>
      ) : (
        <section className="card mx-auto max-w-2xl" aria-labelledby="sum">
          <div className="flex items-start gap-4">
            <span className="icon-tile !h-12 !w-12 !rounded-2xl"><CheckCircle2 className="h-5 w-5 text-good" aria-hidden="true" /></span>
            <div>
              <p className="eyebrow">You showed up today</p>
              <h2 id="sum" className="mt-1 text-2xl font-bold tracking-tight">Session complete 🎉</h2>
              <p className="muted mt-1">{reviewed} review{reviewed === 1 ? '' : 's'} recorded{done.skipped ? `, ${done.skipped} skipped` : ''}.</p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
            {RATINGS.map(([k, l]) => (
              <div key={k} className="rounded-xl border border-line bg-[var(--surface)] p-2.5">
                <dt className="font-mono text-[9px] uppercase tracking-wider text-faint">{l}</dt>
                <dd className="stat-value mt-1 !text-xl">{done[k]}</dd>
              </div>
            ))}
          </dl>
          {retry.length > 0 && <p className="muted mt-3">{retry.length} word{retry.length === 1 ? '' : 's'} needed a retry — they’ll also come back soon.</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => { setDone({ again: 0, hard: 0, good: 0, easy: 0, skipped: 0 }); setRetry([]); q.reload(); }}><RotateCcw className="h-4 w-4" aria-hidden="true" />Check for more</button>
            <Link to="/" className="btn-secondary">Dashboard</Link>
          </div>
        </section>
      )}
      <p className="mt-5 text-center text-[11px] text-faint">
        {pct > 0 ? `${Math.round(pct)}% of this session done. ` : ''}Ratings shape when each word returns. Honesty makes spaced review work.
      </p>
    </>
  );
}
