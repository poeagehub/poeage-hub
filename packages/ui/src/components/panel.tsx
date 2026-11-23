import React from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { Search, X, Inbox } from 'lucide-react';
import { cn } from '../utils';

/* ---------------------------------- Page header ---------------------------------- */
export const PageHeader: React.FC<{
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, description, actions, className }) => (
  <div className={cn('flex flex-col sm:flex-row sm:items-end justify-between gap-3', className)}>
    <div className="min-w-0">
      <h1 className="text-[22px] sm:text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-2xl">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

/* ------------------------------------ Stat card ------------------------------------ */
type Tone = 'primary' | 'green' | 'amber' | 'red' | 'violet' | 'sky' | 'slate';
const TONES: Record<Tone, { chip: string; text: string }> = {
  primary: { chip: 'bg-primary-50 text-primary-600', text: 'text-primary-600' },
  green: { chip: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600' },
  amber: { chip: 'bg-amber-50 text-amber-600', text: 'text-amber-600' },
  red: { chip: 'bg-red-50 text-red-600', text: 'text-red-600' },
  violet: { chip: 'bg-violet-50 text-violet-600', text: 'text-violet-600' },
  sky: { chip: 'bg-sky-50 text-sky-600', text: 'text-sky-600' },
  slate: { chip: 'bg-slate-100 text-slate-600', text: 'text-slate-500' },
};

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  /** Percentage change, shown as a coloured chip when provided. */
  delta?: number | null | undefined;
  onClick?: () => void;
  loading?: boolean;
}> = ({ label, value, hint, icon: Icon, tone = 'primary', delta, onClick, loading }) => {
  const t = TONES[tone];
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'text-left rounded-2xl bg-white border border-slate-200/80 p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition',
        onClick && 'hover:border-primary-300 hover:shadow-md active:scale-[0.99]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {Icon && (
          <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', t.chip)}>
            <Icon className="w-[18px] h-[18px]" />
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-24 rounded-lg bg-slate-100 animate-pulse" />
      ) : (
        <p className="mt-2 text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-900 tabular-nums leading-tight">{value}</p>
      )}
      <div className="mt-1.5 flex items-center gap-2 min-h-[18px]">
        {typeof delta === 'number' && (
          <span
            className={cn(
              'text-[11px] font-bold px-1.5 py-0.5 rounded-md',
              delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
            )}
          >
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span className={cn('text-xs truncate', typeof delta === 'number' ? 'text-slate-400' : t.text)}>{hint}</span>}
      </div>
    </Comp>
  );
};

/* ----------------------------------- Section card ----------------------------------- */
export const Section: React.FC<{
  title?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
}> = ({ title, icon: Icon, actions, children, className, bodyClassName, flush }) => (
  <section className={cn('rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden', className)}>
    {(title || actions) && (
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-primary-600 shrink-0" />}
          <span className="truncate">{title}</span>
        </h2>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    )}
    <div className={cn(!flush && 'p-4 sm:p-5', bodyClassName)}>{children}</div>
  </section>
);

/* ------------------------------------ Empty state ------------------------------------ */
export const EmptyState: React.FC<{
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon: Icon = Inbox, title, description, action, className }) => (
  <div className={cn('flex flex-col items-center text-center py-12 px-6', className)}>
    <span className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
      <Icon className="w-7 h-7" />
    </span>
    <h3 className="text-base font-bold text-slate-900">{title}</h3>
    {description && <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

/* -------------------------------------- Skeleton -------------------------------------- */
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('animate-pulse rounded-lg bg-slate-200/70', className)} />
);

/* ------------------------------------ Filter pills ------------------------------------ */
export interface PillOption {
  value: string;
  label: string;
  count?: number;
}
export const Pills: React.FC<{
  options: PillOption[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}> = ({ options, value, onChange, className }) => (
  <div className={cn('flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 py-0.5', className)}>
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold border transition-all duration-200 active:scale-95',
            active
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900',
          )}
        >
          {o.label}
          {typeof o.count === 'number' && (
            <span className={cn('text-[11px] px-1.5 rounded-full', active ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>{o.count}</span>
          )}
        </button>
      );
    })}
  </div>
);

