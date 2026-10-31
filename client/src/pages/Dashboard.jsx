import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, CalendarDays, Flame, Play, Plus, Repeat, Sparkles, Target, TrendingUp, Trophy,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { EmptyState, ErrorBanner, PageHeader, PageSkeleton, StatusBadge } from '../components/ui.jsx';
import { CountUp, ProgressRing, Reveal, Sparkline, StatCard } from '../components/visual.jsx';
import BarChart from '../components/BarChart.jsx';
import { fmtDateTime } from '../utils/languages.js';

export const Stat = ({ label, value, sub }) => (
  <div className="card !p-4">
    <dt className="eyebrow !text-muted">{label}</dt>
    <dd className="stat-value mt-2">{value}</dd>
    {sub && <p className="mt-1.5 text-xs text-faint">{sub}</p>}
  </div>
);

const today = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

const ACTIVITY = {
  word_added: { label: 'Word added', icon: Plus, tone: 'var(--brand)' },
  review: { label: 'Review', icon: TrendingUp, tone: 'var(--accent)' },
  quiz: { label: 'Quiz', icon: Target, tone: 'var(--warn)' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: s, loading, error, reload } = useAsync(async () => (await api.get('/progress')).data, []);
  if (loading) return <PageSkeleton label="Loading your dashboard…" />;
  if (error) return <ErrorBanner error={error} onRetry={reload} />;

  const name = user.displayName || user.email.split('@')[0];
  const reviewedToday = s.reviewsOverTime?.length ? s.reviewsOverTime[s.reviewsOverTime.length - 1].count : 0;
  const limit = user?.preferences?.dailyReviewLimit || 30;
  const hasWords = s.totalWords > 0;

  return (
    <>
      <PageHeader
        eyebrow={today()}
        title={`Hello, ${name}`}
        sub={s.totalWords === 0 ? 'Let’s add your first word and start building a vault you’ll keep for life.' : `${s.dueNow} word${s.dueNow === 1 ? '' : 's'} due for review. A few minutes today keeps them yours.`}
      >
        <Link to="/words/new" className="btn-secondary"><Plus className="h-4 w-4" aria-hidden="true" />Add word</Link>
        <Link to="/review" className="btn-primary"><Play className="h-4 w-4" aria-hidden="true" />{s.dueNow ? `Review ${s.dueNow}` : 'Review'}</Link>
      </PageHeader>

      {/* Hero */}
      <Reveal>
        <section className="panel sm:!p-7">
          <div className="relative grid items-center gap-7 lg:grid-cols-[1.35fr_.65fr]">
            <div>
              <p className="eyebrow">A quiet place for loud ideas</p>
              <h2 className="display mt-3 text-3xl leading-[1.1] text-ink sm:text-4xl">
                Every word you keep<br className="hidden sm:block" /> becomes a little more <em className="not-italic text-brand">yours.</em>
              </h2>
              <p className="muted mt-3 max-w-lg leading-relaxed">
                {hasWords
                  ? 'Review what is due, practise in context, and watch the language settle in.'
                  : 'Capture a word, add its Telugu meaning, and WordVault will bring it back at exactly the right moment.'}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link to={hasWords ? '/review' : '/words/new'} className="btn-primary">
                  {hasWords ? <Play className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                  {hasWords ? 'Start today’s review' : 'Create your first entry'}
                </Link>
                <Link to="/words" className="btn-ghost">Browse the library<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
            </div>

            <div className="flex items-center gap-5 rounded-2xl border border-line bg-[var(--surface)] p-4 sm:p-5">
              <ProgressRing value={reviewedToday} max={limit} size={126} stroke={8} label="Today’s reviews">
                <div>
                  <p className="stat-value !text-2xl"><CountUp value={reviewedToday} /></p>
                  <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">of {limit}</p>
                </div>
              </ProgressRing>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="eyebrow !text-[0.58rem]">Streak</p>
                  <p className="mt-1 flex items-baseline gap-1.5 text-lg font-semibold text-ink">
                    <Flame className="h-4 w-4 text-warn" aria-hidden="true" />
                    {s.streak.current}<span className="text-xs font-normal text-muted">day{s.streak.current === 1 ? '' : 's'}</span>
                  </p>
                </div>
                <div className="h-px bg-[var(--line)]" />
                <div>
                  <p className="eyebrow !text-[0.58rem]">Review activity</p>
                  <Sparkline data={(s.reviewsOverTime || []).slice(-14)} className="mt-2 h-7 w-full" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {!hasWords ? (
        <div className="mt-5">
          <EmptyState
            title="Your vault is empty"
            action={<Link to="/words/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden="true" />Add your first word</Link>}
          >
            Everything on this dashboard is calculated from your own activity, so it fills in as you learn. Nothing here is a placeholder.
          </EmptyState>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { icon: BookOpen, title: 'Capture', text: 'Add a word by hand, paste a complete entry, or generate one with AI.' },
              { icon: Sparkles, title: 'Connect', text: 'Keep the English explanation and the Telugu meaning side by side.' },
              { icon: Repeat, title: 'Recall', text: 'Review at spaced intervals and use the word in your own sentences.' },
            ].map(({ icon: Icon, title: t, text }, i) => (
              <Reveal key={t} delay={i * 70}>
                <div className="card h-full">
                  <span className="icon-tile"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <h2 className="mt-3 font-semibold text-ink">{t}</h2>
                  <p className="muted mt-1 leading-relaxed">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Saved words" value={s.totalWords} icon={BookOpen} delay={0} />
            <StatCard label="Due now" value={s.dueNow} icon={CalendarDays} tone="accent" delay={40} />
            <StatCard label="Learning streak" value={s.streak.current} suffix="d" sub={`Best ${s.streak.longest}d`} icon={Flame} tone="warn" delay={80} />
            <StatCard label="Quiz accuracy" value={s.quiz.accuracy == null ? '—' : `${s.quiz.accuracy}%`} sub={`${s.quiz.questionsAnswered} answered`} icon={Target} delay={120} />
            <StatCard label="Active use" value={s.activeUse} sub="incl. mastered" icon={TrendingUp} tone="good" delay={160} />
            <StatCard label="Mastered" value={s.mastered} sub="recalled with ease" icon={Trophy} tone="good" delay={200} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
            <Reveal className="min-w-0">
              <section className="card h-full" aria-labelledby="d-activity">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="eyebrow">Last 30 days</p>
                    <h2 id="d-activity" className="mt-1 text-lg font-semibold">Your rhythm</h2>
                  </div>
                  <span className="chip">Real activity only</span>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold text-muted">Reviews completed</h3>
                    <BarChart data={s.reviewsOverTime} label="Reviews" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold text-muted">Words added</h3>
                    <BarChart data={s.wordsOverTime} label="Words added" color="var(--brand-2)" />
                  </div>
                </div>
              </section>
            </Reveal>

            <Reveal delay={80} className="min-w-0">
              <section className="card flex h-full flex-col" aria-labelledby="d-today">
                <p className="eyebrow">Today</p>
                <h2 id="d-today" className="mt-1 text-lg font-semibold">A small, finishable list</h2>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-[var(--surface)] px-3 py-2.5">
                    <span className="text-sm text-muted">Due for review</span>
                    <span className="font-mono text-sm font-semibold text-ink">{s.dueNow}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-[var(--surface)] px-3 py-2.5">
                    <span className="text-sm text-muted">Reviewed today</span>
                    <span className="font-mono text-sm font-semibold text-ink">{reviewedToday} / {limit}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-[var(--surface)] px-3 py-2.5">
                    <span className="text-sm text-muted">Daily goal</span>
                    <span className="font-mono text-sm font-semibold text-good">{Math.min(100, Math.round((reviewedToday / limit) * 100))}%</span>
                  </div>
                </div>
                <Link to="/review" className="btn-primary mt-4 w-full">
                  <Play className="h-4 w-4" aria-hidden="true" />{s.dueNow ? `Review ${s.dueNow} word${s.dueNow === 1 ? '' : 's'}` : 'Review anyway'}
                </Link>
              </section>
            </Reveal>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Reveal className="min-w-0">
              <section className="card h-full" aria-labelledby="d-recent">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 id="d-recent" className="text-lg font-semibold">Recently added</h2>
                  <Link to="/words" className="text-xs font-semibold text-brand hover:underline">All words</Link>
                </div>
                <ul className="divide-y divide-[var(--line)]">
                  {(s.recentWords || []).map((w) => (
                    <li key={w.id}>
                      <Link to={`/words/${w.id}`} className="group flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p lang="en" className="truncate font-semibold text-ink transition-colors group-hover:text-brand">{w.word}</p>
                          {w.meanings?.[0]?.teluguMeaning && <p lang="te" className="truncate text-xs text-ink-soft">{w.meanings[0].teluguMeaning}</p>}
                        </div>
                        <StatusBadge status={w.learningStatus} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>

            <Reveal delay={70} className="min-w-0">
              <section className="card h-full" aria-labelledby="d-diff">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 id="d-diff" className="text-lg font-semibold">Worth another look</h2>
                  <Link to="/difficult" className="text-xs font-semibold text-brand hover:underline">Difficult words</Link>
                </div>
                {s.difficultWords.length === 0 ? (
                  <p className="muted py-3 leading-relaxed">None yet — words you forget repeatedly will show up here.</p>
                ) : (
                  <ul className="divide-y divide-[var(--line)]">
                    {s.difficultWords.map((w) => (
                      <li key={w.id}>
                        <Link to={`/words/${w.id}`} className="group flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p lang="en" className="truncate font-semibold text-ink transition-colors group-hover:text-brand">{w.word}</p>
                            {w.meanings?.[0]?.teluguMeaning && <p lang="te" className="truncate text-xs text-ink-soft">{w.meanings[0].teluguMeaning}</p>}
                          </div>
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-faint">{w.srs.lapses} lapse{w.srs.lapses === 1 ? '' : 's'}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </Reveal>
          </div>

          {s.recentActivity?.length > 0 && (
            <Reveal className="mt-5">
              <section className="card" aria-labelledby="d-feed">
                <h2 id="d-feed" className="text-lg font-semibold">Recent activity</h2>
                <ul className="mt-3 space-y-1">
                  {s.recentActivity.map((a, i) => {
                    const meta = ACTIVITY[a.type] || ACTIVITY.review;
                    const Icon = meta.icon;
                    return (
                      <li key={i} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface)]">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line" style={{ color: meta.tone }}><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1 truncate text-sm"><span className="text-muted">{meta.label}</span> <span lang="en" className="font-medium text-ink">{a.label}</span>{a.detail && <span className="text-faint"> · {a.detail}</span>}</span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-faint">{fmtDateTime(a.at, s.timezone)}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </Reveal>
          )}
        </>
      )}
    </>
  );
}
