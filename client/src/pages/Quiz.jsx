import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, HelpCircle, ListChecks, Play, Sparkles, Trophy, XCircle } from 'lucide-react';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { ErrorBanner, PageHeader, EmptyState, LoadingSkeleton } from '../components/ui.jsx';
import { CountUp, ProgressBar, ProgressRing, Reveal } from '../components/visual.jsx';

const TYPES = [
  ['meaning', 'Meaning'],
  ['fill_blank', 'Fill in the blank'],
  ['correct_sentence', 'Correct sentence'],
  ['synonym', 'Synonym'],
  ['antonym', 'Antonym'],
  ['context_word', 'Word for the situation'],
  ['en_to_te', 'English → Telugu'],
  ['te_to_en', 'Telugu → English'],
];
const isTe = (t) => /[\u0C00-\u0C7F]/.test(t);

export default function Quiz() {
  const [count, setCount] = useState(10); const [types, setTypes] = useState(TYPES.map((t) => t[0]));
  const [quiz, setQuiz] = useState(null); const [answers, setAnswers] = useState({}); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const hist = useAsync(async () => (await api.get('/quizzes')).data.attempts, []);

  const start = async () => {
    setBusy(true); setErr(null);
    try { setQuiz((await api.post('/quizzes', { count, types })).data.quiz); setAnswers({}); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { setQuiz((await api.post(`/quizzes/${quiz.id}/submit`, { answers: Object.entries(answers).map(([qid, optionId]) => ({ qid, optionId })) })).data.quiz); hist.reload(); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  const done = quiz?.status === 'completed';
  const answered = Object.keys(answers).length;

  if (!quiz) return (
    <>
      <PageHeader eyebrow="Practice" title="Quiz & practice" sub="Questions are built only from the words and details you’ve saved." />

      <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <Reveal>
          <div className="card space-y-5">
            <div className="flex items-start gap-3">
              <span className="icon-tile"><HelpCircle className="h-4 w-4" aria-hidden="true" /></span>
              <div>
                <h2 className="text-lg font-semibold text-ink">Build a short quiz</h2>
                <p className="muted mt-0.5 leading-relaxed">Choose how many questions and which kinds. Types your words don’t have data for are skipped automatically.</p>
              </div>
            </div>

            <ErrorBanner error={err} />

            <div>
              <label className="label" htmlFor="qc">Number of questions</label>
              <div className="flex flex-wrap items-center gap-2">
                {[5, 10, 15, 20].map((n) => (
                  <button key={n} type="button" onClick={() => setCount(n)} className={`btn !min-h-9 !px-3 !text-xs ${count === n ? 'btn-primary' : 'btn-secondary'}`}>{n}</button>
                ))}
                <input id="qc" type="number" min={1} max={20} className="input !w-24 !py-2" value={count} onChange={(e) => setCount(Math.min(20, Math.max(1, +e.target.value || 1)))} />
              </div>
            </div>

            <fieldset>
              <legend className="label">Question types</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {TYPES.map(([k, l]) => {
                  const on = types.includes(k);
                  return (
                    <label key={k} className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors ${on ? 'border-brand/40 bg-[var(--surface-hi)] text-ink' : 'border-line bg-[var(--surface)] text-muted hover:text-ink'}`}>
                      <input type="checkbox" className="h-4 w-4 accent-[var(--brand-fill)]" checked={on} onChange={(e) => setTypes((t) => e.target.checked ? [...t, k] : t.filter((x) => x !== k))} />
                      {l}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <button className="btn-primary" disabled={busy || !types.length} onClick={start}><Play className="h-4 w-4" aria-hidden="true" />{busy ? 'Building…' : 'Start quiz'}</button>
              <Link to="/sentences" className="btn-secondary">Sentence-writing practice</Link>
            </div>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <aside className="card h-full">
            <p className="eyebrow">Why it helps</p>
            <h2 className="mt-1 text-lg font-semibold">Recall, not recognition</h2>
            <ul className="mt-4 space-y-3">
              {[
                { icon: ListChecks, title: 'Only your words', text: 'Every question comes from the entries you saved.' },
                { icon: Sparkles, title: 'Mixed formats', text: 'Meaning, context, translation, synonyms — variety keeps recall honest.' },
                { icon: Trophy, title: 'A real score', text: 'Your accuracy is calculated from completed attempts, never estimated.' },
              ].map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-[var(--surface)] text-brand"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
                  <div><p className="text-sm font-semibold text-ink">{title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted">{text}</p></div>
                </li>
              ))}
            </ul>
          </aside>
        </Reveal>
      </div>

      <section className="mt-7" aria-labelledby="qh">
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <p className="eyebrow">History</p>
            <h2 id="qh" className="mt-1 text-xl font-semibold">Recent attempts</h2>
          </div>
        </div>
        {hist.loading ? (
          <LoadingSkeleton rows={2} label="Loading quiz history…" />
        ) : hist.error ? (
          <ErrorBanner error={hist.error} onRetry={hist.reload} />
        ) : hist.data?.length ? (
          <ul className="card divide-y divide-[var(--line)] !p-0">
            {hist.data.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-muted">{new Date(a.completedAt).toLocaleString()}</span>
                <span className="font-mono text-sm font-semibold text-ink">{a.score}<span className="text-faint">/{a.total}</span></span>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No attempts yet">Your scores will appear here.</EmptyState>}
      </section>
    </>
  );

  const pct = done ? Math.round((quiz.score / quiz.total) * 100) : Math.round((answered / quiz.questions.length) * 100);

  return (
    <>
      <PageHeader
        eyebrow={done ? 'Results' : 'In progress'}
        title={done ? 'How you did' : 'Quiz'}
        sub={done ? `${quiz.score} of ${quiz.total} correct · ${Math.round((quiz.score / quiz.total) * 100)}%` : 'Answer what you can; unanswered questions count as incorrect.'}
      >
        {done && <button type="button" className="btn-secondary" onClick={() => setQuiz(null)}>New quiz</button>}
      </PageHeader>

      <ErrorBanner error={err} className="mb-4" />

      {done && (
        <section className="card mb-5 overflow-hidden" aria-labelledby="result">
          <div className="flex flex-wrap items-center gap-6">
            <ProgressRing value={quiz.score} max={quiz.total} size={132} stroke={9} label="Quiz score">
              <div>
                <p className="stat-value !text-3xl"><CountUp value={Math.round((quiz.score / quiz.total) * 100)} suffix="%" /></p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">{quiz.score}/{quiz.total}</p>
              </div>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Attempt complete</p>
              <h2 id="result" className="mt-1 text-2xl font-bold tracking-tight">
                {pct >= 80 ? 'That is solid recall.' : pct >= 50 ? 'A good start — review the misses.' : 'Useful information. Try again after a review.'}
              </h2>
              <p className="muted mt-1 leading-relaxed">Missed questions are the most valuable ones. Read the explanations below, then let spaced review bring those words back.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => setQuiz(null)}>Try another quiz</button>
                <Link className="btn-secondary" to="/progress">See progress</Link>
                <Link className="btn-ghost" to="/review">Review words</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {!done && (
        <div className="mb-4">
          <ProgressBar value={answered} max={quiz.questions.length} label="Answered" right={`${answered} / ${quiz.questions.length}`} />
        </div>
      )}

      <form onSubmit={submit} className="space-y-3.5">
        {quiz.questions.map((q, i) => (
          <fieldset key={q.qid} className="card" disabled={done}>
            <legend className="sr-only">Question {i + 1}</legend>
            <div className="mb-3 flex items-start gap-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-[var(--surface)] font-mono text-[11px] font-semibold text-brand">{i + 1}</span>
              <p className="font-medium leading-relaxed"><span lang={isTe(q.prompt) ? 'te' : 'en'}>{q.prompt}</span></p>
            </div>
            <div className="space-y-2">
              {q.options.map((o) => {
                const chosen = (done ? q.answerOptionId : answers[q.qid]) === o.id;
                const right = done && o.id === q.correctOptionId;
                const wrong = done && chosen && !right;
                return (
                  <label
                    key={o.id}
                    className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors ${right ? 'border-good/60 bg-[color-mix(in_oklab,var(--good)_9%,var(--surface-hi))]' : wrong ? 'border-bad/60 bg-[color-mix(in_oklab,var(--bad)_9%,var(--surface-hi))]' : chosen ? 'border-brand/50 bg-[var(--surface-hi)]' : 'border-line bg-[var(--surface)] hover:border-line-strong'}`}
                  >
                    <input type="radio" name={q.qid} className="mt-0.5 h-4 w-4 accent-[var(--brand-fill)]" checked={chosen} onChange={() => setAnswers((a) => ({ ...a, [q.qid]: o.id }))} />
                    <span lang={isTe(o.text) ? 'te' : 'en'} className="min-w-0 flex-1 leading-relaxed">{o.text}</span>
                    {right && <CheckCircle2 className="h-4 w-4 shrink-0 text-good" aria-label="Correct answer" />}
                    {wrong && <XCircle className="h-4 w-4 shrink-0 text-bad" aria-label="Your answer (incorrect)" />}
                  </label>
                );
              })}
            </div>
            {done && (
              <p className="mt-3 rounded-xl border border-line bg-[var(--surface)] p-3 text-xs leading-relaxed" role="status">
                <strong className={q.correct ? 'text-good' : q.answerOptionId ? 'text-bad' : 'text-warn'}>{q.correct ? 'Correct.' : q.answerOptionId ? 'Not quite.' : 'Unanswered.'}</strong>{' '}
                <span className="text-muted">{q.explanation}</span>
              </p>
            )}
          </fieldset>
        ))}

        {done ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => setQuiz(null)}>New quiz</button>
            <Link className="btn-secondary" to="/progress">See progress</Link>
          </div>
        ) : (
          <button className="btn-primary" disabled={busy || !answered}>{busy ? 'Grading…' : `Submit ${answered ? `${answered} answer${answered === 1 ? '' : 's'}` : 'answers'}`}</button>
        )}
      </form>
    </>
  );
}
