# Meta game: characters, equipment and the API

Everything outside a battle (GDD §7–9, Phase 4). The rules live in `packages/meta` (pure, shared by
the server and the client); the server (`apps/server`) stores and validates; the client
(`apps/client`) edits. Numbers here are first-pass tuning (R10).

## 1. Characters

A character record holds a name, class, base element, rarity, portrait id and an ordered skill list.
Each skill has a base id, an optional infusion (element), a source (`native` or `equipment`) and a
`locked` flag for default infusions (R8: they stay on the skill they were rolled on).

### 1.1 Rolling (`rollCharacter`)

| Step | Rule |
|---|---|
| Rarity | Weighted: Common 50, Uncommon 28, Rare 14, Epic 6, Legendary 2. **Pity:** after 29 rolls in a row below Epic, the 30th is at least Epic. |
| Class | Weighted towards classes the player owns fewer of: weight ∝ 1 / (1 + owned). |
| Base element | Uniform over the 10 elements. Cosmetic plus default infusions (R8). |
| Native skills | At least 2 of the class's 3 signatures; the rest from its 6-skill pool (R9). |
| Default infusions | A uniform count in the rarity's range; those skills get the base element, locked. |
| Name / portrait | "<element epithet> <class title>" (e.g. *Brook Blademaster*); portrait id `<class>.<element>.01`. |

### 1.2 Rarity table

| Rarity | Native skills | Default infusions | Budget: skills / passives |
|---|---|---|---|
| Common | 3 | 1 | 1 / 1 |
| Uncommon | 3 | 1–2 | 2 / 1 |
| Rare | 4 | 1–2 | 2 / 2 |
| Epic | 4 | 2–3 | 3 / 2 |
| Legendary | 5 | 2–3 | 3 / 2 |

Every rarity has the same four equipment slots (§2.1).

The budget caps how many **equipment-granted** skills (prepared ones, §2.2) and item passives a
character can use at once, regardless of which pieces supply them (the sheet's "3 skills 2 passives" note, GDD §8.2). Infusions
have no budget (GDD §7.3, decided 2026-09-27).

## 2. Equipment

Equipment is **modular** (`docs/equipment.md` §6). `packages/content/data/items/items.yaml` holds
**160 components**: 30 Skills, 10 Shards and 120 Sigils. A **piece** is one component or up to three
forged together, and it grants everything its components do: skills, infusions and a passive (GDD
§8.1). The 260 static items from the *Structured Equipment* sheet were retired on 2026-10-02 and
became the pieces of their parts.

> **Passives are live.** A Sigil's `passiveEffect` names the status that implements it, and the
> engine applies it permanently at match start (`CharacterSpec.passives`). All 120 passives are
> implemented; the rulings for ambiguous wording are in `docs/equipment.md`.

### 2.1 Slots

A character has **four equipment slots** (`EQUIPMENT_SLOTS`), and **any piece fits any slot**
(GDD §8.3, decided 2026-09-27). A loadout is up to four equipped pieces plus where their infusions
go: `{ items: [{ itemId, instanceId }, …], infusions: [{ skill, element }, …] }` (§2.2). The
`itemId` is a piece id (component ids joined with `+`). What limits a loadout is the rarity budget, the 5-skill
cap, the infusion rules (§2.2) and each owned copy being on
one character at a time.

Loadouts saved with the earlier typed slots (main hand, off hand, two-handed, body, accessories,
sockets) were converted by migration 0006: items keep that order, and any past the fourth were
unequipped (they stay in the inventory).

**Equipping in the client** (`LoadoutEditor`): the four slots sit above a grid of the items the
player owns (one tile per piece, with a count of free copies), filtered by search, kind (forged,
skills, shards, sigils), element and "only what fits".
- **Hover card:** hovering or focusing a tile shows what the item grants (skill, infusions, passive and
  its in-play wording), how many copies are owned and where, and whether it fits, or which rules
  equipping it would break.
- **Equipping:** clicking a tile equips it in the next free slot. To replace an item, select its slot
  first; × removes an item.
- **Infusions panel:** between the slots and the grid, the pool (each element with how many are
  placed) and every skill of the character. A skill shows its locked native infusion, the infusions
  placed on it (× takes one off), buttons to place one of each pool element that has a version of the
  skill (hover to preview the resulting skill), and its second, Hybrid socket (closed for now).
  Removing an item takes off the infusions it supplied, and those on the skill it granted.
- **Skills panel:** above the infusions, the skills the equipment grants. Prepared ones (✓) are in the
  character's skill list; the rest wait in the pool (+ prepares one when the 5-skill cap and the skill
  budget allow it). Equipping a piece prepares its new skills while they fit.

### 2.2 Grants and resolution (`resolveLoadout`)

- **Skills (the skill pool, decided 2026-10-02):** the skills the equipped pieces grant that the
  character lacks natively go into a **pool** (`skillPool`); the loadout's `skills` list says which are
  **prepared**. Only prepared skills join the character's skills and go into battle, so a character at
  four skills can wear a piece with two skills and an infusion, preparing one of them.
  - The **5-skill cap** and the rarity's **skill budget** count prepared skills only.
  - Unprepared skills (`unprepared`) do nothing: they can't take infusions, and unpreparing a skill
    takes its infusions off (`unprepareSkill`).
  - Preparing a skill no piece grants, or one the character already has, is reported.
  - `withItem` prepares a new piece's skills while they fit (`canPrepare`); `withoutItem` and
    `pruneInfusions` drop prepared skills whose piece is gone.
  - Loadouts saved before the pool have no `skills` list: every granted skill is prepared, as before.
