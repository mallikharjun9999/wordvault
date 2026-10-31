import { Link } from 'react-router-dom';
import { ArrowUpRight, Star } from 'lucide-react';
import { StatusBadge } from './ui.jsx';
import { Reveal } from './visual.jsx';

const dueLabel = (iso, timezone) => {
  try {
    const d = new Date(iso);
    if (d <= new Date()) return 'Due now';
    return `Due ${d.toLocaleDateString(undefined, { timeZone: timezone, month: 'short', day: 'numeric' })}`;
  } catch {
    return '';
  }
};

/** The primary vocabulary card used across the library, favorites and dashboard. */
export default function WordCard({ entry, timezone, delay = 0 }) {
  const m = entry.meanings?.[0] || {};
  const due = entry.srs?.dueAt ? dueLabel(entry.srs.dueAt, timezone) : '';
  return (
    <Reveal delay={delay} className="h-full">
      <Link
        to={`/words/${entry.id}`}
        className="card card-hover group relative block h-full overflow-hidden !p-0"
      >
        <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[var(--line-strong)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="flex h-full flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 lang="en" className="display truncate text-[1.7rem] leading-tight text-ink transition-colors group-hover:text-brand">
                {entry.word}
              </h2>
              {entry.pronunciation && (
                <p className="mt-1 font-mono text-[11px] tracking-wide text-faint">/{entry.pronunciation}/</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {entry.favorite && <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-label="Favorite" />}
              <ArrowUpRight className="h-4 w-4 -translate-y-0.5 translate-x-0.5 text-faint opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-brand group-hover:opacity-100" aria-hidden="true" />
            </div>
          </div>

          <p lang="te" className="mt-4 line-clamp-2 text-[15px] font-medium leading-relaxed text-ink-soft">
            {m.teluguMeaning || <span className="muted">No Telugu meaning yet</span>}
          </p>
          <p lang="en" className="muted mt-1.5 line-clamp-2 leading-relaxed">
            {m.simpleExplanation}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <StatusBadge status={entry.learningStatus} />
            {m.partOfSpeech && <span className="chip !px-2 !py-0.5 capitalize">{m.partOfSpeech}</span>}
            {(entry.categories || []).slice(0, 1).map((c) => <span key={c} className="chip !px-2 !py-0.5">{c}</span>)}
            {due && <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{due}</span>}
          </div>
        </div>
      </Link>
    </Reveal>
  );
}
