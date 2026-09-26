# Custom Arena — Game Design Document

**Version:** 0.5 (expanded from the design sheets: *Skills*, the 10 element sheets, and *Structured Equipment*)
**Date:** 2026-09-25
**Status:** Draft. v0.2 and v0.3 fold in the designer's answers to the rules questions. Section 14 is now a decision log plus the few remaining open items.

---

## Table of contents

1. Vision and pillars
2. Core loop and game modes
3. Battle rules (the formal ruleset)
4. Skill taxonomy and keywords
5. Status effects (buffs and debuffs)
6. Classes, base skills, and elements
7. Characters: generation, rarity, and customization
8. Equipment system
9. Out-of-game flow and UX
10. Technical architecture: recommendation
11. The rules engine: how the game logic should be structured
12. Content pipeline and tooling
13. Implementation roadmap
14. Decision log and remaining open items
15. Appendix: equipment data (infusions recovered from the colored cells, placeholder names)

---

## 1. Vision and pillars

Custom Arena is a 3v3, simultaneous-planning, sequential-resolution tactics game. It sits in the same family as *Naruto-Arena*: colored energy, "random" wildcard costs, queued skills, invisible effects, counters. Its hook is **combinatorial customization**. A character is a *class* (a skill kit), and each skill can be transformed by one of ten *elements*. Equipment then layers passives, extra skills, and more infusions on top.

**Design pillars**

| Pillar | What it means for design and engineering |
|---|---|
| **Readable depth** | Every interaction must be explainable from tooltips. Keywords are precise, and a battle log records every modifier applied. |
| **Build expression** | The 30 skills × 11 forms (base + 10 elements) = 330 skill variants, plus equipment. A player's roster should feel owned. |
| **Mind games over reflexes** | Hidden information (Invisible skills, Traps, Counters, Stealth) and energy bluffing are core. The server must truly hide what the opponent can't see. |
| **Data-driven everything** | New elements, skills, statuses, equipment, and classes are content, not code. Designers ship balance changes without redeploying the engine. |
| **Deterministic and replayable** | Seeded RNG and a pure rules engine. Every match can be replayed, simulated, and audited. |

---

## 2. Core loop and game modes

### 2.1 Loops

```
Micro (one turn):  gain energy → plan queue → reorder & allocate random energy → resolve → react
Match (~10–25 turns): outlast the enemy team of 3; manage cooldowns, statuses, minions, hidden threats
Meta (sessions):   play → earn crystals/equipment → customize characters → build teams → climb ladder
```

### 2.2 Modes

| Mode | Opponent | Rewards | Notes |
|---|---|---|---|
| **Tutorial** | Scripted CPU | Starter characters and crystals | Teaches energy, queueing, cooldowns, one element at a time |
| **Story / Single-player** | Scripted and AI CPU encounters | Equipment, crystals, shards | Chapters themed by element; unlocks C/E/F/J-type equipment requirements |
| **Practice / Bot** | AI at selectable difficulty | Small or none | Also the balance simulator's harness |
| **Casual multiplayer** | Human, matchmade | Standard | Unranked MMR |
| **Ranked multiplayer** | Human, matchmade | Seasonal | Glicko-2 rating, turn timer, disconnect penalties |
| **Private match** | Friend via code | None | Optional custom rules (no timer, fixed seeds) |

---

## 3. Battle rules (formal ruleset)

This section turns the prose rules into an unambiguous spec. Items marked **[DECIDED]** come from the designer's answers (§14.1). Items marked **[PROPOSED]** were engineering defaults. As of v0.4 they are all confirmed.

### 3.1 Board

- Two sides, each with **3 characters**, plus any number of **minions** (a cap is proposed below).
- Each character has **100 HP** **[PROPOSED]**. Many thresholds imply a 100-HP scale: "at or below 60 Health", "above 75 health", "at or above 80".
- Minions have their own HP (defined per minion), skills, and cooldowns. They **do not generate energy**. They pay skill costs from their owner's pool.
- **Minions count as "allies" and "enemies"** for every effect, and can be targeted by all effect types. Only text that says **"character"** excludes them. **[DECIDED]** Examples: base Heal can target a minion; "allied hero is killed" (Unholy/Unholy) and "each character they have that is still alive" (energy generation) exclude minions.
- **Minion cap [PROPOSED]:** 4 minions per side. Summoning beyond the cap fails and refunds nothing; the UI warns before queueing. The cap keeps the UI layout bounded; Earth's Worldcaller can create 4 on its own.

### 3.2 Energy

