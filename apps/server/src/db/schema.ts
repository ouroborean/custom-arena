// PostgreSQL schema (GDD §10.5), managed with Drizzle. Migrations: `npm run db:generate -w @arena/server`.
// Item definitions live in content, never in the database (referenced by string id).

import type { CharacterSkill, Loadout, RarityId } from '@arena/meta';
import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    /** Character rolls since the last pity-eligible rarity (GDD §7.2). */
    rollsSincePity: integer('rolls_since_pity').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
    rarity: text('rarity').$type<RarityId>().notNull(),
    portraitId: text('portrait_id').notNull(),
    /** Ordered skill list; validated by @arena/meta (GDD §7.1 character_skills, kept as one document). */
    skills: jsonb('skills').$type<CharacterSkill[]>().notNull(),
    /** Equipped items by slot (instance ids from item_instances); validated by @arena/meta. */
    loadout: jsonb('loadout').$type<Loadout>().notNull().default({}),
    /** Content version the character was generated against. */
    contentVersion: text('content_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
