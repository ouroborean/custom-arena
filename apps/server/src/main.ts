// Entry point: `npm run dev -w @arena/server` (PGlite in .data/pglite unless DATABASE_URL is set).

import { mkdirSync } from 'node:fs';
import { loadContentOrThrow } from '@arena/content';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db/client.js';

const config = loadConfig();
const memory = config.pgliteDir === ':memory:';
if (!config.databaseUrl && !memory) mkdirSync(config.pgliteDir, { recursive: true });

const { db, close } = await openDb(
  config.databaseUrl ? { url: config.databaseUrl } : memory ? {} : { dataDir: config.pgliteDir },
);
const content = loadContentOrThrow();
const app = await buildApp({
  db,
  content,
  sessionDays: config.sessionDays,
  secureCookies: config.secureCookies,
  devGrants: config.devGrants,
  logger: true,
});

const shutdown = async () => {
  await app.close();
  await close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.port, host: config.host });
