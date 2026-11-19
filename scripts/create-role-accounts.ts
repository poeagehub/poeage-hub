/**
 * Create (or reset) one login per role in the LIVE Firebase project and print the credentials.
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="D:\path\to\serviceAccountKey.json"
 *   npx tsx scripts/create-role-accounts.ts
 * Re-running resets the passwords. Passwords are random and only printed to the console.
 */
import { randomBytes } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

type Role = 'admin' | 'vendor' | 'driver' | 'customer';

const ACCOUNTS: { role: Role; email: string; displayName: string }[] = [
  { role: 'admin', email: 'admin@poeagehub.com', displayName: 'Poeage Admin' },
  { role: 'vendor', email: 'vendor@poeagehub.com', displayName: 'Poeage Vendor' },
  { role: 'driver', email: 'driver@poeagehub.com', displayName: 'Poeage Driver' },
  { role: 'customer', email: 'customer@poeagehub.com', displayName: 'Poeage Customer' },
];

function makePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(14);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('') + '#7';
}

async function main() {
  if (!process.env['GOOGLE_APPLICATION_CREDENTIALS']) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account key path first.');
  }
  initializeApp({ credential: applicationDefault(), projectId: 'poeage-hub-11' });
  const auth = getAuth();
  const db = getFirestore();
  const results: { role: Role; email: string; password: string }[] = [];

  for (const acc of ACCOUNTS) {
    const password = makePassword();
    let user;
    try {
      user = await auth.getUserByEmail(acc.email);
      user = await auth.updateUser(user.uid, { password, displayName: acc.displayName, emailVerified: true });
    } catch {
      user = await auth.createUser({
        email: acc.email,
        password,
        displayName: acc.displayName,
        emailVerified: true,
      });
    }
    await auth.setCustomUserClaims(user.uid, { roles: [acc.role] });

    const stamps = { createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
    await db.collection('users').doc(user.uid).set(
      { uid: user.uid, email: acc.email, displayName: acc.displayName, roles: [acc.role], status: 'active', ...stamps },
      { merge: true },
    );

    if (acc.role === 'vendor') {
      await db.collection('vendors').doc(user.uid).set(
        {
          id: user.uid,
          userId: user.uid,
          storeName: 'Poeage Store',
          storeSlug: 'poeage-store',
          description: '',
          email: acc.email,
          phone: '',
          status: 'approved',
          commissionRate: 0.1,
          address: { line1: '', city: '', state: '', postalCode: '', country: 'IN' },
          metadata: { totalSales: 0, totalOrders: 0, totalProducts: 0, averageRating: 5, totalRatings: 0, totalEarnings: 0, pendingSettlement: 0 },
          ...stamps,
        },
        { merge: true },
      );
    }
    if (acc.role === 'driver') {
      await db.collection('drivers').doc(user.uid).set(
        {
          id: user.uid,
          userId: user.uid,
          displayName: acc.displayName,
          phone: '',
          email: acc.email,
          status: 'approved',
          vehicleType: 'motorcycle',
          vehicleNumber: '',
          licenseNumber: '',
          isOnline: false,
          metadata: { totalDeliveries: 0, totalEarnings: 0, pendingSettlement: 0, averageRating: 5, totalRatings: 0, successRate: 1 },
          ...stamps,
        },
        { merge: true },
      );
    }
    results.push({ role: acc.role, email: acc.email, password });
  }

  console.table(results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
