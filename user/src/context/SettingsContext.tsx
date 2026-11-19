import { createStableContext } from '@poeage/ui';
import React, { useContext, useEffect, useState } from 'react';
import {
  DEFAULT_PLATFORM_SETTINGS,
  subscribePlatformSettings,
  type PlatformSettingsData,
} from '@poeage/firebase-client';

interface SettingsContextType {
  settings: PlatformSettingsData;
  /** True once the first value (or an error) has come back from Firestore. */
  ready: boolean;
}

const SettingsContext = createStableContext<SettingsContextType>('ShopSettings', {
  settings: DEFAULT_PLATFORM_SETTINGS,
  ready: false,
});

/** Live platform settings managed by admins (delivery fee, support contact, maintenance flag...). */
export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<PlatformSettingsData>(DEFAULT_PLATFORM_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribePlatformSettings(
      (s) => {
        setSettings(s);
        setReady(true);
      },
      (err) => {
        console.error('[Settings] Falling back to defaults:', err);
        setReady(true);
      },
    );
    return () => unsubscribe();
  }, []);

  return <SettingsContext.Provider value={{ settings, ready }}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);
