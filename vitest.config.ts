import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    // Server test files open a fresh PGlite database (and run every migration) in beforeAll. With the
    // whole suite running in parallel on a cold cache that can pass Vitest's default 10 s, which
    // failed whole files at random; give setup a minute.
    hookTimeout: 60_000,
  },
});
