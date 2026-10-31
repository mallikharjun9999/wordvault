import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Pencil, Printer, Star, Trash2 } from 'lucide-react';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ConfirmDialog, ErrorBanner, PageSkeleton, StatusBadge } from '../components/ui.jsx';
import { Select } from '../components/Dropdown.jsx';
import { SUPPORTED_LANGUAGES, languageLabel, normalizeLanguage } from '../utils/languages.js';

const Section = ({ title, children }) => (children ? (
  <section>
    <h3 className="eyebrow mb-2">{title}</h3>
    {children}
  </section>
) : null);

const Chips = ({ items, lang = 'en' }) => items?.length ? (
  <ul className="flex flex-wrap gap-2">
    {items.map((x, i) => <li key={i} className="chip" lang={lang}>{x}</li>)}
  </ul>
) : null;

// `lang` is the explanation language: 'te' shows the Telugu meaning, explanation and example translations beneath the
// English; 'en' shows the English entry only.
export function EntryDocument({ entry, lang }) {
  const showTe = lang === 'te';
  return (
    <article className="card overflow-hidden !p-0">
      <header className="relative border-b border-line px-5 py-6 sm:px-7 sm:py-8">
        <p className="eyebrow">Entry · {entry.meanings.length} meaning{entry.meanings.length === 1 ? '' : 's'}</p>
        <h1 lang="en" dir="ltr" className="display mt-2 text-4xl leading-none text-ink sm:text-5xl">{entry.word}</h1>
        {(entry.pronunciation || entry.ipa) && (
          <p lang="en" className="mt-3 font-mono text-xs tracking-wide text-faint">{[entry.pronunciation, entry.ipa].filter(Boolean).join('  ·  ')}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {entry.meanings.map((m, i) => <span key={i} className="chip capitalize">{m.partOfSpeech}</span>)}
          {entry.favorite && <span className="chip !text-warn"><Star className="h-3 w-3 fill-current" aria-hidden="true" />Favorite</span>}
        </div>
      </header>

      <div className="divide-y divide-[var(--line)]">
        {entry.meanings.map((m, i) => {
          return (
            <section key={i} className="px-5 py-6 sm:px-7">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="chip capitalize">{m.partOfSpeech}</span>
                {entry.meanings.length > 1 && <span className="eyebrow">Meaning {i + 1}</span>}
              </div>

              {m.simpleExplanation && <p lang="en" className="text-xl leading-relaxed text-ink">{m.simpleExplanation}</p>}
              {m.detailedExplanation && <p lang="en" className="muted mt-2 leading-relaxed">{m.detailedExplanation}</p>}

              {showTe && (m.teluguMeaning || m.teluguExplanation) && (
                <div lang="te" className="mt-4 rounded-2xl border border-line bg-[var(--accent-wash)] p-4">
                  <p className="text-lg font-semibold leading-relaxed text-ink">{m.teluguMeaning}</p>
                  {m.teluguExplanation && <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{m.teluguExplanation}</p>}
                </div>
              )}

              {m.examples.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {m.examples.map((x, j) => (
                    <li key={j} className="rounded-xl border-l-2 border-brand bg-[var(--surface)] py-2.5 pl-3.5 pr-3">
                      <p lang="en" className="leading-relaxed text-ink">
                        {x.en}
                        {x.context !== 'general' && <span className="chip ml-2 align-middle !text-[10px]">{x.context}</span>}
                      </p>
                      {showTe && x.te && <p lang="te" className="mt-1 text-sm leading-relaxed text-muted">{x.te}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="space-y-6 border-t border-line px-5 py-6 sm:px-7">
        <Section title="Synonyms">
          {entry.synonyms.length > 0 && (
            <ul className="flex flex-wrap gap-2" lang="en">
              {entry.synonyms.map((s, i) => (
                <li key={i} className="chip !items-start !rounded-xl !px-3 !py-1.5">
                  <strong className="font-semibold">{s.word}</strong>
                  {s.difference && <span className="text-faint"> — {s.difference}</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Antonyms"><Chips items={entry.antonyms} /></Section>
        <Section title="Collocations"><Chips items={entry.collocations} /></Section>
        <Section title="Common phrases"><Chips items={entry.phrases} /></Section>
        <Section title="Sentence patterns">
          {entry.sentencePatterns.length > 0 && <ul className="space-y-1.5" lang="en">{entry.sentencePatterns.map((s, i) => <li key={i} className="flex gap-2 text-sm leading-relaxed"><span className="text-brand" aria-hidden="true">→</span>{s}</li>)}</ul>}
        </Section>
        <Section title="Where you’d use it">
          {entry.usageSituations.length > 0 && (
            <ul className="space-y-2.5" lang="en">
              {entry.usageSituations.map((u, i) => (
                <li key={i} className="rounded-xl border border-line bg-[var(--surface)] p-3">
                  <strong className="text-sm font-semibold text-ink">{u.situation}</strong>
                  {u.example && <p className="muted mt-1 leading-relaxed">{u.example}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Common mistakes">
          {entry.commonMistakes.length > 0 && (
            <ul className="space-y-2.5" lang="en">
              {entry.commonMistakes.map((c, i) => (
                <li key={i} className="rounded-xl border border-line bg-[var(--surface)] p-3 text-sm">
                  <p className="text-bad line-through">{c.mistake}</p>
                  <p className="text-good">{c.correction}</p>
                  {c.note && <p className="muted mt-1 text-xs">{c.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Usage notes">{entry.usageNotes && <p lang="en" className="text-sm leading-relaxed text-ink-soft">{entry.usageNotes}</p>}</Section>
        <Section title="Practice">
          {entry.exercises.length > 0 && (
            <ul className="space-y-2" lang="en">
              {entry.exercises.map((x, i) => (
                <li key={i} className="rounded-xl border border-line bg-[var(--surface)] p-3 text-sm">
                  <p className="text-ink">{x.prompt}</p>
                  <details className="no-print mt-1">
                    <summary className="cursor-pointer text-xs font-medium text-brand">Show answer</summary>
                    <p className="mt-1.5 text-muted">{x.answer}</p>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="My notes">{entry.notes && <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{entry.notes}</p>}</Section>
        {(entry.tags.length > 0 || entry.categories.length > 0) && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {entry.categories.map((c) => <span key={`c${c}`} className="chip">📁 {c}</span>)}
            {entry.tags.map((t) => <span key={`t${t}`} className="chip">#{t}</span>)}
          </div>
        )}
      </div>
    </article>
  );
}

export default function VocabDetail() {
  const { id } = useParams(); const nav = useNavigate(); const { user } = useAuth();
  const [lang, setLang] = useState(normalizeLanguage(user?.preferences?.explanationLanguage));
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [actionErr, setActionErr] = useState(null);
  const entry = useAsync(async () => (await api.get(`/vocabulary/${id}`)).data.entry, [id]);

  if (entry.loading) return <PageSkeleton label="Loading this entry…" />;
  if (entry.error) return <ErrorBanner error={entry.error} onRetry={entry.reload} />;
  const e = entry.data;
  const act = async (fn) => { setActionErr(null); try { await fn(); } catch (x) { setActionErr(x); } };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/words" className="btn-ghost !min-h-8 !px-2 !text-xs"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />All words</Link>
        <div className="no-print flex flex-wrap justify-end gap-2">
          <button className="btn-secondary !min-h-9 !px-3 !text-xs" aria-pressed={e.favorite} onClick={() => act(async () => entry.setData((await api.patch(`/vocabulary/${id}`, { favorite: !e.favorite })).data.entry))}>
            <Star className={`h-3.5 w-3.5 ${e.favorite ? 'fill-amber-400 text-amber-500' : ''}`} aria-hidden="true" />{e.favorite ? 'Favorited' : 'Favorite'}
          </button>
          <Link className="btn-secondary !min-h-9 !px-3 !text-xs" to={`/words/${id}/edit`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</Link>
          <button className="btn-secondary !min-h-9 !px-3 !text-xs" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" aria-hidden="true" />Print</button>
          <button className="btn-secondary !min-h-9 !px-3 !text-xs !text-bad" onClick={() => setConfirm(true)}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Delete</button>
        </div>
      </div>

      <ErrorBanner error={actionErr} className="mb-4" />

      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={e.learningStatus} />
        {e.learningStatus === 'documented' && (
          <button className="btn-ghost !min-h-8 !px-2 !py-1 !text-xs" onClick={() => act(async () => entry.setData((await api.post(`/vocabulary/${id}/recognize`, { recognized: true })).data.entry))}>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />I recognize this word
          </button>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="eyebrow !text-muted">Explain in</span>
          <Select
            className="input !w-auto !py-1.5 !text-xs"
            value={lang}
            onChange={(ev) => setLang(ev.target.value)}
            aria-label="Explanation language"
            options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: languageLabel(l) }))}
          />
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <EntryDocument entry={e} lang={lang} />
        <div className="space-y-4">
          <aside className="card no-print" aria-labelledby="detail-meta">
            <p className="eyebrow">At a glance</p>
            <h2 id="detail-meta" className="mt-1 text-lg font-semibold">Learning state</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2"><dt className="text-muted">Status</dt><dd><StatusBadge status={e.learningStatus} /></dd></div>
              <div className="flex items-center justify-between gap-2"><dt className="text-muted">Reviews</dt><dd className="font-mono text-xs text-ink-soft">{e.srs?.reviewCount ?? 0}</dd></div>
              <div className="flex items-center justify-between gap-2"><dt className="text-muted">Lapses</dt><dd className="font-mono text-xs text-ink-soft">{e.srs?.lapses ?? 0}</dd></div>
              <div className="flex items-center justify-between gap-2"><dt className="text-muted">Source</dt><dd className="chip !text-[10px] capitalize">{e.source || 'manual'}</dd></div>
            </dl>
            <Link to={`/words/${id}/edit`} className="btn-secondary mt-4 w-full !text-xs"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Improve this entry</Link>
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={`Delete “${e.word}”?`}
        message="This permanently removes the word, its translations, review history and sentences. This cannot be undone."
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setBusy(true);
          try { await api.del(`/vocabulary/${id}`); nav('/words'); } catch (x) { setActionErr(x); setConfirm(false); } finally { setBusy(false); }
        }}
      />
    </>
  );
}
