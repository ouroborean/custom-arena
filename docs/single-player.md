# Single-player (Phase 6)

This document covers:
- bot difficulty tiers (§1);
- scripted encounters (§2);
- the story, with its verified rewards (§3);
- achievements (§4);
- the tutorial (§5);
- tools (§6) and what's left (§7).

The GDD sections are §2.2 (modes), §8.4 (acquisition) and §11.9 (AI).

## 1. Bot difficulty

Bots plan from a `PlayerView` only, never the full state (GDD §11.9). The tiers live in
`packages/ai/src/search.ts`.

| Tier | How it plays | Use |
|---|---|---|
| **Easy** | Random legal actions, weighted by a quick damage score; stops early now and then | Tutorial, early story |
| **Normal** | Builds its queue one action at a time, simulating the whole turn for every legal option and scoring the result | Default |
| **Hard** | Takes Normal's top first actions (alone, and grown into full plans) and plays each one round deep against the opponent's reply | Late story, practice |

### How the search works
- **Determinization:** what a bot can't see is guessed, never read from the real state:
  - the opponent's banked energy: 0–1 per living character, since players spend most of theirs;
  - hidden effects are left out;
  - the random stream is fresh.
- **Hard's reply:** Hard plans the opponent's reply from the opponent's own view, so the simulated
  opponent walks into Hard's hidden Traps and counters as a real one would. Every candidate plan
  faces the same guessed worlds (common random numbers).
- **Evaluation** (`evaluate`, weights in `EvalWeights`) counts:
  - living characters and their Health;
  - minions, Shields and statuses (with stuns weighted up);
  - delayed and ticking damage the bot has set up, at a discount;
  - banked energy.

### Measurements
| Matchup | Result |
|---|---|
| Normal vs Greedy (Phase 1 bot) | 26/30 |
| Normal vs Greedy (other seeds) | 64/100 |
| Hard vs Greedy (same seeds) | 72/100 |
| Hard vs Normal, head to head | about even (27–30 of 60 across settings) |
| Easy vs Random | about even |

### Why Hard isn't stronger head to head
Diagnostics run while building Hard (40 games each against Normal):
- **True state:** a look-ahead that cheats, knowing the true state including the random stream,
  beats Normal 72%.
- **Guessed world instead:** the same look-ahead on a guessed world wins 57%.
- **Guessed world plus the opponent's true energy:** 55%.
- **Conclusion:** the edge comes from knowing future randomness (energy colors, random targets),
  which no fair bot can have.
- **Evaluation weights:** a sweep of the weights found nothing clearly better. Tuning the
  evaluation, or a real multi-rollout search, is the next lever.

Story difficulty mostly comes from encounter design (§2) rather than from Hard.

## 2. Encounters

Encounters live in `encounters*.yaml` files and use `EncounterDef` in `packages/engine/src/defs.ts`.

### Enemies
- An encounter has 1–3 enemy units.
- **Kits:** each unit gives a class and an element. Without `skills`, its kit is the class's
  signatures, then affinity skills, up to `skillCount` (default 4). Each is infused with the
  element where a variant exists.
- **Other fields:** `hp` and `passives` (statuses for the whole match, e.g. boss traits in
  `story/statuses.bosses.yaml`).

### AI
- `ai.tier` picks the difficulty.
- `ai.script` rules take priority. Each rule's `when` (own `turn`, `every` N turns, `from` turn,
  `hpAtMost`) queues `unit`'s `skill`. A skill may be given by its base id, which matches the
  unit's elemental variant.
- The rule's `target` is `lowestHp`, `highestHp`, `self`, `weakestAlly` or a player-unit index.
- The tier then plans the rest of the turn.

### Match setup
- `playerTeam` gives a fixed team (the tutorial); otherwise the player brings their active team.
- `first` says who moves first, and `settings` overrides match settings (e.g. `fixedEnergy`).

### Rewards
`rewards.first` is paid on the first clear, `rewards.repeat` afterwards. Grants are
`{ currency, items, rolls }`.

