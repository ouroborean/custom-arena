// Server configuration from the environment.

export interface ServerConfig {
  port: number;
  host: string;
  /** postgres://… for a PostgreSQL server; otherwise PGlite is used. */
  databaseUrl?: string;
  /** PGlite data directory (default: .data/pglite); ":memory:" for a throwaway database. */
  pgliteDir: string;
  /** Session lifetime in days. */
  sessionDays: number;
  /** Mark cookies Secure (set in production behind HTTPS). */
  secureCookies: boolean;
  /** Allow POST /api/dev/grant (never in production). */
  devGrants: boolean;
  /** Ranked season schedule (default: seasons.json next to the server's package.json). */
  seasonsFile?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '127.0.0.1',
    ...(env.DATABASE_URL ? { databaseUrl: env.DATABASE_URL } : {}),
    pgliteDir: env.PGLITE_DIR ?? '.data/pglite',
    sessionDays: Number(env.SESSION_DAYS ?? 30),
    secureCookies: env.NODE_ENV === 'production',
    devGrants: env.NODE_ENV !== 'production',
    ...(env.SEASONS_FILE ? { seasonsFile: env.SEASONS_FILE } : {}),
  };
}
