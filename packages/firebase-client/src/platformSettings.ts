import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import type { PlatformSettings } from '@poeage/types';
import { firebaseDb } from './config.ts';

export type PlatformSettingsData = Omit<PlatformSettings, 'id' | 'createdAt' | 'updatedAt'>;

/** Values used until an admin saves settings (and as the fallback if the document is missing). */
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsData = {
  platformName: 'POEAGE HUB',
  supportEmail: 'support@poeagehub.com',
  supportPhone: '',
  supportHours: 'Mon–Sat 9AM–8PM IST',
  deliveryChargeFlat: 5000, // ₹50
  freeDeliveryThreshold: 49900, // ₹499
  maxDeliveryRadiusKm: 50,
  defaultCommissionRate: 0.12,
  gstOnCommission: 0.18,
  driverEarningPerDelivery: 5000, // ₹50
  minPayoutAmount: 10000, // ₹100
  defaultGstRate: 0.18,
  razorpayKeyId: '',
  maintenanceMode: false,
  maintenanceMessage: 'We are performing scheduled maintenance and will be back shortly.',
};

const settingsRef = () => doc(firebaseDb, 'platformSettings', 'global');

function withDefaults(data: Record<string, unknown> | undefined): PlatformSettingsData {
  return { ...DEFAULT_PLATFORM_SETTINGS, ...(data ?? {}) } as PlatformSettingsData;
}

/** One-off read. Missing document => defaults. */
export async function getPlatformSettings(): Promise<PlatformSettingsData> {
  const snap = await getDoc(settingsRef());
  return withDefaults(snap.exists() ? snap.data() : undefined);
}

/** Live subscription so every app picks up admin changes without a reload. */
export function subscribePlatformSettings(
  callback: (settings: PlatformSettingsData, exists: boolean) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    settingsRef(),
    (snap) => callback(withDefaults(snap.exists() ? snap.data() : undefined), snap.exists()),
    onError,
  );
}
