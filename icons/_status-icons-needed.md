# Status icons needed

Generated from `packages/content/data`. Each named status below needs its own icon.
Effects defined inline inside a skill are listed at the end; they can reuse that skill's icon.

- Core: 24
- Elements: 24
- Fusions: 160
- Story bosses: 10
- Item passives: 138 (`eq_*`; these can use the item's own icon, so they are not listed)

## Core

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Might** | Buff | +5 direct damage dealt per stack. | `might` |
| 2 | **Weakness** | Debuff | −5 direct damage dealt per stack. | `weakness` |
| 3 | **Vulnerable** | Debuff | +5 direct damage taken per stack. | `vulnerable` |
| 4 | **Armor** | Buff | −5 Normal damage taken per stack. | `armor` |
| 5 | **Shield** | Buff | Absorbs Normal and Piercing damage until depleted. | `shield` |
| 6 | **Stunned** | Debuff | Cannot use skills. | `stun` |
| 7 | **Stunned (non-Strategic)** | Debuff | Cannot use non-Strategic skills (skills that deal direct damage). | `stun_ns` |
| 8 | **Stunned (Strategic)** | Debuff | Cannot use Strategic skills. | `stun_s` |
| 9 | **Sleep** | Debuff | Stunned. Ends when the bearer takes damage. | `sleep` |
| 10 | **Invulnerable** | Buff | Cannot be targeted by enemy skills, and takes no damage from enemy triggered or ticking effects unless that damage is Affliction or Bypassing. | `invulnerable` |
| 11 | **Ghosted** | Buff | The bearer's skills Bypass (ignore Invulnerable and Isolated). | `ghosted` |
| 12 | **Untargetable** | Buff | Cannot be targeted by enemy skills, but still takes triggered and ticking damage. | `untargetable` |
| 13 | **Isolated** | Debuff | Cannot be targeted by allied skills. | `isolated` |
| 14 | **Shattered** | Debuff | Gets no benefit from Armor or Shield. | `shattered` |
| 15 | **Swiftness** | Buff | Ignores the next Stun effect applied (consumes one stack). | `swiftness` |
| 16 | **Intimidated** | Debuff | Cooldowns increased by 1 per stack. | `intimidated` |
| 17 | **Focus** | Buff | Reduces skill costs by 1 GEN per stack. | `focus` |
| 18 | **Confusion** | Debuff | Increases skill costs by 1 GEN per stack. | `confusion` |
| 19 | **Mark** | Debuff | When the bearer takes direct damage, they take 10 more damage and the Mark is consumed. | `mark` |
| 20 | **Taunted** | Debuff | Can only target the source of the Taunt. | `taunt` |
| 21 | **Immune** | Buff | Cannot have Debuffs applied. | `immune` |
| 22 | **Trap** *(hidden)* | Debuff | The bearer takes X damage the next time they use a Harmful skill. | `trap` |
| 23 | **Sanctify** | Debuff | When the bearer takes direct damage, the damager heals 15 HP. | `sanctify` |
| 24 | **Renew** | Buff | At the end of the applier's turn, heals 5 HP per stack, then loses 1 stack. | `renew` |

## Elements

### Fire

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Ignite** | Debuff | Takes 5 Affliction damage at the end of the applier's turn. Does not stack. If the applier is Flameborn, they heal for the damage dealt. | `ignite` |
| 2 | **Scorched** | Debuff | Healing received is halved (rounded up to the nearest 5). | `scorched` |
| 3 | **Flameborn** | Buff | Heals for the damage dealt by the bearer's Ignites, and heals 10 whenever the bearer's side causes an Explosion. | `flameborn` |

### Poison

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Toxin** | Debuff | Takes 5 Affliction damage per stack at the end of the applier's turn. Stacks. | `toxin` |
| 2 | **Prey (marked)** | Debuff | This unit is considered Prey. | `prey` |

### Holy

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Anointed** | Buff | A mark that empowers Holy skills. | `anointed` |
| 2 | **Condemned** | Debuff | The next time the bearer uses a skill, they randomly receive 1 Weakness, 1 Vulnerable or 1 Confusion, and Condemn is removed. | `condemned` |

### Ice

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Frostbitten** | Debuff | Unable to use Harmful Strategic skills. | `frostbitten` |
| 2 | **Chilled** | Debuff | Unable to have skill costs reduced. | `chilled` |
| 3 | **Numb** | Debuff | Cannot apply Buffs (to anyone, including themselves). | `numb` |
| 4 | **Frostborn** | Buff | Immune to Debuffs from Numb or Chilled units, and Invulnerable to Frostbitten units (they can't target or damage the bearer). | `frostborn` |

### Water

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Flow** | Buff | The bearer's skills ignore counters and reflects. | `flow` |

### Unholy

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Horrified** | Debuff | Can't gain Buffs. | `horrified` |
| 2 | **Immortal** | Buff | Health can't fall below 5. | `immortal` |
| 3 | **Soul Fragment** | Buff | +5 direct damage dealt per stack (1 Might each). Permanent until consumed. | `soul_fragment` |
| 4 | **Lifesteal** | Buff | Heals for the Health it removes from other characters. | `lifesteal` |

### Lightning

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Charged** | Buff | Charge (max 3). At 3, the owner generates 1 extra energy next turn and the Charge is spent. | `charged` |
| 2 | **Sapped** | Debuff | Max 3. At 3, the owner generates 1 less energy next turn and Sapped is removed. | `sapped` |
| 3 | **Stormborn** | Buff | Gains 1 Charge whenever it deals or receives damage (Charge caps at 3). | `stormborn` |
| 4 | **Conduit** | Buff | Steals all Charge from enemies it damages. Allies with Charge that use Helpful skills on it transfer their Charge to it. | `conduit` |

### Wind

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Rushing** | Buff | On gaining it and at the start of each of the bearer's turns: 1 Swiftness and 1 Focus (until the next skill) if they have none. Ends at the end of a turn in which the bearer used no skill. | `rushing` |
| 2 | **Leaping** | Buff | +5 direct damage. Ends once a skill of the bearer's has dealt direct damage and resolved. (Leaping also grants Invulnerable for 1 turn, applied separately.) | `leaping` |

### Shadow

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Stealth** | Buff | Untargetable by enemies. Skills give it for 2 turns. Ends after the bearer uses a skill that isn't Stealthy; a Stealthy skill extends it by 1 turn instead. | `stealth` |
| 2 | **Blinded** | Debuff | The primary target of the bearer's single-target skills is chosen at random. | `blinded` |

### Earth

*No named statuses: every Earth effect is defined inside its skill (see the end of this file).*

## Fusions

### Alchemy

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Catalyst** | Buff | The next skill that affects the bearer is doubled for them: twice the damage, healing, and the stacks and duration of what it applies. | `catalyst` |
| 2 | **Catalyst** | Debuff | The next skill that affects the bearer is doubled for them: twice the damage, healing, and the stacks and duration of what it applies. | `catalyst_debuff` |

### Angel

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Warded** | Buff | The first Harmful skill aimed at the bearer each turn is redirected to the Angel who Warded them. | `warded` |
| 2 | **Halo** | Buff | The first time the bearer would die, they heal to 25 HP instead, and the Halo is spent. | `halo` |
| 3 | **Vigil** | Debuff | Struck a Warded ally under Vigil; takes 15 damage at the end of the Angel's turn. | `vigil_mark` |

### Anointment

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Unction** | Buff | At the end of the applier's turn, one stack is used up to remove one of the bearer's Debuffs and heal them 10. | `unction` |
| 2 | **Chrism** | Buff | Counts as Anointed. When the bearer uses a Helpful skill on an ally, that ally is Anointed until the end of their next turn. | `chrism` |
| 3 | **Submission** | Debuff | Anointed enemies of the bearer deal 10 more damage to them. | `submission` |

### Antidote

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Inoculated** | Buff | The next Debuff applied to the bearer is prevented, and they're immune to that Debuff for 3 turns. | `inoculated` |
| 2 | **Immunity** | Buff | The bearer can't gain the Debuff this immunity was made against. | `immunity` |
| 3 | **Antivenom** | Neutral | When the bearer's Inoculation stops a Debuff, its source takes 10 Affliction. | `antivenom` |
| 4 | **Found Wound** | Debuff | While at or below 60 HP, the bearer counts as Prey. | `find_the_wound` |
| 5 | **Shared Absolution** | Debuff | While Sanctified, each direct hit on the bearer also heals every other ally of the damager 15. | `shared_absolution` |

### Apocalypse

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Frostfire** | Debuff | Counts as both an Ignite and Chilled. Takes 5 Affliction damage at the end of the applier's turn, and can't have skill costs reduced. | `frostfire` |
| 2 | **Thermal Shocked** | Neutral | Already Thermal Shocked this turn. | `thermal_shocked` |
| 3 | **Thermal Shock** | Neutral | When this character gives an enemy with a Fire debuff a Frost debuff, or the reverse, that enemy takes 15 Piercing damage and is Shattered for 1 turn (once per unit per turn). | `thermal_shock` |

### Assassin

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Death Mark** *(hidden)* | Debuff | Assassin skills from the marker's side deal the bearer 10 more, and one that leaves them at or below the Mark's threshold (25 HP) executes them. | `death_mark` |
| 2 | **Subcontract** | Buff | The bearer's skills count as Assassin skills against Death Marks. | `subcontract` |
| 3 | **Whispered Names** | Debuff | When the bearer's Mark is spent, a random other enemy is Marked for 1 turn and the whisper passes on. | `whispered_names` |

### Aurora

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Shimmer** | Buff | The bearer may pay colored costs with any color, as if they were random. | `shimmer` |
| 2 | **Dazzled** | Debuff | At the start of each of the bearer's turns, one of their player's energies changes to a random other color. | `dazzled` |

### Battery

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Cell** | Neutral | Stored charge (max 5) that never decays. Discharge skills spend all of it. | `cell` |
| 2 | **Corroded** | Debuff | The bearer's Shield loses 10 at the end of each of the applier's turns, and they can't gain Armor. | `corroded` |
| 3 | **Battery Core** | Neutral | Charge this character gains while at 3 becomes a Cell instead. | `battery_core` |

### Blight

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Withered** | Debuff | Max HP is 5 lower per stack (max 5), and HP above the new max is lost. Lasts until cleansed. Festering: at the end of its applier's turn, the bearer's Toxin gains 1 stack. | `withered` |
| 2 | **Imp-Bitten** | Debuff | When a Plague Imp dies, the bearer gains 1 Withered. | `imp_bitten` |

### Blood

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Hemorrhage** | Debuff | Max 5. At the end of its applier's turn, the bearer takes 5 Affliction per stack, then gains another stack. Any healing the bearer receives removes it entirely. | `hemorrhage` |

### Brimstone

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Sulfur** | Debuff | Max 4. Does nothing on its own. When the bearer takes Ignite damage or is hit by an Explosion, it Erupts: 10 Affliction per stack to them and 5 per stack to each of their allies, and every stack turns into 1 Toxin. | `sulfur` |

### Cloud

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Aloft** | Buff | Counts as Leaping (+5 direct damage, and Wind's Leaping payoffs) for its whole duration; dealing damage doesn't end it. It gives no Invulnerability. | `aloft` |
| 2 | **Drifting Damage** | Neutral | When this runs out, the bearer takes its value as damage. | `drifting_hit` |
| 3 | **Idle Updraft** | Buff | The bearer's Rushing doesn't end after a turn with no skill used. | `idle_updraft` |
| 4 | **Low Ceiling** | Debuff | Counts as Immobile, whatever mobility skills or buffs the bearer has. | `low_ceiling` |
| 5 | **Squall-marked** | Neutral | Used a Harmful skill under a Squall Line. | `squall_marked` |
| 6 | **Stormcloud** | Neutral | The last enemy to damage a Cloud Titan. | `cloud_titan_mark` |

### Crystal

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Brittle** | Debuff | Max 3. Takes 5 more direct damage per stack. At 3 stacks, the next direct hit Shatters them: 20 more damage, and they're Shattered for 2 turns. Shattering removes Brittle. | `brittle` |
| 2 | **Diamond** | Buff | No single hit can take more than 15 HP from the bearer (counted after Armor and Shield). Ticking damage counts as hits too. | `diamond` |

### Current

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Soaked** | Debuff | Takes 5 more damage from Current skills. When a single-target Current skill damages the bearer, the hit conducts: every other Soaked unit on their side takes the same damage. | `soaked` |
| 2 | **Conductor** | Neutral | This character's Current skills deal 5 more damage to Soaked units. | `current_conductor` |

### Curse

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Hex of Pain** | Debuff | Whenever the bearer deals direct damage, they take 10 Affliction. Lingers. | `hex_pain` |
| 2 | **Hex of Silence** | Debuff | The bearer's Strategic skills cost 1 more random energy. Lingers. | `hex_silence` |
| 3 | **Hex of Ruin** | Debuff | Whenever the bearer gains a Buff, they take 10 Affliction. Lingers. | `hex_ruin` |
| 4 | **Bad Luck** | Neutral | Whoever damages the Cat gains a random Hex for 2 turns. | `cat_curse` |
| 5 | **Evil Eye** | Debuff | When this ends, the Stun passes to an ally of the bearer who hasn't been Stunned by it. | `evil_eye` |

### Devil

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Hellfire** | Debuff | Counts as an Ignite (5 Affliction at the end of the applier's turn), and the bearer is Horrified (can't gain Buffs, Contracts included) while it lasts. | `hellfire` |
| 2 | **Contract** | Buff | A deal with a due date. When it expires, the Devil collects the price. | `contract` |
| 3 | **Devil's Ledger** | Neutral | When a unit holding this character's Contract dies, they gain 2 Soul Fragments. When a unit with their Price on Their Head dies, the killer's cooldowns reset and they gain 1 random energy. | `devils_ledger` |

### Dimension

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Banished** | Debuff | Out of the fight: can't act or be targeted by anyone, takes no damage, and their effects neither tick nor expire. | `banished` |
| 2 | **Banished** | Buff | Out of the fight: can't act or be targeted by anyone, takes no damage, and their effects neither tick nor expire. | `banished_ally` |
| 3 | **Entangled** | Neutral | Linked to other units on the same side; any effect applied to one is applied to the others too. | `entangled` |
| 4 | **Entangled (Buffs)** | Neutral | Linked to other allies; any Buff applied to one is applied to the others too. | `entangled_buffs` |

### Divine

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Exalted** | Buff | Counts as Anointed. The bearer's Radiant skills reach both sides: used on an ally, they also hit a random enemy; used on an enemy, they also help the ally with the least HP. | `exalted` |

### Dragon

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Dragonfire** | Debuff | Counts as Ignite, but deals 10 Affliction damage at the end of its applier's turn instead of 5. Applied to an Ignited unit, it upgrades the Ignite. | `dragonfire` |
| 2 | **Wyrm's Heart** | Neutral | Each time an Ignite or Dragonfire this character applied deals damage, they gain 1 Hoard. | `wyrm_heart` |
| 3 | **Hoard** | Buff | Max 6. Every 2 Hoard gives 1 Armor (every 1 during Elder Wyrm). Breath skills spend all of it for 5 more damage per Hoard to each target. | `hoard` |
| 4 | **Burning Wake** | Buff | Each Ignite the bearer applied also burns at the start of its bearer's turn. | `burning_wake` |
| 5 | **Warming Wings** | Buff | Each time an Ignite the bearer applied deals damage, their ally with the least HP heals as much. | `warming_wings` |
| 6 | **Elder Wyrm** | Buff | Every Hoard gives 1 Armor instead of every 2. | `elder_wyrm` |

### Evil

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Unhallowed** | Debuff | Any healing the bearer would receive, including Renew and Lifesteal, deals that much Affliction damage to them instead. | `unhallowed` |

### Evolution

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Telltale Venom** | Debuff | While the bearer has any Toxin, they count as Prey. | `telltale_venom` |
| 2 | **Delirium** | Debuff | Each Debuff stack on the bearer counts as 2 toward Prey. | `delirium` |
| 3 | **Hormesis** | Buff | Toxin on the bearer heals them for its damage instead of harming them. | `hormesis` |
| 4 | **Parasite Host** | Debuff | Carries a Parasite. Only this unit can target it, and it dies with them. | `parasite_host` |

### Faerie

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Charmed** | Debuff | The bearer's single-target skills pick their target at random from every other unit in the battle, friend or foe. | `charmed` |
| 2 | **Charmed** | Debuff | The bearer's single-target skills land on a random ally of their own. | `bewildered` |

### Ghost

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Spectral** | Buff | The bearer takes no Normal damage; Piercing and Affliction still hurt. | `spectral` |
| 2 | **Haunt** | Debuff | At the end of its applier's turn, the bearer takes 10 Affliction, then the Haunt drifts to a random ally of theirs (it stays if they have none). | `haunt` |
| 3 | **Vanished** | Neutral | Gone from the field; returns at the start of the bearer's next turn with 30 HP. | `vanished` |
| 4 | **Spirit Mark** | Debuff | Wherever the Haunt drifts, its new bearer is Horrified for 1 turn. | `spirit_mark` |
| 5 | **Beckoning** | Buff | The Taunted enemy's Normal damage can't hurt the bearer. | `beckoner` |

### Glacier

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Icebound** | Debuff | The bearer's cooldowns don't tick down. | `icebound` |
| 2 | **Meltwater** | Buff | The bearer's cooldowns tick down 1 extra at the end of each of their turns. | `meltwater` |

### Grave

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Gravekeeper** | Neutral | Whenever any unit or minion dies, on either side, this character gains 1 Grave (max 6). | `grave_keeper` |

### Ion

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Suppressed** | Debuff | The bearer's Buffs have no effect while it lasts; they still tick down and can still be removed. | `suppressed` |
| 2 | **Blackout** | Debuff | The bearer's minions can't use skills and their effects pause. | `blackout` |
| 3 | **Blackout** | Debuff | A blacked-out minion can't act, and its effects pause. | `blacked_out` |

### Lich

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Soulfrost** | Debuff | When the bearer takes direct damage, whoever applied this gains a Soul Fragment (once per turn). | `soulfrost` |
| 2 | **Phylactery** | Neutral | The bearer's soul is in a jar; while it stands, their HP can't drop below 1. | `phylactery_bond` |

### Life

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Grove Tender** | Neutral | Seedlings this character creates Bloom into Treants if they survive until the end of its second turn. | `life_grove` |
| 2 | **Blooming** | Neutral | Blooms into a Treant when this runs out. | `bloom_timer` |
| 3 | **Wild Growth** | Buff | Each allied Seedling that Blooms gives the bearer 1 Might for good. | `wild_growth` |

### Magnet

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Rebound** | Debuff | Struck the Rebound Plate; a Debuff will be Repelled onto them. | `rebound_mark` |
| 2 | **Opposite Pole** | Debuff | The only enemy the Opposite Poles user can target. | `opposite_pole` |

### Mechanic

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Contraption** | Neutral | A machine. Can't be healed or gain Renew (only Repair restores it), and ignores Stun, Sleep and Confusion. | `contraption` |
| 2 | **Upgrade** | Neutral | Upgrade level (max 3). +5 damage per level (each level also gave +10 max HP). | `upgraded` |

### Mist

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Fog** | Buff | Enemy single-target skills aimed at the bearer hit a random unit on their side instead. When Fog ends, it condenses into 2 Renew. | `fog` |

### Moon

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Lunar Cycle** | Neutral | Starts at New Moon and advances at the end of each of this character's turns: New, Waxing, Full, Waning. Moon skills add the current phase's rider. | `lunar_cycle` |
| 2 | **Moonshard** | Debuff | At the start of the next Full Moon, the shard deals 15 damage. | `moonshard` |
| 3 | **Howl** | Neutral | At each Full Moon, heals 20 and Taunts a random enemy for 1 turn. | `wolf_howl` |
| 4 | **Face of the Moon** | Buff | The bearer's Lunar Cycle holds at its current phase. | `face_of_the_moon` |

### Myth

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Legend** | Neutral | At 3 Legend, the bearer becomes Mythic for 3 turns; Legend resets when Mythic ends. | `legend` |
| 2 | **Mythic** | Buff | +20 max HP (and 20 healing), 2 Armor, can't be Stunned, and Myth skills gain their Mythic riders. | `mythic` |
| 3 | **Saga** | Neutral | Gains 1 Legend each time this character uses a Myth skill or kills an enemy or minion; at 3, they become Mythic. | `saga` |

### Night

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Dusk** *(hidden)* | Debuff | Counts down after each of the bearer's turns; at 0, Midnight puts the bearer in Frozen Sleep. | `dusk` |
| 2 | **Frozen Sleep** | Debuff | Asleep, and damage doesn't wake them. Counts as Frostbitten, Chilled and Numb. Afterwards, First Light for 2 turns. | `frozen_sleep` |
| 3 | **First Light** | Neutral | Can't gain Dusk. | `first_light` |
| 4 | **Dormant** | Buff | Can't use skills or be targeted by enemies (ticking and triggered damage still land). Gains 10 Shield at the end of each of their turns, and wakes with 1 Focus. | `dormant` |
| 5 | **Dormant** | Debuff | Can't use skills or be targeted by enemies (ticking and triggered damage still land). | `dormant_enemy` |

### Ninja

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Flurry** | Neutral | Each Harmful skill this character uses also deals each enemy it hit 5 Piercing per Shadow Clone. | `ninja_flurry` |
| 2 | **Substitution** | Buff | The first single-target enemy skill aimed at the bearer each turn hits a Shadow Clone instead. | `substitution` |

### Nomad

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Trek** | Neutral | Max 3. +1 at the end of each of the bearer's turns in which they used a different skill than on their previous turn; repeating a skill, or using none, resets it. | `trek` |
| 2 | **Wanderer** | Neutral | Tracks this character's Trek. | `nomad_trek` |
| 3 | **Mirage** *(hidden)* | Debuff | The bearer's next Harmful skill is countered; the one after lands. | `mirage` |
| 4 | **Mirage** *(hidden)* | Debuff | The bearer's next Harmful skill lands; the one after is countered. | `mirage_lull` |

### Ocean

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Brimming** | Buff | Renew healing that would take the bearer above max HP becomes Shield instead, up to 30. | `brimming` |
| 2 | **Brimming Shield** | Buff | Shield from Renew that overflowed (up to 30). | `brimming_shield` |
| 3 | **Slack Water** | Buff | The bearer's Renew doesn't lose stacks when it heals. | `slack_water_calm` |
| 4 | **Swell of the Deep** | Buff | Each time Brimming gives the bearer Shield, they gain 1 Might for 1 turn. | `swell_of_the_deep` |

### Phoenix

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Rebirth** | Buff | When the bearer would die, they burn to Ashes instead, and Rebirth ends. | `rebirth` |
| 2 | **Ashes** | Neutral | Until the start of the bearer's next turn, they're Untargetable and can't lose HP. Then they rise with 25 HP. | `ashes` |

### Plasma

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Heat** | Neutral | The bearer's Plasma skills deal 5 more damage per Heat. At the end of their turn with 5 Heat, they Melt Down. | `heat` |
| 2 | **Plasma Core** | Neutral | Gains 1 Heat whenever this character gains Charge. At the end of their turn with 5 Heat, they Melt Down: they take 20 Affliction, every enemy takes 20 Affliction and is Sapped, and Heat returns to 0. | `plasma_core` |
| 3 | **Broken Circuit** | Debuff | Can't use Channeled skills. | `breaker_arc` |

### Prism

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Lens** | Buff | The bearer's next skill doesn't Refract, and its direct damage is 50% stronger. Using a skill spends the Lens. | `lens` |

### Reanimation

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Galvanized** | Buff | If the bearer dies while Galvanized, they return at the end of that turn with 30 HP, Reanimated. Each character can be Reanimated once per match. | `galvanized` |
| 2 | **Reanimating** | Neutral | Struck down; returns at the end of this turn, Reanimated. | `reanimating` |
| 3 | **Reanimated** | Neutral | Back for good, but can't be healed or gain Renew, and loses 5 HP at the end of each of their turns. | `reanimated` |
| 4 | **Reprieve** | Buff | The next 5 HP loss from Reanimated is skipped. | `deadhand_reprieve` |

### Ritual

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Rite** | Neutral | Completes once the user (or their Acolytes) have used as many more skills as it has stacks. Breaks if the user is Stunned, falls Asleep or is Banished. | `rite` |
| 2 | **Veiled by Smoke** | Buff | The bearer's next skill counts as Stealthy. | `veiled_by_smoke` |

### Sanctuary

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Sanctum** | Buff | At the end of each of its side's turns, every ally gains 1 Armor per level (until that side's next turn) and heals 5 per level; at level 3, allies can't be Stunned. Doesn't run out while an allied Wardstone stands. | `sanctum` |
| 2 | **Steadfast (Sanctum)** | Buff | Can't be Stunned. | `sanctum_steady` |
| 3 | **Living Temple** | Buff | The bearer counts as a Wardstone. | `living_temple` |
| 4 | **Might (Stately Measure)** | Buff | +5 direct damage dealt per stack. | `stately_might` |
| 5 | **Shieldbearer's Mark** | Debuff | While Sanctified, each direct hit on the bearer gives the damager 15 Shield. | `shieldbearer` |

### Serum

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Dose** | Buff | At the end of its applier's turn, the bearer heals 5 per stack. At 4 Dose, they Overdose: 10 Affliction damage per stack, and all Dose is lost. | `dose` |

### Slime

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Engulfed** | Debuff | Inside an Ooze: Stunned, and 5 Affliction damage at the end of each of its owner's turns, until that Ooze dies or 3 turns pass. | `engulfed` |

### Spore

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Spores** | Debuff | At the end of its applier's turn, a bearer with 2 or more passes 1 to a random ally. At 3, a Mushroom sprouts from the bearer for the applier, and the bearer loses the 3. | `spores` |
| 2 | **Puff** | Neutral | At the end of each of its side's turns, a random enemy gains 1 Spore. | `mushroom_puff` |
| 3 | **Fed by the Colony** | Neutral | Whenever a Mushroom sprouts for this side, +10 max HP and heals 10. | `sporeling_feed` |
| 4 | **Fester Pod** | Neutral | Every Debuff on the bearer counts toward Prey. | `fester_pod` |
| 5 | **Infested** | Debuff | Each ally the bearer passes a Spore to is Confused for 2 turns. | `infest` |
| 6 | **Fungal Colossus** | Buff | Each Mushroom that would sprout for the bearer is absorbed instead (+1 Armor, heals 15). | `fungal_colossus` |

### Stasis

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Suspended** | Debuff | The bearer's effects don't tick, lose duration or deal damage while it lasts. When it ends, they Thaw: their Toxin deals its damage at once, doubled. | `suspended` |
| 2 | **Suspended** | Buff | The bearer's effects don't tick or lose duration while it lasts, so their Buffs hold. When it ends, they Thaw: their Toxin deals its damage at once, doubled. | `suspended_ally` |
| 3 | **Frozen Instant** | Neutral | When this runs out, the bearer takes half its value as Affliction damage. | `frozen_instant_hit` |

### Storm

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Tempest** | Neutral | The team's storm (max 5). At 5, the Eye of the Storm. | `tempest` |
| 2 | **Eye of the Storm** | Buff | The bearer's next Storm skill also strikes every other enemy for 15, and Tempest drops to 3. | `eye_of_the_storm` |
| 3 | **Storm Heart** | Neutral | +1 Tempest each time the team uses a Storm skill; −1 at the end of each of this character's turns in which none was used. At 5, the Eye of the Storm. | `storm_heart` |

### Sun

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Corona** | Buff | Max 3. At the end of the applier's turn, every enemy takes 5 Affliction per stack and every ally heals 5 per stack. | `corona` |
| 2 | **Sun's Heart** | Neutral | Tracks the turns since this character last dealt direct damage. | `sun_heart` |
| 3 | **High Noon** | Debuff | Can't target or damage the High Noon user. | `high_noon_shut` |

### Thunder

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Deafened** | Debuff | Counters, reflects and Traps that belong to the bearer can't trigger. | `deafened` |
| 2 | **Echo** | Neutral | When this runs out, the bearer takes its value as damage, and its owner gains 1 Charge. | `resound_echo` |
| 3 | **Rolling Echo** | Neutral | When this runs out, the bearer and their allies take its value as damage, and its owner gains 1 Charge. | `resound_echo_wide` |
| 4 | **Forked Echo** | Neutral | When this runs out, a random other unit on the bearer's side takes its value as damage, and its owner gains 1 Charge. | `resound_echo_fork` |
| 5 | **Concussive Echo** | Neutral | When this runs out, the bearer takes its value as damage and their Strategic skills are stunned for 1 turn; its owner gains 1 Charge. | `resound_echo_stun` |
| 6 | **Overcapacity** | Buff | Charge can build past 3 to 5; at 5, it's spent and the owner generates 2 extra energy next turn. | `overcapacity` |

### Vengeance

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Vow** | Buff | Each time an enemy damages the bearer with a skill, they gain 1 Wrath. | `vow` |
| 2 | **Wrath** | Buff | Max 3, kept until spent. The bearer's next direct damage deals 10 more per Wrath (to each target), and spending it gives 1 Charge per stack. | `wrath` |
| 3 | **Ledger of Wrongs** | Neutral | Remembers the damage each enemy dealt this character since their last turn. | `vengeance_ledger` |

### Vigilante

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Exposed** | Debuff | Can't become Stealthed, Invulnerable or Untargetable (any they have ends), and the Invisible effects they own are revealed. Vigilante skills deal them 10 more. | `exposed` |
| 2 | **Informant** | Neutral | Whoever damages the Informant is Exposed for 2 turns. | `informant_watch` |
| 3 | **Night Patrol (watched)** | Neutral | The patrol notes each Harmful skill the bearer uses. | `patrol_watch` |
| 4 | **Setup** | Debuff | Any ally of the bearer who gives them a Buff is Exposed for 2 turns. | `setup_watch` |
| 5 | **Swept** | Debuff | Each skill the bearer uses while Condemned also Blinds them for 1 turn. | `swept` |

### Winter

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Snowbound** | Debuff | Counts as a Frost debuff, and the bearer counts as Immobile. They lose their mobility buffs (Swiftness, Rushing, Leaping), can't gain new ones, and their mobility skills cost 1 more. | `snowbound` |

### Zealot

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Fervor** | Buff | +5 damage per stack to the bearer's Zealot skills (max 5). +1 whenever an enemy damages the bearer or gives them a Debuff. Martyr: when the bearer dies, each of their allies heals 10 per stack and gains 1 Might per 2. | `fervor` |
| 2 | **Fervent Chant** | Buff | If the bearer dies, they're a Martyr as if they had 3 Fervor. | `fervent_chant` |
| 3 | **Take the Blow** | Buff | The next single-target enemy skill aimed at the bearer hits the Initiate instead. | `take_the_blow` |
| 4 | **Unction** | Buff | Absorbs damage. | `unction_shield` |

## Story bosses

| # | Status | Kind | Description | id |
|---|---|---|---|---|
| 1 | **Tyrant's Pyre** | Neutral | At the start of each of its turns, a random enemy is Ignited for 2 turns. | `boss_cinder_tyrant` |
| 2 | **Queen's Venom** | Neutral | Its direct damage also gives the target 1 Toxin. | `boss_mire_queen` |
| 3 | **Inquisitor's Zeal** | Neutral | Heals 10 at the start of each of its turns. | `boss_high_inquisitor` |
| 4 | **Warden's Rime** | Neutral | Its icy armor takes 10 less Normal damage from every hit. | `boss_frost_warden` |
| 5 | **Rising Tide** | Neutral | Gains 1 Renew at the start of each of its turns. | `boss_tide_caller` |
| 6 | **Undying Crown** | Neutral | Can't drop below 5 Health while another enemy character stands. | `boss_barrow_king` |
| 7 | **Gathering Storm** | Neutral | Gains 1 Charge at the start of each of its turns. | `boss_storm_herald` |
| 8 | **Master's Poise** | Neutral | Gains 1 Swiftness (until its next turn) at the start of each of its turns. | `boss_gale_master` |
| 9 | **Dread Gaze** | Neutral | Enemies that damage it are Blinded for 1 turn. | `boss_nightmare` |
| 10 | **Living Rock** | Neutral | Starts each of its turns with 5 Shield (lasting until its next turn). | `boss_mountain_heart` |

## Effects defined inside skills (can reuse the skill icon)

| Source | Effect | Kind | Skill or minion |
|---|---|---|---|
| Base | Wolf Bite | Neutral | `wolf` |
| Base | Arcane Bolt | Neutral | `arcane_familiar` |
| Base | Riposte | Buff | `riposte` |
| Base | Snipe (aiming) | Neutral | `snipe` |
| Base | Channel | Neutral | `channel` |
| Base | Mislead | Debuff | `mislead` |
| Earth | Shale Guard | Buff | `riposte.earth` |
| Earth | Tunnelmaker (digging) | Neutral | `snipe.earth` |
| Earth | Boulder Trap | Debuff | `trap.earth` |
| Earth | Worldcaller | Neutral | `channel.earth` |
| Earth | Pitfall | Debuff | `mislead.earth` |
| Earth | Landslide | Buff | `dance.earth` |
| Earth | Earth Pillar | Debuff | `smite.earth` |
| Earth | Ancient Grudge | Debuff | `taunt.earth` |
| Fire | Dragon Breath | Neutral | `dragon_hatchling` |
| Fire | Cinder Burst | Neutral | `cinderling` |
| Fire | Blisterblade | Buff | `riposte.fire` |
| Fire | Heat Seeker (aiming) | Neutral | `snipe.fire` |
| Fire | Hidden Explosives | Debuff | `trap.fire` |
| Fire | Flamethrower | Neutral | `channel.fire` |
| Fire | Heat Haze | Debuff | `mislead.fire` |
| Fire | Ring of Fire | Debuff | `taunt.fire` |
| Holy | Zealous Rush | Buff | `charge.holy` |
| Holy | Retribution | Buff | `riposte.holy` |
| Holy | Spear of Light (aiming) | Neutral | `snipe.holy` |
| Holy | Holy Nova (lingering) | Neutral | `blast.holy` |
| Holy | Consecration | Neutral | `channel.holy` |
| Holy | Martyrdom | Debuff | `mislead.holy` |
| Holy | Saving Grace (lingering) | Buff | `prayer.holy` |
| Ice | Frost Spines | Buff | `riposte.ice` |
| Ice | Comet Shard (aiming) | Neutral | `snipe.ice` |
| Ice | Frost Snare | Debuff | `trap.ice` |
| Ice | Blizzard | Neutral | `channel.ice` |
| Lightning | Feedback Loop | Buff | `riposte.lightning` |
| Lightning | Particle Beam (charging) | Neutral | `snipe.lightning` |
| Lightning | Tesla Coil | Debuff | `trap.lightning` |
| Lightning | Lightningrod | Neutral | `channel.lightning` |
| Lightning | Hologram | Debuff | `mislead.lightning` |
| Lightning | Polarity | Debuff | `smite.lightning` |
| Lightning | Lightning Cage | Buff | `withstand.lightning` |
| Lightning | Aggro Signal | Debuff | `taunt.lightning` |
| Poison | Shed Skin | Buff | `riposte.poison` |
| Poison | Banewood Javelin (aiming) | Neutral | `snipe.poison` |
| Poison | Snake Pit | Debuff | `trap.poison` |
| Poison | Nine Plagues | Neutral | `channel.poison` |
| Poison | Numbing Needle | Debuff | `mislead.poison` |
| Poison | Preymark | Debuff | `smite.poison` |
| Shadow | Long Shadow | Buff | `charge.shadow` |
| Shadow | Mirage Blade | Buff | `riposte.shadow` |
| Shadow | Dream Seeker (aiming) | Neutral | `snipe.shadow` |
| Shadow | Dream Chains | Debuff | `trap.shadow` |
| Shadow | Nightsong | Neutral | `channel.shadow` |
| Shadow | Illusory Lure | Debuff | `mislead.shadow` |
| Unholy | Wraithwalk | Buff | `charge.unholy` |
| Unholy | Spiteful Retort | Buff | `riposte.unholy` |
| Unholy | Soul Lance (aiming) | Neutral | `snipe.unholy` |
| Unholy | Soul Shackle | Debuff | `trap.unholy` |
| Unholy | Grave Step | Buff | `maneuver.unholy` |
| Unholy | Drain Life | Neutral | `channel.unholy` |
| Unholy | Drain Life | Debuff | `channel.unholy` |
| Unholy | Mirage of Nightmares | Debuff | `mislead.unholy` |
| Unholy | Soul Sickness | Debuff | `smite.unholy` |
| Unholy | Jaws of Hell | Neutral | `hellhound_jaws` |
| Water | Surge | Buff | `charge.water` |
| Water | Riverbend | Buff | `riposte.water` |
| Water | Tidal Arrow (aiming) | Neutral | `snipe.water` |
| Water | Whirlpool Trap | Debuff | `trap.water` |
| Water | Call Rain | Neutral | `channel.water` |
| Water | Dunk | Debuff | `mislead.water` |
| Water | Aqua Ring | Debuff | `smite.water` |
| Water | Tidal Pull (reset on Flow) | Neutral | `taunt.water` |
| Wind | Elegant Sweep (winding up) | Neutral | `snipe.wind` |
| Wind | Float Noose | Debuff | `trap.wind` |
| Wind | Vortex | Neutral | `channel.wind` |
| Wind | Wind Step | Debuff | `mislead.wind` |
| Wind | Feathermark | Debuff | `smite.wind` |

Fusion skills define 995 more inline effects across 55 fusions.