In a single-player match the human always sits in seat 0. The AI's seed is `singlePlayerBotSeed(seed)`,
shared by client and server.

## 3. Story

### Content
There are ten element chapters in `story/story.chapters.yaml`. Each has three encounters:
1. **A skirmish:** Easy AI, two enemies.
2. **A battle:** three enemies. Easy AI through Chapter 3, Normal after.
3. **A boss** with a trait and a short script:
   - **AI:** Easy for Chapters 1–2, Normal for 3–8, Hard for 9–10.
   - **Health:** 95 for the first boss, rising to 150–170 later.

### Rewards and unlocks
| What | Pays |
|---|---|
| Skirmish, first clear | 50 Gold (10 on repeats) |
| Battle, first clear | 80 Gold and the element's Shard (15 on repeats) |
| Boss, first clear | 150 Gold and one of the element's accessories (25 on repeats) |
| Finishing a chapter | 100 Gold and the element's emblem: its Crystal forged with the emblem's Sigil (*Dragon Crystal of the Inferno*) |

Encounters unlock in order, and a chapter opens when the one before it is complete.

### Difficulty curve
`npm run sim -- --story` measures a Normal bot with random, unequipped teams playing each
encounter. It stands in for a decent player. First pass:

- Skirmishes: 100%.
- Battles: 25–100%.
- Bosses: mostly 35–55%. The outliers are the Mire Queen (95%, Chapter 2) and the Storm Herald
  (15%, Chapter 7).
- The finale (the Mountain Heart): 35%.

Tuning is deferred.

### Verified rewards
Story matches run in the browser. To keep rewards honest, the server checks every result:
1. **Start:** `POST /api/story/:id/start` checks the encounter is unlocked, fixes the teams, and
   issues a seed. It returns `{ attemptId, config }`.
2. **Play:** the client plays locally. The encounter's AI is seeded with `singlePlayerBotSeed`.
3. **Finish:** `POST /api/story/attempts/:id/finish` receives the commands. The server replays your
   commands through the engine and re-derives every AI move from the same seeded bot, so only its
   own result counts.
4. **Refusals:** resubmissions, unfinished or tampered replays, and attempts that span a content
   update are refused.
5. **On a win:**
   - progress is recorded (`story_progress`);
   - the first-clear or repeat reward is paid;
   - the chapter reward is paid once (`story_chapters`).

Achievements count every finished attempt.

The client can still seed-scum locally (retrying plans against a known seed), much like save
scumming. Each new attempt gets a new seed.

## 4. Achievements

Achievements are defined in `story/achievements.yaml`. Each one counts finished matches that match
`when`:
- `outcome`;
- `modes` (casual, ranked, story, tutorial);
- `withClass` and `withElement` (on the player's team);
- `encounter`, `chapter`, `maxTurns`.

It completes at `count`. With `streak`, the matches must be in a row: a non-counting match of the
same modes resets it. The reward is paid once.

There are 17:
- First Victory, Arena Debut, On a Roll (3 online wins in a row), Contender (10 ranked wins).
- Quick Work (a win by turn 16).
- Two story bosses.
- 10 wins with each class, each paying one of that class's armors.

Which matches count:
- **Story and tutorial:** every finished attempt.
- **Casual and ranked:** matches that meet the reward rules' minimum length (the same
  anti-farming rule as match rewards). Private matches never count.
- **At most once:** each match is counted once.

Completed achievements appear in `match.end.achievements` and in story results.

## 5. Tutorial

### Content
The tutorial has three lessons in `tutorial/`:
1. **Energy and skills:** Strike, Smash and the queue, random costs, cooldowns.
2. **Statuses and counters:** Focus, Bless, and an Invisible Riposte that the enemy is scripted to
   walk into.
3. **Elements:** Fire's Ignite and explosions.

The lessons are encounters in the `tutorial` chapter, so they share the story's unlocks, rewards and
verification. Finishing all three pays a free character and a Dragon Crystal (two Fire Shards).

