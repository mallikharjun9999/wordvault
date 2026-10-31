// Dependency-free SVG bar chart. Draws only the data it is given.
export default function BarChart({ data, label, color = 'var(--brand)' }) {
  const series = Array.isArray(data) ? data : [];
  if (!series.length) return <p className="muted py-6 text-center">No activity recorded yet.</p>;

  const max = Math.max(1, ...series.map((d) => d.count));
  const total = series.reduce((s, d) => s + d.count, 0);
  const w = 320;
  const h = 92;
  const gap = 2;
  const bw = (w - gap * (series.length - 1)) / series.length;
  const first = series[0]?.date;
  const last = series[series.length - 1]?.date;

  return (
    <figure className="group/chart">
      <svg viewBox={`0 0 ${w} ${h + 8}`} className="h-28 w-full" role="img" aria-label={`${label}: ${total} in the last ${series.length} days`} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" y1={h * f} x2={w} y2={h * f} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 5" />
        ))}
        <line x1="0" y1={h} x2={w} y2={h} stroke="currentColor" strokeOpacity="0.22" />
        {series.map((d, i) => {
          const bh = d.count > 0 ? Math.max(2, (d.count / max) * (h - 4)) : 0;
          return bh > 0 ? (
            <rect
              key={d.date}
              x={i * (bw + gap)}
              y={h - bh}
              width={bw}
              height={bh}
              rx={Math.min(2.5, bw / 2)}
              fill={color}
              fillOpacity="0.82"
              className="transition-opacity duration-200 hover:opacity-100"
            >
              <title>{`${d.date}: ${d.count}`}</title>
            </rect>
          ) : null;
        })}
      </svg>
      <figcaption className="mt-1 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
        <span>{first}</span>
        <span className="text-ink-soft">{total === 0 ? 'No activity yet' : `${total} total`}</span>
        <span>{last}</span>
      </figcaption>
    </figure>
  );
}
