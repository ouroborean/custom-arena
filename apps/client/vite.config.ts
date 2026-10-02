import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

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
      const built = Object.keys(bundle)
        .filter((f) => f !== 'index.html' && !f.endsWith('.map'))
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

const API = process.env.API_PROXY ?? 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react(), serviceWorker()],
  // The bundle carries all game content (~1 MB, ~250 kB gzipped); that is expected, not a warning.
  build: { chunkSizeWarningLimit: 1500 },
  // The API server (npm run server) is proxied so cookies stay same-origin in development. API_PROXY
  // points it at another server (a second one on another PORT, say).
  server: { port: 5173, strictPort: true, proxy: { '/api': { target: API, ws: true } } },
  preview: { port: 4173, strictPort: true, proxy: { '/api': { target: API, ws: true } } },
});
