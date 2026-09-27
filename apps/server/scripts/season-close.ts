// Pays a finished ranked season's tier rewards (docs/live-ops.md §4). Safe to re-run: players
// already paid are skipped.
//
//   npm run season:close -w @arena/server -- ranked-s1 [--dry-run]
//
// With PGlite (the default), stop the dev server first: a data directory takes one process at a
// time. With DATABASE_URL it runs against the live PostgreSQL database.

import { mkdirSync } from 'node:fs';
import { loadContentOrThrow } from '@arena/content';
import { formatAmounts } from '@arena/meta';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db/client.js';
import { closeSeason, loadSeasons } from '../src/seasons.js';

const seasonId = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!seasonId || seasonId.startsWith('--')) {
  console.error('Usage: npm run season:close -w @arena/server -- <season id> [--dry-run]');
  process.exit(1);
}

const content = loadContentOrThrow();
const config = loadConfig();
const schedule = loadSeasons(content, config.seasonsFile);
if (!config.databaseUrl && config.pgliteDir !== ':memory:') mkdirSync(config.pgliteDir, { recursive: true });
const { db, close } = await openDb(
  config.databaseUrl ? { url: config.databaseUrl } : config.pgliteDir === ':memory:' ? {} : { dataDir: config.pgliteDir },
);

try {
  const r = await closeSeason(db, content, schedule, seasonId, Date.now(), { dryRun });
  const tiers = new Map(schedule.tiers.map((t) => [t.id, t]));
  console.log(`${r.season.name} (${r.season.id})${dryRun ? ' — dry run, nothing paid' : ''}`);
  for (const p of r.paid) {
    const t = tiers.get(p.tier)!;
    const reward = [formatAmounts(content, t.reward?.currency ?? {}), ...(t.reward?.items ?? []).map((i) => content.items[i]?.name ?? i)];
    console.log(`  ${p.displayName.padEnd(24)} ${t.name.padEnd(10)} ${String(p.rating).padStart(5)}  (${p.games} games)  ${reward.join(' · ')}`);
  }
  console.log(`${dryRun ? 'Would pay' : 'Paid'} ${r.paid.length}; already paid ${r.alreadyPaid}; unplaced ${r.unplaced} (fewer than ${schedule.minGames} games or below the lowest tier).`);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await close();
}