- **Infusions (GDD §7.3):**
  - **The pool:** each equipped item adds its elements to the character's infusion pool
    (`infusionPool`), and the loadout's `infusions` list says which skill each one goes on. Nothing is
    applied automatically, not even onto a skill the same item grants, and unplaced infusions do nothing.
  - **Native infusions** stay locked on the skills they were rolled on.
  - **Two per skill:** a skill holds up to `MAX_INFUSIONS_PER_SKILL` (2) infusions, counting a native
    one. Two make the pair's fusion element (content `fusions`, `data/elements/fusions.yaml`: 55, one
    per unordered pair, one element twice included; `fusionOf` looks one up in either order).
    `infusedElement` gives the element a skill ends up with, and `infusedSkillId` the skill it becomes.
    Every skill has a version for every fusion (`strike.dragon`, …, from the fusion kits), so a
    second infusion turns the skill into its fusion version: Ice + Wind make Smash into Winter's.
  - **Problems:** placing more of an element than the pool has, or on a skill the character doesn't
    have, is reported. `pruneInfusions` drops such placements when items change (`withItem`,
    `withoutItem`).
  - **Saved data:** migration 0007 removed the old per-item targets, so loadouts saved before the pool
    start with nothing placed.
- **Budgets** per the rarity table (skills and passives; infusions have none); every problem is listed,
  not just the first.
- A loadout is validated when saved and again when the team becomes engine input (a loadout that
  became invalid blocks the match with a 409 listing the problems).

### 2.3 Acquisition

New accounts get:
- **Three characters:** rolled for free, and made the active team.
- **A starter kit:** a Shard, a Skill, and another Skill forged with a Shard.
- **300 Gold.**

After that:
- **Rolling costs Gold,** up to 60 characters.
- **Components** come from casual and ranked match drops; story chapters, encounters and
  achievements also grant forged pieces.
- **Forging** combines unequipped pieces into one, and **splitting** takes one apart
  (`docs/equipment.md` §6).
- **Salvage** turns unequipped pieces back into Gold.

The rules and numbers are in `docs/equipment.md` §4. Development servers also expose
`POST /api/dev/grant`.

### 2.4 Data decisions

- Typos fixed: *Sacrificial Dagger*, *Ricochet Rifle*, *Frostblood Mallet*; "Bolster" → Bless,
  "Guardian" → Paladin (GDD §14.2).
- Two different items were both named **Book of the Damned** (type A, Prayer; and a two-skill
  type J, Curse/Ravage). The J item is renamed **Tome of the Damned**.
- *Emblem of the Aurora*'s passive listed Stormborn twice; the duplicate is dropped.
- Items the sheet left unnamed keep the GDD's placeholder names (`placeholder: true`).

## 3. API (`apps/server`)

Fastify + Drizzle. PGlite (embedded Postgres) by default, PostgreSQL via `DATABASE_URL`.
Sessions: random tokens in an httpOnly `arena_session` cookie; the database stores their SHA-256.
Passwords: Argon2id.

| Method | Path | |
|---|---|---|
| GET | `/api/health` | Engine and content versions |
| GET | `/api/content`, `/api/content/:version` | Current content version; the bundle (immutable) |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Accounts and sessions |
| GET | `/api/me` | Current user and pity counter |
| GET, POST | `/api/characters`, `/api/characters/roll` | Roster; roll a character (costs Gold) |
| GET, PATCH, DELETE | `/api/characters/:id` | Detail (with validation and resolved loadout), rename, retire |
| GET, PUT | `/api/teams/active` | Active team (3 characters, in battle order) |
| GET | `/api/teams/active/specs` | The team as engine input, equipment included |
| GET | `/api/inventory` | Owned item instances and where they're equipped |
| GET, PUT | `/api/characters/:id/loadout` | Loadout and its resolution; save (400 lists problems) |
| GET, POST | `/api/characters/:id/presets` | Loadout presets |
| POST, DELETE | `/api/characters/:id/presets/:presetId(/apply)` | Apply or delete a preset |
| GET | `/api/wallet` | Currency balances (docs/equipment.md §4) |
| POST | `/api/forge` | Forge an unequipped addition onto an unequipped base |
| POST | `/api/inventory/:id/split` | Split an unequipped forged piece into its components |
| POST | `/api/inventory/:id/salvage` | Salvage an unequipped piece for Gold |
| GET | `/api/story` | Story and tutorial chapters: unlocks and clears (docs/single-player.md) |
| POST | `/api/story/:id/start` | A verified attempt: teams and seed |
| POST | `/api/story/attempts/:id/finish` | Submit the commands; the server replays them and pays out |
| GET | `/api/achievements` | Achievement progress |
| POST | `/api/dev/grant` | Development only: add an item to the inventory |
| GET | `/api/matches`, `/api/matches/:id/replay` | Match history; replay records (see docs/multiplayer.md) |
| GET | `/api/ratings` | The running ranked season, rating, placement and tier, last season reward, and casual record |
| GET (WebSocket) | `/api/ws` | The match service (docs/multiplayer.md) |

Schema: `apps/server/src/db/schema.ts`; migrations in `src/db/migrations`
(`npm run db:generate -w @arena/server` after schema changes).

## 4. Client

Sign in or register → **Home** (active team, practice vs bot, roster, inventory) → **character page**
(rename, retire, loadout editor with live validation, presets). Practice uses the server-validated
team against a generated bot team. The **Sandbox** is the original setup screen (any generated
teams, hotseat, watch bots) and works without the server.
