import React from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Power, Truck, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ Buttons */
type Tone = 'amber' | 'green' | 'blue' | 'violet' | 'ghost' | 'outline' | 'danger';
const TONE: Record<Tone, string> = {
  amber: 'bg-gradient-to-b from-accent-400 to-accent-600 text-white shadow-[0_8px_24px_-8px_rgba(127,107,255,.55)] hover:from-accent-300 hover:to-accent-500',
  green: 'bg-gradient-to-b from-emerald-300 to-emerald-500 text-slate-950 shadow-[0_8px_24px_-8px_rgba(16,185,129,.6)] hover:from-emerald-200 hover:to-emerald-400',
  blue: 'bg-gradient-to-b from-sky-400 to-blue-600 text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,.7)] hover:from-sky-300 hover:to-blue-500',
  violet: 'bg-gradient-to-b from-violet-400 to-violet-600 text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,.7)] hover:from-violet-300 hover:to-violet-500',
  ghost: 'bg-transparent text-slate-300 hover:bg-white/5 hover:text-white',
  outline: 'bg-white/5 text-slate-100 border border-white/15 hover:bg-white/10',
  danger: 'bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25',
};

export const ActionButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; loading?: boolean; size?: 'md' | 'lg' | 'sm' }
> = ({ tone = 'amber', loading, size = 'md', className, children, disabled, ...rest }) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={cx(
      'inline-flex items-center justify-center gap-2 font-extrabold rounded-2xl transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 select-none',
      size === 'lg' ? 'h-14 px-6 text-base' : size === 'sm' ? 'h-9 px-3.5 text-xs rounded-xl' : 'h-12 px-5 text-sm',
      TONE[tone],
      className,
    )}
  >
    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
  </button>
);

/* -------------------------------------------------------------------- Field */
export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({ label, hint, children, className }) => (
  <label className={cx('block', className)}>
    <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-slate-500 mt-1.5">{hint}</span>}
  </label>
);

/* ------------------------------------------------------------------- Notices */
export const Notice: React.FC<{ tone: 'error' | 'success' | 'warn'; children: React.ReactNode; className?: string }> = ({ tone, children, className }) => {
  const m = {
    error: 'bg-red-500/10 border-red-500/30 text-red-200',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
    warn: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
  }[tone];
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-[13px] leading-snug', m, className)}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
};

/* ------------------------------------------------------- Availability switch */
export const AvailabilitySwitch: React.FC<{ online: boolean; onToggle: () => void; compact?: boolean }> = ({ online, onToggle, compact }) => (
  <button
    onClick={onToggle}
    role="switch"
    aria-checked={online}
    aria-label={online ? 'You are online. Tap to go offline' : 'You are offline. Tap to go online'}
    className={cx(
      'group inline-flex items-center gap-2.5 rounded-full border transition select-none',
      compact ? 'h-10 pl-1.5 pr-3.5 max-[339px]:pr-1.5' : 'h-12 pl-1.5 pr-4',
      online ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' : 'bg-white/5 border-white/15 text-slate-300',
    )}
  >
    <span className={cx('relative rounded-full flex items-center justify-center transition', compact ? 'w-7 h-7' : 'w-9 h-9', online ? 'bg-emerald-400 text-slate-950' : 'bg-slate-700 text-slate-300')}>
      <Power className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      {online && <span className="absolute inset-0 rounded-full bg-emerald-400/60 animate-radar" />}
    </span>
    <span className={cx('text-xs font-black tracking-wide', compact && 'max-[339px]:hidden')}>{online ? 'ONLINE' : 'OFFLINE'}</span>
  </button>
);

/* ------------------------------------------------------------------- Avatar */
export const Avatar: React.FC<{ name?: string; size?: number; className?: string }> = ({ name, size = 40, className }) => (
  <span
    style={{ width: size, height: size, fontSize: size * 0.42 }}
    className={cx('shrink-0 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white font-black flex items-center justify-center shadow-lg shadow-accent-500/20', className)}
  >
    {(name?.trim()?.[0] ?? 'D').toUpperCase()}
  </span>
);

