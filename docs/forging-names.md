# Forging names

Implemented: the tables live in `packages/content/data/items/forging.yaml` (the source of truth), and
`describePiece` in `@arena/engine` builds names from them. Forging itself is described in
`docs/equipment.md` §6.

Names for forged equipment. A forged piece holds up to 3 components (skills, element shards, at most
1 passive) and is named `[prefix] Base [of Suffix]` from them:

| Components | Name |
|---|---|
| 1 skill | the skill's base item (below) |
| 2 skills | the pair name (below) |
| 3 skills | the third skill's **prefix** + the pair name of the first two, in the order the player forged them: Charge onto a Saint Bow is a *Reckless Saint Bow*, Shot onto a Battle Censer is a *Hawkeye's Battle Censer* |
| skill(s) + element(s) | an `<Element>-Infused` or `<Fusion>-Infused` prefix: *Fire-Infused Warhelm*, then *Sun-Infused Warhelm* with Earth added |
| 1 shard | *<Element> Shard* |
| 2 shards | *<Fusion> Crystal*; Ice + Ice is the **Pure Crystal** (not "Crystal Crystal") |
| a passive | adds *of <Suffix>*; a passive on its own is a **Sigil** (*Sigil of …*) |

A piece never carries two prefixes: a 3-skill piece is full, and a skill pair has room for only one shard.
A passive is allowed on a piece without the skill it improves (it just does nothing until the wearer
has that skill).

