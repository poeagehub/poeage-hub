/**
 * Create the base product categories in the LIVE project (no products, no sample data).
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="D:\path\to\serviceAccountKey.json"
 *   npx tsx scripts/seed-categories.ts
 * Safe to re-run: existing categories are only merged, never duplicated.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const CATEGORIES = [
  { slug: 'electronics', name: 'Electronics' },
  { slug: 'fashion', name: 'Fashion' },
  { slug: 'home-kitchen', name: 'Home & Kitchen' },
  { slug: 'beauty-health', name: 'Beauty & Health' },
  { slug: 'sports-outdoors', name: 'Sports & Outdoors' },
  { slug: 'books', name: 'Books' },
];

async function main() {
  if (!process.env['GOOGLE_APPLICATION_CREDENTIALS']) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account key path first.');
  }
  initializeApp({ credential: applicationDefault(), projectId: 'poeage-hub-11' });
  const db = getFirestore();
  for (const [i, c] of CATEGORIES.entries()) {
    await db.collection('categories').doc(c.slug).set(
      {
        id: c.slug,
        name: c.name,
        slug: c.slug,
        order: i,
        isActive: true,
        productCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log('category:', c.slug);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
