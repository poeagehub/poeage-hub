/**
 * SEO file generator for the storefront: robots.txt and the XML sitemaps.
 *
 *   /robots.txt              -> buildRobots()
 *   /sitemap.xml                 -> sitemap INDEX  (lists the 6 child sitemaps below)
 *   /sitemap-pages.xml           -> core pages (home, all products, offers, stores)
 *   /sitemap-info.xml            -> help & policy pages (about, support, shipping, returns, terms, privacy)
 *   /sitemap-categories.xml      -> one URL per active category
 *   /sitemap-products.xml        -> one URL per PUBLISHED product, with its images (Google image sitemap)
 *   /sitemap-stores.xml          -> one profile page per APPROVED store
 *   /sitemap-store-products.xml  -> one "all products of this store" listing per APPROVED store
 *
 * Products, categories and stores are read from Firestore through its public REST API.
 * firestore.rules already allows public reads of exactly these documents
 * (published products, approved vendors, active categories), so no credentials are needed.
 *
 * Used by the Vercel function (api/seo.ts) in production and by the Vite dev server locally.
 * NOTE: the folder name starts with "_" so Vercel does not expose this file as its own endpoint.
 */

export type SitemapType = 'index' | 'pages' | 'info' | 'categories' | 'products' | 'stores' | 'store-products';

export const SITEMAP_TYPES: SitemapType[] = ['index', 'pages', 'info', 'categories', 'products', 'stores', 'store-products'];

interface Entry {
  path: string;
  lastmod?: string;
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
  /** Product images (Google image sitemap extension). */
  images?: { loc: string; title?: string }[];
}

const MAX_URLS_PER_SITEMAP = 10000; // protocol limit is 50,000
const CHILD_SITEMAPS: Exclude<SitemapType, 'index'>[] = ['pages', 'info', 'categories', 'products', 'stores', 'store-products'];
const MAX_IMAGES_PER_PRODUCT = 5; // Google allows up to 1,000; a handful is plenty

/** Core public pages. /products?offers=1 is a real filtered view the storefront supports (deals). */
const CORE_PAGES: Entry[] = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/products', changefreq: 'daily', priority: 0.9 },
  { path: '/products?offers=1', changefreq: 'daily', priority: 0.8 },
  { path: '/stores', changefreq: 'daily', priority: 0.8 },
];

/** Help & policy pages (routes defined in App.tsx). */
const INFO_PAGES: Entry[] = [
  { path: '/about', changefreq: 'monthly', priority: 0.5 },
  { path: '/support', changefreq: 'monthly', priority: 0.5 },
  { path: '/shipping-policy', changefreq: 'monthly', priority: 0.4 },
  { path: '/returns', changefreq: 'monthly', priority: 0.4 },
  { path: '/terms', changefreq: 'yearly', priority: 0.3 },
  { path: '/privacy', changefreq: 'yearly', priority: 0.3 },
];

// ---------- helpers ----------

