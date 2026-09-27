// Pick and win rates from recorded online matches (GDD Phase 8 analytics, docs/live-ops.md §1).
//
//   npm run analytics -w @arena/server
//   options: --kind ranked|casual|private  --since 2026-09-01  --content <version>|current
//            --min 20 (fewest picks to list)  --json
//
// With PGlite (the default), stop the dev server first: a data directory takes one process at a
// time. With DATABASE_URL it reads the live PostgreSQL database.

import { mkdirSync } from 'node:fs';
import { loadContentOrThrow } from '@arena/content';
import type { MatchConfig, PlayerId } from '@arena/engine';
import { analyzeMatches, formatRates } from '@arena/meta';
import { and, eq, gte } from 'drizzle-orm';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db/client.js';
import { matches } from '../src/db/schema.js';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]!;
  if (!a.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith('--')) {
    args.set(a.slice(2), next);
    i++;
  } else args.set(a.slice(2), 'true');
}

const content = loadContentOrThrow();
const config = loadConfig();
if (!config.databaseUrl && config.pgliteDir !== ':memory:') mkdirSync(config.pgliteDir, { recursive: true });
const { db, close } = await openDb(
  config.databaseUrl ? { url: config.databaseUrl } : config.pgliteDir === ':memory:' ? {} : { dataDir: config.pgliteDir },
);

const filters = [eq(matches.status, 'finished')];
const kind = args.get('kind');
if (kind) filters.push(eq(matches.kind, kind));
const since = args.get('since');
if (since) filters.push(gte(matches.startedAt, new Date(since)));
const version = args.get('content') === 'current' ? content.version : args.get('content');
if (version) filters.push(eq(matches.contentVersion, version));

const rows = await db
  .select({ config: matches.config, winner: matches.winner })
  .from(matches)
  .where(and(...filters));
await close();

const report = analyzeMatches(
  content,
  rows.map((r) => ({ teams: (r.config as MatchConfig).teams, winner: r.winner as PlayerId | null })),
);

if (args.has('json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const min = Number(args.get('min') ?? 1);
  const scope = [kind ?? 'all kinds', since ? `since ${since}` : null, version ? `content ${version.slice(0, 8)}` : null].filter(Boolean).join(', ');
  console.log(`${report.matches} finished matches (${scope}); ${report.draws} draws; first seat wins ${(100 * report.firstSeatWinRate).toFixed(1)}%\n`);
  for (const [title, list] of [
    ['Classes', report.classes],
    ['Elements', report.elements],
    ['Skills', report.skills],
    ['Items', report.items],
  ] as const) {
    console.log(formatRates(title, list, min));
    console.log('');
  }
  if (report.matches < 100) console.log('Few matches so far: treat these rates as anecdotes (docs/live-ops.md §1).');
}