/* ------------------------------------ Search field ------------------------------------ */
export const SearchField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder = 'Search…', className }) => (
  <div className={cn('relative', className)}>
    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate-200 bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 [&::-webkit-search-cancel-button]:hidden"
    />
    {value && (
      <button onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:bg-slate-100">
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

/* ------------------------------------ Status pill ------------------------------------ */
const PILL: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/15',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/15',
};
export const StatusPill: React.FC<{
  tone?: keyof typeof PILL;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}> = ({ tone = 'slate', children, dot = true, className }) => (
  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset whitespace-nowrap', PILL[tone], className)}>
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
    {children}
  </span>
);

/** Maps an order/vendor/driver status string to a pill colour. */
export function toneForStatus(status: string): keyof typeof PILL {
  const s = status.toLowerCase();
  if (/(deliver|complete|approved|active|published|paid|settled|open|in stock|online)/.test(s)) return 'green';
  if (/(cancel|reject|suspend|fail|out of stock|blocked|refund)/.test(s)) return 'red';
  if (/(pending|review|placed|new|low|processing|packing|draft|awaiting)/.test(s)) return 'amber';
  if (/(out for|transit|picked|dispatch|assigned|ready)/.test(s)) return 'blue';
  if (/(confirm|accepted)/.test(s)) return 'violet';
  return 'slate';
}

/* ------------------------------------ Data table ------------------------------------ */
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Hidden from the phone card layout (still in the desktop table). */
  hideOnCard?: boolean;
  /** Use as the title line of the phone card. */
  primary?: boolean;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

/**
 * Real table on md+, stacked cards on phones. Each card shows the `primary` column
 * as its title and the rest as label/value rows.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  const title = (columns.find((c) => c.primary) ?? columns[0])!;
  const rest = columns.filter((c) => c !== title && !c.hideOnCard);
  const alignCls = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');
  return (
    <div className={className}>
      {/* Desktop / tablet */}
      <div className="hidden md:block overflow-x-auto">
        <table data-rt="off" className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100">
              {columns.map((c) => (
                <th key={c.key} className={cn('px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap', alignCls(c.align))}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-slate-50/80')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-5 py-3.5 align-middle', alignCls(c.align), c.className)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone cards */}
      <ul className="md:hidden divide-y divide-slate-100">
        {rows.map((r) => (
          <li
            key={rowKey(r)}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            className={cn('p-4 space-y-2.5', onRowClick && 'active:bg-slate-50')}
          >
            <div className="font-semibold text-slate-900">{title.render(r)}</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {rest.map((c) => (
                <div key={c.key} className={cn('min-w-0', c.align === 'right' && 'text-right')}>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.header}</dt>
                  <dd className="text-sm text-slate-800 mt-0.5 break-words">{c.render(r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------- Modal ---------------------------------------- */
export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}> = ({ open, onClose, title, description, children, footer, size = 'md' }) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted || typeof document === 'undefined') return null;

  const width = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-xl',
    lg: 'sm:max-w-3xl',
    xl: 'sm:max-w-5xl',
  }[size] || 'sm:max-w-xl';

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Full-screen backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 animate-[fadeIn_.15s_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centering container with safe margins on all viewports */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 text-center">
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'relative w-full bg-white shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[calc(100vh-3.5rem)] rounded-t-3xl sm:rounded-3xl my-auto text-left overflow-hidden border border-slate-200/80 animate-[slideUp_.2s_ease-out]',
            width,
          )}
        >
          {/* Mobile handle indicator */}
          <div className="sm:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-300 shrink-0" />

          {/* Dialog Header: shrink-0 so it is NEVER compressed or cut off */}
          <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 sm:pt-5 sm:px-6 shrink-0 border-b border-slate-100/80 bg-white">
            <div className="min-w-0 pr-2">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">{title}</h2>
              {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 -mr-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Dialog Body: scrollable middle with flex-1 min-h-0 */}
          <div className="px-5 py-4 sm:px-6 sm:py-5 overflow-y-auto flex-1 min-h-0">
            {children}
          </div>

          {/* Dialog Footer: shrink-0 pinned at bottom */}
          {footer && (
            <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl pb-safe flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
