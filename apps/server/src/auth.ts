// Accounts and sessions (GDD §10.2: self-hosted sessions + Argon2). The session token is random and
// only ever sent as an httpOnly cookie; the database stores its SHA-256.

import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { and, eq, gt } from 'drizzle-orm';
import type { Db } from './db/client.js';
import { sessions, users } from './db/schema.js';

export const SESSION_COOKIE = 'arena_session';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  /** Can use the admin tool (the account's email is in ADMIN_EMAILS). */
  isAdmin?: boolean;
}

const tokenId = (token: string) => createHash('sha256').update(token).digest('hex');

export function hashPassword(password: string): Promise<string> {
  // Argon2id with the library defaults (OWASP-recommended parameters).
  return hash(password);
}

export function verifyPassword(stored: string, password: string): Promise<boolean> {
  return verify(stored, password).catch(() => false);
}

export async function createSession(db: Db, userId: string, days: number): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  await db.insert(sessions).values({ id: tokenId(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function userForSession(db: Db, token: string | undefined): Promise<(SessionUser & { lastSeenAt: Date | null }) | null> {
  if (!token) return null;
  const rows = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName, lastSeenAt: users.lastSeenAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, tokenId(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, tokenId(token)));
}
