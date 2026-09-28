# Glossary

Keywords used in skill text and in the engine. Content descriptions should use these exact words.

The game explains keywords beside its tooltips (hold Alt, or always on touch screens; Settings →
Keyword explanations). Its text comes from `packages/content/data/base/glossary.yaml`, which also
lists the word forms that count as each keyword: keep the two in step.

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
| **Boulder** | Earth: a 45 HP minion with no skills, used as ammunition (Launch Stone, Vine Whirl, Tunnelmaker) and armor (Treant Form). |
| **Blinded** | Shadow: the primary target of the bearer's single-target skills is chosen at random among legal targets. |
| **Channel Growth** | Earth: every allied Seedling (Forest Stalkers included) gets +10 max HP, then heals 10. |
| **Channeled** | An ongoing skill effect on its user. It ends if the user is stunned (for that skill's class), dies, or uses another skill. |
| **Charge / Charged** | Lightning: stacks of Charged, max 3. At 3, the owner generates 1 extra energy on their next turn and the Charge is spent. "Charged" means at least 1. |
| **Chilled** | Ice: skill costs can't be reduced. |
| **Character** | A player's hero unit. Generates energy; its death counts toward elimination. |
| **Condemned** | Holy: the next skill the bearer uses gives them a random Weakness, Vulnerable or Confusion, then it ends. |
| **Conduit** | Lightning: steals all Charge from enemies it damages; Charged allies that use Helpful skills on it give it their Charge. |
| **Cooldown (CD)** | Number of the owner's own turns a skill stays locked after use. |
| **Counter** | Negates a skill as it's used. Cost stays paid, and the cooldown starts. |
| **Direct damage** | Damage dealt by a skill's use (including delayed hits like Snipe). Gets Might, Weakness and Vulnerable, and triggers "on direct damage" effects. |
| **Drain (Soul Fragment)** | Unholy: "drain a Soul Fragment from X" means the user gains 1 Soul Fragment. X doesn't need to have one. |
| **Duration** | Internal count of turns; drops by 1 at the end of every turn. See rules.md §8. |
| **Explode / Explosion** | Fire: 10 Affliction damage to every enemy of whoever caused it. Skips Invulnerable targets. |
| **Flow** | Water: the bearer's skills ignore counters and reflects. |
| **Frost debuff** | Ice: Frostbitten, Chilled or Numb. |
| **Frostbitten** | Ice: can't use Harmful Strategic skills. |
| **Frostborn** | Ice: immune to Debuffs from Numb or Chilled units; Frostbitten units can't target or damage it. |
| **GEN / r / random** | A wildcard cost payable with any color. |
| **Ghosted** | The bearer's skills Bypass. |
| **Harmful / Helpful** | Every skill is exactly one. Counters, Traps and Frostbitten key off Harmful. |
| **Horrified** | Unholy: can't gain Buffs (including from itself). |
| **HiddenTarget** | Skill tag: the opponent sees the skill but not its target (Snipe). |
| **Immobile** | Wind: a character with no mobility skills (Charge, Maneuver, Mislead, Dance) and no mobility buffs (Swiftness, Rushing, Leaping). Computed, not applied. |
| **Indirect damage** | Damage from triggered or ticking effects. |
| **Immortal** | Unholy: Health can't fall below 5. "Undying" on the sheet means the same thing. |
| **Invisible** | Skill tag and effect visibility: hidden from the opponent until triggered or expired. |
| **Invulnerable** | Can't be targeted by enemy skills, and takes no indirect enemy damage unless it's Affliction or Bypassing. |
| **Leap / Leaping** | Wind: Invulnerable for 1 turn, plus Leaping: +5 direct damage until one of the bearer's skills has dealt direct damage. |
| **Lifesteal** | Unholy: heals for the Health the bearer removes from other characters. Shield-absorbed damage and damage to minions don't count. |
| **Isolated** | Can't be targeted by allied skills (Bypass ignores it). |
| **Minion** | A summoned unit. Has HP and possibly skills, generates no energy, and pays skill costs from its owner's pool. |
| **"New" skill** | A skill actually used this turn (queued or triggered), as opposed to an ongoing effect ticking. |
| **Normal** | The default damage type. Reduced by Armor, absorbed by Shield. |
| **Numb** | Ice: can't apply Buffs, even to themselves. |
| **Once per round** | Once per **match**. |
| **Piercing** | Damage type that ignores Armor but is absorbed by Shield. |
| **Prey** | Poison: a unit with more than 2 total stacks of Toxin, Weakness, Vulnerable and Confusion, or below 20 HP, or marked as Prey. Computed, not applied. |
| **Renew** | Heals 5 HP per stack at the end of the applier's turn, then loses 1 stack. |
| **Reflect** | A counter that also applies the skill to its user (or the user's team, for AoE skills). |
| **Rushing** | Wind: 1 Swiftness and 1 Focus each turn if missing. Ends after a turn in which the bearer used no skill. |
| **Sapped** | Lightning: max 3 stacks. At 3, the owner generates 1 less energy on their next turn and Sapped is removed. |
| **Shattered** | Gets no benefit from Armor or Shield. |
| **Seedling** | Earth: a 15 HP minion whose Channel Earth gives its creator 1 Might and 1 Armor (permanent). Forest Stalkers count as Seedlings. |
| **Sleep** | Stunned (2 turns when applied by skills), ending when the bearer takes damage. Holy's Chastise is the same status. |
| **Soul Fragment** | Unholy: a permanent stacking Buff; each stack is 1 Might. Consumed by several Unholy skills. |
| **Stormborn** | Lightning: gains 1 Charge whenever it deals or receives damage. |
| **Stealth / Stealthy** | Shadow: Stealth makes the bearer untargetable by enemies for 2 turns; a non-Stealthy skill ends it, a Stealthy one extends it by 1 turn. |
| **Strategic** | Skill class for skills that aren't explicitly directly damaging. Tagged per skill. Some stuns only affect Strategic or non-Strategic skills. |
| **Stunned** | Can't use skills (optionally only Strategic or only non-Strategic ones). |
| **Taunted** | Enemy single-target skills must target the taunter. |
| **Tick / ticking effect** | An effect with an end-of-turn payload (DoT, HoT, Renew, channel, minion attack). Fires at the end of its applier's turn, in the order that player chooses. |
| **Toxin** | Poison: 5 Affliction damage per stack at the end of the applier's turn. Stacks merge per applying side. |
| **Trap** | A hidden effect on an enemy that fires when they use (typically Harmful) skills. |
| **Untargetable** | Can't be targeted by enemy skills, but still takes indirect damage. Bypass does not ignore it. |
| **Uncounterable** | Skill tag: can't be countered or reflected. |
