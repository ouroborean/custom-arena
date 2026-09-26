# Custom Arena — Formal Ruleset

**Status:** Locked for engine v0.1.0 (Phases 1–3). Source: GDD §3 plus decisions Q1–Q17 and R1–R10 (GDD §14). Element rulings are in §11+.
**Implementation:** `packages/engine`. Each rule below names the module that enforces it.
**Changing a rule:** update this document, the engine, and the matching test in the same change.

Terms in **bold** are defined in [glossary.md](glossary.md).

---

## 1. Match setup — `match.ts`

1. Two players, each fielding 1–3 characters (3 in normal play). Characters have **100 HP** (R4) and 1–5 skills.
2. Player 1 (index 0) moves first, unless the config says otherwise.
3. Each side may have at most **4 living minions** (R5). A summon beyond the cap fails, with a log entry.

## 2. Energy — `energy.ts`, `turn.ts`

1. Colors: **S**trength, **A**gility, **I**ntelligence, **W**isdom. Costs may also include **r** (random / GEN), payable with any color.
2. At the start of a player's turn they gain random-colored energy:
   - on the match's very first turn, 1 energy;
   - otherwise, 1 per living **character** (minions don't count), plus any `energyGain` modifiers.
3. Energy persists between turns with **no cap** (Q2).
4. A player's energy pool is **hidden from the opponent**, both its colors and its count (Q12).

## 3. Turn structure — `commands.ts`, `turn.ts`

A turn belongs to one player. The global turn counter increases by 1 each turn.

1. **Start:** gain energy, then fire start-of-turn triggers.
2. **Planning:** the player queues at most **one skill per unit** (characters and minions). Queueing checks, in order:
   - the unit is theirs and alive, and has nothing queued yet;
   - the skill is off cooldown and the unit can act;
   - the targets are legal;
   - the queue can still be paid for (§4).

   A queued skill can be un-queued. The queue can be reordered, and the player may order their own ticking effects.
3. **Commit** (`endTurn`): the player assigns colors to all **r** costs. The default takes from the colors with the most left over. All queued costs are paid now.
4. **Resolution:** queued skills resolve in queue order through the Use Pipeline (§6). The match ends immediately if a side is eliminated.
5. **End of turn**, in this order:
   1. The player's **ticking effects** fire (DoTs, HoTs, Renew, channel ticks, minion attacks), in their chosen order, then in application order (Q3).
   2. **Every effect on the board** has its duration reduced by 1. Effects that reach 0 expire, and their `onExpire` payloads run (Q1).
   3. This player's **cooldowns** tick down by 1 (Q15).
   4. If both players have taken **50 turns**, the match is a draw (R3).

## 4. Paying costs — `energy.ts`, `queries.ts`

1. Queued costs are payable iff, for each color, specific costs ≤ pool, and total costs ≤ total pool.
2. Cost modifiers apply at queue time. A **Focus**-style reduction lowers only the **r** part and never goes below 0. With no r cost, it reduces nothing (Q8).
3. At resolution, the cost is recomputed. If it has **increased** since queueing, the skill fails and its energy is **refunded**.

## 5. Cooldowns — `queries.ts`, `turn.ts`

1. A skill with cooldown *n* can't be used on its owner's next *n* turns. **CD 1 = unusable on the owner's following turn** (Q15).
2. Internally, using a skill sets `remaining = n + 1 + (Intimidated stacks)`. It drops by 1 at the end of each of the owner's turns, *including the turn of use*. The skill is usable at 0.
3. A **countered** skill still starts its cooldown and keeps its cost spent.
4. A skill that **fails before use** (stunned mid-resolution, dead actor, no legal target) keeps its cost spent but **starts no cooldown** (Q7, R1).

## 6. The Skill Use Pipeline — `pipeline.ts`

For each queued skill:

1. **Can act?** The actor must be alive and not blocked by a stun that covers this skill's class (**Strategic** / non-Strategic). Skills tagged UsableWhileStunned or Unstunnable skip this check. On failure: cost spent, no cooldown.
2. **Cost check:** see §4.3.
3. **Targets are re-resolved:**
   - single-target skills fail if their target died or can no longer be targeted;
   - a **Taunted** actor's enemy target is redirected to the taunter;
   - AoE skills take every currently targetable unit, and fail if there are none.
4. **Cooldown starts.** Using a skill ends the actor's other **channels** (Q6).
5. The `skillUsed` event fires. It's private to the owner for **Invisible** skills. For **HiddenTarget** skills, the targets are hidden from the opponent.
6. Effects that end "when the bearer next uses a skill" (optionally only a Harmful or a damaging one) still apply to this use, and end once it has resolved.
7. **Traps** and other on-use triggers on the actor fire. The skill continues unless the actor died.
8. If the skill is **Harmful** and not **Uncounterable**, the first **counter** or **reflect** in application order intercepts it:
   - counters on the actor (Mislead-type) or on an enemy target (Riposte-type);
   - the interceptor is revealed, and its payload runs;
   - a **Reflect** then applies the skill's effects, from the reflecting unit, to the original user (or the user's whole team, for AoE skills).
