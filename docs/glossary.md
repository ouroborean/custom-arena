# Glossary

Keywords used in skill text and in the engine. Content descriptions should use these exact words.

| Term | Meaning |
|---|---|
| **Affliction** | Damage type that ignores Armor and Shield, and gets through Invulnerable when indirect. |
| **Ally / Enemy** | Any unit on the same / other side, **including minions**, unless the text says "character". "Ally" includes the user. |
| **Anointed** | Holy: a marker that empowers Holy skills. |
| **AoE** | A skill targeting all enemies or all allies (target kind `allEnemies` / `allAllies`). |
| **Applier** | The unit (and its player) that put an effect on the board. Ticking effects fire at the end of the applier's turn. |
| **Archetype** | One of the 30 base skill slots (Strike … Titan). Elemental variants keep their archetype, so "your Strike skills" matches Torch Strike too. |
| **Buff / Debuff** | Effect kinds. Immune blocks Debuffs. |
| **Bypass** | Ignores Invulnerable and Isolated. |
| **Channeled** | An ongoing skill effect on its user. It ends if the user is stunned (for that skill's class), dies, or uses another skill. |
| **Chilled** | Ice: skill costs can't be reduced. |
| **Character** | A player's hero unit. Generates energy; its death counts toward elimination. |
| **Condemned** | Holy: the next skill the bearer uses gives them a random Weakness, Vulnerable or Confusion, then it ends. |
| **Cooldown (CD)** | Number of the owner's own turns a skill stays locked after use. |
| **Counter** | Negates a skill as it's used. Cost stays paid, and the cooldown starts. |
| **Direct damage** | Damage dealt by a skill's use (including delayed hits like Snipe). Gets Might, Weakness and Vulnerable, and triggers "on direct damage" effects. |
| **Duration** | Internal count of turns; drops by 1 at the end of every turn. See rules.md §8. |
| **Explode / Explosion** | Fire: 10 Affliction damage to every enemy of whoever caused it. Skips Invulnerable targets. |
| **Frost debuff** | Ice: Frostbitten, Chilled or Numb. |
| **Frostbitten** | Ice: can't use Harmful Strategic skills. |
| **Frostborn** | Ice: immune to Debuffs from Numb or Chilled units; Frostbitten units can't target or damage it. |
| **GEN / r / random** | A wildcard cost payable with any color. |
| **Ghosted** | The bearer's skills Bypass. |
| **Harmful / Helpful** | Every skill is exactly one. Counters, Traps and Frostbitten key off Harmful. |
| **HiddenTarget** | Skill tag: the opponent sees the skill but not its target (Snipe). |
| **Indirect damage** | Damage from triggered or ticking effects. |
| **Invisible** | Skill tag and effect visibility: hidden from the opponent until triggered or expired. |
| **Invulnerable** | Can't be targeted by enemy skills, and takes no indirect enemy damage unless it's Affliction or Bypassing. |
| **Isolated** | Can't be targeted by allied skills (Bypass ignores it). |
| **Minion** | A summoned unit. Has HP and possibly skills, generates no energy, and pays skill costs from its owner's pool. |
| **"New" skill** | A skill actually used this turn (queued or triggered), as opposed to an ongoing effect ticking. |
| **Normal** | The default damage type. Reduced by Armor, absorbed by Shield. |
| **Numb** | Ice: can't apply Buffs, even to themselves. |
| **Once per round** | Once per **match**. |
| **Piercing** | Damage type that ignores Armor but is absorbed by Shield. |
| **Prey** | Poison: a unit with more than 2 total stacks of Toxin, Weakness, Vulnerable and Confusion, or below 20 HP, or marked as Prey. Computed, not applied. |
| **Reflect** | A counter that also applies the skill to its user (or the user's team, for AoE skills). |
| **Shattered** | Gets no benefit from Armor or Shield. |
| **Strategic** | Skill class for skills that aren't explicitly directly damaging. Tagged per skill. Some stuns only affect Strategic or non-Strategic skills. |
| **Stunned** | Can't use skills (optionally only Strategic or only non-Strategic ones). |
| **Taunted** | Enemy single-target skills must target the taunter. |
| **Tick / ticking effect** | An effect with an end-of-turn payload (DoT, HoT, Renew, channel, minion attack). Fires at the end of its applier's turn, in the order that player chooses. |
| **Toxin** | Poison: 5 Affliction damage per stack at the end of the applier's turn. Stacks merge per applying side. |
| **Trap** | A hidden effect on an enemy that fires when they use (typically Harmful) skills. |
| **Untargetable** | Can't be targeted by enemy skills, but still takes indirect damage. Bypass does not ignore it. |
| **Uncounterable** | Skill tag: can't be countered or reflected. |
