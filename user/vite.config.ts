import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Serves /robots.txt and /sitemap*.xml in `vite dev` / `vite preview` with the same code Vercel runs in production
 * (api/seo.ts), so they can be checked locally at http://localhost:5180/sitemap.xml.
 */
function seoFiles(): Plugin {
  const pattern = /^\/(robots\.txt|sitemap(?:-(pages|info|categories|products|stores|store-products))?\.xml)(?:\?.*)?$/;
  const handle = (loadModule: (id: string) => Promise<any>) => async (req: any, res: any, next: () => void) => {
    const m = pattern.exec(req.url ?? '');
    if (!m) return next();
    try {
      const { default: handler } = await loadModule('/api/seo.ts');
      const type = m[1] === 'robots.txt' ? 'robots' : m[2] ?? 'index';
      const reply = {
        status: (code: number) => { res.statusCode = code; return reply; },
        setHeader: (k: string, v: string) => res.setHeader(k, v),
        send: (body: string) => res.end(body),
      };
      await handler({ url: `/api/seo?type=${type}`, headers: req.headers }, reply);
    } catch (err) {
      console.error('[seo]', err);
      res.statusCode = 500;
      res.end('SEO file generation failed');
    }
  };

  return {
    name: 'poeage-seo-files',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, __dirname, ''));
      server.middlewares.use(handle((id) => server.ssrLoadModule(id)));
    },
  };
}

export default defineConfig({
  envDir: __dirname,
  plugins: [react(), seoFiles()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
        },
      },
    },
  },
});
