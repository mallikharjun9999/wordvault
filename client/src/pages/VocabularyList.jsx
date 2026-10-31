import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { api } from '../api/client.js';
import { useAsync, useDebounced } from '../hooks/useAsync.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { EmptyState, ErrorBanner, LoadingSkeleton, PageHeader, Pagination } from '../components/ui.jsx';
import { Select } from '../components/Dropdown.jsx';
import WordCard from '../components/WordCard.jsx';
import { Reveal } from '../components/visual.jsx';

const TITLES = {
  all: { title: 'My words', eyebrow: 'The library', sub: 'Every word you have saved, with its English sense and Telugu meaning side by side.' },
  favorites: { title: 'Favorites', eyebrow: 'Kept close', sub: 'The words you starred — your personal shortlist.' },
  difficult: { title: 'Difficult words', eyebrow: 'Worth another look', sub: 'Words you have forgotten 2+ times or that keep feeling hard.' },
};

export default function VocabularyList({ mode = 'all' }) {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [showFilters, setShowFilters] = useState(false);
  const dq = useDebounced(q);
  const p = Object.fromEntries(sp.entries());
  const meta = TITLES[mode] || TITLES.all;

  const query = useMemo(() => {
    const o = new URLSearchParams();
    if (dq) o.set('q', dq);
    for (const k of ['category', 'tag', 'status']) if (p[k]) o.set(k, p[k]);
    o.set('sort', p.sort || (mode === 'difficult' ? 'due' : 'newest'));
    o.set('page', p.page || '1');
    o.set('limit', '20');
    if (mode === 'favorites') o.set('favorite', 'true'); else if (p.favorite) o.set('favorite', p.favorite);
    if (mode === 'difficult') o.set('difficult', 'true');
    return o.toString();
  }, [dq, sp, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useAsync(async () => {
    const r = await api.get(`/vocabulary?${query}`);
    return { items: r.data.items, meta: r.meta };
  }, [query]);
  const facets = useAsync(async () => (await api.get('/vocabulary/facets')).data, []);

  const setParam = (k, v) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== 'page') n.delete('page');
    setSp(n);
  };
  const activeFilters = ['category', 'tag', 'status'].filter((k) => p[k]);
  const filtered = !!(dq || activeFilters.length);
  const clearAll = () => { setQ(''); setSp(new URLSearchParams()); };

  const sel = (label, k, opts) => (
    <div className="block min-w-0">
      <Select
        className="input !py-2"
        value={p[k] || ''}
        onChange={(e) => setParam(k, e.target.value)}
        aria-label={label}
        options={[{ value: '', label }, ...opts]}
      />
    </div>
  );

  return (
    <>
      <PageHeader eyebrow={meta.eyebrow} title={meta.title} sub={meta.sub}>
        <Link to="/words/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden="true" />Add word</Link>
      </PageHeader>

      <div className="card mb-5 !p-3 sm:!p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
            <input
              type="search"
              className="input !py-2.5 !pl-10"
              placeholder="Search words, meanings, explanations…"
              aria-label="Search"
              value={q}
              onChange={(e) => { setQ(e.target.value); if (p.page) setParam('page', ''); }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`btn-secondary !min-h-10 ${activeFilters.length ? '!border-brand/50 !text-brand' : ''}`}
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
              {activeFilters.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 font-mono text-[10px] text-[var(--on-brand)]">{activeFilters.length}</span>}
            </button>
            <div className="block">
              <Select
                className="input !py-2.5"
                aria-label="Sort"
                value={p.sort || (mode === 'difficult' ? 'due' : 'newest')}
                onChange={(e) => setParam('sort', e.target.value)}
                options={[
                  { value: 'newest', label: 'Newest first' },
                  { value: 'oldest', label: 'Oldest first' },
                  { value: 'alpha', label: 'A → Z' },
                  { value: 'due', label: 'Next review' },
                ]}
              />
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="animate-rise mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-3">
            {sel('All categories', 'category', facets.data?.categories || [])}
            {sel('All tags', 'tag', facets.data?.tags || [])}
            {sel('Any status', 'status', [{ v: 'documented', l: 'Documented' }, { v: 'recognized', l: 'Recognized' }, { v: 'active', l: 'Active use' }, { v: 'mastered', l: 'Mastered' }])}
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow !text-muted">
          {list.data?.meta ? `${list.data.meta.total} word${list.data.meta.total === 1 ? '' : 's'}` : 'Gathering your words'}
          {filtered && ' · filtered'}
        </p>
        {(filtered || activeFilters.length > 0) && (
          <button type="button" className="btn-ghost !min-h-8 !px-2 !text-xs" onClick={clearAll}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />Clear filters
          </button>
        )}
      </div>

      {list.loading ? <LoadingSkeleton rows={4} label="Loading words…" /> : list.error ? <ErrorBanner error={list.error} onRetry={list.reload} /> :
        list.data.items.length === 0 ? (
          filtered ? (
            <EmptyState title="No matching words" action={<button className="btn-secondary" onClick={clearAll}>Clear filters</button>}>
              Try a different search or remove a filter.
            </EmptyState>
          ) : mode === 'favorites' ? (
            <EmptyState title="No favorites yet">Tap the star on any word to keep it here.</EmptyState>
          ) : mode === 'difficult' ? (
            <EmptyState title="No difficult words">Words you forget repeatedly in reviews will appear here. Nice work so far!</EmptyState>
          ) : (
            <EmptyState title="Your vault is empty" action={<Link to="/words/new" className="btn-primary">Add your first word</Link>}>
              Generate a full entry with AI, paste one you already have, or write one yourself.
            </EmptyState>
          )
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Words">
              {list.data.items.map((v, i) => (
                <li key={v.id} className="h-full">
                  <WordCard entry={v} timezone={user?.preferences?.timezone} delay={Math.min(i, 6) * 40} />
                </li>
              ))}
            </ul>
            <Pagination meta={list.data.meta} onPage={(n) => setParam('page', String(n))} />
          </>
        )}

      {list.data?.items?.length > 0 && (
        <Reveal className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line px-4 py-3">
            <p className="text-sm text-muted">Keep the collection growing — one word a day is enough.</p>
            <Link to="/words/new" className="btn-secondary !min-h-9 !text-xs"><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add another word</Link>
          </div>
        </Reveal>
      )}
    </>
  );
}
