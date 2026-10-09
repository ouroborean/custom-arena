# Devil — animation brief

Group id: `devil`. Element(s): Fire + Unholy. Concept file: `docs/animations/concepts/devil.yaml`.
Skill source: `packages/content/data/fusions/devil/skills.devil.yaml`; minions: `packages/content/data/fusions/devil/minions.devil.yaml`; statuses: `packages/content/data/fusions/devil/statuses.devil.yaml`.

## Skills (33)

### `strike.devil` — Infernal Edge
- Strike · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 25 damage to target enemy. If they have Hellfire, it spreads to a random ally of theirs for 1 turn; if not, they gain it for 1 turn.
- applies: hellfire · ops: damage, if, apply

### `smash.devil` — Infernal Crush
- Smash · cost SS · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 40 damage to target enemy. For each Buff they have, a random ally of theirs gains Hellfire for 2 turns.
- applies: hellfire · ops: damage, repeat, apply

### `charge.devil` — Hellbent
- Charge · cost free · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- The user loses 15 HP. Deals 25 damage to target enemy, and the user gains 2 Focus for their next skill.
- applies: focus · ops: damage, apply

### `riposte.devil` — Devil's Due
- Riposte · cost r · cooldown 3 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, counters any Harmful skill used on the user, and a random Buff of its user's moves to the user, or, if they have none, they take 15 Affliction damage. Invisible.
- inline statuses: devils_due · ops: apply, if, stealRandom, damage
  - inline `devils_due` (Buff, hidden; triggers: skillTargeted/counter): Counters Harmful skills used on the bearer; a random Buff of each one's user moves to the bearer, or, if they have none, they take 15 Affliction.

### `rage.devil` — Faustian Fury
- Rage · cost Sr · cooldown 4 · target **self** · tags Helpful, Strategic
- The user gains a Contract (3 turns): 2 Might, Flameborn and Immortal now; price: 30 Affliction damage and Horrified for 2 turns.
- applies: might, flameborn, immortal, horrified · inline statuses: faustian_contract · ops: apply, damage
  - inline `faustian_contract` (Buff): Price when it expires: 30 Affliction damage and Horrified for 2 turns.

### `shot.devil` — Infernal Coin
- Shot · cost r · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 15 damage to target enemy. An Ignite on them becomes Hellfire for 2 turns; if they already had Hellfire, the user gains 1 Soul Fragment.
- applies: soul_fragment, hellfire · ops: damage, if, apply, removeEffect

### `snipe.devil` — Collection Day
- Snipe · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic, Channeled, HiddenTarget
- On the following turn, deals 40 damage to target enemy; if they have a Contract, its price is collected now, doubled. The target of this skill is invisible. Channeled.
- inline statuses: collection_day · ops: apply, damage, expire
  - inline `collection_day` (Neutral): Strikes its target at the end of the following turn and collects their Contract, doubled.

### `trap.devil` — Fine Print
- Trap · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a skill, they gain a Contract (2 turns): 1 Swiftness now; price: Stunned for 1 turn and 2 Weakness. Invisible.
- applies: swiftness, stun, weakness · inline statuses: fine_print, fine_print_contract · ops: apply
  - inline `fine_print` (Debuff, hidden; triggers: skillUsed): The bearer's next skill gives them a Contract.
  - inline `fine_print_contract` (Neutral): Price when it expires: Stunned for 1 turn and 2 Weakness.

### `maneuver.devil` — Put It on My Tab
- Maneuver · cost I · cooldown 2 · target **self** · tags Helpful, Strategic, Invisible
- For 1 turn, each hit on the user is delayed and becomes a Contract whose price, at the end of their next turn, is half that damage as Affliction. Invisible.
- inline statuses: on_my_tab · ops: apply
  - inline `on_my_tab` (Neutral): Each hit on the bearer is delayed and becomes a Contract; its price is half that damage, as Affliction.

### `companion.devil` — Imp Notary
- Companion · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Imp Notary (25 HP) permanently. Offer (I): target unit gets a Contract (2 turns): 1 Might now; price: 10 Affliction damage. Sealing Wax (r): 10 Affliction damage, and Hellfire on a Contract holder.
- summons: imp_notary · ops: summon

### `bolt.devil` — Borrowed Fire
- Bolt · cost Ir · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 35 damage to target enemy, and the user gains a Contract (2 turns) whose price is 15 Affliction damage, waived if that enemy has died by then.
- inline statuses: borrowed_fire · ops: damage, apply, if
  - inline `borrowed_fire` (Neutral): Price when it expires: 15 Affliction damage, waived if the enemy it hit has died.

### `blast.devil` — Hellstorm
- Blast · cost SIr · cooldown 2 · target **allEnemies** · tags Harmful, NonStrategic
- Deals 20 damage to all enemies. The user spends all their Soul Fragments (up to 3), and every enemy gains Hellfire for 1 turn per fragment spent.
- applies: hellfire · ops: damage, set, repeat, removeStacks, if, apply

