import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';

/** Fixed, GPU-cheap ambient canvas: one quiet light source behind everything. */
export function AnimatedBackground() {
  return <div className="app-bg" aria-hidden="true" />;
}

/** Fades content in as it enters the viewport. Falls back to visible when IO is unavailable. */
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return undefined; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setShown(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${shown ? 'is-visible' : ''} ${className}`} style={{ '--reveal-delay': `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/** Counts a number up on mount without a motion library. Honors reduced motion. */
export function CountUp({ value, decimals = 0, prefix = '', suffix = '', className = '' }) {
  const target = Number(value);
  const [display, setDisplay] = useState(() => (Number.isFinite(target) ? 0 : value));
  useEffect(() => {
    if (!Number.isFinite(target)) { setDisplay(value); return undefined; }
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setDisplay(target); return undefined; }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 760);
      setDisplay(target * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, value]);
  const text = Number.isFinite(target) ? Number(display).toFixed(decimals) : String(value ?? '—');
  return <span className={className}>{prefix}{text}{suffix}</span>;
}

export function Eyebrow({ children, className = '' }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

export function StatCard({ label, value, sub, icon: Icon, decimals = 0, suffix = '', delay = 0, tone = 'brand' }) {
  const tones = {
    brand: 'text-brand',
    accent: 'text-accent',
    good: 'text-good',
    warn: 'text-warn',
  };
  return (
    <Reveal delay={delay} className="h-full">
      <div className="card card-hover flex h-full flex-col gap-3 !p-4 sm:!p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="eyebrow !text-muted">{label}</p>
          {Icon && <span className={tones[tone]}><Icon className="h-4 w-4" aria-hidden="true" /></span>}
        </div>
        <p className="stat-value">
          {typeof value === 'number' ? <CountUp value={value} decimals={decimals} suffix={suffix} /> : value}
        </p>
        {sub && <p className="mt-auto text-xs leading-relaxed text-faint">{sub}</p>}
      </div>
    </Reveal>
  );
}

export function ProgressBar({ value, max = 100, label, right, className = '' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={className}>
      {(label || right) && (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          {label && <span className="text-xs font-medium text-muted">{label}</span>}
          {right && <span className="font-mono text-[11px] tabular-nums text-ink-soft">{right}</span>}
        </div>
      )}
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label || 'Progress'}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Animated SVG progress ring with a single restrained accent stroke. */
export function ProgressRing({ value, max = 100, size = 148, stroke = 9, label, children }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`${label || 'Progress'}: ${Math.round(pct * 100)}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--brand)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 900ms var(--ease)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Small inline sparkline used in hero cards. */
export function Sparkline({ data, className = '' }) {
  const values = (data || []).map((d) => d.count ?? d);
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const w = 100;
  const h = 28;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--brand)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

/** Floating confirmation used after an action that changes saved data. */
export function Toast({ open, onClose, children, timeout = 6000 }) {
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => onClose?.(), timeout);
    return () => clearTimeout(t);
  }, [open, onClose, timeout]);
  if (!open) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 lg:bottom-6" role="status" aria-live="polite">
      <div className="glass animate-rise pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm leading-relaxed text-ink">{children}</div>
        <button type="button" onClick={onClose} className="-m-1 rounded-lg p-1 text-faint transition-colors hover:text-ink" aria-label="Dismiss notification">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
