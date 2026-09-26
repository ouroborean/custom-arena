// Database connection: PGlite (embedded Postgres; in-memory or a data directory) for development
// and tests, or a real PostgreSQL server via DATABASE_URL. Both speak the same Drizzle API.

import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema.js';

export type Db = PgliteDatabase<typeof schema>;

const MIGRATIONS = fileURLToPath(new URL('./migrations', import.meta.url));

export interface OpenDbOptions {
  /** postgres://… — use a PostgreSQL server. */
  url?: string;
  /** Directory for PGlite data; omit for an in-memory database. */
  dataDir?: string;
}

export interface OpenDb {
  db: Db;
  close: () => Promise<void>;
}

/** Opens the database and applies pending migrations. */
export async function openDb(opts: OpenDbOptions = {}): Promise<OpenDb> {
  if (opts.url) {
    const { default: pg } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const pool = new pg.Pool({ connectionString: opts.url });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    // Same query-builder surface as PGlite's; only the driver differs.
    return { db: db as unknown as Db, close: () => pool.end() };
  }
  const client = opts.dataDir ? new PGlite(opts.dataDir) : new PGlite();
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return { db, close: () => client.close() };
}