Naming rules: pair names have no possessives (prefixes may), no "of" (the suffix's word), no element or
fusion words (the infusion prefixes' words), and every name is unique. A pair can be two simple items joined
with "&" (*Sword & Shield*, *Bell & Book*); "& Shield" is the go-to for pairing a skill with Withstand.

## Base items and third-skill prefixes

| Skill | Base item | Prefix |
|---|---|---|
| Strike | Longsword | Keen |
| Smash | Greathammer | Crushing |
| Charge | Spear | Reckless |
| Riposte | Rapier | Duelist's |
| Rage | Warhelm | Berserker's |
| Shot | Shortbow | Hawkeye's |
| Snipe | Longrifle | Patient |
| Trap | Snare | Trapper's |
| Maneuver | Grapnel | Elusive |
| Companion | Totem | Packleader's |
| Bolt | Wand | Spellslinger's |
| Blast | Tome | Cataclysmic |
| Consume | Orb | Hungering |
| Summon | Glove | Conjurer's |
| Channel | Circlet | Resonant |
| Stab | Dagger | Cutthroat |
| Ravage | Hatchets | Butcher's |
| Mislead | Smoke Bomb | Deceiver's |
| Stun | Blackjack | Staggering |
| Dance | Scimitars | Whirling |
| Heal | Mace | Mending |
| Bless | Chalice | Hallowed |
| Curse | Effigy | Bewitching |
| Smite | Sceptre | Righteous |
| Prayer | Hymnal | Devout |
| Cleave | Battleaxe | Sweeping |
| Shout | Warhorn | Bellowing |
| Withstand | Shield | Steadfast |
| Taunt | Banner | Defiant |
| Titan | Fullplate | Colossal |

## Skill pairs (435)

Each pair is listed once, under whichever of its skills comes first in the base skill order.

### Strike +

| With | Name |
|---|---|
| Smash | Bastard Sword |
| Charge | Cavalry Sabre |
| Riposte | Smallsword |
| Rage | Barbarian Sword |
| Shot | Sword & Bow |
| Snipe | Bayonet |
| Trap | Sword & Net |
| Maneuver | Hook Sword |
| Companion | Sword & Hound |
| Bolt | Spellblade |
| Blast | Rune Claymore |
| Consume | Soul Drinker |
| Summon | Flying Sword |
| Channel | Runesword |
| Stab | Sword & Dagger |
| Ravage | Falchion |
| Mislead | Sword Cane |
| Stun | Sword & Cudgel |
| Dance | Bladesong |
| Heal | Sword & Salve |
| Bless | Paladin Sword |
| Curse | Hexblade |
| Smite | Sword & Scales |
| Prayer | Crusader Sword |
| Cleave | Greatsword |
| Shout | Sword & Horn |
| Withstand | Sword & Shield |
| Taunt | Bladed Gauntlets |
| Titan | Zweihander |

### Smash +

| With | Name |
|---|---|
| Charge | Battering Ram |
| Riposte | Rebound Maul |
| Rage | War Maul |
| Shot | Mortar |
| Snipe | Trebuchet |
| Trap | Deadfall |
| Maneuver | Wrecking Ball |
| Companion | Mammoth Tusk |
| Bolt | Runehammer |
| Blast | Meteor Hammer |
| Consume | Bone Club |
| Summon | Ogre Fist |
| Channel | Seismic Rod |
| Stab | Morning Star |
| Ravage | Bonecrusher |
| Mislead | Ambush Maul |
| Stun | Skullcracker |
| Dance | Flail |
| Heal | Bonesetter |
| Bless | Hammer & Chalice |
| Curse | Witch Hammer |
| Smite | Judgment Hammer |
| Prayer | Temple Bell |
| Cleave | Poleaxe |
| Shout | Gong |
| Withstand | Anvil |
| Taunt | Brawler Gauntlets |
| Titan | Giant Maul |

### Charge +

| With | Name |
|---|---|
| Riposte | Pike |
| Rage | War Lance |
| Shot | Javelin |
| Snipe | Ballista |
| Trap | Net & Trident |
| Maneuver | Vaulting Pole |
| Companion | War Saddle |
| Bolt | Comet Lance |
| Blast | Bursting Lance |
| Consume | Leech Lance |
| Summon | Phantom Steed |
| Channel | Arcane Lance |
| Stab | Partisan |
| Ravage | Boar Spear |
| Mislead | Mirage Spear |
| Stun | Tilting Lance |
| Dance | Glaive |
| Heal | Pilgrim Staff |
| Bless | Battle Censer |
| Curse | Wraith Lance |
| Smite | Templar Lance |
| Prayer | Processional Staff |
| Cleave | Halberd |
| Shout | Herald Lance |
| Withstand | Spear & Shield |
| Taunt | Lance & Pennant |
| Titan | Juggernaut |

### Riposte +

| With | Name |
|---|---|
| Rage | Grudge Foil |
| Shot | Answering Bow |
| Snipe | Overwatch |
| Trap | Tripwire |
| Maneuver | Swashbuckler Cape |
| Companion | Watchdog Collar |
| Bolt | Counterspell Wand |
| Blast | Backlash Tome |
| Consume | Sanguine Rapier |
| Summon | Warding Familiar |
| Channel | Echoing Diadem |
| Stab | Rapier & Dagger |
| Ravage | Thorn Rapier |
| Mislead | Gambit Foil |
| Stun | Swordbreaker |
| Dance | Rapier & Fan |
| Heal | Fencer Balm |
| Bless | Oath Rapier |
| Curse | Retribution Doll |
| Smite | Rapier & Sceptre |
| Prayer | Vigil Rapier |
| Cleave | Bearded Axe |
| Shout | Rapier & Horn |
| Withstand | Rapier & Buckler |
| Taunt | Thrown Gauntlet |
| Titan | Thornmail |

### Rage +

| With | Name |
|---|---|
| Shot | Warbow |
| Snipe | Vendetta Rifle |
| Trap | Bear Trap |
| Maneuver | Leaping Claws |
| Companion | Direwolf Pelt |
| Bolt | Wild Magic Wand |
| Blast | Fury Tome |
| Consume | Ravenous Helm |
| Summon | Ancestral Spirits |
| Channel | Tempest Circlet |
| Stab | Rabid Fang |
| Ravage | Reaver Hatchets |
| Mislead | Warpaint |
| Stun | Horned Helm |
| Dance | Battle Trance |
| Heal | Battle Tonic |
| Bless | Martyr Helm |
| Curse | Bedlam Mask |
| Smite | Scourge |
| Prayer | Battle Hymn |
| Cleave | Warlord Axe |
| Shout | Helm & Horn |
| Withstand | Helm & Shield |
| Taunt | Red Banner |
| Titan | Behemoth Plate |

### Shot +

| With | Name |
|---|---|
| Snipe | Longbow |
| Trap | Huntsman Bow |
| Maneuver | Skirmisher Bow |
| Companion | Bow & Falcon |
| Bolt | Spell Arrows |
| Blast | Bomb Arrows |
| Consume | Thirsting Arrows |
| Summon | Spirit Quiver |
| Channel | Starfall Bow |
| Stab | Hand Crossbow |
| Ravage | Barbed Arrows |
| Mislead | Smoke Arrows |
| Stun | Bolas |
| Dance | Acrobat Bow |
| Heal | Salve Darts |
| Bless | Saint Bow |
| Curse | Hex Arrows |
| Smite | Seraph Bow |
| Prayer | Vesper Bow |
| Cleave | Throwing Axe |
| Shout | Whistling Arrows |
| Withstand | Pavise |
| Taunt | Beacon Arrow |
| Titan | Arbalest |

### Snipe +

| With | Name |
|---|---|
| Trap | Stalker Rifle |
| Maneuver | Ranger Cloak |
| Companion | Spotter Owl |
| Bolt | Spellscope |
| Blast | Handcannon |
| Consume | Draining Rifle |
| Summon | Scrying Eye |
| Channel | Spyglass |
| Stab | Blowgun |
| Ravage | Big Game Rifle |
| Mislead | Decoy Rifle |
| Stun | Sleep Darts |
| Dance | Twin Pistols |
| Heal | Remedy Darts |
| Bless | Halo Sight |
| Curse | Omen Rifle |
| Smite | Silver Bullet |
| Prayer | Bell Tower |
| Cleave | Chakram |
| Shout | Echo Rifle |
| Withstand | Rampart Rifle |
| Taunt | Flare Gun |
| Titan | Culverin |

### Trap +

| With | Name |
|---|---|
| Maneuver | Trapdoor |
| Companion | Snare & Hound |
| Bolt | Rune Trap |
| Blast | Powder Keg |
| Consume | Pitcher Plant |
| Summon | Mimic |
| Channel | Binding Circle |
| Stab | Caltrops |
| Ravage | Maneater |
| Mislead | False Floor |
| Stun | Weighted Net |
| Dance | Silk Snare |
| Heal | Safety Net |
| Bless | Halo Snare |
| Curse | Witch Knot |
| Smite | Penance Chain |
| Prayer | Rosary |
| Cleave | Pendulum Trap |
| Shout | Alarm Bell |
| Withstand | Barricade |
| Taunt | Lure Flag |
| Titan | Portcullis |

### Maneuver +

| With | Name |
|---|---|
| Companion | Courser Bridle |
| Bolt | Blink Wand |
| Blast | Flash Powder |
| Consume | Eclipse Orb |
| Summon | Changeling |
| Channel | Phase Circlet |
| Stab | Cloak & Dagger |
| Ravage | Raider Hook |
| Mislead | Shroud |
| Stun | Dazzle Flare |
| Dance | Featherstep Boots |
| Heal | Rescue Hook |
| Bless | Feathered Cloak |
| Curse | Wisp Lantern |
| Smite | Falling Star |
| Prayer | Monk Robe |
| Cleave | Boarding Axe |
| Shout | Signal Horn |
| Withstand | Kite Shield |
| Taunt | Matador Cape |
| Titan | Siege Tower |

### Companion +

| With | Name |
|---|---|
| Bolt | Raven Rod |
| Blast | Wyvern Totem |
| Consume | Vampire Bat |
| Summon | Menagerie |
| Channel | Shaman Rattle |
| Stab | Jackal Fang |
| Ravage | Warg Collar |
| Mislead | Fox Mask |
| Stun | Bear Paw |
| Dance | Charmer Flute |
| Heal | Unicorn Horn |
| Bless | White Stag |
| Curse | Black Cat |
| Smite | Griffon Crest |
| Prayer | Guardian Lion |
| Cleave | Tiger Claws |
| Shout | Hound Whistle |
| Withstand | Tortoise Shell |
| Taunt | Bull Horns |
| Titan | War Elephant |

### Bolt +

| With | Name |
|---|---|
| Blast | Battlestaff |
| Consume | Wither Wand |
| Summon | Imp Wand |
| Channel | Wizard Staff |
| Stab | Athame |
| Ravage | Wand & Hatchet |
| Mislead | Glamour Wand |
| Stun | Daze Wand |
| Dance | Conductor Baton |
| Heal | Caduceus |
| Bless | Benediction Rod |
| Curse | Malediction Rod |
| Smite | Lawgiver Staff |
| Prayer | Crozier |
| Cleave | Forked Wand |
| Shout | Command Rod |
| Withstand | Wand & Shield |
| Taunt | Goad Staff |
| Titan | Obelisk |

### Blast +

| With | Name |
|---|---|
| Consume | Abyssal Grimoire |
| Summon | Portal Tome |
| Channel | Maelstrom Circlet |
| Stab | Shrapnel Bomb |
| Ravage | Spiked Bombs |
| Mislead | Phantasm Tome |
| Stun | Concussion Bomb |
| Dance | Starburst Fan |
| Heal | Wellspring Tome |
| Bless | Radiant Tome |
| Curse | Plague Tome |
| Smite | Heavenfall Codex |
| Prayer | Choir Book |
| Cleave | Sundering Axe |
| Shout | Siege Trumpet |
| Withstand | Blast Shield |
| Taunt | Blunderbuss |
| Titan | Siege Engine |

### Consume +

| With | Name |
|---|---|
| Summon | Soul Jar |
| Channel | Vampire Crown |
| Stab | Lamprey Knife |
| Ravage | Ghoul Claws |
| Mislead | Siren Mask |
| Stun | Lethargy Orb |
| Dance | Danse Macabre |
| Heal | Leech Jar |
| Bless | Communion Chalice |
| Curse | Sin Eater |
| Smite | Orb & Sceptre |
| Prayer | Tithe Bowl |
| Cleave | Scythe |
| Shout | Drinking Horn |
| Withstand | Devourer Shield |
| Taunt | Feast Banner |
| Titan | Leviathan Hide |

### Summon +

| With | Name |
|---|---|
| Channel | Seance Candle |
| Stab | Spectre Knife |
| Ravage | Fiend Gauntlet |
| Mislead | Doppelganger Mask |
| Stun | Gargoyle |
| Dance | Marionette Strings |
| Heal | Glowmoth Jar |
| Bless | Cherub Idol |
| Curse | Haunted Doll |
| Smite | Valkyrie Helm |
| Prayer | Reliquary |
| Cleave | Haunted Axe |
| Shout | Gjallarhorn |
| Withstand | Sentinel Idol |
| Taunt | Scarecrow |
| Titan | Golem Heart |

### Channel +

| With | Name |
|---|---|
| Stab | Runed Dirk |
| Ravage | Razor Wheel |
| Mislead | Mesmer Circlet |
| Stun | Lullaby Chimes |
| Dance | Dervish Crown |
| Heal | Laurel Wreath |
| Bless | Halo |
| Curse | Miasma Censer |
| Smite | Crown & Sceptre |
| Prayer | Prayer Wheel |
| Cleave | Orbiting Axes |
| Shout | Singing Bowl |
| Withstand | Aegis |
| Taunt | Beacon Lantern |
| Titan | Mountain Crown |

### Stab +

| With | Name |
|---|---|
| Ravage | Kukri |
| Mislead | Smoke & Daggers |
| Stun | Garrote |
| Dance | War Fans |
| Heal | Lancet |
| Bless | Misericorde |
| Curse | Kris |
| Smite | Silver Stake |
| Prayer | Confessor Knife |
| Cleave | Tomahawk |
| Shout | Dagger & Whistle |
| Withstand | Spiked Targe |
| Taunt | Spurs |
| Titan | Iron Maiden |

### Ravage +

| With | Name |
|---|---|
| Mislead | Wolfskin Cloak |
| Stun | Spiked Knuckles |
| Dance | Twin Sickles |
| Heal | Cautery Iron |
| Bless | Penitent Flail |
| Curse | Hag Claws |
| Smite | Executioner Axe |
| Prayer | Flagellant Whip |
| Cleave | Labrys |
| Shout | Hunting Horn |
| Withstand | Sawtooth Shield |
| Taunt | Gore Banner |
| Titan | Spiked Plate |

### Mislead +

| With | Name |
|---|---|
| Stun | Brass Knuckles |
| Dance | Masquerade Mask |
| Heal | Snake Oil |
| Bless | Indulgence |
| Curse | Jinx Charm |
| Smite | Witchfinder Hat |
| Prayer | False Idol |
| Cleave | Concealed Axe |
| Shout | False Alarm |
| Withstand | Illusory Wall |
| Taunt | Red Herring |
| Titan | Hollow Armor |

### Stun +

| With | Name |
|---|---|
| Dance | Tanglefoot |
| Heal | Smelling Salts |
| Bless | Dazzling Chalice |
| Curse | Gorgon Mask |
| Smite | Gavel |
| Prayer | Cloister Bell |
| Cleave | War Pick |
| Shout | Shrieking Mandrake |
| Withstand | Bashing Shield |
| Taunt | Knuckleduster |
| Titan | Siege Gauntlets |

### Dance +

| With | Name |
|---|---|
| Heal | Maypole |
| Bless | Celebrant Veil |
| Curse | Tarantella |
| Smite | Sabre Dance |
| Prayer | Jubilee Ribbons |
| Cleave | Twin Crescents |
| Shout | Wardrum |
| Withstand | Scimitar & Shield |
| Taunt | Peacock Fan |
| Titan | Iron Greaves |

### Heal +

| With | Name |
|---|---|
| Bless | Ambrosia |
| Curse | Wormwood |
| Smite | Lightbringer |
| Prayer | Psalter |
| Cleave | Bone Saw |
| Shout | Bagpipes |
| Withstand | Mace & Shield |
| Taunt | Field Banner |
| Titan | Trollhide |

### Bless +

| With | Name |
|---|---|
| Curse | Fate Coin |
| Smite | Sceptre & Chalice |
| Prayer | Grail |
| Cleave | Consecrated Glaive |
| Shout | Gilded Trumpet |
| Withstand | Votive Shield |
| Taunt | Oriflamme |
| Titan | Gilded Plate |

### Curse +

| With | Name |
|---|---|
| Smite | Damnation Brand |
| Prayer | Bell & Book |
| Cleave | Bane Axe |
| Shout | Screaming Skull |
| Withstand | Hexward |
| Taunt | Jester Mask |
| Titan | Revenant Plate |

### Smite +

| With | Name |
|---|---|
| Prayer | Scripture |
| Cleave | Arbiter Axe |
| Shout | Doom Trumpet |
| Withstand | Sceptre & Shield |
| Taunt | Crusade Banner |
| Titan | Archon Plate |

### Prayer +

| With | Name |
|---|---|
| Cleave | Monk Spade |
| Shout | Carillon |
| Withstand | Abbey Shield |
| Taunt | Pulpit |
| Titan | Cathedral Plate |

### Cleave +

| With | Name |
|---|---|
| Shout | Axe & Horn |
| Withstand | Axe & Shield |
| Taunt | Champion Axe |
| Titan | Giant Axe |

### Shout +

| With | Name |
|---|---|
| Withstand | Shieldwall |
| Taunt | Warbanner |
| Titan | Overlord Helm |

### Withstand +

| With | Name |
|---|---|
| Taunt | Tower Shield |
| Titan | Bastion Shield |

### Taunt +

| With | Name |
|---|---|
| Titan | Citadel Plate |

## Passive suffixes (120)

One per passive, from the item it comes from (the item's other components become their own pieces).
A passive on its own is a *Sigil of …*; on a piece it ends the name: *Fire-Infused Warhelm of Defiance*.

| Passive from | Suffix | Passive |
|---|---|---|
| Wind Katana | of Momentum | Your Strikes deal 5 additional damage, plus 5 damage for every mana in their total cost. |
| Magma Hammer | of Eruptions | Smash skills deal 10 additional damage to all targets but their cost is increased by 1 GEN. |
| Water Spear | of the Torrent | Charge now changes Specific costs to Random costs for 1 turn, and deals 5 additional damage. |
| Poison Rapier | of Reprisal | Once per round, Riposte will reset its cooldown when triggered. |
| Unholy Cleaver | of Defiance | Your Rage skills give you 10 Shield for each 20 HP you're missing when you use them. |
| Ice Kunai | of Fixation | Your Shot skills deal 5 additional damage every time they're used against the same target, stacking. |
| Shadow Arbalest | of Inevitability | The target of your Snipe skills is now visible, but your Snipes now Bypass and cannot be Countered. |
| Vine Whip | of Brambles | The cooldown of your Trap skills is reduced by 1 turn if it fails to activate. |
| Lightsaber Dirk | of Shelter | Your Maneuver skills can be used on an ally, but their cooldowns are increased by 1. |
| Ice Claw | of Kinship | Minions from your Companion skills have all their costs changed to GEN. |
| Fire Sceptre | of Kindling | Your Bolt skills receive double benefit from Might. |
| Holy Book | of Requiem | Your Blast skills deal 10 additional damage for each dead enemy. |
| Twisted Wand | of Sacrifice | Consume may be used on allied Summoned Minions, instantly killing it to Heal 10 Health and add 10 Shield. |
| Sacrificial Dagger | of Soulbinding | Your Summon is also healed whenever you are. |
| Holy Censer | of Devotion | You gain 10 Shield at the end of each turn you maintain your Channel skills. |
| Scything Claw | of Opportunity | When Stab activates its bonus effect, all your current Cooldowns are decreased by 1. |
| Lightning Dagger | of the Ambush | Your Ravage skills deal 5 additional damage for each ally that acted before you that turn. |
| Mist Fan | of Vapors | When Mislead is triggered, your skills Bypass for 1 turn. |
| Sun Baton | of Fracture | Enemies affected by your Stuns are Shattered for the duration. |
| Hoop Blade | of Rhythm | Using a skill reduces the remaining cooldown of your Dance skills by 1. |
| Wind Charm Stick | of Solace | Your Heal skills heal an additional 5 health over the following 2 turns. (No bonus immediately) |
| Anointment Mace | of Sanctity | Using Bless on a target causes them to ignore non-damage effects for 1 turn. |
| Brimstone Lash | of Harvest | Gain 1 random energy whenever an enemy affected by your Curse dies. |
| Book of Shadows | of Mercy | Your Smite skills have their cost reduced by 1 GEN, but they no longer deal damage. |
| Book of the Damned | of Abundance | Increases the cooldown of Prayer by 1 turn. Any targets at full health after the heal will also be affected by Bless. |
| Paladin Axe | of Echoes | Your Cleave skills deal 5 Piercing damage to any enemy they don't affect directly. |
| Lightning Banner | of Dread | Gain 10 Shield whenever an enemy affected by your Shout acts. |
| Wind Shield | of Thorns | Deals 10 Piercing damage to any enemy that damages you during your Withstand skills. |
| Ice Hammer | of Enmity | Your Taunt skills have unlimited duration, but cannot be used while active. |
| Chemtech Sword | of Respite | Heal for 10 health when Titan expires, increased to 20 if you are at or below 40 HP. |
| Soldier Spear | of the Vanguard | After using a Charge skill, your next Riposte costs no energy. |
| Soldier Greataxe | of Wrath | You will automatically use Charge on the first enemy to damage you when you Rage. |
| Kusurigama | of Quickening | Gain 1 Swiftness when you Stun an enemy. |
| Dual Blackjacks | of Treachery | Successfully Countering an enemy with Mislead resets the cooldown of your Stun ability. |
| Ancient Longbow | of the Falcon | After using a Maneuver, your Snipe skills will hit instantly for 1 turn. |
| Tracker's Whistle | of the Pack | Maneuvers that only target the user are also used on every Companion. |
| Warlock Staff | of Composure | Consumes no longer interrupt Channeled skills. |
| Summoner's Scrollstaff | of Conjuration | When you start Channeling, your Summons' skills have no cost on the following turn. |
| Staff and Shield | of Salvation | Using Withstand while below 40 Health will also activate Bless. |
| High Priest Staff | of the Faithful | If any target affected by your Prayer is also affected by your Bless, the Bless will also be applied to all allies. |
| Dual Claws | of the Beast | Your Rage costs an additional Generic, but also casts your Companion when used. |
| Tree Club | of the Wilds | During Titan, your Companion gains 20 HP, 1 Might and 1 Armor. |
| Spear and Shield | of Discipline | Charge deals double damage if Withstand was not broken. |
| Sword and Shield | of Chivalry | Taunted targets receive 1 Weakness, and the user gains 1 Might during their Withstand. |
| Dagger and Orb | of Gluttony | Killing an enemy with Consume makes your next Curse cost no energy. |
| Cultist Scythe | of Cruelty | Consume deals 10 affliction damage when used on a Stun target. This damage is not affected by other modifiers. |
| Staff and Beads | of Contrition | If your Withstand's Shield is broken, your Prayer costs 1 less Specific energy for 1 turn. |
| Dual Tonfa | of Balance | Gain 1 Swiftness when you Withstand, and 1 Armor while Dance is active. |
| Mace and Greatshield | of Burden | At the start of battle, the user permanently gains 2 Armor and 1 Weakness |
| Paladin's Greatsword | of Valor | Gain 1 Might when you buff an ally, up to 1 per ally. Gain 1 Armor when you buff yourself, up to 2. |
| Emblem of the Inferno | of the Inferno | Ignite may stack an additional time. |
| Emblem of the Arc Furnace | of the Furnace | Shattered enemies take 5 additional damage whenever they take Effect damage. |
| Emblem of the Hellfire | of Hellfire | Dealing damage to an ally grants the user a random buff until the end of their next turn |
| Emblem of the Glacier | of the Floe | You gain double benefit from Armor while Frostborn. |
| Emblem of the Permafrost | of Permafrost | All allies begin the game with 10 Shield. Minions are created with 5 Shield. |
| Emblem of the Frostflame | of Frostflame | When this character gains new Shield, they deal 5 Affliction damage to all enemies. |
| Emblem of the Gale | of the Gale | Gain 1 Might every turn while Rushing. This Might is lost if Rush ends. |
| Emblem of the Miasma | of Miasma | Deal 10 additional damage to each enemy. This effect is disabled for any enemy that damages you. |
| Emblem of the Monsoon | of the Monsoon | Heal 10 Health whenever a Swiftness is removed by a Stun. |
| Emblem of the Tempest | of the Tempest | Gain 15 Shield whenever you gain energy from Charge. This Shield refreshes but does not stack. |
| Emblem of the Blackout | of the Blackout | Deal 10 damage to any target that attempts to become Invulnerable. This effect can only happen once per turn per target. |
| Emblem of the Aurora | of Caprice | Each turn, randomly gain Might, Armor, Swiftness, Focus, Stormborn, or Frostborn |
| Emblem of the Tide | of the Tide | Gain 1 Swiftness whenever Flow is triggered. If you have Swiftness already, gain Focus until the end of your next turn instead |
| Emblem of the Abyss | of the Abyss | When you Counter or Reflect an enemy skill, deal 10 Piercing damage to the Countered enemy, or 5 Piercing damage to the enemy Reflected to and from. |
| Emblem of the Bloodtide | of the Bloodtide | Heal for 5 Health whenever you use a damaging ability. |
| Emblem of the Mountain | of the Mountain | Heal for 5 Health whenever Channel Earth occurs |
| Emblem of the Sanctuary | of the Haven | Until you use a Harmful skill, you heal 10 Health every turn |
| Emblem of the Magma | of Magma | Deal double damage to minions. This effect can only trigger on one creature each turn. |
| Emblem of the Serpent | of the Serpent | Permanently gain 1 Might or 1 Armor, depending whether you damaged an enemy or were damaged by an enemy. |
| Emblem of the Neurotoxin | of Neurotoxin | Ending your turn without spending all of your energy grants a random ally Might for 1 turn. |
| Emblem of the Bog | of the Bog | Allied minions deal 5 Affliction damage to a random target when they die |
| Emblem of the Void | of the Void | If you end your turn without acting, extend the duration of any active Invulnerability effects by 1 turn. This can only happen once per effect |
| Emblem of the Phantom | of the Phantom | Deal 10 additional Piercing damage whenever you damage an Invulnerable enemy. |
| Emblem of the Eclipse | of the Eclipse | Dealing damage with Mark effects applies 1 Weakness for 1 turn. |
| Emblem of the Sun | of the Dawn | Dealing damage to a Sanctified enemy grants you 1 Might. |
| Emblem of the Seraph | of the Seraph | Become Invulnerable for 1 turn the first time you are Stunned each round |
| Emblem of the Font | of the Font | Anointing an ally removes all debuffs from them. |
| Emblem of the Grave | of the Tomb | Gain 1 Might and heal for 10 Health when an allied hero is killed. |
| Emblem of the Plague | of the Plague | Stackable debuffs you cause or receive are permanent. |
| Emblem of the Lich | of the Crypt | You and your Minions gain 5 Shield whenever you use a Harmful skill. |
| Barbarian Greatclub | of Havoc | Whenever you damage all living enemies, deal 5 additional Piercing damage to all enemies. |
| Helmet of the Ancestors | of the Ancestors | Once per turn if you would take 30 or more damage from a single ability, first lower that damage by 10 |
| Shadowrune Bolas | of Bewilderment | Stunning a target affected by Swiftness applies Confusion for the same duration. |
| Mask of Many Faces | of Guises | You gain 5 Shield whenever a skill is Countered or Reflected, increased to 10 for enemy skills. |
| Boomerang Blade | of Comeuppance | For 1 turn after a Trap is triggered, your skills Bypass against the triggerer. |
| Ricochet Rifle | of Ricochets | Deal 10 damage to a random enemy whenever one of your Harmful skills is Countered. |
| Explosive Relic | of Ambition | Using a skill that costs 2 or more total energy grants the user Focus until the end of their next turn. |
| High Wizard's Hat | of Serenity | If you are Stunned while Channeling a skill, you gain Immune until the end of your next turn. |
| Hand of Blessing | of Generosity | The first Buff you apply to an ally each turn is also applied to you. |
| Robe of the Song | of Song | While your health is 60 or below, your Helpful skills cannot be Stunned. |
| Totem of the Fallen | of the Fallen | Gain 1 Might for 1 turn whenever an allied Minion is killed by an enemy. |
| Cloak of Ancient Leaves | of Hubris | Gain 1 Might and 1 Vulnerable while at or above 80 Health. |
| Banner of Glory | of Glory | Remove a random Debuff from all allies when you Shout |
| Knight's Buckler | of Rebuttal | Countering or Reflecting a skill applies 1 Weakness and 1 Vulnerable to the target for 2 turns |
| Rod of Domination | of Domination | Damage that would be dealt to you is instead dealt to one of your Minions at random. You take double damage while you have no Minions. |
| Blood Chalice | of Culling | Automatically kill Minions that fall to 10 or lower health, gaining a random Buff. |
| Visor of the Restful Spirit | of Tranquility | At the start of your turn, gain 2 Might if you weren't damaged last turn. |
| Footwraps of the Long Path | of the Wanderer | Using a Harmful skill makes your Helpful skills Unstunnable for 1 turn. |
| Hand of Healing | of Selflessness | Using Heal on an ally also heals you for 10 Health, but you may no longer Heal yourself. |
| Golden Plate | of Scars | Gain 1 Armor per 35 missing Health. |
| Crown of Flames | of Cinders | Your Shout, Curse, and Taunt skills deal 10 Affliction damage to a random enemy when used. |
| Flame Whip | of Grief | Trap, Riposte, and Mislead skills have their cooldowns reset when an allied character dies. |
| Frozen Gauntlets | of Rime | After using Cleave, Withstand, or Blast skills, increase any Shield you have by 10. |
| Glacial Pendant | of Hoarfrost | Heal for 5 Health whenever one of your Stun or Curse skills expires, increased to 10 if you are at or below 40 Health |
| Winged Sandals | of Flight | Once per turn, taking new damage lowers the cooldown of a random Charge, Dance or Maneuver by 1 |
| Rocfeather Cloak | of the Roc | Your Strike and Cleave skills deal 5 additional damage for each Swiftness you have. |
| Electroblade | of Sparks | Your Strike, Bolt and Charge skills deal 5 Piercing damage to two random targets when used. |
| Cybernetic Enhancements | of Clockwork | Your Dance, Titan, and Rage skills grant 1 Might, 1 Armor, and 1 Swiftness for 1 turn. |
| Chalice of Life | of Reverie | Gain 1 Focus each turn your Channel or Rage skills are active. When these skills end, gain 1 Confusion. |
| Trident of the Deep | of the Deep | Gain 1 Renew when using Bless, Heal, or Withstand skills. |
| Crown of the Caller | of the Caller | Your Summon and Companion skills share Buffs with you. |
| Earthcaller's Hammer | of Humbling | Your Stun and Smash skills remove a random Buff from their primary target. |
| Lotus Essence | of the Lotus | Ravage and Consume extend the duration of non-Stun Debuffs on the target by 1 turn. |
| Cryptid Dagger | of Predation | Stab and Strike skills deal 5 more damage to Prey. |
| Cloak of Night | of Dusk | Your Mislead, Riposte, and Maneuver skills have 1 less cooldown, to a minimum of 1. |
| Wightblades | of the Wight | Your Stab and Shot abilities deal 5 less damage, but they Bypass and cannot be Countered. |
| Revered Crown | of Reverence | Apply 5 Shield to allies you heal, and heal allies you Shield for 5 Health. This Healing and Shielding cannot be modified, and cannot cause Triggers. |
| Penance Lash | of Penance | Effects applied by your Bolt and Smite skills last an additional turn. |
| Helm of the Damned | of the Damned | Your Bless and Curse skills grant you 1 Might or 1 Armor for their duration. |
| The Black Blade | of the Usurper | Your Ravage and Charge skills steal a random non-Elemental Buff from their primary target. |
