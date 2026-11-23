import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, X, MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../utils';

export interface PanelNavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Count bubble (e.g. pending approvals). Hidden when 0. */
  badge?: number;
  badgeTone?: 'danger' | 'warning';
  /** Match the exact path only (use for "/"). */
  end?: boolean;
  /** Show in the phone bottom bar (max 4 are used; the rest live under "More"). */
  primary?: boolean;
}

export interface PanelShellProps {
  /** e.g. { first: 'POEAGE', second: 'ADMIN' } */
  brand: { first: string; second: string };
  sectionLabel: string;
  nav: PanelNavItem[];
  /** Left side of the top bar next to the page title (store name, role pill…). */
  headerLeft?: React.ReactNode;
  /** Right side of the top bar (store switch, profile, sign out…). */
  headerRight?: React.ReactNode;
  /** Pinned at the bottom of the desktop sidebar / drawer. */
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Turns every plain <table> inside `root` into a stacked card list on phones (CSS in each app's index.css,
 * keyed on the `rt` class + `data-label`). Re-runs when the page content changes.
 */
function useResponsiveTables(root: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let raf = 0;
    const apply = () => {
      el.querySelectorAll<HTMLTableElement>('table:not([data-rt="off"])').forEach((table) => {
        const heads = Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent ?? '').trim());
        if (!heads.length) return;
        table.classList.add('rt');
        table.querySelectorAll('tbody tr').forEach((tr) => {
          Array.from(tr.children).forEach((td, i) => {
            if (!td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i] ?? '');
          });
        });
      });
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };
    apply();
    const mo = new MutationObserver(schedule);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [root]);
}

const badgeClass = (tone: PanelNavItem['badgeTone']) =>
  tone === 'warning' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white';

function NavList({ nav, onNavigate }: { nav: PanelNavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {nav.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end ?? item.path === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 pl-3 pr-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-primary-600/20 to-primary-600/5 text-white font-semibold shadow-xs ring-1 ring-white/5'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 active:scale-98',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-gradient-to-b from-primary-400 to-primary-500 shadow-sm shadow-primary-400/50" />}
                <Icon className={cn('w-[18px] h-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105', isActive ? 'text-primary-400' : '')} />
                <span className="flex-1 truncate">{item.label}</span>
                {!!item.badge && item.badge > 0 && (
                  <span
                    className={cn(
                      'min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs',
                      badgeClass(item.badgeTone),
                    )}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function Brand({ brand }: { brand: PanelShellProps['brand'] }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 via-primary-600 to-indigo-600 text-white flex items-center justify-center font-black text-base shadow-lg shadow-primary-900/40 ring-1 ring-white/10">
        P
      </div>
      <div className="leading-none">
        <span className="font-extrabold text-white text-[15px] tracking-tight">{brand.first}</span>
        <span className="text-primary-400 font-extrabold text-[15px] tracking-tight ml-1">{brand.second}</span>
      </div>
    </div>
  );
}

/**
 * One responsive layout for the admin and vendor panels.
 *  - lg and up: fixed sidebar + top bar.
 *  - phones/tablets: top bar with a menu button (slide-in drawer) and a bottom tab bar.
 */
export const PanelShell: React.FC<PanelShellProps> = ({
  brand,
  sectionLabel,
  nav,
  headerLeft,
  headerRight,
  sidebarFooter,
  children,
}) => {
  const [drawer, setDrawer] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  useResponsiveTables(mainRef);
  const { pathname } = useLocation();

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  const explicit = nav.filter((n) => n.primary);
  const tabs = (explicit.length ? explicit : nav).slice(0, 4);
  const moreBadge = nav.filter((n) => !tabs.includes(n)).reduce((s, n) => s + (n.badge ?? 0), 0);
  const moreActive = !tabs.some((t) => (t.path === '/' ? pathname === '/' : pathname.startsWith(t.path)));

  const sidebar = (
    <>
      <div className="h-16 flex items-center px-5 border-b border-white/10 shrink-0">
        <Brand brand={brand} />
      </div>
      <div className="px-6 pt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{sectionLabel}</div>
      <NavList nav={nav} onNavigate={() => setDrawer(false)} />
      {sidebarFooter && <div className="p-4 border-t border-white/10">{sidebarFooter}</div>}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-slate-950 text-slate-300 sticky top-0 h-screen self-start">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <div className={cn('lg:hidden fixed inset-0 z-50', drawer ? '' : 'pointer-events-none')} aria-hidden={!drawer}>
        <div
          onClick={() => setDrawer(false)}
          className={cn('absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200', drawer ? 'opacity-100' : 'opacity-0')}
        />
        <aside
          className={cn(
            'absolute inset-y-0 left-0 w-[17.5rem] max-w-[85vw] flex flex-col bg-slate-950 text-slate-300 shadow-2xl transition-transform duration-200 ease-out',
            drawer ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <button
            onClick={() => setDrawer(false)}
            aria-label="Close menu"
            className="absolute right-3 top-3.5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
          {sidebar}
        </aside>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-40 h-14 lg:h-16 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 px-3 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 -ml-1 rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="lg:hidden w-7 h-7 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center font-black text-sm shrink-0">P</span>
            <div className="min-w-0 flex items-center gap-2.5">{headerLeft}</div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">{headerRight}</div>
        </header>

        <main ref={mainRef} className="flex-1 pb-24 lg:pb-8">{children}</main>
      </div>

      {/* Phone bottom tab bar */}
      <nav
        aria-label="Primary"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 pb-safe"
      >
        <ul className="grid grid-cols-5">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.end ?? item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'relative flex flex-col items-center justify-center gap-0.5 h-14 text-[10.5px] font-semibold transition-colors',
                      isActive ? 'text-primary-600' : 'text-slate-500',
                    )
                  }
                >
                  <span className="relative">
                    <Icon className="w-[22px] h-[22px]" />
                    {!!item.badge && item.badge > 0 && (
                      <span className={cn('absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center', badgeClass(item.badgeTone))}>
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </span>
                  <span>{item.label.split(' ')[0]}</span>
                </NavLink>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => setDrawer(true)}
              className={cn('relative w-full flex flex-col items-center justify-center gap-0.5 h-14 text-[10.5px] font-semibold', moreActive ? 'text-primary-600' : 'text-slate-500')}
            >
              <span className="relative">
                <MoreHorizontal className="w-[22px] h-[22px]" />
                {moreBadge > 0 && <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />}
              </span>
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
};