9. Otherwise, the skill's ops run in order. Triggers caused by each op resolve before the next op.

## 7. Damage — `damage.ts`

1. **Types** (Q5): Normal, Piercing and Affliction.
   - **Armor** reduces only Normal damage.
   - **Shield** absorbs Normal and Piercing damage.
   - Affliction ignores both.
2. **Direct** damage is damage dealt by a skill's use, including a Snipe's delayed hit. Triggered damage (Mark, Trap, counters) and ticking damage (DoTs, channels, minion auto-attacks) are **indirect**.
3. **Order of operations:**
   1. base amount;
   2. \+ the source's **Might**/**Weakness**, if direct;
   3. \+ the target's **Vulnerable**, if direct;
   4. − the target's **Armor**, if Normal;
   5. floor at 0;
   6. Shield absorption, oldest Shield first;
   7. HP loss.

   **Shattered** turns off steps 4 and 6 (Q10).
4. A direct hit on an enemy that can't currently be targeted deals nothing. For example, a Snipe lands on a target that became Invulnerable.
5. **Invulnerable** blocks indirect enemy damage unless it's Affliction or Bypassing (Q10). An effect flagged `respectsInvulnerable` (Fire's Explode, Q14) never hits Invulnerable targets.
6. A unit at 0 HP dies. Its effects are removed. Triggers it had already queued, such as Sanctify on a killing blow, still resolve.
7. **Win check:** a side with no living characters loses. If both sides are eliminated together, the match is a **draw** (Q9).

## 8. Effects and durations — `effects.ts`, `duration.ts`

1. **Durations** (Q1): every effect stores an integer that drops by 1 at the end of *every* turn, and it's removed at 0. Content declares intent, which the engine compiles when the effect is applied:

   | Intent | Applied on the applier's turn | Applied on the opponent's turn |
   |---|---|---|
   | `thisTurn` | 1 | 1 |
   | `enemyTurns: N` (present for N opponent turns) | 2N | 2N + 1 |
   | `ownTurns: N` (present for N more own turns) | 2N + 1 | 2N |
   | no duration / `permanent` | never expires (Q16) | never expires |

   **Authoring convention for sheet text "for N turns":** `enemyTurns: N`. The effect covers the rest of the current turn plus N turns of each side.
2. **Stacking:** each application is its own instance, and queries sum stacks across instances. `unique` effects (e.g. Mark) refresh the existing instance instead.
3. **Immune** blocks Debuffs. **Swiftness** negates the next Stun by consuming one of its stacks.
4. A newly applied stun ends any of the bearer's channels whose skill it now blocks.
5. **Hidden effects** (Q11) are visible only to the applier's side. They're revealed to both players when triggered. One that expires untriggered is announced to both players.
6. Multiple traps and counters stack on one unit, unless a skill says otherwise.
7. **Minions** count as allies and enemies for every effect. Only text that says "character" excludes them (Q13).

## 9. Randomness and determinism — `rng.ts`, `replay.ts`

