import React from 'react';
import { Wrench } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

/** Replaces the storefront with a friendly notice while admins have maintenance mode switched on. */
export const MaintenanceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSettings();

  if (!settings.maintenanceMode) return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
          <Wrench className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">{settings.platformName} is under maintenance</h1>
        <p className="text-sm text-slate-400 leading-relaxed">{settings.maintenanceMessage}</p>
        {(settings.supportEmail || settings.supportPhone) && (
          <p className="text-xs text-slate-500">
            Need help? {settings.supportEmail}
            {settings.supportEmail && settings.supportPhone ? ' · ' : ''}
            {settings.supportPhone}
          </p>
        )}
      </div>
    </div>
  );
};