/** Escape the 5 characters that are illegal in XML text. Prevents malformed sitemaps. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Normalise the site origin: no trailing slash, always http(s). */
export function normalizeOrigin(value: string): string {
  const v = value.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/** Firestore timestamp / ISO string -> W3C date (YYYY-MM-DD). Returns undefined if not a valid date. */
function toLastmod(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

function urlset(origin: string, entries: Entry[]): string {
  const hasImages = entries.some((e) => e.images?.length);
  const body = entries
    .map((e) => {
      const lines = [`    <loc>${escapeXml(origin + e.path)}</loc>`];
      if (e.lastmod) lines.push(`    <lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq) lines.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority !== undefined) lines.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      for (const img of e.images ?? []) {
        const inner = [`      <image:loc>${escapeXml(img.loc)}</image:loc>`];
        if (img.title) inner.push(`      <image:title>${escapeXml(img.title)}</image:title>`);
        lines.push(`    <image:image>\n${inner.join('\n')}\n    </image:image>`);
      }
      return `  <url>\n${lines.join('\n')}\n  </url>`;
    })
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
    (hasImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '') +
    '>\n' +
    (body ? body + '\n' : '') +
    '</urlset>\n'
  );
}

function sitemapIndex(origin: string, lastmod: string): string {
  const body = CHILD_SITEMAPS.map(
    (name) =>
      `  <sitemap>\n    <loc>${escapeXml(`${origin}/sitemap-${name}.xml`)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`,
  ).join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    '\n</sitemapindex>\n'
  );
}

// ---------- Firestore (public REST) ----------

interface FirestoreDoc {
  name: string;
  fields?: Record<string, { stringValue?: string; timestampValue?: string; arrayValue?: { values?: { stringValue?: string }[] } }>;
  updateTime?: string;
}

async function queryCollection(
  collectionId: string,
  filter: { field: string; value: string | boolean },
  fields: string[], // only these fields are returned, keeping the response small
): Promise<FirestoreDoc[]> {
  const projectId = process.env['FIREBASE_PROJECT_ID'] || process.env['VITE_FIREBASE_PROJECT_ID'] || 'poeage-hub-11';
  const apiKey = process.env['FIREBASE_API_KEY'] || process.env['VITE_FIREBASE_API_KEY'];
  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery` +
    (apiKey ? `?key=${encodeURIComponent(apiKey)}` : '');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        select: { fields: fields.map((fieldPath) => ({ fieldPath })) },
        where: {
          fieldFilter: {
            field: { fieldPath: filter.field },
            op: 'EQUAL',
            value: typeof filter.value === 'boolean' ? { booleanValue: filter.value } : { stringValue: filter.value },
          },
        },
        limit: MAX_URLS_PER_SITEMAP,
      },
    }),
  });
  if (!res.ok) throw new Error(`Firestore ${collectionId} query failed: ${res.status}`);

  const rows = (await res.json()) as { document?: FirestoreDoc }[];
  return rows.flatMap((r) => (r.document ? [r.document] : []));
}

const docId = (d: FirestoreDoc) => d.name.slice(d.name.lastIndexOf('/') + 1);
const lastmodOf = (d: FirestoreDoc) => toLastmod(d.fields?.['updatedAt']?.timestampValue ?? d.updateTime);

/** A failed Firestore call must not break the sitemap: serve a valid (possibly empty) urlset instead. */
async function safely(fn: () => Promise<Entry[]>): Promise<Entry[]> {
  try {
    return await fn();
  } catch (err) {
    console.error('[sitemap]', err);
    return [];
  }
}

// ---------- public API ----------

export async function buildSitemap(type: SitemapType, origin: string): Promise<string> {
  const base = normalizeOrigin(origin);
  const today = new Date().toISOString().slice(0, 10);

  switch (type) {
    case 'index':
      return sitemapIndex(base, today);

    case 'pages':
      return urlset(base, CORE_PAGES.map((p) => ({ ...p, lastmod: today })));

    case 'info':
      return urlset(base, INFO_PAGES.map((p) => ({ ...p, lastmod: today })));

    case 'categories':
      return urlset(
        base,
        await safely(async () => {
          const docs = await queryCollection('categories', { field: 'isActive', value: true }, ['slug', 'updatedAt']);
          return docs.flatMap((d): Entry[] => {
            const slug = d.fields?.['slug']?.stringValue || docId(d);
            // The storefront filters with ?cat=<slug> (see ProductListingPage).
            return [{ path: `/products?cat=${encodeURIComponent(slug)}`, lastmod: lastmodOf(d), changefreq: 'weekly', priority: 0.8 }];
          });
        }),
      );

    case 'products':
      return urlset(
        base,
        await safely(async () => {
          const docs = await queryCollection('products', { field: 'status', value: 'published' }, ['slug', 'name', 'images', 'updatedAt']);
          return docs.flatMap((d): Entry[] => {
            // /product/:slug falls back to the document id, so the id is a safe fallback.
            const slug = d.fields?.['slug']?.stringValue || docId(d);
            const name = d.fields?.['name']?.stringValue;
            const images = (d.fields?.['images']?.arrayValue?.values ?? [])
              .map((v) => v.stringValue ?? '')
              .filter((u) => /^https?:\/\//i.test(u)) // only absolute URLs are valid in an image sitemap
              .slice(0, MAX_IMAGES_PER_PRODUCT)
              .map((loc) => ({ loc, title: name }));
            return [{ path: `/product/${encodeURIComponent(slug)}`, lastmod: lastmodOf(d), changefreq: 'weekly', priority: 0.7, images }];
          });
        }),
      );

    case 'store-products':
      return urlset(
        base,
        await safely(async () => {
          const docs = await queryCollection('vendors', { field: 'status', value: 'approved' }, ['updatedAt']);
          // The listing page filters by vendor id with ?store=<id> (see ProductListingPage).
          return docs.map((d): Entry => ({ path: `/products?store=${encodeURIComponent(docId(d))}`, lastmod: lastmodOf(d), changefreq: 'daily', priority: 0.5 }));
        }),
      );

    case 'stores':
      return urlset(
        base,
        await safely(async () => {
          const docs = await queryCollection('vendors', { field: 'status', value: 'approved' }, ['updatedAt']);
          return docs.map((d): Entry => ({ path: `/store/${encodeURIComponent(docId(d))}`, lastmod: lastmodOf(d), changefreq: 'weekly', priority: 0.6 }));
        }),
      );
  }
}

export function buildRobots(origin: string): string {
  const base = normalizeOrigin(origin);
  return [
    '# POEAGE HUB — robots.txt',
    '# Public catalogue pages are crawlable; private, transactional and internal-search pages are not.',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    '# Private / transactional pages (no SEO value)',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /order-success/',
    'Disallow: /account/',
    'Disallow: /wishlist',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /forgot-password',
    '',
    '# Internal search results and endless filter/sort combinations (duplicate content)',
    'Disallow: /search',
    'Disallow: /*?*q=',
    'Disallow: /*?*sort=',
    'Disallow: /*?*page=',
    '',
    '# API endpoints',
    'Disallow: /api/',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
}
