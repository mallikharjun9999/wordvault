import { Link } from 'react-router-dom';
import {
  BarChart3, BookOpen, CalendarCheck, Flame, Target, TrendingUp, Trophy,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { ErrorBanner, PageHeader, PageSkeleton, StatusBadge } from '../components/ui.jsx';
import BarChart from '../components/BarChart.jsx';
import { CountUp, ProgressBar, ProgressRing, Reveal, StatCard } from '../components/visual.jsx';
import { fmtDateTime } from '../utils/languages.js';

const STATUS_ORDER = ['documented', 'recognized', 'active', 'mastered'];
const FALLBACK_DEFINITION = {
  documented: 'Saved with its meaning. Not recalled in review yet.',
  recognized: 'You have recognised this word in review at least once.',
  active: 'You use this word correctly in your own sentences.',
  mastered: 'Recalled easily, again and again.',
};

const ACTIVITY_TONE = {
  word_added: 'var(--brand)',
  review: 'var(--accent)',
  quiz: 'var(--warn)',
};

export default function Progress() {
  const { data: s, loading, error, reload } = useAsync(async () => (await api.get('/progress')).data, []);
  if (loading) return <PageSkeleton label="Loading your progress…" />;
  if (error) return <ErrorBanner error={error} onRetry={reload} />;

  const total = s.totalWords || 0;
  const statusTotal = STATUS_ORDER.reduce((n, k) => n + (s.statusCounts?.[k] || 0), 0);
  const activeRate = statusTotal ? Math.round(((s.activeUse || 0) / statusTotal) * 100) : 0;
  const hasWords = total > 0;

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Learning progress"
        sub={`Every number here is calculated from your saved records. Days follow your timezone (${s.timezone}).`}
      >
        {hasWords && <Link to="/review" className="btn-primary">Review due words</Link>}
      </PageHeader>

      {/* Hero */}
      <Reveal>
        <section className="panel sm:!p-7" aria-labelledby="p-hero">
          <div className="relative grid items-center gap-7 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="eyebrow">Where you are</p>
              <h2 id="p-hero" className="display mt-3 text-3xl leading-[1.08] text-ink sm:text-4xl">
                {hasWords ? 'The habit is becoming visible.' : 'Your first page is still blank.'}
              </h2>
              <p className="muted mt-3 max-w-xl leading-relaxed">
                {hasWords
                  ? `${s.reviewsCompleted} review${s.reviewsCompleted === 1 ? '' : 's'} completed and ${activeRate}% of your words in active use or mastered.`
                  : 'Add a word and this page will start filling in with real activity — no invented numbers, ever.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="chip"><Flame className="h-3 w-3 text-warn" aria-hidden="true" />{s.streak.current}-day streak</span>
                <span className="chip">Best {s.streak.longest} days</span>
                <span className="chip">{s.dueNow} due now</span>
              </div>
            </div>
            <ProgressRing value={activeRate} max={100} size={150} stroke={10} label="Words in active use">
              <div>
                <p className="stat-value !text-3xl"><CountUp value={activeRate} suffix="%" /></p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">active use</p>
              </div>
            </ProgressRing>
          </div>
        </section>
      </Reveal>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Saved words" value={total} icon={BookOpen} delay={0} />
        <StatCard label="Reviews done" value={s.reviewsCompleted} icon={CalendarCheck} tone="accent" delay={40} />
        <StatCard
          label="Quiz accuracy"
          value={s.quiz.accuracy == null ? '—' : `${s.quiz.accuracy}%`}
          sub={`${s.quiz.correct}/${s.quiz.questionsAnswered} over ${s.quiz.attempts} quiz${s.quiz.attempts === 1 ? '' : 'zes'}`}
          icon={Target}
          delay={80}
        />
        <StatCard label="Learning streak" value={s.streak.current} suffix="d" sub={`Longest ${s.streak.longest}d`} icon={Flame} tone="warn" delay={120} />
      </div>

      <Reveal className="mt-5">
        <section className="card" aria-labelledby="p-status">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow">The shape of your library</p>
              <h2 id="p-status" className="mt-1 text-lg font-semibold">Where your words stand</h2>
            </div>
            <span className="chip">{total} word{total === 1 ? '' : 's'}</span>
          </div>

          {statusTotal === 0 ? (
            <p className="muted mt-4 leading-relaxed">No entries to chart yet. Each word moves through these stages as you review and use it.</p>
          ) : (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {STATUS_ORDER.map((k) => {
                const n = s.statusCounts?.[k] || 0;
                return (
                  <li key={k} className="rounded-2xl border border-line bg-[var(--surface)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={k} />
                      <span className="stat-value !text-xl"><CountUp value={n} /></span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-muted">
                      {s.definitions?.[k] || FALLBACK_DEFINITION[k]}
                    </p>
                    <ProgressBar className="mt-3" value={n} max={Math.max(1, statusTotal)} right={`${Math.round((n / Math.max(1, statusTotal)) * 100)}%`} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </Reveal>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Reveal className="min-w-0">
          <section className="card h-full" aria-labelledby="p-words">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <p className="eyebrow">Last 30 days</p>
                <h2 id="p-words" className="mt-1 text-lg font-semibold">Words added</h2>
              </div>
              <BarChart3 className="h-4 w-4 text-brand" aria-hidden="true" />
            </div>
            <BarChart data={s.wordsOverTime} label="Words added" color="var(--brand-2)" />
          </section>
        </Reveal>

        <Reveal delay={70} className="min-w-0">
          <section className="card h-full" aria-labelledby="p-reviews">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <p className="eyebrow">Last 30 days</p>
                <h2 id="p-reviews" className="mt-1 text-lg font-semibold">Reviews completed</h2>
              </div>
              <TrendingUp className="h-4 w-4 text-accent" aria-hidden="true" />
            </div>
            <BarChart data={s.reviewsOverTime} label="Reviews" />
          </section>
        </Reveal>

        <Reveal className="min-w-0">
          <section className="card h-full" aria-labelledby="p-difficult">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="p-difficult" className="text-lg font-semibold">Difficult words</h2>
              <Link to="/difficult" className="text-xs font-semibold text-brand hover:underline">See all</Link>
            </div>
            {s.difficultWords?.length ? (
              <ul className="divide-y divide-[var(--line)]">
                {s.difficultWords.map((w) => (
                  <li key={w.id}>
                    <Link to={`/words/${w.id}`} className="group flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p lang="en" className="truncate font-semibold text-ink transition-colors group-hover:text-brand">{w.word}</p>
                        {w.meanings?.[0]?.teluguMeaning && <p lang="te" className="truncate text-xs text-ink-soft">{w.meanings[0].teluguMeaning}</p>}
                      </div>
                      <span className="shrink-0 text-right font-mono text-[10px] uppercase leading-relaxed tracking-wider text-faint">
                        {w.srs.lapses} lapse{w.srs.lapses === 1 ? '' : 's'}<br />ease {w.srs.easeFactor}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted py-3 leading-relaxed">No difficult words. Words you forget repeatedly in review will collect here.</p>
            )}
          </section>
        </Reveal>

        <Reveal delay={70} className="min-w-0">
          <section className="card h-full" aria-labelledby="p-feed">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="p-feed" className="text-lg font-semibold">Recent activity</h2>
              <Trophy className="h-4 w-4 text-warn" aria-hidden="true" />
            </div>
            {s.recentActivity?.length ? (
              <ul className="space-y-1">
                {s.recentActivity.map((a, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl px-1 py-2">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: ACTIVITY_TONE[a.type] || 'var(--brand)' }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="eyebrow !inline !text-[0.58rem]">{a.type.replace('_', ' ')}</span>{' '}
                      <span lang="en" className="font-medium text-ink">{a.label}</span>
                      {a.detail && <span className="text-faint"> · {a.detail}</span>}
                    </span>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-faint">{fmtDateTime(a.at, s.timezone)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted py-3">Nothing recorded yet.</p>
            )}
          </section>
        </Reveal>
      </div>
    </>
  );
}
