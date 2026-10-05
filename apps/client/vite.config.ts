import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { PORTRAIT_DIR, portraitManifest, scanPortraits } from './portraits.js';

const PUBLIC_DIR = new URL('./public/', import.meta.url);

/**
 * Public files to precache: the manifest, app icons, skill and status icons, and asset manifests —
 * not portrait or sound files.
 */
function publicShellFiles(dir = PUBLIC_DIR, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = `${prefix}${e.name}`;
    if (e.isDirectory()) return publicShellFiles(new URL(`${e.name}/`, dir), `${path}/`);
    const shell = !path.startsWith('assets/') || path.startsWith('assets/icons/') || path.endsWith('manifest.json');
    return shell ? [`/${path}`] : [];
  });
}

/** Emits /sw.js from service-worker.js with this build's files and a version (docs/live-ops.md §6). */
function serviceWorker(): Plugin {
  return {
    name: 'arena-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Portrait images are fetched as they're shown (stale-while-revalidate), not precached.
      const built = Object.keys(bundle)
        .filter((f) => f !== 'index.html' && !f.endsWith('.map') && !/^assets\/portraits\/.+\.(png|webp|jpe?g)$/.test(f))
        .map((f) => `/${f}`);
      const precache = ['/', ...built, ...publicShellFiles()].sort();
      const hash = createHash('sha256');
      hash.update(precache.join('\n'));
      for (const f of Object.values(bundle)) hash.update(f.type === 'chunk' ? f.code : f.source);
      const source = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8')
        .replace("'__VERSION__'", JSON.stringify(hash.digest('hex').slice(0, 12)))
        .replace('__PRECACHE__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

/**
 * Character portraits from character_images/ (portraits.ts): served at /assets/portraits/ in
 * development, with the manifest built from the folder on every request (so a new file shows up on
 * reload), and emitted with the build. The client falls back to monogram portraits for the rest.
 */
function portraits(): Plugin {
  const MIME: Record<string, string> = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
  let build = false;
  return {
    name: 'arena-portraits',
    configResolved(config) {
      build = config.command === 'build';
    },
    configureServer(server) {
      server.middlewares.use('/assets/portraits/', (req, res, next) => {
        const file = decodeURIComponent((req.url ?? '').split('?')[0]!.replace(/^\//, ''));
        if (file === 'manifest.json') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-cache');
          return res.end(portraitManifest());
        }
        const url = new URL(file, PORTRAIT_DIR);
        const ext = file.split('.').pop()!.toLowerCase();
        if (file.includes('/') || !MIME[ext] || !existsSync(url)) return next();
        res.setHeader('Content-Type', MIME[ext]!);
        res.setHeader('Cache-Control', 'no-cache');
        res.end(readFileSync(url));
      });
    },
    buildStart() {
      if (!build) return;
      const scan = scanPortraits();
      for (const files of Object.values(scan.portraits)) {
        for (const f of files) this.emitFile({ type: 'asset', fileName: `assets/portraits/${f}`, source: readFileSync(new URL(f, PORTRAIT_DIR)) });
      }
      this.emitFile({ type: 'asset', fileName: 'assets/portraits/manifest.json', source: portraitManifest(scan) });
      if (scan.unrecognized.length) this.warn(`character_images: not named <element><class>prof.png, skipped: ${scan.unrecognized.join(', ')}`);
    },
  };
}

const API = process.env.API_PROXY ?? 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react(), portraits(), serviceWorker()],
  // The bundle carries all game content (~1 MB, ~250 kB gzipped); that is expected, not a warning.
  build: { chunkSizeWarningLimit: 1500 },
  // The API server (npm run server) is proxied so cookies stay same-origin in development. API_PROXY
  // points it at another server (a second one on another PORT, say).
  server: { port: 5173, strictPort: true, proxy: { '/api': { target: API, ws: true } } },
  preview: { port: 4173, strictPort: true, proxy: { '/api': { target: API, ws: true } } },
});