### How lessons are driven
- **Forcing energy:** `settings.fixedEnergy` fixes the player's energy gain on their first turns
  ("force this hand"). It is part of the config, so replays still verify.
- **Coach scripts** (`tutorial.lessons.yaml`): each step has:
  - text;
  - an optional highlight: `energy`, `endTurn`, `queue`, `enemies`, `log`, `{ skill }` or
    `{ unit }`;
  - an optional `expect`: queue a skill (optionally on a unit), or end the turn.
- **The coach in battle:** the client shows the step and highlights its target. It refuses commands
  the step doesn't ask for (e.g. "Use Strike for now."), and a matching command moves it on. Steps
  without an `expect` wait for "Got it". After the last step, the player plays freely.
- **Tests:** a test follows every script against its lesson's AI with forced energy (three seeds),
  so a content change that breaks a lesson fails CI.

## 5a. Arcade

The arcade is the single-player way to earn items. It is a ladder of bot teams that grow on a fixed
curve, defined in `economy/economy.arcade.yaml`. Your active team climbs it one stage at a time.

### The curve

Each stage sets the enemies' kit shape:
- `skills`: skill count, with the class's starter skill first.
- `infusions`: infusions in total.
- `doubles`: skills with two infusions, i.e. a fusion element.
- `cohesion`: the chance that a single infusion is the enemy's own element.
- `overlap`: how the three enemies' elements relate.
- `bot`: the bot tier.

| Stages | Skills / infusions | Elements | Bot |
|---|---|---|---|
| 1–2 | 2 → 3 skills, no infusions | none | Easy |
| 3–6 | Skills and infusions grow in turn, up to 5 / 2 | Random, then half cohesive | Easy → Normal |
| 7 | 5 / 3 | Cohesive: one element per enemy | Normal |
| 8–9 | 5 / 4–5, one double skill | Each enemy has two elements: its own, plus a second for its double | Hard |
| 10–11 | 5 / 6–7, two doubles | **Partial overlap:** each enemy's second element is the next enemy's first | Hard |
| 12 | 5 / 8, three doubles | **Full overlap:** all three share both elements | Hard |

Enemies are always three different classes. Stage 1 is three 2-skill enemies with no infusions.

### Runs

- A win moves the run to the next stage.
- A loss or a draw ends the run, and the next one starts at stage 1.
- Clearing stage 12 completes the ladder and pays the `complete` bonus; the next run starts over.
- You always move first.

The server issues and verifies stages the same way as story attempts (`POST /api/arcade/start`,
`POST /api/arcade/attempts/:id/finish`; `GET /api/arcade` reports the run). If a stage is left
unfinished, it is issued again: same seed, same enemies, same team. Leaving a match therefore can't
reroll an easier team. A stage issued before a content or engine update is voided: it doesn't count
either way, and the run goes on.

### Rewards

Practice pays half the casual drop chance and nothing below 8 turns. The arcade has neither of those
penalties: every cleared stage pays its `win` reward in full.
- Gold rises from 15 to 80 per stage.
- Every stage drops 1 item; stages 8–12 drop 2.
- A played-out loss or a draw pays 15 Gold. A surrender pays nothing.
- Arcade drops have their **own daily cap** (15), separate from the match cap of 10.

## 6. Tools

- `npm run sim -- --bots normal,hard --games 200`: tier duels.
- `npm run sim -- --story --games 20`: the story difficulty curve.
- `npm run sim -- --equip --games 2000`: equipped teams (docs/equipment.md §5).

## 7. Not built yet

- **Hard bot:** a Hard tier that beats Normal head to head (§1).
- **Story tuning:** story balance, especially the two outlier bosses.
- **More lessons:** one tutorial lesson per element (the GDD's "one element at a time"); there is
  one Fire lesson now.
- **Unlock predicates:** the GDD's story-driven unlocks of C/E/F/J equipment are superseded by the
  item rewards above (GDD §8.4 ignores the sheet's unlock conditions).
