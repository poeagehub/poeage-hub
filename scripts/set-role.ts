/**
 * Give an existing Firebase Auth user a role in the LIVE project.
 *
 * Usage (from repo root):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="D:\path\to\serviceAccountKey.json"
 *   npx tsx scripts/set-role.ts <email> <admin|vendor|driver|customer> ["Display Name"]
 *
 * It sets the `roles` custom claim and creates/updates users/<uid> in Firestore.
 * The user must already exist under Authentication -> Users.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const [email, role, displayName] = process.argv.slice(2);
const ROLES = ['admin', 'vendor', 'driver', 'customer'];

if (!email || !role || !ROLES.includes(role)) {
  console.error('Usage: npx tsx scripts/set-role.ts <email> <admin|vendor|driver|customer> ["Display Name"]');
  process.exit(1);
}
if (!process.env['GOOGLE_APPLICATION_CREDENTIALS']) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account key JSON path first.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: 'poeage-hub-11' });

async function main() {
  const user = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid, { roles: [role] });
  await getFirestore()
    .collection('users')
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        email: user.email,
        displayName: displayName ?? user.displayName ?? email.split('@')[0],
        roles: [role],
        status: 'active',
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  console.log(`Done: ${email} (uid ${user.uid}) is now "${role}". Sign out and back in to refresh the token.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