/* -------------------------------------------------------------- Stat tile */
export const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: 'amber' | 'green' | 'sky' | 'violet' }> = ({ icon, label, value, sub, tone = 'amber' }) => {
  const t = { amber: 'text-accent-300 bg-accent-400/10', green: 'text-emerald-300 bg-emerald-400/10', sky: 'text-sky-300 bg-sky-400/10', violet: 'text-violet-300 bg-violet-400/10' }[tone];
  return (
    <div className="d-card p-3.5 sm:p-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{label}</span>
        <span className={cx('w-8 h-8 rounded-xl hidden min-[360px]:flex items-center justify-center shrink-0', t)}>{icon}</span>
      </div>
      <p className="mt-2.5 text-[clamp(1.25rem,6.4vw,1.65rem)] leading-none font-black tracking-tight text-white tabular-nums truncate">{value}</p>
      {sub && <p className="mt-1.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
};

/* ------------------------------------------------------------- Page heading */
export const PageTitle: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode }> = ({ title, subtitle, right }) => (
  <div className="flex items-end justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-[clamp(1.35rem,6vw,1.9rem)] sm:text-3xl font-black tracking-tight text-white">{title}</h1>
      {subtitle && <p className="text-[13px] sm:text-sm text-slate-400 mt-1 leading-snug">{subtitle}</p>}
    </div>
    {right}
  </div>
);

/* ------------------------------------------------------------ Radar empty */
export const RadarEmpty: React.FC<{ active: boolean; title: string; text: string; action?: React.ReactNode }> = ({ active, title, text, action }) => (
  <div className="d-card px-6 py-12 text-center overflow-hidden">
    <div className="relative w-24 h-24 mx-auto">
      {active && (
        <>
          <span className="absolute inset-0 rounded-full border border-accent-400/40 animate-radar" />
          <span className="absolute inset-0 rounded-full border border-accent-400/30 animate-radar [animation-delay:1.3s]" />
        </>
      )}
      <span className="absolute inset-3 rounded-full bg-gradient-to-br from-accent-400/20 to-accent-500/5 border border-accent-400/30 flex items-center justify-center text-accent-300">
        <Truck className="w-9 h-9 animate-[floaty_3s_ease-in-out_infinite]" />
      </span>
    </div>
    <h3 className="mt-6 text-lg font-extrabold text-white">{title}</h3>
    <p className="mt-1.5 text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">{text}</p>
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

/* ---------------------------------------------------------------- Auth shell */
export const AuthShell: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide }) => (
  <div className="min-h-screen d-bg lg:grid lg:grid-cols-[1.05fr_1fr]">
    <aside className="hidden lg:flex flex-col justify-between p-12 xl:p-16 relative overflow-hidden border-r border-white/5">
      <div className="absolute -top-24 -left-24 w-[28rem] h-[28rem] rounded-full bg-accent-400/15 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[26rem] h-[26rem] rounded-full bg-indigo-500/15 blur-3xl" />
      <Link to="/login" className="relative flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white flex items-center justify-center shadow-lg shadow-accent-500/30"><Truck className="w-6 h-6" /></span>
        <span className="text-lg font-black tracking-tight text-white">POEAGE <span className="text-accent-300">DRIVER</span></span>
      </Link>
      <div className="relative max-w-md">
        <h2 className="text-5xl font-black tracking-tight leading-[1.05] text-white">
          Deliver.<br />Earn.<br /><span className="bg-gradient-to-r from-accent-200 to-accent-400 bg-clip-text text-transparent">On your time.</span>
        </h2>
        <ul className="mt-8 space-y-4 text-slate-300">
          {['Go online whenever you want — no fixed shifts', 'One-tap navigation to the store and the customer', 'Every handover confirmed with a customer PIN'].map((t) => (
            <li key={t} className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-accent-300 shrink-0 mt-0.5" /><span>{t}</span></li>
          ))}
        </ul>
      </div>
      <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} POEAGE HUB · Delivery partner portal</p>
    </aside>

    <main className="flex items-center justify-center px-4 py-10 sm:px-8">
      <div className={cx('w-full', wide ? 'max-w-lg' : 'max-w-md')}>
        <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white flex items-center justify-center shadow-lg shadow-accent-500/30"><Truck className="w-6 h-6" /></span>
          <span className="text-lg font-black tracking-tight text-white">POEAGE <span className="text-accent-300">DRIVER</span></span>
        </div>
        {children}
      </div>
    </main>
  </div>
);

/* ------------------------------------------------------------ Sheet / dialog */
/** Bottom sheet on phones, centred dialog on larger screens. */
export const Sheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ open, onClose, title, subtitle, children, footer }) => {
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

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Full-screen backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-200 animate-[fadeIn_.15s_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centering wrapper with safe padding and scrollability */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4 text-center">
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full sm:max-w-md max-h-[90vh] sm:max-h-[calc(100vh-3.5rem)] my-auto flex flex-col rounded-t-[1.75rem] sm:rounded-[1.75rem] bg-[#0d1424] border border-white/10 shadow-2xl text-left overflow-hidden animate-[slideUp_.2s_ease-out]"
        >
          {/* Mobile swipe handle */}
          <div className="sm:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20 shrink-0" />

          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 sm:pt-5 shrink-0 border-b border-white/[0.06]">
            <div className="min-w-0 pr-2">
              <h2 className="text-lg font-black text-white">{title}</h2>
              {subtitle && <p className="text-[13px] text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 -mr-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-white/[0.06] flex gap-2.5 shrink-0 bg-[#0a0f1b]">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
