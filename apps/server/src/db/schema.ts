// PostgreSQL schema (GDD §10.5), managed with Drizzle. Migrations: `npm run db:generate -w @arena/server`.
// Item definitions live in content, never in the database (referenced by string id).

import type { CharacterSkill, Loadout } from '@arena/meta';
import { sql } from 'drizzle-orm';
import { boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { Command, MatchConfig } from '@arena/engine';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** When the account was last active (any signed-in request, written at most every few minutes). */
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    /** Infused Recruits left (decided 2026-10-09): a chosen class and element, recruited already equipped. */
    infusedRecruits: integer('infused_recruits').notNull().default(3),
  },
  (t) => [uniqueIndex('users_email_idx').on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the session token; the token itself only lives in the cookie. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const characters = pgTable(
  'characters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    classId: text('class_id').notNull(),
    element: text('element').notNull(),
    portraitId: text('portrait_id').notNull(),
    /** Ordered skill list; validated by @arena/meta (GDD §7.1 character_skills, kept as one document). */
    skills: jsonb('skills').$type<CharacterSkill[]>().notNull(),
    /** Up to four equipped items (instance ids from item_instances) and where their infusions go; validated by @arena/meta. */
    loadout: jsonb('loadout').$type<Loadout>().notNull().default({ items: [], infusions: [] }),
    /** Content version the character was generated against. */
    contentVersion: text('content_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Place in the player's roster order (they drag to arrange it); null for recruits since, which go last. */
    position: integer('position'),
  },
  (t) => [index('characters_user_idx').on(t.userId)],
);

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Exactly 3 character ids, in battle order. */
    characterIds: jsonb('character_ids').$type<string[]>().notNull(),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('teams_user_idx').on(t.userId)],
);

export const itemInstances = pgTable(
  'item_instances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Content item id (items.yaml). */
    itemId: text('item_id').notNull(),
    /** Where it came from (starter kit, dev grant, later drops and rewards). */
    source: text('source').notNull(),
    acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('item_instances_user_idx').on(t.userId)],
);

export const loadoutPresets = pgTable(
  'loadout_presets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    loadout: jsonb('loadout').$type<Loadout>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('loadout_presets_character_idx').on(t.characterId)],
);

/** A multiplayer match (GDD §10.5). The config holds the seed and both teams' frozen specs. */
export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** casual | ranked | private */
    kind: text('kind').notNull(),
    /** active | finished | aborted */
    status: text('status').notNull(),
    contentVersion: text('content_version').notNull(),
    engineVersion: text('engine_version').notNull(),
    /** Seed and team snapshots; the seed is never sent to clients before the match ends. */
    config: jsonb('config').$type<MatchConfig>().notNull(),
    p0User: uuid('p0_user')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    p1User: uuid('p1_user')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 0, 1, or null for a draw / unfinished. */
    winner: smallint('winner'),
    endReason: text('end_reason'),
    turns: integer('turns').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    /** Rating changes applied (ranked): [{ before, after }, { before, after }]. */
    ratingChanges: jsonb('rating_changes').$type<{ before: number; after: number }[]>(),
  },
  (t) => [index('matches_p0_idx').on(t.p0User), index('matches_p1_idx').on(t.p1User), index('matches_status_idx').on(t.status)],
);

/** The replay log: every engine command, in order (GDD §10.5 match_actions). */
export const matchActions = pgTable(
  'match_actions',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    player: smallint('player').notNull(),
    command: jsonb('command').$type<Command>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.seq] })],
);

/** Glicko-2 ratings per queue ("casual" hidden MMR, or a ranked season id). */
export const ratings = pgTable(
  'ratings',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    queue: text('queue').notNull(),
    rating: doublePrecision('rating').notNull(),
    rd: doublePrecision('rd').notNull(),
    vol: doublePrecision('vol').notNull(),
    games: integer('games').notNull().default(0),
    wins: integer('wins').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.queue] })],
);

/** Currency balances (GDD §10.5 currencies): one row per user and currency (docs/equipment.md §3). */
export const currencies = pgTable(
  'currencies',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    amount: integer('amount').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind] })],
);

