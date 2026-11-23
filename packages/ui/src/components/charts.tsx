import React, { useId, useState } from 'react';
import { cn } from '../utils';

/* Dependency-free SVG charts. Colours follow the app's `primary` palette. */

export interface SeriesPoint {
  label: string;
  value: number;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Area/line chart with hover read-out. */
export const AreaChart: React.FC<{
  data: SeriesPoint[];
  height?: number;
  format?: (n: number) => string;
  className?: string;
}> = ({ data, height = 220, format = (n) => String(n), className }) => {
  const id = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const pad = { l: 8, r: 8, t: 14, b: 26 };
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const x = (i: number) => pad.l + (data.length <= 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (data.length - 1));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const pts: [number, number][] = data.map((d, i) => [x(i), y(d.value)]);

  // Smooth monotone-ish path.
  let line = '';
  pts.forEach(([px, py], i) => {
    const prev = pts[i - 1];
    if (i === 0 || !prev) line = `M${px},${py}`;
    else {
      const [qx, qy] = prev;
      const cx = (qx + px) / 2;
      line += ` C${cx},${qy} ${cx},${py} ${px},${py}`;
    }
  });
  const first = pts[0];
  const last = pts[pts.length - 1];
  const area = first && last ? `${line} L${last[0]},${H - pad.b} L${first[0]},${H - pad.b} Z` : '';
  const ticks = [0, 0.5, 1].map((t) => ({ v: max * t, y: y(max * t) }));
  const every = Math.max(1, Math.ceil(data.length / 7));

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--chart, 99 102 241))" stopOpacity="0.28" />
            <stop offset="100%" stopColor="rgb(var(--chart, 99 102 241))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <line key={t.v} x1={pad.l} x2={W - pad.r} y1={t.y} y2={t.y} stroke="#e2e8f0" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        ))}
        {area && <path d={area} fill={`url(#g${id})`} />}
        {line && <path d={line} fill="none" stroke="rgb(var(--chart, 99 102 241))" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        {data.map((d, i) =>
          (i % every === 0 && data.length - 1 - i >= every) || i === data.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="fill-slate-400" fontSize="11">
              {d.label}
            </text>
          ) : null,
        )}
        {data.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (W / data.length) / 2}
            y={0}
            width={W / data.length}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onTouchStart={() => setHover(i)}
          />
        ))}
        {hover !== null && pts[hover] && (
          <g pointerEvents="none">
            <line x1={pts[hover]![0]} x2={pts[hover]![0]} y1={pad.t} y2={H - pad.b} stroke="#94a3b8" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <circle cx={pts[hover]![0]} cy={pts[hover]![1]} r="5" fill="white" stroke="rgb(var(--chart, 99 102 241))" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>
      {hover !== null && data[hover] && pts[hover] && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none rounded-lg bg-slate-900 text-white text-xs px-2.5 py-1.5 shadow-lg whitespace-nowrap"
          style={{ left: `${Math.min(88, Math.max(12, (pts[hover]![0] / W) * 100))}%`, top: Math.max(30, (pts[hover]![1] / H) * height - 8) }}
        >
          <div className="text-slate-400 text-[10px]">{data[hover].label}</div>
          <div className="font-bold">{format(data[hover].value)}</div>
        </div>
      )}
    </div>
  );
};

/** Horizontal bar list – ideal for "top products" / breakdowns. */
export const BarList: React.FC<{
  items: { label: string; value: number; sub?: string; color?: string }[];
  format?: (n: number) => string;
  className?: string;
}> = ({ items, format = (n) => String(n), className }) => {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className={cn('space-y-3.5', className)}>
      {items.map((it) => (
        <li key={it.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold text-slate-800 truncate">{it.label}</span>
            <span className="font-bold text-slate-900 tabular-nums shrink-0">{format(it.value)}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={cn('h-full rounded-full', it.color ?? 'bg-primary-500')} style={{ width: `${Math.max(3, (it.value / max) * 100)}%` }} />
          </div>
          {it.sub && <p className="mt-1 text-[11px] text-slate-400">{it.sub}</p>}
        </li>
      ))}
    </ul>
  );
};

/** Donut with centre label and legend. */
export const Donut: React.FC<{
  slices: { label: string; value: number; color: string }[];
  centre?: { value: string; label: string };
  size?: number;
}> = ({ slices, centre, size = 150 }) => {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="16" />
          {total > 0 &&
            slices.map((s) => {
              const len = (s.value / total) * c;
              const el = (
                <circle key={s.label} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-offset} strokeLinecap="butt" />
              );
              offset += len;
              return el;
            })}
        </svg>
        {centre && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-extrabold text-slate-900 leading-none">{centre.value}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-1">{centre.label}</span>
          </div>
        )}
      </div>
      <ul className="w-full space-y-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-slate-600 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="font-bold text-slate-900 tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