### `consume.devil` — Collect
- Consume · cost S · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 5 damage to target enemy, who gains a Contract (2 turns) whose price is 20 Affliction damage; the user heals as much as it deals.
- inline statuses: collect_debt · ops: damage, apply, set, heal
  - inline `collect_debt` (Neutral): Price when it expires: 20 Affliction damage, and the applier heals as much.

### `summon.devil` — Imp Captain
- Summon · cost S · cooldown 1 · target **self** · tags Helpful, Strategic
- Summons an Imp Captain (25 HP) for 3 turns. Ember Whip (r): 10 damage to target enemy. Its hits deal 5 more per Soul Fragment the user has, without spending them.
- summons: imp_captain · ops: summon

### `channel.devil` — Soulburn
- Channel · cost rr · cooldown 3 · target **enemy** · tags Harmful, NonStrategic, Channeled
- For up to 3 turns, target enemy has Hellfire, and at the end of each of the user's turns it burns them for 10 more Affliction damage. Channeled.
- applies: hellfire · inline statuses: soulburn · ops: apply, damage
  - inline `soulburn` (Neutral; triggers: turnEnd): Holds Hellfire on the target and burns them for 10 more Affliction each turn.

### `stab.devil` — Pitchfork
- Stab · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy and removes a random Buff of theirs; if they have none, it deals 20 instead.
- ops: if, damage, removeRandom

### `ravage.devil` — Hellraze
- Ravage · cost SA · cooldown 2 · target **enemy** · tags Harmful, NonStrategic
- Deals 35 Piercing damage to target enemy. If they have Buffs, those become a Contract: they keep them for 1 turn, then lose their Buffs and pay 10 Affliction damage per Buff they had.
- inline statuses: hellraze_contract · ops: damage, if, apply, removeKind
  - inline `hellraze_contract` (Neutral): Price when it expires: their Buffs are lost, and 10 Affliction damage per Buff they had.

### `mislead.devil` — Soul Snare
- Mislead · cost r · cooldown 3 · target **enemy** · tags Harmful, Strategic, Invisible
- For 1 turn, if target enemy uses a Harmful skill, it's countered, and the user gains a Soul Fragment for each Ignite and Scorch they have. Invisible.
- applies: soul_fragment · inline statuses: soul_snare · ops: apply
  - inline `soul_snare` (Debuff, hidden; triggers: skillUsed/counter): The bearer's next Harmful skill is countered; the applier gains a Soul Fragment for each Ignite and Scorch on the bearer.

### `stun.devil` — Hellbound
- Stun · cost SA · cooldown 3 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy, who gains Hellfire for 1 turn. For 3 turns, they're Stunned while they have Hellfire, but never on two of their turns in a row.
- applies: hellfire · inline statuses: hellbound · ops: damage, apply, setCounter, if
  - inline `hellbound` (Debuff; triggers: turnStart): Stunned while the bearer has Hellfire, but never on two of their turns in a row.

### `dance.devil` — Dance with the Devil
- Dance · cost S · cooldown 2 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains 1 Swiftness and 1 Focus, and Ignites they apply also burn at the start of each of their turns.
- applies: swiftness, focus · inline statuses: dance_with_the_devil · macros: ignite_tick · ops: apply, forEach, macro
  - inline `dance_with_the_devil` (Buff; triggers: turnStart): The bearer's Ignites also burn at the start of each of their turns.

### `heal.devil` — Fair Trade
- Heal · cost W · cooldown 3 · target **ally** · tags Helpful, Strategic
- Target ally and the enemy with the most HP both have their HP set to the average of the two: the ally heals exactly what that enemy loses.
- ops: forEach, set, if, damage, heal

### `bless.devil` — Pact of Flame
- Bless · cost W · cooldown 2 · target **ally** · tags Helpful, Strategic
- Target ally receives a Contract (2 turns): Lifesteal now; price: 20 Affliction damage, minus the HP they healed meanwhile.
- applies: lifesteal · inline statuses: pact_of_flame · ops: apply, setCounter, if, damage
  - inline `pact_of_flame` (Buff; triggers: healed): Price when it expires: 20 Affliction damage, minus the HP healed meanwhile.

### `curse.devil` — Double or Nothing
- Curse · cost r · cooldown 2 · target **enemy** · tags Harmful, Strategic
- Target enemy gains Hellfire for 1 turn. Then, at random, either each of their Debuffs gains 1 more stack and lasts 2 turns longer, or the user gains 1 Soul Fragment.
- applies: hellfire, weakness, vulnerable, toxin, confusion, soul_fragment · ops: apply, random, extendEffects, forEach, if

### `smite.devil` — Price on Their Head
- Smite · cost Sr · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy. If they die within 2 turns, whoever killed them has their cooldowns reset, and the user's player gains 1 random energy.
- inline statuses: price_on_their_head · ops: damage, apply
  - inline `price_on_their_head` (Debuff): Whoever kills the bearer has their cooldowns reset; the applier gains 1 energy.