/** What each player earned from a match; the key makes rewards at-most-once. */
export const matchRewards = pgTable(
  'match_rewards',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    currency: jsonb('currency').$type<Record<string, number>>().notNull(),
    /** Item ids granted (their instances have source 'reward'). */
    items: jsonb('items').$type<string[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.userId] }), index('match_rewards_user_idx').on(t.userId)],
);

/** Story progress: clears per encounter (docs/single-player.md). */
export const storyProgress = pgTable(
  'story_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    encounterId: text('encounter_id').notNull(),
    clears: integer('clears').notNull().default(0),
    firstClearedAt: timestamp('first_cleared_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.encounterId] })],
);

/** Chapters whose completion reward was paid (at most once). */
export const storyChapters = pgTable(
  'story_chapters',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    chapterId: text('chapter_id').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.chapterId] })],
);

/**
 * A single-player attempt: the server fixes the teams and the seed; the client plays locally and
 * submits its commands, which the server replays (re-deriving the AI's moves) before paying out.
 */
export const spAttempts = pgTable(
  'sp_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** story | tutorial | practice | arcade */
    mode: text('mode').notNull(),
    /** Encounter id (story), lesson id (tutorial), or "<bot>:<seat>" (practice: the bot's difficulty
     * and the player's seat), or the stage number (arcade). */
    ref: text('ref').notNull(),
    contentVersion: text('content_version').notNull(),
    engineVersion: text('engine_version').notNull(),
    config: jsonb('config').$type<MatchConfig>().notNull(),
    /** null until finished; then win | loss | draw, or void (an arcade stage the game changed under). */
    outcome: text('outcome'),
    turns: integer('turns'),
    commands: jsonb('commands').$type<{ player: number; cmd: Command }[]>(),
    /** Practice and arcade: what the finished attempt paid (its drops count toward the daily caps). */
    reward: jsonb('reward').$type<{ currency: Record<string, number>; items: string[]; xp?: unknown }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('sp_attempts_user_idx').on(t.userId)],
);

/** Achievement progress (GDD §10.5 achievements_progress). */
export const achievementProgress = pgTable(
  'achievement_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: text('achievement_id').notNull(),
    count: integer('count').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })],
);

/** Security-relevant events (GDD Phase 5 anti-abuse): logins, failures, forfeits, rate limiting. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    ip: text('ip'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_user_idx').on(t.userId), index('audit_kind_idx').on(t.kind)],
);

/** Season-end rewards paid (docs/live-ops.md §4): one row per player per season, so a close-out pays at most once. */
export const seasonRewards = pgTable(
  'season_rewards',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seasonId: text('season_id').notNull(),
    tier: text('tier').notNull(),
    /** Final display rating. */
    rating: integer('rating').notNull(),
    currency: jsonb('currency').$type<Record<string, number>>().notNull(),
    /** Item ids granted (their instances have source 'season:<id>'). */
    items: jsonb('items').$type<string[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.seasonId] })],
);

/** Player levels (docs/equipment.md §4.1): each account's total experience; the level is derived from it. */
export const playerProgress = pgTable('player_progress', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  xp: integer('xp').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Loot boxes earned on the experience bar; rolled when the player opens one. */
export const lootBoxes = pgTable(
  'loot_boxes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Loot box id in content (uncommon, rare, epic). */
    box: text('box').notNull(),
    /** What paid it: `level` (a bubble on the bar), `tutorial` (a battle lesson) or `guide` (a menu guide). */
    source: text('source').notNull().default('level'),
    /** For `level` boxes: the level and bubble that paid it. */
    level: integer('level'),
    at: smallint('at'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** null until opened; then what it held (LootRoll[] from @arena/meta). */
    openedAt: timestamp('opened_at', { withTimezone: true }),
    contents: jsonb('contents').$type<unknown[]>(),
  },
  (t) => [index('loot_boxes_user_idx').on(t.userId)],
);

/** Menu guides an account has finished, and so been paid for (economy `guideRewards`): once per guide. */
export const guideRewards = pgTable(
  'guide_rewards',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    guideId: text('guide_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.guideId] })],
);
