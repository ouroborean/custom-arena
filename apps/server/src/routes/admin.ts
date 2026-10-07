// The admin tool (decided 2026-10-07): player counts, who's online, and each account's details
// (characters and loadouts, level, wallet, inventory, team, ratings, progress, recent matches). Only
// accounts listed in ADMIN_EMAILS can use it (requireAdmin); every player lookup is audited.

import { displayRating, levelOf, seasonAt, seasonTier } from '@arena/meta';
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, parse, requireAdmin, type AppContext } from '../app.js';
import { audit } from '../audit.js';
import {
  achievementProgress,
  characters,
  currencies,
  guideRewards,
  itemInstances,
  lootBoxes,
  matches,
  playerProgress,
  ratings,
  spAttempts,
  storyChapters,
  storyProgress,
  teams,
  users,
} from '../db/schema.js';
import { walletOf } from '../economy.js';
import { characterJson } from './roster.js';
import { resolveStored } from './equipment.js';

const PAGE = 50;
const DAY = 86_400_000;

export function adminRoutes(ctx: AppContext) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', async (req) => {
      if (req.url.startsWith('/api/admin')) await requireAdmin(req);
    });

    /** Headline counts and who's online right now. */
    app.get('/api/admin/overview', async () => {
      const now = ctx.clock.now();
      const today = new Date(now - (now % DAY));
      const [[registered], [newToday], [newWeek], [activeDay], [active15], [matchesToday]] = await Promise.all([
        ctx.db.select({ n: count() }).from(users),
        ctx.db.select({ n: count() }).from(users).where(gte(users.createdAt, today)),
        ctx.db.select({ n: count() }).from(users).where(gte(users.createdAt, new Date(now - 7 * DAY))),
        ctx.db.select({ n: count() }).from(users).where(gte(users.lastSeenAt, new Date(now - DAY))),
        ctx.db.select({ n: count() }).from(users).where(gte(users.lastSeenAt, new Date(now - 15 * 60_000))),
        ctx.db.select({ n: count() }).from(matches).where(and(eq(matches.status, 'finished'), gte(matches.endedAt, today))),
      ]);
      const onlineIds = ctx.hub?.onlineUserIds() ?? [];
      const inMatch = new Set(ctx.hub?.inMatchUserIds() ?? []);
      const online = onlineIds.length
        ? await ctx.db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, onlineIds)).orderBy(asc(users.displayName))
        : [];
      return {
        registered: registered?.n ?? 0,
        newToday: newToday?.n ?? 0,
        newThisWeek: newWeek?.n ?? 0,
        activeToday: activeDay?.n ?? 0,
        activeNow: active15?.n ?? 0,
        matchesToday: matchesToday?.n ?? 0,
        online: online.map((u) => ({ ...u, inMatch: inMatch.has(u.id) })),
        inMatch: inMatch.size,
      };
    });

    /** Players, newest first, filtered by name or email; 50 a page. */
    app.get('/api/admin/players', async (req) => {
      const { q, page } = parse(z.object({ q: z.string().max(80).optional(), page: z.coerce.number().int().min(0).max(10_000).optional() }), req.query);
      const term = q?.trim();
      const where = term ? or(ilike(users.displayName, `%${term}%`), ilike(users.email, `%${term}%`)) : undefined;
      const [rows, [total]] = await Promise.all([
        ctx.db
          .select({ id: users.id, displayName: users.displayName, email: users.email, createdAt: users.createdAt, lastSeenAt: users.lastSeenAt })
          .from(users)
          .where(where)
          .orderBy(desc(users.createdAt))
          .limit(PAGE)
          .offset((page ?? 0) * PAGE),
        ctx.db.select({ n: count() }).from(users).where(where),
      ]);
      const ids = rows.map((r) => r.id);
      const [xp, gold, chars] = ids.length
        ? await Promise.all([
            ctx.db.select({ id: playerProgress.userId, xp: playerProgress.xp }).from(playerProgress).where(inArray(playerProgress.userId, ids)),
            ctx.db.select({ id: currencies.userId, n: currencies.amount }).from(currencies).where(and(inArray(currencies.userId, ids), eq(currencies.kind, 'gold'))),
            ctx.db.select({ id: characters.userId, n: count() }).from(characters).where(inArray(characters.userId, ids)).groupBy(characters.userId),
          ])
        : [[], [], []];
      const online = new Set(ctx.hub?.onlineUserIds() ?? []);
      const by = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
      const [xpOf, goldOf, charsOf] = [by(xp), by(gold), by(chars)];
      return {
        total: total?.n ?? 0,
        page: page ?? 0,
        pageSize: PAGE,
        players: rows.map((r) => ({
          ...r,
          level: levelOf(ctx.content, xpOf.get(r.id)?.xp ?? 0).level,
          gold: goldOf.get(r.id)?.n ?? null,
          characters: charsOf.get(r.id)?.n ?? 0,
          online: online.has(r.id),
        })),
      };
    });

    /** Everything about one account. */
    app.get('/api/admin/players/:id', async (req) => {
      const { id } = parse(z.object({ id: z.uuid() }), req.params);
      const [user] = await ctx.db
        .select({ id: users.id, displayName: users.displayName, email: users.email, createdAt: users.createdAt, lastSeenAt: users.lastSeenAt })
        .from(users)
        .where(eq(users.id, id));
      if (!user) throw new HttpError(404, 'No such player');
      audit(ctx.db, 'admin_view', { userId: req.user!.id, detail: { player: id } });

      const season = seasonAt(ctx.seasons, ctx.clock.now());
      const [chars, [team], items, [xp], [boxes], ratingRows, cleared, chaptersDone, [arcade], recent, achievements, guides, wallet] = await Promise.all([
        ctx.db.select().from(characters).where(eq(characters.userId, id)).orderBy(sql`${characters.position} asc nulls last`, characters.createdAt),
        ctx.db.select().from(teams).where(and(eq(teams.userId, id), eq(teams.isActive, true))).limit(1),
        ctx.db.select().from(itemInstances).where(eq(itemInstances.userId, id)).orderBy(asc(itemInstances.acquiredAt)),
        ctx.db.select({ xp: playerProgress.xp }).from(playerProgress).where(eq(playerProgress.userId, id)),
        ctx.db.select({ n: count() }).from(lootBoxes).where(and(eq(lootBoxes.userId, id), isNull(lootBoxes.openedAt))),
        ctx.db.select().from(ratings).where(eq(ratings.userId, id)),
        ctx.db.select({ id: storyProgress.encounterId, clears: storyProgress.clears }).from(storyProgress).where(eq(storyProgress.userId, id)),
        ctx.db.select({ id: storyChapters.chapterId }).from(storyChapters).where(eq(storyChapters.userId, id)),
        ctx.db
          .select({ best: sql<number>`coalesce(max(${spAttempts.ref}::int), 0)::int` })
          .from(spAttempts)
          .where(and(eq(spAttempts.userId, id), eq(spAttempts.mode, 'arcade'), eq(spAttempts.outcome, 'win'))),
        ctx.db
          .select()
          .from(matches)
          .where(or(eq(matches.p0User, id), eq(matches.p1User, id)))
          .orderBy(desc(matches.startedAt))
          .limit(10),
        ctx.db.select().from(achievementProgress).where(and(eq(achievementProgress.userId, id))),
        ctx.db.select({ id: guideRewards.guideId }).from(guideRewards).where(eq(guideRewards.userId, id)),
        walletOf(ctx.db, ctx.content, id),
      ]);

      // Who each piece is on, and the opponents' names for the recent matches.
      const wornBy = new Map<string, string>();
      for (const c of chars) for (const e of c.loadout.items ?? []) if (e.instanceId) wornBy.set(e.instanceId, c.id);
      const opponentIds = [...new Set(recent.map((m) => (m.p0User === id ? m.p1User : m.p0User)))];
      const names = new Map(
        opponentIds.length
          ? (await ctx.db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, opponentIds))).map((u) => [u.id, u.name])
          : [],
      );
      const ranked = season ? ratingRows.find((r) => r.queue === season.id) : undefined;
      const casual = ratingRows.find((r) => r.queue === 'casual');
      const online = new Set(ctx.hub?.onlineUserIds() ?? []);
      const inMatch = new Set(ctx.hub?.inMatchUserIds() ?? []);

      return {
        account: { ...user, online: online.has(id), inMatch: inMatch.has(id) },
        progress: { ...levelOf(ctx.content, xp?.xp ?? 0), unopenedBoxes: boxes?.n ?? 0 },
        wallet,
        characters: chars.map((c) => ({ ...characterJson(c), resolved: resolveStored(ctx, c) })),
        team: team?.characterIds ?? [],
        inventory: items.map((i) => ({ id: i.id, itemId: i.itemId, source: i.source, acquiredAt: i.acquiredAt, equippedOn: wornBy.get(i.id) ?? null })),
        ranked: ranked && {
          season: season!.name,
          rating: Math.round(ranked.rating),
          display: displayRating(ranked),
          games: ranked.games,
          wins: ranked.wins,
          tier: seasonTier(ctx.seasons, ranked)?.name ?? null,
        },
        casual: casual ? { games: casual.games, wins: casual.wins } : { games: 0, wins: 0 },
        story: { cleared: cleared.length, clears: cleared, chapters: chaptersDone.map((c) => c.id) },
        arcadeBest: arcade?.best ?? 0,
        achievements: achievements.filter((a) => a.completedAt).map((a) => a.achievementId),
        guides: guides.map((g) => g.id),
        recentMatches: recent.map((m) => {
          const seat = m.p0User === id ? 0 : 1;
          return {
            id: m.id,
            kind: m.kind,
            status: m.status,
            opponent: names.get(seat === 0 ? m.p1User : m.p0User) ?? '—',
            outcome: m.status !== 'finished' ? null : m.winner === null ? 'draw' : m.winner === seat ? 'win' : 'loss',
            endReason: m.endReason,
            turns: m.turns,
            startedAt: m.startedAt,
          };
        }),
      };
    });
  };
}
