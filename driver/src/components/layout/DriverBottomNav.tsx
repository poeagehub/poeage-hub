import React from 'react';
import { NavLink } from 'react-router-dom';
import { Package, History, Wallet, User } from 'lucide-react';

const TABS = [
  { label: 'Jobs', path: '/', icon: Package, end: true },
  { label: 'History', path: '/history', icon: History, end: false },
  { label: 'Earnings', path: '/earnings', icon: Wallet, end: false },
  { label: 'Profile', path: '/profile', icon: User, end: false },
];

export const DriverBottomNav: React.FC = () => {
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 pb-safe"
    >
      <ul className="grid grid-cols-4 h-16 max-w-xl mx-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <li key={tab.path}>
              <NavLink
                to={tab.path}
                end={tab.end}
                className={({ isActive }) =>
                  `relative h-full flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                    isActive ? 'text-amber-400' : 'text-slate-400 active:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute top-0 h-0.5 w-10 rounded-b bg-amber-400" />}
                    <Icon className={`w-[22px] h-[22px] ${isActive ? 'stroke-[2.4]' : ''}`} />
                    {tab.label}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