1. All randomness comes from the match's seeded RNG (sfc32): energy colors, "random enemy" picks, and later Blind and random debuffs.
2. A match is fully reproduced by (engine version, content version, seed, teams, command log). CI replays recorded matches byte-for-byte.
3. The engine never reads the clock or `Math.random` (enforced by lint).

---

## 10. Interpretations made while encoding the base skills

These are rulings the sheets left open. Each is easy to change in `packages/content/data/base/skills.yaml`.

| Skill | Ruling |
|---|---|
| Strike | The Might gained has no stated duration, so it's **permanent** and stacks with each use (Q16). |
| Charge | The sheet's design note says "next action buff", so the Focus ends when the user **next uses a skill**. |
| Riposte, Mislead | Counter **every** Harmful skill during their duration, not just the first. Shadow's Riposte says "first", which implies the base one doesn't stop at one. |
| Trap | Trap X fires **once** (on the first Harmful skill) and is consumed. |
| Snipe | Fires at the **end of the following turn** (the opponent's). It can be stopped by stunning, killing, or making the target untargetable before then. The hit is direct. |
| Channel | Ticks at the end of each of the user's turns, **starting with the turn it's used**: 2 ticks, or 3 if a damaged enemy is Marked (the extension applies once). Tick damage is indirect, so it doesn't consume Marks. |
| Companion, Summon | Minion attacks are ticks at the end of the owner's turn: indirect damage to a random targetable enemy. **Wolf HP 30, Arcane Familiar HP 20** are placeholders; the sheet gives none. |
| Heal, Bless ("target ally") | "Ally" includes the user. |
| Consume | "Damage dealt" counts damage absorbed by Shield. The Mark/Curse bonus is checked before the hit consumes the Mark. |
| Cleave | The second random enemy is never the primary target. |
| Prayer | Its 10 Shield has no stated duration, so it's permanent until depleted. |

---

## 11. Fire

Content: `packages/content/data/fire/`. Statuses: **Ignite**, **Scorched**, **Flameborn**. Action: **Explode**.

### 11.1 Mechanics

| Term | Ruling |
|---|---|
| **Ignite** | 5 Affliction damage at the end of the applier's turn. One per unit: re-applying refreshes it, and the newest applier becomes its source. There's no stated duration, so it lasts until something removes it (Q16). |
| **Scorched** | Healing received ×0.5, rounded up to a multiple of 5. One per unit. It's permanent unless a skill states a duration. |
| **Flameborn** | One per unit. The bearer heals for the damage their own Ignites deal. They also heal 10 whenever **their side** causes an Explosion. |
| **Explode** | 10 Affliction damage to every enemy of whoever caused it (the skill user, trap setter or channeler). It's indirect damage, and Invulnerable targets are skipped (Q14). Each qualifying target causes its own Explosion, so Chain Detonation, Blastwave and Flamethrower can set off several at once. |

### 11.2 Skill rulings

| Skill | Ruling |
|---|---|
| Hot Foot | The +2 Might applies to the user's next damaging (non-Strategic) skill, then ends. Strategic skills don't use it up. |
| Blisterblade | Counters every Harmful skill for the turn. An attacker who is already Ignited is Scorched instead. |
| Flickerflare | If the target was already Ignited, one random *other* enemy is also Ignited. |
| Heat Seeker | Deals 40 direct damage at the end of the following turn, then Scorches the target permanently. |
| Hidden Explosives, Heat Haze | Each fires once. Heat Haze triggers on **any** skill; Hidden Explosives only on Harmful ones. |
| Dragon Hatchling | HP 30 (placeholder). Its owner's Flameborn is an aura that ends when the Hatchling leaves the board. Its attack Ignites the enemy it hit; that Ignite starts ticking on the owner's next turn. |
| Cinderlings | HP 10 each (placeholder). Both count toward the 4-minion cap. |
| Flashbang | Applies **Stunned (non-Strategic)**, a base status that Swiftness also negates. |
| Ivory Step | Tagged Helpful/Strategic (self-targeted), so it can't be countered. |
| Ashen Barrier, Wraith in White | Count every active Ignite / Scorched on the board. Ashen Barrier's Shield has no stated duration, so it lasts until depleted. |
| Ring of Fire | A Harmful skill during the Taunt Ignites the bearer. If they use none, they're Scorched for 2 of their turns when the Taunt ends. |

### 11.3 Balance notes (greedy-bot simulation, 3,000 matches)

- Fire characters win about 51% of games, and characters with no element about 49%.
- **Flickerflare** won about 76% of the games it appeared in, the clear outlier. For 1 random energy with no cooldown, it added Ignite to Shot's damage and spread Ignite on re-cast. Giving Ignite a 3-turn duration barely changed this (about 75%).
- **Change (2026-09-26):** Flickerflare's cooldown went from 0 to 1. Re-simulated over 2,000 matches, it wins about 71%. That's still the top Fire skill, so it's worth revisiting (cost color, or spreading only onto un-Ignited enemies).

---

## 12. Poison

Content: `packages/content/data/poison/`. Statuses: **Toxin**, **Prey (marked)**. Condition: **prey**.

### 12.1 Mechanics

| Term | Ruling |
|---|---|
| **Toxin** | 5 Affliction damage per stack at the end of the applier's turn. Toxin from the same side merges into one stack count on the bearer. It's permanent until removed (Q16). |
| **Prey** | A **derived** state, not a status. A unit is Prey if it has more than 2 total stacks of Toxin, Weakness, Vulnerable and Confusion, **or** is below 20 HP, **or** is marked as Prey (Lunge, Mesmerizing Glare). It's defined once in `conditions.poison.yaml`, and the client shows a PREY tag on the portrait. |
| **Stances** (Viper, Cobra, Constrictor) | Convert **every** instance in the battle, including the user's own team's. Each converted effect keeps its stacks and remaining duration. The new debuff counts as applied by the user, so Immune blocks it. |

### 12.2 Skill rulings

| Skill | Ruling |
|---|---|
| Lunge | All enemies are marked Prey through the user's next turn. |
| Shed Skin | Triggers on the first direct hit only. The 3 Renew then decays normally. |
| Sting | The Toxin, Weakness or Vulnerable is picked uniformly at random. |
| Snake Pit | Triggers on **every** Strategic skill the target uses during the 3 turns. |
| Slither | Unstunnable. Its Focus has no stated duration, so it's **permanent** (Q16). |
| Unstated durations | Also permanent: Sting's debuff, Acid Orb's Mark and Vulnerable, Swamp Toxins' Confusion, Numbing Needle's debuffs, and Coil's Shield and Armor. |
| Devour | Kills characters at 14 HP or less and minions at 29 or less (the sheet says "less than 15", doubled for minions). Tagged Strategic, since it deals no damage. |
| Emerald Asp | Its skills are Serpent Fang (r, no cooldown) and Constrict (rr, no cooldown). The sheet gives no cooldowns. |
| Spriggan Harasser | Its Sting costs W, with a cooldown of 1 (Sting's own). |
| Nine Plagues | Channels for 9 of the user's turns. Using another skill with that character ends it. |
| Pounce | The random energy is added immediately, so it's usable next turn. |
| Envenom | Bypasses Invulnerable. The Prey / Invulnerable check happens before the hit. |
| Preymark | Triggers on direct damage from the applier's side, including the user. |
| Tail Lash | Its cooldown resets if any enemy it hit is Prey after the hit. |
| Moonglove Mixture | Targets **any** unit. It's tagged Helpful, so counters don't catch it even when used on an enemy. |
| Bad Stomach, Stances | Have no target, and are tagged Harmful/Strategic. |

### 12.3 Balance notes (greedy-bot simulation, 3,000 matches, elements None/Fire/Poison)

- By character element: Fire 50.0%, None 49.9%, Poison 49.5%.
- Highest Poison skills: Plague Stomp about 66%, Viper Strike about 63% (Flickerflare, after its cooldown change, about 67%).
- Lowest Poison skills: Pounce, Slither, Mesmerizing Glare, Tail Lash, Lacerate, Shed Skin and Coil, at 43–45%.
- **Watch:** Slither's permanent Focus, and permanent Weakness/Vulnerable from Sting and Numbing Needle. These stack up over long matches; permanent debuffs also make Prey easy to trigger.