- Five cost symbols: **S** (Strength), **A** (Agility), **I** (Intelligence), **W** (Wisdom), **r** (random / GEN: payable by any color).
- Special cost tokens from the sheets: `nc` = no cost; `G` appears once (Holy Riposte) and is presumably GEN = r.
- **Generation (start of a player's turn):**
  - Player 1's very first turn: +1 random-colored energy.
  - Every other turn: +1 random-colored energy per **living character** (not minions).
  - Modifiers: **Charged** (3 stacks → +1 next turn), **Sapped** (3 stacks → −1 next turn), Poison *Pounce* (+1 random), Unholy equipment (+1 on kill), and so on.
- **The pool persists between turns with no cap.** Energy can be banked freely. **[DECIDED]** Watch for stalling in the balance simulator. The turn timer and the draw rule are the backstops.
- **The opponent's energy pool is hidden.** **[DECIDED]** Players see neither its colors nor its count. Spend is visible only indirectly, through the skills that resolve.
- **Energy exchange [PROPOSED, optional]:** trade 5 energy of any colors for 1 of a chosen color, once per turn. This softens color screw. Decide during balance testing.

### 3.3 Turn structure

```
TURN START (active player P)
  1. Start-of-turn phase
     a. Energy generation
     b. Start-of-turn triggers (e.g., Wind Rush grants, Monk passive)
  2. Planning phase (interactive, timed in multiplayer)
     - P queues skills: pick actor → pick skill → pick target(s)
     - Costs are *reserved* at queue time (see 3.4); the skill can be un-queued freely
  3. Commit phase
     - P reorders the queue (skills AND their own ongoing ticking effects)
     - P assigns concrete colors to each reserved "r" cost
     - P confirms
  4. Resolution phase (automatic)
     - Queue items resolve strictly in the chosen order
     - Each skill passes through the Use Pipeline (3.6)
     - After each item: death checks, trigger resolution
  5. End-of-turn phase
     a. Ticking effects that P applied (DoTs, HoTs, Renew, Channel ticks) fire,
        in the order P set in the commit phase                        [DECIDED: ticks at end of applier's turn]
     b. Death checks and triggers
     c. EVERY effect on the board (both sides) has its duration decremented by 1;
        effects that reach 0 are removed (untriggered Invisible effects show an "expired" tooltip)
     d. Cooldowns of P's units decrement [see 3.5]
TURN PASSES to the opponent
```

**Win condition:** all opponent **characters** are dead at any check (minions don't count). If both teams die in the same resolution (e.g., reflected damage), the match is a **draw**. **[DECIDED]**

### 3.4 Energy reservation (the "promised random" tracker)

Reservation must stay provably payable at every step. Because **r** is a pure wildcard, feasibility has a simple closed form:

```
Let pool[c] for c ∈ {S,A,I,W}; specific[c] = sum of reserved specific costs; R = sum of reserved r costs.
Queue is payable  ⇔  ∀c: specific[c] ≤ pool[c]   AND   Σ specific[c] + R ≤ Σ pool[c]
```

- Queueing a skill = tentatively adding its (modified) cost and re-checking the inequality. There's no search and no backtracking.
- "No energy left" is shown when `Σ pool − Σ specific − R == 0` or no remaining skill is affordable.
- Commit-phase color assignment is a free choice subject to `pool[c] − specific[c] ≥ assigned_r[c]`. The UI can default to "spend the most plentiful colors first".
- **Cost modifiers** (Focus −1 GEN, Confusion +1 GEN, Chilled "cannot be reduced", Wind *Falling Slam* −1 GEN, Earth *Worldquake*, Lightning *Zap* swapping I → r) are applied **at queue time** and re-validated at resolution. If a cost has *increased* by resolution time (e.g., Confusion applied by an earlier queued Mislead trigger), the skill **fails and is refunded** **[PROPOSED]**. The alternative, charging whatever is available, feels bad.
- "Reduce by 1 GEN" reduces only an **r** cost. If the skill has no r cost, it reduces nothing. **[DECIDED]**

### 3.5 Cooldowns

- A skill with CD *n* can't be used on the owner's next *n* turns. **CD 1 = unusable on the owner's following turn**, usable on the one after. **[DECIDED]**
- Cooldowns tick **only on the owner's turns**, unlike effect durations, which tick every turn. **[DECIDED]**
- **Implementation:** on use, set `remaining = n + 1` (plus Intimidated stacks), and decrement at the end of every owner turn, *including the turn of use*. The skill is usable when `remaining == 0`, and the UI displays `remaining`.

  | CD 1 skill used on own turn T | End of T | Opponent's turn | Own turn T+2 | End of T+2 | Own turn T+4 |
  |---|---|---|---|---|---|
  | `remaining` | 2 → 1 | shows 1 | 1 (locked) | 1 → 0 | 0 (usable) |

  CD 0 skills set `remaining = 1`, which reaches 0 at the end of the same turn. So they're usable every turn but can't be used twice in one turn. Effects like "reduce remaining cooldown by 1" act on `remaining` (floor 0). "Reset cooldown" sets it to 0.
- The cooldown starts when the skill is **used**, including when it's **countered** (costs are not refunded; this is from the brief).
- If a queued skill **fails before it's used**, the cost stays paid but **no cooldown starts**. **[DECIDED]** The main case is an actor stunned mid-resolution by something triggered earlier in the queue. **[PROPOSED]** Apply the same rule to every pre-use failure: dead actor, or all targets gone or untargetable.
- **Intimidated** adds +1 to cooldowns set while it's active, per stack.
- Effects like "reduce the remaining cooldown by 1" (Water *Waterfall*, Hoop Blade) operate on the remaining counter, with a floor of 0.

### 3.6 The Skill Use Pipeline

Every use of a skill, whether by a character or a minion, queued or triggered, runs through this exact sequence. It's the backbone of rule consistency.

```
USE(skill, user, declaredTargets)
 1. Can-act check        user alive? stunned (all skills / matching skill classes)? Sleep/Chastise? Frostbitten+Strategic+Harmful?
                          → FAIL: energy stays spent (paid at commit), NO cooldown, log "X could not act"
 2. Target re-resolution  targets still alive/targetable? Taunt forces target? Blinded → random primary target?
                          Invulnerable / Untargetable / Stealth / Isolated → retarget or fizzle (same as FAIL)
                          Bypass ignores Invulnerable and Isolated.
                          Frostborn target is Invulnerable to Frostbitten users.
 3. Cooldown              start cooldown (energy was already paid at commit)
 4. Interception window   ordered checks on the *user* and each *target*:
                            - Counter effects (Riposte, Mislead): negate the skill
                            - Reflect effects (Aggro Signal): negate it AND apply it to its user
                              (or the user's team, for an AoE skill)
                            - Trap effects: fire their payload (the skill still happens)
                          A triggered Invisible effect is revealed to both players.
                          Flow ignores Counter/Reflect. "Uncounterable" skips the Counter/Reflect checks.
 5. Emit SkillUsed event  (triggers: Condemn, Trap X, Ignite-on-use, Rush maintenance, "new skill" tracking)
 6. Execute effect ops    in the order written in the skill definition, per target
 7. Emit SkillResolved
 8. Death & cleanup       deaths → OnDeath triggers → minion/owner cleanup → win check
```

### 3.7 Damage pipeline

**[DECIDED]** There are three damage types, ordered from most to least mitigable: **Normal → Piercing → Affliction**. The sheet's one "Physical" (base Smash) is Normal.

Separately, damage is either **direct** or **indirect**:

- **Direct:** any damage dealt by a skill's use. That includes Affliction damage from a skill, like Pyrokinesis.
- **Indirect:** damage from triggered effects (Mark, Trap X, Explosions, Riposte payloads) and from ticking effects (Ignite, Toxin, Channel ticks).

The two axes are independent:

| Step | Normal | Piercing | Affliction |
|---|---|---|---|
| Reduced by Armor (−5/stack) | ✔ | ✘ | ✘ |
| Absorbed by Shield | ✔ | ✔ | ✘ |

| Step | Direct | Indirect |
|---|---|---|
| Might / Weakness on the source (±5/stack) | ✔ | ✘ |
| Vulnerable on the target (+5/stack) | ✔ | ✘ |
| Triggers "on direct damage" effects (Mark, Sanctify, Shed Skin) | ✔ | ✘ |
| Blocked by an Invulnerable target | n/a (can't be targeted unless Bypassing) | ✔ blocked, unless Affliction or Bypassing |

**Shattered** (debuff, **[DECIDED]**): the bearer gets no benefit from Armor or Shield. Normal and Piercing damage skip both steps.

```
dmg = base + skillBonuses
if direct:   dmg += 5*Might(src) − 5*Weakness(src) + 5*Vulnerable(tgt)
if type == Normal and not Shattered(tgt):   dmg −= 5*Armor(tgt)
dmg = max(0, dmg)
apply element/equipment damage modifiers (hook: outgoingDamage / incomingDamage)
if type != Affliction and not Shattered(tgt): absorb with Shield
HP −= remainder;  if Immortal: HP = max(HP, 5)
emit Damaged(src, tgt, amount, type, direct) → Mark, Sanctify, Lifesteal, Stormborn, Conduit, Sleep-break, Rush, etc.
```

Rounding: all healing and damage values are multiples of 5. Scorched's "−50% rounded up to nearest 5" suggests keeping everything in 5-steps. Implement a single `roundTo5(x, mode)` helper and use it everywhere.

### 3.8 Durations: the "turn" unit **[DECIDED]**

**The engine rule is uniform.** Each effect stores an integer `duration` counted in *player turns*, whoever's turn it is. At the end of **every** turn (either player's), every effect's duration drops by 1. An effect is removed when its duration **reaches 0**. So an effect with duration 1 is removed at the end of the turn it was applied.

**What varies is how designers translate sheet text into that integer.** It depends on who the effect is meant to matter to:

| Intent | Internal duration | Example (applied in P1's turn) |
|---|---|---|
| Lasts only for the rest of this turn | **1** | Burning Blood "until the end of the turn" |
| Must be faced by the **opponent** for N of their turns | **2N** | Invulnerable "for 1 turn" = 2: 2→1 end of P1's turn, 1→0 end of P2's turn |
| Must be usable by the **applier's side** for N more of their own turns | **2N + 1** | A self-buff that lasts through P1's next turn = 3 |
| "until the end of the user's next turn" | **3** | |
| "permanently", **or no duration stated** | ∞ (no countdown; ends only when something specifically ends it: consume, cleanse, or removal) | Ignite, Soul Fragments **[DECIDED]** |
| Event-bound ("until they use a new Harmful skill") | ∞ plus an expiry trigger | Gleam, Charge's next-skill buffs |

**Authoring rule:** content never stores bare "N turns". It uses explicit helpers, and the build step compiles them to the integer:

```yaml
duration: { enemyTurns: 1 }   # → 2
duration: { ownTurns: 1 }     # → 3
duration: { thisTurn: true }  # → 1
duration: { raw: 4 }          # escape hatch for odd cases
```

This forces every one of the ~330 variants to declare its intent once, and the tooltip generator can phrase it consistently.

**Effects applied during the opponent's turn** tick by the same rule. Examples are a Riposte payload or Trap stun triggered in P2's turn. So `{ enemyTurns: 1 }` applied during P2's turn to P2's own unit would cover P2's *next* turn. The helper names describe whose turns the effect spans, relative to the turn it was applied in:

- `enemyTurns` counts turns of the **side opposite the applier**.
- `ownTurns` counts turns of the **applier's side**.

The compiler computes the integer from which side is active when the effect is applied. That's a small runtime calculation, not a static constant.

### 3.9 "New" skills

"New" (as in "uses a new Harmful skill") means a skill **used this turn from the queue or by a trigger**, as opposed to an ongoing effect ticking (Channel ticks, Renew, Ignite). The engine tags each `SkillUsed` event with `isNew: true`. Channel/tick events are emitted as `EffectTicked` and never satisfy "new".

### 3.10 Channeled skills

- A **Channeled** skill creates an ongoing effect owned by the user that executes a payload each turn (or once at the end, for "on the following turn" Snipes).
- **Interruption [DECIDED]:** a channel ends if the user is **Stunned** (for the relevant skill class), **dies**, or **uses any other skill**. Warlock Staff ("Consumes no longer interrupt Channeled skills") is an explicit exception granted by a passive, via a `channelInterruptExempt` modifier.
- Channel ticks fire at the end of the channeler's turn, in the player's chosen tick order (§3.3).
- "Snipe"-type skills are channels of length 1 whose target is **invisible** to the opponent until it fires.

### 3.11 Hidden information

| Hidden thing | Who sees it |
|---|---|
| Skills marked **Invisible** (Riposte, Mislead, Trap, Snipe target, etc.) | Owner only. **[DECIDED]** Revealed to both players when triggered. If one expires untriggered, the opponent gets an "expired" tooltip/log entry. |
| Queued skills during planning | Owner only |
| Opponent's energy pool | Hidden, both colors and count **[DECIDED]** |
| Stealthed units | Visible, but marked "untargetable". Their Stealthy actions are shown only as "a Stealthed unit acted" **[PROPOSED]**. |

**Stacking:** multiple Traps, and multiple counters of any kind, can coexist on the same unit unless a skill says otherwise. **[DECIDED]** Each is its own effect instance, and they resolve in application order.

This is enforced **server-side** by per-player state redaction (§11.7). Never send hidden data to the client and merely hide it in the UI.

---

## 4. Skill taxonomy and keywords

The sheets use several axes of classification implicitly. Formalize them as **tags** on every skill; statuses, passives, and equipment key off them.

| Tag family | Values | Used by |
|---|---|---|
| **Intent** | `Harmful`, `Helpful` | Riposte, Mislead, Trap X, Condemn, Frostbitten, Dunk, Taunt |
| **Class** | `Strategic`, `NonStrategic` | "stuns their non-Strategic skills", Frostbitten, Riverbend, Buffet. **[DECIDED]** Strategic = skills that are not explicitly directly damaging. It's **tagged explicitly per skill**, never inferred. A lint warns when a skill tagged Strategic has a direct `damage` op, or vice versa, so deliberate exceptions stay visible. |
| **Archetype** | the 30 base names: `Strike`, `Smash`, … `Titan` | Equipment ("Your Strike skills…"), class kits, infusion slots |
| **Delivery** | `Instant`, `Channeled`, `Delayed` | Channel rules, Snipe |
| **Visibility** | `Invisible`, `Stealthy` | Redaction, Stealth |
| **Mobility** | Charge, Maneuver, Mislead, Dance (per Wind's *Immobile*) | Wind Immobile checks |
| **Flags** | `Uncounterable`, `Bypasses` (ignores Invulnerable **and** Isolated), `Unstunnable`, `UsableWhileStunned` | Pipeline steps 1, 2, 4 |
| **Element** | `None`, `Fire`, … `Unholy` | "Frost debuff", "Ice debuffs", "non-Elemental Buff", element passives |

### 4.1 Base archetype intent (from the sheet's design notes)

| Skill | Design role |
|---|---|
| Strike | Single-target damage + minor buff |
| Smash | Primary target + AoE splash |
| Charge | Low damage + next-action buff |
| Riposte | Self-targeted reaction, invisible |
| Rage | 3+ turn offense buff |
| Shot | Bare single-target, scaling, no side effect |
| Snipe | Multi-turn callout with last-turn payoff |
| Trap | Single-target enemy action trigger |
| Maneuver | Self-targeted defensive |
| Companion | Permanent summon |
| Stab | Light skill with bonus payout condition |
| Ravage | Heavy skill with bonus payout condition |
| Mislead | Enemy-targeted reaction, invisible |
| Stun | Single-target hostile stun |
| Others (Bolt, Blast, Consume, Summon, Channel, Dance, Heal, Bless, Curse, Smite, Prayer, Cleave, Shout, Withstand, Taunt, Titan) | Roles are implied by their base text. Add the same one-line intent for each, so element designers keep each archetype's identity. |

Treat these intents as **design invariants**. Every elemental variant of *Trap* should still be "a single-target enemy action trigger". This lets future elements slot in predictably, and lets players reason about unfamiliar variants.

---

## 5. Status effects

### 5.1 Core (element-neutral)

| Status | Kind | Stacking | Effect |
|---|---|---|---|
| Might | Buff | stacks | +5 direct damage dealt per stack |
| Weakness | Debuff | stacks | −5 direct damage dealt per stack |
| Vulnerable | Debuff | stacks | +5 direct damage taken per stack |
| Armor | Buff | stacks | −5 normal damage taken per stack |
| Shield | Buff | pool (HP) | Absorbs damage |
| Stunned | Debuff | refresh | Cannot use skills (optionally filtered by class: Strategic / non-Strategic) |
| Invulnerable | Buff | refresh | Cannot be targeted by enemy skills. Also takes no damage from enemy ticking or triggered effects, unless that damage is Affliction or Bypassing |
| Untargetable | Buff | refresh | Cannot be targeted by enemy skills (single-target or AoE), but **still takes** ticking and triggered damage |
| Shattered | Debuff | refresh | Gets no benefit from Armor or Shield |
| Swiftness | Buff | stacks | Consumed to ignore the next Stun |
| Intimidated | Debuff | stacks | Cooldowns +1 per stack |
| Focus | Buff | stacks | Costs −1 GEN per stack |
| Confusion | Debuff | stacks | Costs +1 GEN per stack |
| Mark | Debuff | single | On taking direct damage: +10 damage, consume |
| Taunt | Debuff | single | Can only target the Taunt source |
| Immune | Buff | refresh | Cannot have Debuffs applied |
| Trap X | Debuff (hidden) | per-source | Takes X damage when using a Harmful skill |
| Sanctify | Debuff | refresh | When it takes direct damage, the damager heals 15 |
| Renew | Buff | stacks | Heals 5 per stack at the end of the applier's turn, then loses 1 stack |

**Reactive keywords [DECIDED]:**
- **Counter:** negates the triggering skill. Its cost stays paid and its cooldown starts.
- **Reflect:** an enhanced Counter. It negates the skill *and* applies it to the skill's user, or to the user's whole team if the skill was AoE.
- **Bypass:** ignores Invulnerable and Isolated.
- **"Once per round"** in equipment text means **once per match**. The content will be reworded to say so (e.g., Poison Rapier).

### 5.2 Elemental statuses (summary)

| Element | Themes (from sheets) | Signature statuses |
|---|---|---|
| **Fire** | Spread, detonation, sustain via burning | Ignite (5 Affliction/turn, no stack), Scorched (healing −50%), Flameborn (heal from Ignite + Explosions), Explode (10 Affliction to enemy team; **exception:** does not damage Invulnerable targets) |
| **Ice** | Shielding, Hindering, Oppression | Frostbitten (no Harmful Strategic), Chilled (costs can't be reduced), Numb (can't apply buffs), Frostborn (immunity vs chilled/numb; invulnerable to frostbitten) |
| **Water** | Healing, Disruption, Tempo | Renew, Flow (ignore Counter/Reflect) |
| **Lightning** | Resource management, target-chaining, consistency | Charge (→ +energy), Sapped (→ −energy), Stormborn (gain Charge on damage), Conduit (steal and transfer Charge) |
| **Wind** | Reactivity, Immunity, Speed | Rush (Swiftness + Focus upkeep), Leap (1-turn Invulnerable + next hit +5), Immobile (derived state) |
| **Earth** | Armor, Healing, Minions | Boulder / Seedling / Worldsprout minions, Channel Growth |
| **Poison** | Affliction, Debilitation, Patience | Toxin (5 Affliction/stack/turn), Prey (derived: >2 debuff stacks or <20 HP) |
| **Shadow** | Untargetability, Deception, Interference | Stealth, Blinded, Ghosted (bypass Invulnerable), Isolated, Sleep, Stealthy keyword |
| **Holy** | Healing, Anointment benefits, Penalties | Anoint, Sanctify, Condemn |
| **Unholy** | Kiss/Kill, Health manipulation, Debuffs | Horrify (can't gain buffs), Immortal (HP floor 5), Soul Fragments (+1 Might each), Lifesteal |

**Clarifications [DECIDED]:**
- **Frostborn** is relational. The bearer is *Immune to debuffs from* units that are Numb or Chilled, and *Invulnerable to* units that are Frostbitten, so those units can't target or damage it. Implement it as `canReceiveStatus` and `canTarget` modifiers that inspect the **source** unit's statuses.
- **Charged and Sapped** cap at 3 stacks. At 3 they trigger on the owner's next energy generation and are then **removed**.
- **Chastise** (Holy) is functionally identical to Shadow's **Sleep**. Implement one status, with a Holy-flavored alias for its name and icon.
- **Renew** loses 1 stack per turn (see §5.1).

**Derived statuses** such as Prey and Immobile aren't applied. They're **computed predicates**, and the engine must model them as queries, not stored flags. Otherwise they'll go stale.

### 5.3 Status definition fields (engine contract)

Every status is a data record with:

- `id`, `name`, `element`, `kind` (Buff/Debuff/Neutral), `visibility`, `icon`
- `stacking`: `none | refresh | stack(max?) | independentInstances | pool`
- `duration`: default expiry rule (§3.8)
- `modifiers`: query hooks (damage, cost, targeting, canAct...)
- `triggers`: event hooks (OnDamaged, OnSkillUsed, OnTurnStart, OnExpire...)
- `cleansable`: boolean (for Chainbreaker, Holy/Water passive, "remove a random Debuff")

---

## 6. Classes, base skills, and elements

### 6.1 Classes (reconstructed)

The equipment sheet's E-type unlock requirements ("…with the Warrior") give a clean **10 classes × 3 signature skills = 30 skills** mapping:

| Class | Signature skills | Fantasy |
|---|---|---|
| Warrior | Strike, Smash, Titan | Frontline damage and self-buff |
| Knight | Charge, Riposte, Shout | Tempo and reactive defense |
| Druid | Rage, Companion, Ravage | Beast/primal, pets |
| Ranger | Shot, Snipe, Trap | Ranged pressure, prediction |
| Monk | Maneuver, Dance, Smite | Evasion, self-buffing |
| Mage | Bolt, Blast, Channel | Burst and AoE |
| Warlock | Consume, Summon, Curse | Drain, minions, debuffs |
| Rogue | Stab, Mislead, Stun | Control, deception |
| Priest | Heal, Bless, Prayer | Support |
| Paladin | Cleave, Withstand, Taunt | Tank, protection |

"Bolster" in older sheets is **Bless**, and "Guardian" is **Paladin**. **[DECIDED]**

### 6.2 Class skill pools

Characters roll **3–5 native skills**, so each class needs more than its 3 signatures. Each class's **pool is 6 skills**: its 3 signatures plus 3 **affinity skills** borrowed from thematically adjacent classes.

The affinity sets are built so that **every one of the 30 skills is a signature for exactly one class and an affinity for exactly one other class**. The rule of "divergent adjustment" is that no two classes share a borrowed skill. Neighboring classes therefore reach into each other's kits in different directions, instead of converging on the same popular picks.

| Class | Signatures | Affinity (borrowed from) | Resulting identity |
|---|---|---|---|
| Warrior | Strike, Smash, Titan | Charge (Knight), Shout (Knight), Rage (Druid) | Aggressive frontliner with a war cry |
| Knight | Charge, Riposte, Shout | Strike (Warrior), Cleave (Paladin), Stun (Rogue) | Disciplined duelist with shield-bash control |
| Druid | Rage, Companion, Ravage | Smash (Warrior), Trap (Ranger), Blast (Mage) | Primal force of nature, area control |
| Ranger | Shot, Snipe, Trap | Companion (Druid), Maneuver (Monk), Stab (Rogue) | Mobile hunter with a pet |
| Monk | Maneuver, Dance, Smite | Riposte (Knight), Bless (Priest), Prayer (Priest) | Evasive, reactive, spiritual self-sustain |
| Mage | Bolt, Blast, Channel | Summon (Warlock), Consume (Warlock), Mislead (Rogue) | Arcane caster with familiars and illusions |
| Warlock | Consume, Summon, Curse | Bolt (Mage), Withstand (Paladin), Taunt (Paladin) | Dark caster who draws aggro and endures |
| Rogue | Stab, Mislead, Stun | Ravage (Druid), Snipe (Ranger), Dance (Monk) | Assassin: setup, then burst |
| Priest | Heal, Bless, Prayer | Channel (Mage), Curse (Warlock), Shot (Ranger) | Battle cleric: sustain, plus smiting and hexing |
| Paladin | Cleave, Withstand, Taunt | Titan (Warrior), Smite (Monk), Heal (Priest) | Holy tank with self-sustain |

**Native-skill roll [PROPOSED]:** every character gets **at least 2 of its 3 signatures**. The remaining native slots are drawn from the rest of the 6-skill pool without repeats. A 3-skill Common therefore always feels like its class, while higher rarities vary more.

Equipment (types A/B/C/E/F/J) can still add skills from **outside** the pool, up to the cap of 5.

This table is a first pass. Adjust any row. The only structural invariant worth keeping is "each skill borrowed once", because it guarantees every archetype appears on exactly two classes.

### 6.3 Elements as transformation layers

An element doesn't add skills. It **replaces an archetype's definition** with its elemental variant: Strike → Torch Strike. The variant keeps the archetype tag, so "Your Strike skills deal +5" still applies to Torch Strike.

Element identity checklist, to use when designing future elements:

1. Two to four **signature statuses** with one clear interaction loop (Fire: apply Ignite → payoff Explode; Poison: stack Toxin → trigger Prey).
2. A **"-born" self-state** or equivalent power window (Flameborn, Frostborn, Stormborn, Anoint, Flow, Rush/Leap, Stealth, Soul Fragments).
3. All 30 archetypes covered, preserving archetype intent (§4.1).
4. Three **themes** stated in the sheet header.
5. Keywords reuse the global vocabulary before inventing new ones.

---

## 7. Characters: generation, rarity, and customization

### 7.1 Character record

```
Character
  id, ownerId, name (generated), portraitId
  classId, baseElement
  rarity                → skillCount (3–5), upgradeCapacity
  skills[]              ordered list of { archetype, infusion: Element|None, source: Native|Equipment, locked: bool }
  equipment[slot]       item instance ids
  stats (record: wins, games, per-mode)
```

### 7.2 Generation algorithm

```
roll rarity (weighted table; pity timer [PROPOSED])
roll class (uniform, or weighted to fill the player's roster gaps [PROPOSED, reduces duplicates])
roll baseElement (uniform over 10)
nativeCount = rarity.skillCount            // e.g., Common 3, Rare 4, Epic/Legendary 5
skills = sample(class.signatures, 2)
       + sample(class.pool − skills, nativeCount − 2)      // pool = 3 signatures + 3 affinity (§6.2)
k = randInt(1, 3)  (optionally weighted by rarity)
pick k skills → infusion = baseElement, locked = true       // "fixed Elemental Crystal"
portrait = pickPortrait(class, baseElement)                // from asset store
name = nameGenerator(class, baseElement)
```

Proposed rarity table (to tune):

| Rarity | Native skills | Default infusions | Equipment slots | Free infusion sockets |
|---|---|---|---|---|
| Common | 3 | 1 | 2 | 1 |
| Uncommon | 3 | 1–2 | 3 | 1 |
| Rare | 4 | 1–2 | 3 | 2 |
| Epic | 4 | 2–3 | 4 | 2 |
| Legendary | 5 | 2–3 | 5 | 3 |

**Base element decision [OPEN]:** does the base element do anything beyond default infusions and portrait? One good cheap option: a small **affinity bonus**. For example, skills infused with the base element cost −1 GEN once per match, or the character counts as "X-infused" for equipment unlock requirements. Or it could be purely cosmetic.

### 7.3 Customization rules

- **Infusing a skill** consumes (or socket-equips) an Elemental Crystal/Shard and swaps the skill to its elemental variant.
- **One infusion per skill.** Default (locked) infusions can't be removed **[PROPOSED]**, or can be removed with a rare "Purifying" item.
- **Adding a skill** via equipment is only possible when the character has < 5 skills. Removing that equipment removes the skill.
- **Conflict resolution:** if two equipped items both try to infuse the same skill, the player picks which one applies. The other item's infusion is shown as inactive.
- **Loadout validation** happens server-side on save and again at match start. Store loadouts as named presets.

### 7.4 Assets

Portraits are keyed by `(class, element)`: 100 combinations. Use a manifest rather than path conventions alone:

```
assets/portraits/manifest.json
  { "warrior.fire": ["warrior_fire_01.webp", "warrior_fire_02.webp"], ... }
```

Serve via CDN (S3/R2 + CloudFront/Cloudflare). The character stores `portraitId`, never a path, so assets can move freely.

---

## 8. Equipment system

### 8.1 Grant model

All equipment reduces to a bundle of **grants**, which is how the engine should model it:

| Grant | Effect |
|---|---|
| `Passive(id)` | Attaches a passive effect definition (same contract as a status: modifiers + triggers) |
| `Skill(archetype)` | Adds a skill (if < 5) |
| `Infusion(element, target?)` | Infuses a skill. The target is either fixed (A/E/F: "Strike") or player-chosen (D/I/K: any skill) |

### 8.2 Equipment types (from *Structured Equipment*)

| Type | Grants | Count | Proposed slot |
|---|---|---|---|
| A | 1 Skill + 1 Passive + 1 Element | 30 (one per skill) | Main Hand |
| B | 2 Skills + 1 Passive | 20 (2 per class) | Two-Handed |
| C | 2 Skills + 1 Element | 20 | Exotic (weapon) |
| D | 2 Elements + 1 Passive | 30 (3 per element) | Elemental Weapon |
| E | 2 Elements + 1 Skill | 30 | Off Hand |
| F | 1 Skill + 1 Element | 30 (as listed on the sheet) | Body Armor (elemental) |
| G | 1 Skill + 1 Passive | 20 (class secondary + ultimate; "Guardian" rows = Paladin) | Body Armor (class) |
| H | 1 Element + 1 Passive | 20 (2 per element) | Accessory |
| I | "Perfect Anima Crystal" | 10 | Accessory (see note) |
| J | 1 Skill | 30 (+10 two-skill J items) | Accessory |
| K | 1 Element (Shard) | 10 | Accessory / consumable |
| L | 1 Passive | open-ended | Accessory |

The sheet's note "I … 3 skills 2 passives 4 element" reads like a **slot-budget formula**: a fully kitted character totals at most 3 equipment-granted skills, 2 passives, and 4 infusions. That's an excellent balance lever. **Recommend adopting explicit budgets per character** (scaled by rarity) and validating them in the loadout validator, independent of which items supplied them.

### 8.3 Proposed slot layout

```
Weapon:   [Main Hand (A | C | D)] + [Off Hand (E)]   — or —   [Two-Handed (B)]
Armor:    [Body (F | G)]
Accessory ×N (by rarity): H | I | J | K | L
```

The layout is data-configurable (`slots.json`), so it can be tuned without code changes.

### 8.4 Acquisition

All unlock conditions on the sheet are **ignored**. **[DECIDED]** Acquisition will be designed fresh. The engine-side plan is to keep acquisition **fully data-driven**, so any scheme can be plugged in later without code changes:

- **Drop tables** per mode and difficulty (weighted item pools, with rarity weights).
- **Story and chapter rewards** (fixed grants).
- **Crafting** **[PROPOSED]**: Shards (K) → Crystals (I).
- **Achievement predicates** (optional, later): a small predicate language over match results ("win N with class X", "win N in a row"), in case unlock-style rewards return.

---

## 9. Out-of-game flow and UX

### 9.1 Screen map

```
Login/Register
   └─ Home (main menu)
        ├─ Play ─┬─ Story / Single-player
        │        ├─ Practice vs Bot
        │        ├─ Casual / Ranked queue
        │        └─ Private match
        ├─ Tutorial
        ├─ Roster ─ Character detail ─ Customize (skills • infusions • equipment • presets)
        ├─ Create Character (roll/summon)
        ├─ Inventory (equipment • crystals • shards)
        ├─ Profile (stats, match history, replays)
        └─ Settings
Persistent panel on Home: current Team (3 slots) + roster strip; click character → loadout popover (add/remove to team)
```

### 9.2 Battle screen essentials

- **Team columns:** 3 characters and minions per side. HP bar, shield overlay, status icons with stack counts, and a hover tooltip showing *source*, *remaining duration*, and *exact numeric effect*.
- **Skill bar per character:** costs rendered as colored pips, CD overlay, and a disabled reason on hover ("Stunned (non-Strategic)", "Taunted by X", "Not enough I").
- **Energy pool:** colored counters plus a **"reserved"** ghost layer, showing specific costs reserved and a separate "r promised" counter.
- **Queue tray:** drag to reorder, including the player's own ongoing ticking effects. Ends with an **allocation step** for random costs, pre-filled with a smart default.
- **Resolution playback:** step-through animation driven by the engine's event log, speed-adjustable, with a full-text battle log.
- **Hidden info cues:** your own invisible effects are shown with a "hidden" badge. For the opponent, show nothing, or "?" where the rules reveal that *something* exists.
- **Turn timer** in multiplayer, with an auto-commit of the current queue on timeout.

---

## 10. Technical architecture: recommendation

### 10.1 Summary

> **TypeScript everywhere, in one monorepo, with a pure deterministic rules engine shared by client, server, AI, and tools.** Use a React web client and a Node.js authoritative game server over WebSockets, with PostgreSQL for persistent data and Redis for matchmaking/presence. Package the web client for desktop and mobile later if needed.

Why this fits Custom Arena specifically:

1. **The game is rules-heavy and UI-heavy, not graphics-heavy.** Tooltips, drag-to-reorder queues, and inventories are DOM/React's strengths. Canvas or engine UIs make this harder.
2. **One engine, many consumers.** The client uses the engine for instant previews (valid targets, cost feasibility, damage previews). The server uses the *same code* for authority, the AI uses it for simulation, and tools use it for balance runs. With TypeScript on both sides, this is literally one package.
3. **Hidden information requires server authority.** The server must be the only holder of the full state.
4. **Turn-based traffic is tiny.** No need for UDP, rollback, or tick-rate netcode. A WebSocket carrying commands and event batches is plenty.

### 10.2 Stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | npm workspaces (Turborepo optional later) | `packages/*`, `apps/*`. Implemented with npm workspaces: no extra tooling to install, and the packages consume each other's TypeScript source directly. |
| Language | TypeScript (strict) | Shared types between all layers |
| Rules engine | Plain TS, zero runtime deps | Pure functions, seeded PRNG (e.g., `pure-rand` or a hand-rolled xoshiro128**) |
| Content schemas | Zod | Validates JSON/YAML content at build time and at server boot |
| Web client | React + Vite + Zustand + TanStack Query | Framer Motion for UI animation; PixiJS optional for battle VFX |
| Styling | Tailwind or CSS modules + a design-token file | Element colors as tokens |
| Desktop/mobile (later) | Tauri (desktop), Capacitor (mobile) | Reuse the web build |
| Game server | Node 22 + Fastify (HTTP) + `ws` (WebSocket) | One process hosts many match rooms; scale out with sticky routing |
| Persistence | PostgreSQL + Drizzle (or Prisma) | Accounts, roster, inventory, matches, replays |
| Ephemeral | Redis | Matchmaking queues, presence, room directory, rate limits |
| Auth | Managed (Supabase Auth / Clerk) or self-hosted Lucia-style sessions + Argon2 | OAuth + email. Don't hand-roll crypto. |
| Assets | Object storage + CDN (S3/R2) | Portrait manifest |
| Observability | OpenTelemetry → Grafana/Sentry | Per-match error capture with seed + action log for exact repro |
| Testing | Vitest (engine), Playwright (client E2E) | Golden-replay tests (§12.3) |
| Hosting (start) | Fly.io / Railway / Render + managed Postgres | Migrate to k8s only if needed |

**Serverless alternative (also solid):** Cloudflare Workers + **Durable Objects**, one DO per match. That gives a single-threaded authoritative room with built-in WebSockets and storage. Use D1/Postgres (via Hyperdrive) for accounts. This removes room-routing and scaling work entirely. Choose it if you want minimal ops. The engine package is identical either way.

**Alternatives considered and rejected:**
- *Unity/Godot client:* better for heavy VFX, but you lose engine-code sharing with the server (C#/GDScript vs TS) and fight UI tooling for a menu-heavy game. Revisit only if the art direction demands it.
- *Colyseus:* its state-sync model conflicts with hidden-information redaction and event-log replay. A thin custom room layer is simpler here.
- *Peer-to-peer / client authority:* incompatible with invisible skills and ranked integrity.

### 10.3 Repository layout

```
custom-arena/
├─ packages/
│  ├─ engine/          # pure rules: state, commands, pipeline, effects runtime, RNG, redaction
│  ├─ content/         # JSON/YAML: skills, elements, statuses, classes, equipment, minions + Zod schemas
│  ├─ ai/              # bots: heuristic + search (uses engine)
│  ├─ protocol/        # WS message types, versioning, codecs
│  └─ ui-kit/          # shared React components (tooltips, cost pips, status icons)
├─ apps/
│  ├─ client/          # React game client
│  ├─ server/          # Fastify + ws: auth, roster, matchmaking, rooms
│  ├─ admin/           # content editor, player support tools
│  └─ sim/             # CLI balance simulator (bot vs bot at scale)
└─ docs/               # this GDD, rules reference, glossary
```

### 10.4 Runtime architecture

```
 ┌──────────── Client (React) ────────────┐
 │ UI ←→ local store ←→ engine (preview)  │
 └───────────────┬────────────────────────┘
        HTTPS (REST: auth, roster, inventory)   WSS (match)
                 │                               │
 ┌───────────────▼──────────┐    ┌───────────────▼────────────────┐
 │ API service (Fastify)    │    │ Match service (rooms)          │
 │ auth, roster, gen, equip │    │ Room = authoritative engine    │
 │ validation (engine pkg)  │    │ state + timer + redaction      │
 └───────┬──────────────────┘    └───────┬────────────────────────┘
         │                               │ action log (append)
     PostgreSQL ◄────────────────────────┘
         ▲
       Redis  ← matchmaking queues, presence, room directory, pub/sub
```

API and Match can start as **one Node process** and split later.

### 10.5 Data model (PostgreSQL, core tables)

```
users(id, email, display_name, created_at, ...)
characters(id, user_id, class_id, base_element, rarity, portrait_id, name, created_at, content_version)
character_skills(character_id, slot_index, archetype, infusion, source, locked)
item_defs      → lives in content, not DB (referenced by string id)
item_instances(id, user_id, item_def_id, acquired_at, bound_character_id NULL)
character_equipment(character_id, slot, item_instance_id)
loadout_presets(id, character_id, name, payload_json)
teams(id, user_id, name, character_ids[3], is_active)
currencies(user_id, kind, amount)             -- crystals, shards
achievements_progress(user_id, achievement_id, progress_json)
matches(id, mode, content_version, engine_version, seed, p1_user, p2_user|bot_id,
        started_at, ended_at, winner, end_reason)
match_snapshots(match_id, p, team_snapshot_json)   -- frozen loadouts at match start
match_actions(match_id, seq, player, command_json, ts)   -- the replay log
ratings(user_id, season_id, rating, rd, volatility)
```

Replays are reconstructed as `seed + team snapshots + content_version + commands`. The engine is deterministic, so no state snapshots are needed except for periodic checkpoints on long matches.

---

## 11. The rules engine: how the game logic should be structured

This is the heart of the project. The goal is to express all 330 skill variants, every status, and every equipment passive as **data composed from a small set of primitives**, with a narrow, safe escape hatch for true one-offs.

### 11.1 Core principles

1. **Pure core:** `apply(state, command, ctx) → { state', events[] }`. No I/O, no clocks, no `Math.random`.
2. **Immutable state** (structural sharing via Immer or hand-written reducers). Cheap snapshots enable AI search, undo in the planning phase, and replay.
3. **Single seeded RNG** threaded through state (`state.rng`). Every random choice ("random enemy", Blind targeting, Sting's random debuff, energy generation) draws from it in a defined order.
4. **Everything that changes a rule is an Effect Source.** Statuses, passives, equipment, minion auras, and field effects all implement the same two interfaces: **Modifiers** (queries) and **Triggers** (events).
5. **Skills are programs** in a small declarative DSL: an ordered list of **ops** with conditions.

### 11.2 State shape (abridged)

```ts
interface GameState {
  contentVersion: string;
  turn: number;
  activePlayer: PlayerId;
  phase: 'start' | 'planning' | 'commit' | 'resolve' | 'end' | 'finished';
  rng: RngState;
  players: Record<PlayerId, {
    energy: Record<Color, number>;       // S A I W
    queue: QueuedAction[];               // planning-time only
    reserved: { specific: Record<Color, number>; random: number };
  }>;
  units: Record<UnitId, Unit>;           // characters AND minions
  effects: Record<EffectId, EffectInstance>; // statuses, channels, traps, counters, passives
  order: { effects: EffectId[] };        // player-reorderable ticking order
  log: GameEvent[];                      // append-only within a turn
  seq: number;                           // monotonically increasing ids
}

interface Unit {
  id: UnitId; owner: PlayerId; kind: 'character' | 'minion';
  defId: string; hp: number; maxHp: number; alive: boolean;
  skills: SkillInstance[];               // resolved variant ids + cooldown counters
  summonedBy?: UnitId; expiresAt?: Expiry;
  counters: Record<string, number>;      // generic resource store: soulFragments, charge, ...
}

interface EffectInstance {
  id: EffectId; defId: string;           // points to status/passive/channel definition
  source: UnitId; bearer: UnitId | PlayerId | 'field';
  stacks: number; value?: number;        // e.g., shield pool, trap X
  expiry: Expiry; hiddenFrom: PlayerId[];
  data: Record<string, unknown>;         // per-instance memory (e.g., "triggered once this turn")
}
```

Soul Fragments, Charge, Renew stacks, and Toxin could each be a status *or* a unit counter. **Rule of thumb:** if it has a duration or can be cleansed or stolen, make it a status with stacks. If it's a pure resource, make it a counter. Soul Fragments grant Might, so model them as a status with a Might modifier per stack.

### 11.3 Modifiers (queries)

Any game question that effects can bend is asked through a **modifier chain**:

```ts
type Query =
  | { q: 'skillCost'; unit; skill }           → Cost
  | { q: 'cooldownOnUse'; unit; skill }       → number
  | { q: 'canUseSkill'; unit; skill }         → Allow | Deny(reason)
  | { q: 'canTarget'; source; skill; target } → Allow | Deny(reason) | Redirect(target)
  | { q: 'outgoingDamage'; source; target; dmg } → Damage
  | { q: 'incomingDamage'; source; target; dmg } → Damage
  | { q: 'healingReceived'; target; amount }  → number
  | { q: 'canReceiveStatus'; target; status } → Allow | Deny
  | { q: 'energyGain'; player }               → EnergyGain
  | { q: 'isPrey' | 'isImmobile' | 'hasTag'; unit } → boolean   // derived statuses
```

Evaluation: gather all active Effect Sources relevant to the query, sort by **(layer, priority, timestamp)**, and fold. Fixed layers keep math predictable:

```
1. Replace/Set   (e.g., Chilled: "costs cannot be reduced" sets a flag)
2. Additive      (Might +5/stack, Focus −1 GEN, Confusion +1 GEN)
3. Multiplicative (Scorched ×0.5, "double damage", Bolt double Might)
4. Clamp/Floor   (min 0, Immortal floor)
```

Debugging bonus: each fold step records `{source, before, after}` so tooltips and the battle log can show **exact breakdowns** ("25 base +5 Might −5 Armor = 25").

### 11.4 Triggers (events)

The engine emits typed events. Effect Sources subscribe with conditions and a payload of ops:

```
TurnStarted, TurnEnded, EnergyGenerated,
SkillQueued (preview only), SkillUsed{isNew}, SkillCountered, SkillReflected, SkillResolved,
TargetSelected, DamageDealt{type,direct}, Damaged, Healed, ShieldBroken,
StatusApplied, StatusRemoved, StatusExpired, StackChanged,
UnitSummoned, UnitDied, ChannelTicked, ChannelEnded, Explosion (custom elemental event)
```

**Trigger resolution rules** (these prevent infinite loops and ambiguity):

- Triggers go onto a **FIFO trigger stack** and resolve after the current op completes, before the next op.
- Each trigger has a **reentrancy guard**: a source can't trigger from an event it caused within the same chain, unless flagged `chainable`. Explosions triggering Explosions need an explicit decision.
- **Depth limit** (e.g., 32) with a logged error, as a safety net.
- "Once per turn" and "once per round" limits are stored in `EffectInstance.data` and reset on TurnStarted.

### 11.5 The Skill DSL

Skills (and minion skills, trap payloads, passive payloads) are lists of **ops**. Keep the op set small and orthogonal:

```
Targeting:   target(selector)            selector ∈ self | ally | enemy | allEnemies | allAllies | randomEnemy(n, excluding)
                                                    | enemyAllies (the target's allies) | allUnits | filter(predicate)
Damage:      damage(amount, type, {bypass?, uncounterable?})
Healing:     heal(amount) | drainHealth(from, amount)
Status:      apply(statusId, {stacks, duration, value}) | remove(statusId | filter) | transfer | steal | convert(a→b)
Resources:   gainEnergy(color|random, n) | counter(unit, key, delta)
Cooldowns:   cooldown(skillSel, delta | reset)
Summoning:   summon(minionId, count, duration) | kill(unit) | sacrifice(filter)
Reactive:    createTrigger(eventFilter, payload, duration, {hidden, consumes})  ← Trap, Riposte, Mislead
Channeling:  channel(ticks, payloadPerTick, onComplete?, onInterrupt?)
Delay:       delayed(turns, payload)                                           ← Snipe
Control:     if(predicate, then, else) | forEach(selector, ops) | repeat(n, ops) | chooseRandom([ops])
Meta:        useSkill(skillRef, target)  ← Earth Vine Whirl uses Launch Stone; Spriggan uses Sting
             script(id, params)          ← escape hatch (registered TS function), see 11.6
```

**Predicates** are a similarly small language: `hasStatus(unit, id, minStacks?)`, `hpAtMost(unit, n)`, `isTagged(skill, tag)`, `count(selector) >= n`, `userHas(counter, n)`, `and/or/not`.

**Worked example 1: Fire Strike (Torch Strike).**

```yaml
id: strike.fire
archetype: Strike
element: Fire
name: Torch Strike
cost: { S: 1 }
cooldown: 0
tags: [Harmful, NonStrategic, Instant]
target: { select: enemy }
ops:
  - damage: { amount: 25 }
  - apply: { status: ignite }
```

**Worked example 2: Fire Smash (Chain Detonation).** Uses conditional per-target logic.

```yaml
id: smash.fire
cost: { S: 1, r: 1 }
cooldown: 2
tags: [Harmful, NonStrategic, Instant]
target: { select: enemy }
ops:
  - damage: { to: primary, amount: 20 }
  - damage: { to: primaryAllies, amount: 10 }
  - forEach:
      in: [primary, primaryAllies]
      do:
        - if: { hasStatus: ignite }
          then: [ { emit: explosion } ]
```

**Worked example 3: Base Riposte.** A reactive effect via `createTrigger`.

```yaml
id: riposte.base
cost: { r: 1 }
cooldown: 3
tags: [Helpful, Strategic, Invisible]
target: { select: self }
ops:
  - createTrigger:
      hidden: true
      duration: { enemyTurns: 1 }   # internal 2 — covers the opponent's next turn
      on: { event: SkillUsed, targets: bearer, skillTag: Harmful, isNew: true }
      intercept: counter             # negates the skill (step 4 of the pipeline)
      payload:
        - damage: { to: triggerSource, amount: 15 }
```

**Worked example 4: Status Ignite.**

```yaml
id: ignite
element: Fire
kind: Debuff
stacking: none                        # D-type passive "Fire/Fire" overrides via modifier: maxStacks +1
triggers:
  - on: TurnEnded(effect.source.owner)  # ticks at the end of the applier's turn (§3.3)
    do: [ { damage: { to: bearer, amount: 5, type: Affliction, direct: false, source: effect.source } } ]
```

**Worked example 5: Equipment Wind Katana (type A).**

```yaml
id: equip.wind_katana
type: A
slot: MainHand
grants:
  - skill: Strike
  - infusion: { element: Wind, archetype: Strike }
  - passive:
      modifiers:
        - query: outgoingDamage
          when: { skillArchetype: Strike, source: bearer }
          add: { expr: "5 + 5 * skill.totalCost" }
```

### 11.6 The escape hatch

Some skills are truly unique: Poison *Viper Stance* (convert all Might in battle to Weakness), Earth *Rampart* (double the current Shield), Lightning *EXO-Armor*. Where the DSL would get awkward, use:

```yaml
ops: [ { script: convertAllStacks, params: { from: might, to: weakness, scope: battle } } ]
```

`script` ids map to registered, unit-tested TS functions in `packages/engine/scripts/`. Keep the list short and generic (`convertAllStacks` also serves Cobra Stance and Constrictor Stance). **Budget rule:** if more than ~10% of variants need scripts, the DSL is missing a primitive, so add the primitive.

This also resolves the sheet's schema column `execution: str — Custom strings for constructing/routing to correct functions`. That string becomes the DSL op list, with `script` as the routing fallback.

### 11.7 Commands, validation, and redaction

```ts
type Command =
  | { t: 'queue'; actor: UnitId; skill: SkillRef; targets: UnitId[] }
  | { t: 'unqueue'; index: number }
  | { t: 'reorder'; order: (QueueIndex | EffectId)[] }
  | { t: 'allocateRandom'; allocation: Record<Color, number> }
  | { t: 'exchangeEnergy'; give: Record<Color, number>; get: Color }   // if adopted
  | { t: 'endTurn' }
  | { t: 'surrender' };
```

- **Validation** is a pure function, `validate(state, player, command) → ok | error(code)`. The client calls it for UI affordances and the server calls it for authority.
- **Planning is local-first:** the client can build the queue with the engine offline. The server receives the final `endTurn` bundle (`queue + order + allocation`) and validates it atomically. This reduces round trips and keeps latency irrelevant.
- **Redaction:** `viewFor(state, player) → PlayerView` strips hidden effects, the opponent's queue, hidden targets, and RNG state. Events are redacted the same way: `redactEvent(event, player)` may drop an event, or replace it with a masked form ("An unseen effect triggered").
- **Never send the seed** to clients during a match. After the match, the replay can include it.

### 11.8 Determinism checklist

- No `Math.random`, `Date.now`, or object-key-order dependence (sort ids explicitly).
- All randomness via `state.rng`, drawn in a documented order.
- Integer math only. Everything is a multiple of 5, and the ×0.5 multipliers round per §3.7.
- Durations are integers compiled from intent helpers (§3.8). The runtime never interprets "N turns" itself.
- The engine version and content version are stored with every match. Old replays run on archived versions (keep old content bundles immutable).

### 11.9 AI

Since the engine is pure and fast, bots are straightforward:

| Tier | Approach | Use |
|---|---|---|
| Easy | Random legal queue weighted by damage | Tutorial/early story |
| Normal | **Heuristic scorer:** enumerate candidate queues (prune: ≤ 3 actors × few skills × targets), simulate one turn, score (HP diff, kill potential, status value, energy efficiency, threat of known enemy cooldowns) | Default bot |
| Hard | **Determinized MCTS / expectimax:** sample hidden info consistent with observations, search 2–3 plies | Late story, practice |
| Scripted | Story encounters with authored behaviors (`ai.yaml` per boss) | Story mode |

Bots must use **only `PlayerView`** (never the full state), so they can't cheat on hidden info. The same bots drive the **balance simulator**.

---

## 12. Content pipeline and tooling

### 12.1 Source of truth

The sheets are currently Google Sheets (PDF exports). Recommended path:

1. **Phase 1 (now):** keep Sheets for authoring. Add columns for the structured fields: `cost`, `cd`, `tags`, `targeting`, `ops` (YAML in a cell, or an `ops_ref`). A script exports CSV → JSON → Zod validation → `packages/content/dist`.
2. **Phase 2:** move canonical content into the repo as YAML (reviewable diffs, CI validation). Build the **admin content editor** (`apps/admin`) with form UIs generated from the Zod schemas and a live "try it" sandbox running the engine.
3. **Content versioning:** every build produces `contentVersion = hash`. Matches pin it. Balance patches are new versions.

### 12.2 Validation (CI gates)

- Schema validity (Zod).
- Referential integrity: every status/minion/skill id referenced exists.
- Completeness: every element defines all 30 archetypes. Every archetype has base text.
- Tooltip generation: auto-generate a tooltip from ops and **diff it against the human description**. Mismatches flag typos or balance drift.
- Keyword lint: unknown keywords in descriptions (it would catch "Rarvage", "Mirslead", "Nurmb").

### 12.3 Testing strategy

- **Unit tests** per op, modifier layer, and pipeline step.
- **Scenario tests** per skill variant: set up state → use skill → assert events/state. Write them from each description (330 of them; good work to parallelize).
- **Golden replays:** recorded matches re-run on every commit. Any divergence fails CI unless the content version changed.
- **Property tests:** random legal command sequences never crash, never produce negative energy, never leak hidden info through `viewFor`.
- **Balance simulator:** `sim --bots normal --games 50000 --pool all` → win rates per skill variant, element, class, and equipment. Flag outliers above 55% or below 45%.

---

## 13. Implementation roadmap

Each phase ends in something playable or testable. Estimates assume one experienced full-stack developer. Scale down with more hands.

### Phase 0: Rules lock and foundations (1–2 weeks) — ✅ done 2026-09-25
- Confirm the remaining items in §14.3. Write `docs/rules.md` (the formal ruleset, from §3 plus §14.1) and `docs/glossary.md`.
- Apply the §14.2 content fixes to the source sheets, and add the explicit `Strategic` and duration-intent columns.
- Set up the monorepo, CI, lint, and test infrastructure.
- Define Zod schemas for skills, statuses, minions, classes, and equipment. Import the **base 30 skills** and **core statuses**.

### Phase 1: Engine core (3–5 weeks) — ✅ done 2026-09-25 (engine v0.1.0; see README and docs/rules.md)
- State model, seeded RNG, commands, validation, and the energy reservation solver.
- Turn phases, cooldowns, durations, the use pipeline, the damage pipeline, the modifier layers, and the trigger stack.
- DSL interpreter covering all ops needed by the base skills (including createTrigger, channel, delayed, summon).
- Headless CLI to play a match in the terminal. Unit and scenario tests for all 30 base skills.
- **Exit criterion:** a full bot-vs-bot match with base skills runs deterministically, and replay matches byte-for-byte.

### Phase 2: Battle client prototype (3–4 weeks) — ✅ built 2026-09-25 (apps/client), awaiting playtests
- React battle screen: units, statuses, skill bars, energy pool with reservation, queue tray with reorder, random-energy allocation, and playback from the event log.
- Local hotseat mode and local vs Easy bot.
- Tooltips with modifier breakdowns.
- **Exit criterion:** internal playtests of base-skill teams are fun and legible.

### Phase 3: Elements (6–10 weeks; parallelizable per element)
Suggested order (simple → complex mechanics):
1. **Fire** (DoT, explosion event, conditional payoffs)
2. **Poison** (stacking DoT, derived Prey)
3. **Holy** (Anoint/Sanctify/Condemn, heals)
4. **Ice** (skill-class restrictions, cost locks)
5. **Water** (Renew, Flow, cooldown manipulation)
6. **Unholy** (resource counter, HP floor, lifesteal)
7. **Lightning** (energy economy modifiers, Conduit transfers)
8. **Wind** (mobility states, derived Immobile; Vortex uses the redesigned text in §14.2)
9. **Shadow** (Stealth, Blind random targeting, Isolated, Sleep → the hidden-info stress test)
10. **Earth** (many minions, minion-as-resource, Launch Stone meta-skill use)

Per element: statuses → 30 variants → scenario tests → tooltip-diff pass → sim run.

### Phase 4: Backend and meta (4–6 weeks)
- Auth, profiles, the Postgres schema, and REST APIs.
- Character generation (rarity, class pools, default infusions, portraits), roster, and teams.
- Inventory, equipment, the loadout validator (budgets, slots, skill cap), and presets.
- Content-delivery endpoint (client fetches the content bundle by version).

### Phase 5: Multiplayer (3–5 weeks)
- WebSocket protocol (versioned), match rooms, turn timers, and redacted views.
- Reconnection (resend the view + events since the last ack), disconnect/forfeit rules.
- Matchmaking (Redis queue, rating bands widening over time), Glicko-2, match history, and replay viewer.
- Anti-abuse: rate limits, server-side validation only, and audit logs.

### Phase 6: Single-player (4–6 weeks)
- Normal/Hard AI and the scripted-encounter framework.
- Tutorial (step-scripted using engine hooks: "force this hand", "highlight this skill").
- Story chapters, rewards, and the achievement/unlock predicate system (§8.4).

### Phase 7: Equipment content and economy (3–4 weeks)
- Implement equipment types A–L passives (they reuse the effect runtime), drop tables, crafting (shards → crystals), and currencies.
- Balance simulator including equipment. Tune.

### Phase 8: Polish, launch, and live ops (ongoing)
- Art pipeline and portrait manifest, VFX/SFX, accessibility (color-blind energy pip shapes!), and localization readiness.
- Analytics (pick/win rates), a balance patch cadence, and seasons.
- Desktop/mobile wrappers.

---

## 14. Decision log and remaining open items

### 14.1 Rules decisions (answered 2026-09-25)

| # | Question | Decision | Where applied |
|---|---|---|---|
| Q1 | How are durations counted? | Internal integer ticks down by 1 at the end of **every** player turn and is removed at 0. Opponent-facing N turns = 2N. Applier-facing N more turns = 2N+1. "This turn only" = 1. | §3.3, §3.8 |
| Q2 | Energy pool persistence and cap | Persists, **no cap** | §3.2 |
| Q3 | When do ticking effects fire? | **End of the applier's turn** | §3.3, §3.10, §5.1 |
| Q4 | What is Strategic? | Not explicitly directly damaging. **Tagged per skill.** | §4 |
| Q5 | Damage types | Normal → Piercing → Affliction. Armor reduces only Normal. Shield absorbs Normal and Piercing. Affliction ignores both. **Direct** = damage from a skill's use (not triggered or ticking). | §3.7 |
| Q6 | What interrupts a Channel? | Stun, death, or using another skill | §3.10 |
| Q7 | Actor stunned mid-resolution before its queued skill executes | **No cooldown**, cost **not refunded** | §3.5, §3.6 |
| Q8 | "−1 GEN" with no r cost | Reduces nothing | §3.4 |
| Q9 | Mutual wipe | **Draw** | §3.3 |
| Q10 | Undefined terms | **Shattered:** no benefit from Armor or Shield. **Reflect:** counter + apply the skill to its user (or their team if AoE). **Untargetable:** like Invulnerable, but still takes ticking and triggered damage. **Invulnerable:** also blocks ticking and triggered damage unless it's Affliction or Bypassing. **Bypass:** ignores Invulnerable and Isolated. **Once per round** = once per match. | §3.6, §3.7, §4, §5.1 |
| Q11 | Trap and counter visibility, stacking | Revealed when triggered. Show a tooltip when expiring untriggered. All trap and counter kinds stack unless stated otherwise. | §3.11 |
| Q12 | Is the opponent's energy visible? | **No** | §3.2, §3.11 |
| Q13 | Do minions count as allies/enemies? | Yes, for all effects, unless the text says "character" | §3.1 |
| Q14 | Fire Explode vs the Invulnerable rule | An explicit exception: Explode does **not** damage Invulnerable targets, despite being Affliction (`respectsInvulnerable: true`) | §5.2 |
| Q15 | Cooldown clock | Ticks **only on the owner's turns**. CD 1 must stay unusable on the owner's following turn (internally `remaining = n + 1`). | §3.5 |
| Q16 | Effects with no stated duration (e.g., Ignite) | **Permanent** until specifically ended (consumed, cleansed, or removed by a skill) | §3.8 |
| Q17 | Wind Vortex redesign | Confirmed. See the new text in §14.2. | §14.2 |

### 14.2 Content decisions: fixes to apply to the source sheets

| Item | Decision |
|---|---|
| Typos "Rarvage", "Mirslead", "Nurmb" | Correct them to Ravage, Mislead, Numb |
| Bolster | Former name of **Bless**. Rename it everywhere (equipment types B, C, G, J). |
| Guardian | It's **Paladin**. Rename it everywhere (G-type: Hand of Healing, Golden Plate). |
| B-type pair inconsistencies | Ignore them. Keep the items as listed. |
| Renew | Loses 1 stack per turn |
| Frostborn | Immune to debuffs from Numb or Chilled units. Invulnerable to Frostbitten units (they can't target or damage the bearer). |
| Charged / Sapped | Max 3 stacks, removed after triggering |
| Wind Channel (Vortex) | Redesigned text (AI 3): "Deals 10 damage to all enemies for 2 turns. If the user is Leaping or Rushing when a tick fires, an additional turn is added. Channeled." |
| Unholy Trap (Soul Shackle) | Corrected text: "For 1 turn, if target enemy uses a skill, they are Stunned for 1 turn and gain 2 Weakness for 2 turns. Invisible." |
| Chastise (Holy) | Functionally identical to Sleep. Treat it as an alias. |
| Poison Heal (Moonglove Mixture) | Can target enemies, by design |
| Earth Curse (Worldmute) | Its ally-targeting is an intentional divergence from archetype intent |
| Shadow Titan (Faceless One) | New text: "For 3 turns, the user gains 1 Armor, and all enemies are Taunted by the user and Isolated." |
| Poison Channel (Nine Plagues) | CD 9 / 9 turns confirmed |
| Unnamed items | Given placeholder names (§15) |
| All unlock conditions | Ignored (§8.4) |
| Fire sheet footer | Ignored |
| Class skill pools | Expanded to 6 per class (§6.2) |
| Type F "10 varieties / 300" text | Ignored. Use the 30 listed items. |
| Unlabeled color matrix beside Type A | Ignored |

### 14.3 Engineering defaults (all confirmed 2026-09-25)

These started as engineering defaults. The designer confirmed all of them, along with every other **[PROPOSED]** item in this document, which now counts as decided.

| # | Item | Decision |
|---|---|---|
| R1 | **Other pre-use failures** (actor dead, all targets gone or untargetable) | Same as Q7: cost paid, no cooldown |
| R2 | **Durations for effects applied during the opponent's turn** (Riposte/Trap payloads) | `enemyTurns`/`ownTurns` are relative to the applier and computed at application time (§3.8) |
| R3 | **Stalling risk** from an uncapped pool, turtling, and draws | Monitor it in the simulator. Fallback: a turn limit (e.g., 50 per player) → draw. |
| R4 | Base HP | 100 per character |
| R5 | Minion cap | 4 per side |
| R6 | Stealthed-unit action visibility | Shown as "a Stealthed unit acted" |
| R7 | Energy exchange (5 → 1 chosen color) | Optional. Decide after playtests. |
| R8 | Does base element matter mechanically? Are default infusions removable? | Cosmetic plus default infusions. Defaults are locked. |
| R9 | Class pool table (§6.2) and the "at least 2 signatures" roll rule | First pass; review |
| R10 | Rarity table (§7.2) and slot/budget numbers (§8.2–8.3) | First pass; to tune |

---

## 15. Appendix: equipment data

The PDF export drops cell colors from the text. They were recovered by parsing the PDF's fill operations and matching them to rows. The color key is from the brief. Wind renders as very light grey (#F3F3F3), and Shadow as mid grey (#999999).

Names in *italics* are **placeholders** for items that were unnamed on the sheet. "Bolster" has been renamed Bless and "Guardian" renamed Paladin.

### 15.1 Type A (Main Hand): one skill, one passive, one element

| Item | Skill | Infusion |
|---|---|---|
| Wind Katana | Strike | Wind |
| Magma Hammer | Smash | Fire |
| Water Spear | Charge | Water |
| Poison Rapier | Riposte | Poison |
| Unholy Cleaver | Rage | Unholy |
| Ice Kunai | Shot | Ice |
| Shadow Arbalest | Snipe | Shadow |
| Vine Whip | Trap | Earth |
| Lightsaber Dirk | Maneuver | Lightning |
| Ice Claw | Companion | Ice |
| Fire Sceptre | Bolt | Fire |
| Holy Book | Blast | Holy |
| Twisted Wand | Consume | Earth |
| Sacrificial Dagger | Summon | Unholy |
| Holy Censer | Channel | Holy |
| Scything Claw | Stab | Poison |
| Lightning Dagger | Ravage | Lightning |
| Mist Fan | Mislead | Water |
| Sun Baton | Stun | Earth |
| Hoop Blade | Dance | Shadow |
| Wind Charm Stick | Heal | Wind |
| Anointment Mace | Bless | Water |
| Brimstone Lash | Curse | Fire |
| Book of Shadows | Smite | Shadow |
| Book of the Damned | Prayer | Unholy |
| Paladin Axe | Cleave | Holy |
| Lightning Banner | Shout | Lightning |
| Wind Shield | Withstand | Wind |
| Ice Hammer | Taunt | Ice |
| Chemtech Sword | Titan | Poison |

Each element appears exactly 3 times.

### 15.2 Type C (Exotic): two skills, one element

| Item | Skills | Infusion |
|---|---|---|
| Hexblade | Strike / Summon | Unholy |
| Iceblood Hammer | Smash / Stun | Ice |
| Knife Talisman | Stab / Prayer | Shadow |
| *Blightfang Staff* | Ravage / Channel | Poison |
| *Galewarden Bow* | Shot / Titan | Wind |
| *Tidecaller's Net* | Trap / Prayer | Water |
| *Dawnspark Rod* | Bolt / Bless | Holy |
| *Tempest Aegis* | Blast / Riposte | Wind |
| *Thunderbrand Longbow* | Smite / Snipe | Lightning |
| *Wellspring Maul* | Heal / Rage | Water |
| *Emberforged Greatsword* | Strike / Titan | Fire |
| *Duskveil Charm* | Heal / Maneuver | Shadow |
| *Rootbound Halberd* | Cleave / Companion | Earth |
| *Herald's Trumpet* | Shout / Bless | Holy |
| *Rimeglass Wand* | Bolt / Withstand | Ice |
| *Stormhex Chakram* | Curse / Dance | Lightning |
| *Mountainbreaker* | Smash / Taunt | Earth |
| *Venomkiss Chalice* | Bless / Consume | Poison |
| *Cinderpsalm Axe* | Cleave / Prayer | Fire |
| *Bloodpact Lance* | Heal / Charge | Unholy |

### 15.3 Type D (Elemental Weapon): two elements, one passive

The sheet's "Emblem of the…" heading suggests the naming pattern used for the placeholders.

| Item | Infusions | Passive (abridged) |
|---|---|---|
| *Emblem of the Inferno* | Fire + Fire | Ignite may stack one additional time |
| *Emblem of the Arc Furnace* | Fire + Lightning | Shattered enemies take +5 from effect damage |
| *Emblem of the Hellfire* | Fire + Unholy | Damaging an ally grants a random buff |
| *Emblem of the Glacier* | Ice + Ice | Double Armor benefit while Frostborn |
| *Emblem of the Permafrost* | Ice + Earth | Allies start with 10 Shield; minions with 5 |
| *Emblem of the Frostflame* | Ice + Fire | Gaining Shield deals 5 Affliction to all enemies |
| *Emblem of the Gale* | Wind + Wind | +1 Might per turn while Rushing |
| *Emblem of the Miasma* | Wind + Poison | +10 damage vs each enemy that hasn't damaged you |
| *Emblem of the Monsoon* | Wind + Water | Heal 10 when a Stun removes Swiftness |
| *Emblem of the Tempest* | Lightning + Lightning | 15 refreshing Shield on Charge energy |
| *Emblem of the Blackout* | Lightning + Shadow | 10 damage to targets becoming Invulnerable |
| *Emblem of the Aurora* | Lightning + Ice | Random buff each turn (fix the duplicate "Stormborn") |
| *Emblem of the Tide* | Water + Water | Swiftness (or Focus) when Flow triggers |
| *Emblem of the Abyss* | Water + Shadow | Piercing damage on Counter/Reflect |
| *Emblem of the Bloodtide* | Water + Unholy | Heal 5 on damaging ability |
| *Emblem of the Mountain* | Earth + Earth | Heal 5 on Channel Earth |
| *Emblem of the Sanctuary* | Earth + Holy | Heal 10/turn until using a Harmful skill |
| *Emblem of the Magma* | Earth + Fire | Double damage to one minion per turn |
| *Emblem of the Serpent* | Poison + Poison | Permanent Might/Armor on dealing/taking damage |
| *Emblem of the Neurotoxin* | Poison + Lightning | Unspent energy → an ally gains Might |
| *Emblem of the Bog* | Poison + Earth | Allied minions deal 5 Affliction on death |
| *Emblem of the Void* | Shadow + Shadow | Idle turn extends Invulnerability once |
| *Emblem of the Phantom* | Shadow + Wind | +10 Piercing vs Invulnerable enemies |
| *Emblem of the Eclipse* | Shadow + Holy | Mark damage applies 1 Weakness |
| *Emblem of the Sun* | Holy + Holy | +1 Might on damaging Sanctified enemies |
| *Emblem of the Seraph* | Holy + Wind | Invulnerable on first Stun (once per match) |
| *Emblem of the Font* | Holy + Water | Anointing cleanses debuffs |
| *Emblem of the Grave* | Unholy + Unholy | +1 Might and heal 10 when an allied character dies |
| *Emblem of the Plague* | Unholy + Poison | Stackable debuffs become permanent |
| *Emblem of the Lich* | Unholy + Ice | You and your minions gain 5 Shield on Harmful skill use |

### 15.4 Type E (Off Hand): one skill, two elements

| Item | Skill | Infusions |
|---|---|---|
| Devil's Blade | Strike | Fire + Unholy |
| Mythic Hammer | Smash | Earth + Ice |
| Storm Chaser | Charge | Lightning + Wind |
| Ritual Guard | Riposte | Fire + Shadow |
| Solar Berserker | Rage | Fire + Earth |
| Spore Hunter | Shot | Poison + Earth |
| Charged Sight | Snipe | Poison + Lightning |
| Mirror World | Trap | Water + Shadow |
| Ninja Step | Maneuver | Wind + Shadow |
| Faerie Partner | Companion | Wind + Poison |
| Rainbow Mage | Bolt | Lightning + Ice |
| Alchemical Explosion | Blast | Fire + Water |
| Corpse Eater | Consume | Unholy + Lightning |
| Misty Calling | Summon | Water + Wind |
| Channel's Current | Channel | Water + Lightning |
| Spectral Knife | Stab | Unholy + Wind |
| Lich's Spike | Ravage | Ice + Unholy |
| Vigilante Mask | Mislead | Holy + Shadow |
| Good Night's Sleep | Stun | Ice + Shadow |
| Preserved Form | Dance | Poison + Ice |
| Pure Injection | Heal | Poison + Water |
| Cleansing Touch | Bless | Holy + Poison |
| Evil Fate | Curse | Unholy + Shadow |
| Angel's Wrath | Smite | Wind + Holy |
| Anointed Words | Prayer | Water + Holy |
| Magnetic Arc | Cleave | Lightning + Earth |
| Fire and Ice | Shout | Ice + Fire |
| Divine Authority | Withstand | Fire + Holy |
| Grave Insult | Taunt | Earth + Unholy |
| Prism Guardian | Titan | Ice + Holy |

A two-element item infuses up to two skills: the named skill plus one the player chooses, or two chosen skills **[PROPOSED]**. The sheet doesn't specify which skills receive the infusions.

### 15.5 Type F (Elemental Armor): one skill, one element

| Item | Skill | Infusion |
|---|---|---|
| Viper Blade | Strike | Poison |
| Frostblood Mallet | Smash | Ice |
| Skylance | Charge | Wind |
| S.E.C.U.T.O.R. MK I | Riposte | Lightning |
| Oathsign | Rage | Holy |
| Blackflint Revolver | Shot | Unholy |
| Red Arcane Lens | Snipe | Fire |
| Satchel of Void Ooze | Trap | Shadow |
| Sapphire Anklet | Maneuver | Water |
| Feather Talisman | Companion | Wind |
| Dark Faerie's Blessing | Bolt | Shadow |
| Hoof Talisman | Blast | Earth |
| Blue Arcane Lens | Consume | Water |
| Deployment Platform | Summon | Lightning |
| Arcadian Brooch | Channel | Poison |
| Inquisitor's Prod | Stab | Holy |
| Sanguine Hook | Ravage | Unholy |
| Dusk Rose | Mislead | Earth |
| Divine Edict | Stun | Holy |
| Fan of the Flames | Dance | Fire |
| Holy Prism | Heal | Ice |
| Writ of Vengeance | Bless | Lightning |
| Haunted Memento | Curse | Shadow |
| Druidic Symbol | Smite | Earth |
| Tome of Fables | Prayer | Ice |
| Oathbreaker's Blade | Cleave | Unholy |
| Faerie Bugle | Shout | Poison |
| Ironshell Shield | Withstand | Water |
| Dragon Knight's Helm | Taunt | Fire |
| Rocfeather Charm | Titan | Wind |

Each element appears exactly 3 times.

### 15.6 Types H, I, K

- **H (Accessory):** one element each, as the sheet's element column lists (e.g., Crown of Flames = Fire, Cloak of Night = Shadow).
- **I (Crystals) / K (Shards):** their named element.
