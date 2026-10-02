// Entry point: `npm run dev -w @arena/server` (PGlite in .data/pglite unless DATABASE_URL is set).

import { mkdirSync } from 'node:fs';
import { loadContentOrThrow } from '@arena/content';
import { nextSeason, seasonAt } from '@arena/meta';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { openDb } from './db/client.js';
import { abortStaleMatches } from './match/store.js';
import { loadSeasons } from './seasons.js';

const config = loadConfig();
const memory = config.pgliteDir === ':memory:';
if (!config.databaseUrl && !memory) mkdirSync(config.pgliteDir, { recursive: true });

const { db, close } = await openDb(
  config.databaseUrl ? { url: config.databaseUrl } : memory ? {} : { dataDir: config.pgliteDir },
);
const content = loadContentOrThrow();
const seasons = loadSeasons(content, config.seasonsFile);
const aborted = await abortStaleMatches(db);
const app = await buildApp({
  db,
  content,
  sessionDays: config.sessionDays,
  secureCookies: config.secureCookies,
  devGrants: config.devGrants,
  allItems: config.allItems,
  testGold: config.testGold,
  seasons,
  logger: true,
});

// Close the database cleanly however the server is stopped: an unclean stop can damage PGlite's data.
let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  await app.close();
  await close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// SIGHUP: the console window was closed (Windows). disconnect: the launcher (scripts/launch.mjs) let go.
process.on('SIGHUP', shutdown);
process.on('disconnect', shutdown);

if (aborted) app.log.warn(`${aborted} match(es) from a previous run were aborted`);
const season = seasonAt(seasons, Date.now());
const next = nextSeason(seasons, Date.now());
if (season) app.log.info(`Ranked: ${season.name} (${season.id})${season.end ? `, ends ${season.end}` : ''}`);
else app.log.warn(`Ranked is between seasons${next ? `; ${next.name} starts ${next.start}` : ' and none is scheduled (edit seasons.json)'}`);
await app.listen({ port: config.port, host: config.host });
