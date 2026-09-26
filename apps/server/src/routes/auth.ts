// Registration, login and logout. New accounts get a starter roster of 3 rolled characters and an
// active team made of them, so they can play immediately.

import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { HttpError, parse, requireUser, type AppContext } from '../app.js';
import { SESSION_COOKIE, createSession, deleteSession, hashPassword, verifyPassword } from '../auth.js';
import { teams, users } from '../db/schema.js';
import { rollForUser } from './roster.js';

const Credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});
const Registration = Credentials.extend({ displayName: z.string().trim().min(1).max(24) });

export function authRoutes(ctx: AppContext) {
  const setSession = async (reply: FastifyReply, userId: string) => {
    const { token, expiresAt } = await createSession(ctx.db, userId, ctx.sessionDays);
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: ctx.secureCookies,
      expires: expiresAt,
    });
  };

  return async (app: FastifyInstance) => {
    app.post('/api/auth/register', async (req, reply) => {
      const body = parse(Registration, req.body);
      const email = body.email.toLowerCase();
      const taken = await ctx.db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, email)).limit(1);
      if (taken.length) throw new HttpError(409, 'That email is already registered');
      const [user] = await ctx.db
        .insert(users)
        .values({ email, displayName: body.displayName, passwordHash: await hashPassword(body.password) })
        .returning({ id: users.id, email: users.email, displayName: users.displayName });
      if (!user) throw new HttpError(500, 'Could not create the account');

      const starters = [];
      for (let i = 0; i < 3; i++) starters.push(await rollForUser(ctx, user.id));
      await ctx.db.insert(teams).values({ userId: user.id, name: 'Team 1', characterIds: starters.map((c) => c.id), isActive: true });

      await setSession(reply, user.id);
      return reply.status(201).send({ user });
    });

    app.post('/api/auth/login', async (req, reply) => {
      const body = parse(Credentials, req.body);
      const [row] = await ctx.db
        .select()
        .from(users)
        .where(eq(sql`lower(${users.email})`, body.email.toLowerCase()))
        .limit(1);
      // Same message either way, so login doesn't reveal which emails exist.
      if (!row || !(await verifyPassword(row.passwordHash, body.password))) throw new HttpError(401, 'Wrong email or password');
      await setSession(reply, row.id);
      return { user: { id: row.id, email: row.email, displayName: row.displayName } };
    });

    app.post('/api/auth/logout', async (req, reply) => {
      const token = req.cookies[SESSION_COOKIE];
      if (token) await deleteSession(ctx.db, token);
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      return reply.status(204).send();
    });

    app.get('/api/me', { preHandler: requireUser }, async (req) => {
      const [row] = await ctx.db.select({ rollsSincePity: users.rollsSincePity }).from(users).where(eq(users.id, req.user!.id));
      return { user: req.user, rollsSincePity: row?.rollsSincePity ?? 0 };
    });
  };
}
