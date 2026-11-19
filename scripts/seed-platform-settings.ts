/**
 * Create platformSettings/global in the LIVE project if it does not exist yet (never overwrites).
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="D:\path\to\serviceAccountKey.json"
 *   npx tsx scripts/seed-platform-settings.ts
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

async function main() {
  if (!process.env['GOOGLE_APPLICATION_CREDENTIALS']) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account key path first.');
  }
  initializeApp({ credential: applicationDefault(), projectId: 'poeage-hub-11' });
  const ref = getFirestore().collection('platformSettings').doc('global');
  if ((await ref.get()).exists) {
    console.log('platformSettings/global already exists — left unchanged.');
    return;
  }
  await ref.set({
    id: 'global',
    platformName: 'POEAGE HUB',
    supportEmail: 'support@poeagehub.com',
    supportPhone: '',
    supportHours: 'Mon–Sat 9AM–8PM IST',
    deliveryChargeFlat: 5000,
    freeDeliveryThreshold: 49900,
    maxDeliveryRadiusKm: 50,
    defaultCommissionRate: 0.12,
    gstOnCommission: 0.18,
    driverEarningPerDelivery: 5000,
    defaultGstRate: 0.18,
    razorpayKeyId: '',
    maintenanceMode: false,
    maintenanceMessage: 'We are performing scheduled maintenance and will be back shortly.',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log('Created platformSettings/global with defaults.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
