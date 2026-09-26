// The HTTP API (GDD §10.4 "API service"): content delivery, accounts, roster and teams.
// Built as a factory so tests can inject an in-memory database and a deterministic RNG seed.

import { randomInt } from 'node:crypto';
import cookie from '@fastify/cookie';
import { ENGINE_VERSION, type ContentBundle } from '@arena/engine';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { SESSION_COOKIE, userForSession, type SessionUser } from './auth.js';
import type { Db } from './db/client.js';
import { authRoutes } from './routes/auth.js';
import { rosterRoutes } from './routes/roster.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

export interface AppOptions {
  db: Db;
  content: ContentBundle;
  sessionDays?: number;
  secureCookies?: boolean;
  /** Seed source for character rolls (default: crypto-random). */
  rollSeed?: () => number;
  logger?: boolean;
}

export interface AppContext {
  db: Db;
  content: ContentBundle;
  sessionDays: number;
  secureCookies: boolean;
  rollSeed: () => number;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Parses a request body/params with Zod, turning failures into 400s. */
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
  return r.data;
}

export async function requireUser(req: FastifyRequest): Promise<void> {
  if (!req.user) throw new HttpError(401, 'Sign in first');
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const ctx: AppContext = {
    db: opts.db,
    content: opts.content,
    sessionDays: opts.sessionDays ?? 30,
    secureCookies: opts.secureCookies ?? false,
    rollSeed: opts.rollSeed ?? (() => randomInt(2 ** 31)),
  };
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(cookie);

  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req) => {
    req.user = await userForSession(ctx.db, req.cookies[SESSION_COOKIE]);
  });

  app.setErrorHandler((err: unknown, _req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.status(status).send({ error: (err as Error).message });
    app.log.error(err);
    return reply.status(500).send({ error: 'Internal error' });
  });

  app.get('/api/health', async () => ({ ok: true, engine: ENGINE_VERSION, content: ctx.content.version }));

  // Content delivery (GDD §13 Phase 4): clients fetch the bundle for the version the server runs.
  app.get('/api/content', async () => ({ version: ctx.content.version }));
  app.get('/api/content/:version', async (req, reply) => {
    const { version } = parse(z.object({ version: z.string() }), req.params);
    if (version !== ctx.content.version) throw new HttpError(404, `Content ${version} isn't served here`);
    reply.header('cache-control', 'public, max-age=31536000, immutable');
    return ctx.content;
  });

  await app.register(authRoutes(ctx));
  await app.register(rosterRoutes(ctx));
  return app;
}
