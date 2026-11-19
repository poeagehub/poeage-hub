/**
 * Publish firestore.rules to the LIVE project without the Firebase CLI.
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="D:\path\to\serviceAccountKey.json"
 *   npx tsx scripts/deploy-rules.ts
 */
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

async function main() {
  if (!process.env['GOOGLE_APPLICATION_CREDENTIALS']) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account key path first.');
  }
  const app = initializeApp({ credential: applicationDefault(), projectId: 'poeage-hub-11' });
  const source = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const rules = getSecurityRules(app);
  const ruleset = await rules.releaseFirestoreRulesetFromSource(source);
  console.log('Published Firestore ruleset:', ruleset.name ?? '(ok)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
