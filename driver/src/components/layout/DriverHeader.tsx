import React from 'react';
import { useDriverAuth } from '../../context/AuthContext';
import { Truck, Power, LogOut } from 'lucide-react';

export const DriverHeader: React.FC = () => {
  const { driver, isOnline, toggleAvailability, signOutDriver } = useDriverAuth();

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-white pt-[env(safe-area-inset-top,0px)]">
      <div className="h-14 px-4 flex items-center justify-between gap-3 max-w-xl mx-auto">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow flex-shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-extrabold text-white tracking-tight leading-none truncate">POEAGE DRIVER</h1>
            <p className="text-[10px] text-slate-400 font-mono mt-1 leading-none truncate">
              {driver?.vehicleNumber || driver?.displayName || 'FLEET'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={toggleAvailability}
            aria-pressed={isOnline}
            className={`flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-full text-xs font-extrabold transition-colors ${
              isOnline
                ? 'bg-green-500 text-slate-950 active:bg-green-400'
                : 'bg-slate-800 text-slate-300 border border-slate-700 active:bg-slate-700'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </button>
          <button
            onClick={signOutDriver}
            aria-label="Sign out"
            className="w-9 h-9 flex items-center justify-center text-slate-400 active:text-red-400 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
