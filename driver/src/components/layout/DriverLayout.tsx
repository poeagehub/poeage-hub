import React from 'react';
import { NavLink } from 'react-router-dom';
import { Package, History, Wallet, User, LogOut, Truck, ShieldCheck } from 'lucide-react';
import { useDriverAuth } from '../../context/AuthContext';
import { Avatar, AvailabilitySwitch, cx } from '../ui';

const TABS = [
  { label: 'Jobs', path: '/', icon: Package, end: true },
  { label: 'History', path: '/history', icon: History, end: false },
  { label: 'Earnings', path: '/earnings', icon: Wallet, end: false },
  { label: 'Profile', path: '/profile', icon: User, end: false },
];

const firstName = (n?: string) => (n ?? '').trim().split(/\s+/)[0] || 'Partner';

export const DriverLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { driver, user, isOnline, toggleAvailability, signOutDriver } = useDriverAuth();
  const name = driver?.displayName || user?.displayName || '';

  return (
    <div className="min-h-screen d-bg text-slate-100 lg:grid lg:grid-cols-[17.5rem_1fr]">
      {/* ------------------------------ Desktop sidebar ------------------------------ */}
      <aside className="hidden lg:flex flex-col sticky top-0 h-screen p-5 border-r border-white/[0.06] bg-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-2 pt-1 pb-6">
          <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white flex items-center justify-center shadow-lg shadow-accent-500/30">
            <Truck className="w-5 h-5" />
          </span>
          <div className="leading-none">
            <p className="text-[15px] font-black tracking-tight text-white">POEAGE <span className="text-accent-300">DRIVER</span></p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mt-1.5">Partner app</p>
          </div>
        </div>

        <nav className="space-y-1">
          {TABS.map(({ label, path, icon: Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) =>
                cx(
                  'relative flex items-center gap-3 px-3.5 h-11 rounded-2xl text-sm font-bold transition',
                  isActive ? 'bg-accent-400/10 text-accent-300' : 'text-slate-400 hover:text-white hover:bg-white/5',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-accent-400" />}
                  <Icon className="w-[18px] h-[18px]" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="d-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Availability</p>
                <p className="text-sm font-bold text-white mt-0.5">{isOnline ? 'Receiving jobs' : 'Not receiving jobs'}</p>
              </div>
            </div>
            <div className="mt-3"><AvailabilitySwitch online={isOnline} onToggle={toggleAvailability} /></div>
          </div>

          <div className="flex items-center gap-3 px-1">
            <Avatar name={name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{name || 'Delivery partner'}</p>
              <p className="text-[11px] text-slate-500 font-mono truncate flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" /> {driver?.vehicleNumber || 'Verified'}
              </p>
            </div>
            <button onClick={signOutDriver} aria-label="Sign out" title="Sign out" className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col min-h-screen">
        {/* -------------------------------- Phone header -------------------------------- */}
        <header className="lg:hidden sticky top-0 z-40 bg-[#070b14]/80 backdrop-blur-xl border-b border-white/[0.06] pt-[env(safe-area-inset-top,0px)]">
          <div className="h-16 px-3 min-[380px]:px-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={name} size={40} />
              <div className="min-w-0 leading-tight max-[299px]:hidden">
                <p className="text-[11px] text-slate-500">Hello,</p>
                <p className="text-[15px] font-extrabold text-white truncate">{firstName(name)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <AvailabilitySwitch online={isOnline} onToggle={toggleAvailability} compact />
              <button onClick={signOutDriver} aria-label="Sign out" className="w-10 h-10 max-[339px]:hidden flex items-center justify-center rounded-xl text-slate-500 active:text-red-300 active:bg-red-500/10">
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:pb-10">{children}</main>

        {/* --------------------------- Phone floating tab bar --------------------------- */}
        <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pointer-events-none">
          <ul className="pointer-events-auto grid grid-cols-4 gap-0.5 min-[360px]:gap-1 p-1 min-[360px]:p-1.5 rounded-[1.75rem] bg-[#0d1424]/90 backdrop-blur-xl border border-white/10 shadow-[0_20px_40px_-12px_rgba(0,0,0,.8)] max-w-md mx-auto">
            {TABS.map(({ label, path, icon: Icon, end }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={end}
                  className={({ isActive }) =>
                    cx(
                      'h-[3.25rem] rounded-[1.35rem] flex flex-col items-center justify-center gap-0.5 text-[10px] min-[360px]:text-[10.5px] font-bold transition min-w-0',
                      isActive ? 'bg-accent-500 text-white shadow-lg shadow-accent-500/25' : 'text-slate-400 active:bg-white/5',
                    )
                  }
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
};
