import { useEffect, useId, useRef } from 'react';
import { AlertCircle, CheckCircle2, Inbox, Loader2, RotateCw } from 'lucide-react';
import { STATUS_LABEL } from '../utils/languages.js';

export const Spinner = ({ label = 'Loading…' }) => (
  <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-4 py-16">
    <span className="relative grid h-11 w-11 place-items-center">
      <span className="absolute inset-0 rounded-full border border-line" />
      <Loader2 className="h-5 w-5 animate-spin text-brand motion-reduce:animate-none" aria-hidden="true" />
    </span>
    <span className="eyebrow !text-muted">{label}</span>
  </div>
);

export const ErrorBanner = ({ error, onRetry, className = '' }) => !error ? null : (
  <div
    role="alert"
    className={`animate-rise flex items-start gap-3 rounded-2xl border p-3.5 text-sm ${className}`}
    style={{ borderColor: 'color-mix(in oklab, #ef4444 38%, var(--line))', background: 'color-mix(in oklab, #ef4444 8%, var(--surface-hi))', color: 'var(--ink)' }}
  >
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <p>{error.message || String(error)}</p>
      {Array.isArray(error.details) && error.details.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs opacity-80">
          {error.details.slice(0, 5).map((d, i) => <li key={i}>{d.path ? `${d.path}: ` : ''}{d.message}</li>)}
        </ul>
      )}
    </div>
    {onRetry && (
      <button type="button" className="btn-secondary !min-h-8 shrink-0 !rounded-lg !px-2.5 !py-1 !text-xs" onClick={onRetry}>
        <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />Retry
      </button>
    )}
  </div>
);

export const Notice = ({ children, tone = 'success' }) => children ? (
  <div
    role="status"
    className="animate-rise flex items-start gap-2.5 rounded-2xl border p-3.5 text-sm"
    style={tone === 'success'
      ? { borderColor: 'color-mix(in oklab, var(--good) 32%, var(--line))', background: 'color-mix(in oklab, var(--good) 8%, var(--surface-hi))' }
      : { borderColor: 'color-mix(in oklab, var(--warn) 36%, var(--line))', background: 'color-mix(in oklab, var(--warn) 9%, var(--surface-hi))' }}
  >
    <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'success' ? 'text-good' : 'text-warn'}`} aria-hidden="true" />
    <div className="min-w-0 flex-1">{children}</div>
  </div>
) : null;

export const EmptyState = ({ title, children, action }) => (
  <div className="card animate-rise flex flex-col items-center !border-dashed px-6 py-12 text-center">
    <span className="icon-tile mb-4 !h-12 !w-12 !rounded-2xl">
      <Inbox className="h-5 w-5" aria-hidden="true" />
    </span>
    <h2 className="text-base font-semibold text-ink">{title}</h2>
    {children && <p className="muted mt-1.5 max-w-md leading-relaxed">{children}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export function Field({ label, error, hint, children, id }) {
  const auto = useId(); const fid = id || auto;
  return (
    <div>
      <label htmlFor={fid} className="label">{label}</label>
      {children({ id: fid, 'aria-describedby': hint ? `${fid}-hint` : undefined, 'aria-invalid': !!error })}
      {hint && <p id={`${fid}-hint`} className="mt-1.5 text-[11px] leading-relaxed text-faint">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-sm text-bad">{error}</p>}
    </div>
  );
}

const STATUS_STYLE = {
  documented: { dot: 'var(--faint)' },
  recognized: { dot: 'var(--brand)' },
  active: { dot: 'var(--warn)' },
  mastered: { dot: 'var(--good)' },
};

export const StatusBadge = ({ status }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.documented;
  return (
    <span className="chip">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} aria-hidden="true" />
      {STATUS_LABEL[status] || status}
    </span>
  );
};

/** Accessible modal built on the native <dialog> element (focus trap, Esc to close, inert background). */
export function Dialog({ open, onClose, title, children, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) (d.showModal ? d.showModal() : d.setAttribute('open', ''));
    if (!open && d.open) (d.close ? d.close() : d.removeAttribute('open'));
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby={titleId}
      className={`m-auto max-h-[88vh] w-[calc(100%-1.5rem)] overflow-y-auto ${wide ? 'max-w-3xl' : 'max-w-md'}`}
      style={{ background: 'var(--surface-solid)', color: 'var(--ink)', borderColor: 'var(--line-strong)' }}
    >
      {open && (
        <>
          <div className="mb-4 flex items-start gap-3">
            <span className="mt-1 h-8 w-1 rounded-full bg-brand" aria-hidden="true" />
            <h2 id={titleId} className="pt-0.5 text-lg font-semibold tracking-tight text-ink">{title}</h2>
          </div>
          <div>{children}</div>
        </>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, busy }) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <p className="muted leading-relaxed">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </Dialog>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <button type="button" className="btn-secondary !min-h-9 !px-3 !text-xs" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</button>
      <span className="eyebrow !text-muted">Page {meta.page} / {meta.pages} · {meta.total} words</span>
      <button type="button" className="btn-secondary !min-h-9 !px-3 !text-xs" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next</button>
    </nav>
  );
}

export const PageHeader = ({ title, children, sub, eyebrow }) => (
  <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <h1 className="h1">{title}</h1>
      {sub && <p className="muted mt-2 max-w-2xl leading-relaxed">{sub}</p>}
    </div>
    {children && <div className="no-print flex flex-wrap gap-2">{children}</div>}
  </header>
);

/** Quiet loading placeholders for cards and lists. */
export const LoadingSkeleton = ({ rows = 3, className = '', label = 'Loading…' }) => (
  <div className={className}>
    <p role="status" className="sr-only">{label}</p>
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card space-y-3">
          <div className="skeleton h-5 w-1/3" />
          <div className="skeleton h-3 w-2/3" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ))}
    </div>
  </div>
);

/** Page-shaped placeholder so full-page loads keep the final layout steady. */
export const PageSkeleton = ({ label = 'Loading…' }) => (
  <div role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{label}</span>
    <div className="space-y-5" aria-hidden="true">
      <div className="space-y-2.5">
        <div className="skeleton h-2.5 w-24" />
        <div className="skeleton h-9 w-2/3 max-w-md" />
        <div className="skeleton h-3 w-1/2 max-w-sm" />
      </div>
      <div className="skeleton h-56 w-full rounded-[1.75rem]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-24 rounded-[1.35rem]" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-44 rounded-[1.35rem]" />
        <div className="skeleton h-44 rounded-[1.35rem]" />
      </div>
    </div>
  </div>
);
