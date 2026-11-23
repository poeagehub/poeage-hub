/**
 * Vercel serverless function behind /robots.txt and every /sitemap*.xml (see vercel.json rewrites).
 *
 * The XML is served with a plain `application/xml` content type and NO stylesheet on purpose:
 * browsers then show their built-in collapsible tree view of the XML, and search engines read it as normal.
 */
import { SITEMAP_TYPES, buildRobots, buildSitemap, type SitemapType } from './_lib/sitemap.js'; // ".js" is required by Vercel's ESM build; Vite and TypeScript map it to sitemap.ts

// Minimal request/response shapes so no extra dependency (@vercel/node) is needed.
interface Req {
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): Res;
  setHeader(name: string, value: string): void;
  send(body: string): void;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Public origin: SITE_URL env (recommended in production) or the host the request came in on. */
function originOf(req: Req): string {
  const fromEnv = process.env['SITE_URL'] || process.env['VITE_USER_APP_URL'];
  if (fromEnv && !/localhost|127\.0\.0\.1/.test(fromEnv)) return fromEnv;
  const host = first(req.headers['x-forwarded-host']) || first(req.headers['host']) || 'localhost:5180';
  const proto = first(req.headers['x-forwarded-proto']) || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const params = new URL(req.url ?? '/', 'http://localhost').searchParams;
  const type = params.get('type') ?? 'index';
  const origin = originOf(req);

  if (type === 'robots') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).send(buildRobots(origin));
    return;
  }

  if (!SITEMAP_TYPES.includes(type as SitemapType)) {
    res.status(404).send('Not found');
    return;
  }

  const xml = await buildSitemap(type as SitemapType, origin);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Cached at the edge for an hour; a new product shows up within the hour without a redeploy.
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(xml);
}