### `prayer.devil` — Choir of the Pit
- Prayer · cost Srr · cooldown 2 · target **allAllies** · tags Helpful, Strategic
- All allies heal 20, and all enemies are Horrified for 1 turn. For as long, each Helpful skill used on a Horrified enemy (whose Buffs fail) gives a random ally of the user 1 Might instead.
- applies: horrified, might · inline statuses: choir_of_the_pit · ops: heal, apply, if
  - inline `choir_of_the_pit` (Debuff; triggers: skillTargeted): While Horrified, each Helpful skill used on the bearer gives a random enemy of theirs 1 Might.

### `cleave.devil` — Co-signed Debt
- Cleave · cost S · cooldown 1 · target **enemy** · tags Harmful, NonStrategic
- Deals 20 damage to target enemy, and a random other enemy gains a Contract (2 turns) whose price is half of all the damage the target takes until it's due (this hit included), as Affliction damage.
- inline statuses: cosigned_debt, cosigned_debtor · ops: damage, set, forEach, setCounter, apply
  - inline `cosigned_debt` (Neutral): Price when it expires: half of the damage the Debtor took meanwhile (rounded down to 5), as Affliction damage.
  - inline `cosigned_debtor` (Neutral; triggers: damaged): All the damage the bearer takes is added to the price of the other enemy's Co-signed Debt.

### `shout.devil` — Infernal Toll
- Shout · cost S · cooldown 3 · target **allEnemies** · tags Harmful, Strategic
- For 2 turns, each skill an enemy uses deals them 5 Affliction damage per energy it cost.
- inline statuses: infernal_toll · ops: apply, if, damage
  - inline `infernal_toll` (Debuff; triggers: skillUsed): Each skill the bearer uses deals them 5 Affliction damage per energy it cost.

### `withstand.devil` — Bargained Aegis
- Withstand · cost r · cooldown 3 · target **self** · tags Helpful, Strategic
- The user gains a Contract (2 turns): 40 Shield now; price: any Shield left is lost and dealt to them as Affliction damage.
- inline statuses: bargained_aegis · ops: apply, damage
  - inline `bargained_aegis` (Buff): A Shield. Price when it expires: what's left is dealt to the bearer as Affliction.

### `taunt.devil` — Dare the Damned
- Taunt · cost S · cooldown 3 · target **enemy** · tags Harmful, Strategic
- Target enemy is Taunted by the user for up to 3 turns, until they've dealt the user 30 damage in total.
- applies: taunt · inline statuses: dare_the_damned · ops: setCounter, apply, if, removeEffect
  - inline `dare_the_damned` (Neutral; triggers: damaged): An enemy the bearer Taunted stays Taunted until they've dealt the bearer 30 damage.

### `titan.devil` — Archfiend
- Titan · cost SW · cooldown 4 · target **self** · tags Helpful, Strategic
- For 3 turns, the user gains Immune and Lifesteal, and each enemy they damage gains Hellfire for 1 turn.
- applies: immune, lifesteal, hellfire · inline statuses: archfiend · ops: apply
  - inline `archfiend` (Buff; triggers: dealtDamage): Each enemy the bearer damages directly gains Hellfire for 1 turn.

### `imp_notary_offer` — Offer (minion skill of `imp_notary`)
- Minion · cost I · cooldown 0 · target **any** · tags Radiant, Strategic
- Target unit gets a Contract (2 turns): 1 Might now; price: 10 Affliction damage.
- applies: might · inline statuses: imp_offer · ops: apply, damage
  - inline `imp_offer` (Buff): Price when it expires: 10 Affliction damage.

### `imp_notary_sealing_wax` — Sealing Wax (minion skill of `imp_notary`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 Affliction damage to target enemy, and Hellfire for 1 turn if they hold a Contract.
- applies: hellfire · ops: damage, if, apply

### `imp_captain_ember_whip` — Ember Whip (minion skill of `imp_captain`)
- Minion · cost r · cooldown 0 · target **enemy** · tags Harmful, NonStrategic
- Deals 10 damage to target enemy.
- ops: damage

## Minions (2)

A minion acts through its skills (above) and its passives' triggers (below): concept the passive actions too.

- `imp_notary` — Imp Notary, 25 HP; skills: imp_notary_offer, imp_notary_sealing_wax
- `imp_captain` — Imp Captain, 25 HP; skills: imp_captain_ember_whip
  - passive `imp_captain_rally`: Its hits deal 5 more per Soul Fragment its summoner has.

## Named statuses defined here (4) — this group owns their default animations

- `hellfire` — Hellfire (Debuff; triggers: turnEnd): Counts as an Ignite (5 Affliction at the end of the applier's turn), and the bearer is Horrified (can't gain Buffs, Contracts included) while it lasts. _Applied by skills in: devil._
- `contract` — Contract (Buff): When it expires, the bearer pays its price. _Applied by skills in: none directly._
- `devils_tab` — On the Tab (Neutral): A Contract. Price when it expires: half its value as Affliction damage. _Applied by skills in: none directly._
- `devils_ledger` — Devil's Ledger (Neutral; triggers: signal): When a unit holding this character's Contract dies, they gain 2 Soul Fragments. When a unit with their Price on Their Head dies, the killer's cooldowns reset and they gain 1 random energy. _Applied by skills in: none directly._
