// The reference's own words (ported from the Element Arena Reference site's content/*.md): the home
// page's "How the game works", the element and fusion overviews, each element's tagline and themes, and
// each fusion's tagline, "plays like" line and notes. Nothing mechanical:
// every skill, keyword, status, term and class comes from the content bundle (reference/data.ts).
// `**bold**` marks emphasis; keep these in step with the game when a rule changes or a kit is reworked.

/** The ten base elements, in the order the reference lists them. */
export const ELEMENTS = ['Fire', 'Ice', 'Water', 'Lightning', 'Wind', 'Poison', 'Earth', 'Holy', 'Unholy', 'Shadow'] as const;

export interface ProseSection {
  title: string;
  /** Bullet points, each with a bold lead-in. */
  items: { lead: string; text: string }[];
}

export const HOME = {
  lead: 'Every skill, element, fusion and status in the game, worded exactly as the game has them. New to the game? Start with how it works below. Looking something up? Pick a section, or press / to search.',
  howItWorks: {
    title: 'How the game works',
    items: [
      {
        lead: 'Battles are three against three.',
        text: "Each side fields three characters with 100 Health. Players take turns: on yours, you queue at most one skill for each of your characters (and minions), put them in order, and they resolve in that order. A team wins when every enemy character is down; minions don't count.",
      },
      {
        lead: 'Characters and classes.',
        text: 'A character has a class and up to five skills. Each of the ten classes can use six of the 30 base skills: three signature skills and three borrowed from a neighboring class, so every skill belongs to two classes. Every character also has a base element, with an infusion of it to place on one of its skills, and equipment can add more skills and infusions.',
      },
      {
        lead: 'Energy pays for skills.',
        text: "There are four colors: Strength (red), Agility (green), Intelligence (blue) and Wisdom (white). A dashed square in a cost is random: any color pays for it, and Free costs nothing. At the start of your turn you gain one energy of a random color for each of your living characters. Unspent energy carries over, your opponent can't see your pool, and once a turn you can trade 2 energy of one color for 1 of another.",
      },
      {
        lead: 'Cooldowns.',
        text: "A skill with cooldown (CD) 1 can't be used on your next turn; CD 0 skills can be used every turn.",
      },
      {
        lead: 'Elements are infusions.',
        text: "There are ten elements. An infusion placed on a skill turns it into that element's version: Strike becomes Fire's Torch Strike. Each element has its own version of all 30 skills, and its own statuses and terms.",
      },
      {
        lead: 'Two infusions make a fusion.',
        text: "A skill can hold two infusions, and two make the pair's fusion element: Fire + Fire is Dragon, Fire + Ice is Apocalypse, in either order. The 55 fusions each have their own version of all 30 skills and their own keywords.",
      },
      {
        lead: 'Statuses.',
        text: 'Skills give Buffs, Debuffs and other effects, such as Might, Stunned or Ignite. Each is defined on the Statuses & terms page, and underlined words in skill text link to their definitions.',
      },
    ],
  } satisfies ProseSection,
};

export const ELEMENTS_LEAD =
  "An infusion turns a skill into one of the ten elements' versions. Each element has its own version of all 30 base skills, its own statuses and terms, and ten fusions it makes with a second infusion.";

export const ELEMENT_PROSE: Record<(typeof ELEMENTS)[number], { tagline: string; themes: string }> = {
  Fire: {
    tagline: 'Spread Ignite across the enemy team, make it Explode, and heal through the flames while Flameborn.',
    themes: 'Spread, detonation, sustain through burning',
  },
  Ice: {
    tagline: 'Shield your allies and lock enemies down with the three Frost debuffs: Frostbitten, Chilled and Numb.',
    themes: 'Shielding, hindering, oppression',
  },
  Water: {
    tagline: 'Heal over time with Renew, disrupt with Confusion and longer Stuns, and bring cooldowns back sooner.',
    themes: 'Healing, disruption, tempo',
  },
  Lightning: {
    tagline: "Build Charge into extra energy, Sap the enemy's, and chain hits from target to target.",
    themes: 'Resource management, target-chaining, consistency',
  },
  Wind: {
    tagline: 'Rush for Swiftness and Focus, Leap out of reach, and react before the enemy can.',
    themes: 'Reactivity, immunity, speed',
  },
  Poison: {
    tagline: 'Stack Toxin and Debuffs until the target is Prey, then cash it in.',
    themes: 'Affliction, debilitation, patience',
  },
  Earth: {
    tagline: 'Armor up, heal, and fill the field with minions: Boulders, Seedlings and more.',
    themes: 'Armor, healing, minions',
  },
  Holy: {
    tagline: 'Anoint to empower Holy skills, heal, and penalize enemies with Sanctify and Condemn.',
    themes: 'Healing, Anointment benefits, penalties',
  },
  Unholy: {
    tagline: "Drain Health, collect Soul Fragments for extra damage, and Horrify enemies so they can't gain Buffs.",
    themes: 'Life drain, Soul Fragments, Debuffs',
  },
  Shadow: {
    tagline: 'Slip into Stealth, Blind and deceive the enemy, and interfere with their plans.',
    themes: 'Untargetability, deception, interference',
  },
};

export const FUSIONS = {
  lead: 'Two infusions on one skill make a fusion: 55 fusion elements, each with its own keywords and its own version of all 30 skills. Pick one from the matrix or the list, or filter the list below by keyword or parent element.',
  howTheyWork: {
    title: 'How fusions work',
    items: [
      {
        lead: 'Two infusions make a fusion.',
        text: "A skill with one infusion becomes that element's version of the skill (Fire's Strike is Torch Strike). A skill with two infusions becomes the version of the pair's fusion element: Fire + Fire is **Dragon**, Fire + Ice is **Apocalypse**. Order doesn't matter, so Ice + Fire is Apocalypse too. The ten elements make 55 fusions: ten pure ones (one element twice) and 45 pairs.",
      },
      {
        lead: 'Every fusion has all 30 skills.',
        text: 'Each fusion has its own version of every base skill, from Strike to Titan, with its own name, cost, cooldown and effect.',
      },
      {
        lead: 'Each fusion has its own keywords.',
        text: "New statuses and rules that its skills use, listed at the top of its page and in the keyword glossary. Some fusions also have a passive: any character carrying at least one of that fusion's skills has it for the whole battle.",
      },
    ],
  } satisfies ProseSection,
};

export interface KitProse {
  /** The fusion's id in the content bundle (elements/fusions.yaml). */
  id: string;
  tagline: string;
  playsLike: string;
  notes?: string[];
}

/** Every fusion's tagline, "plays like" line and notes. The reference lists fusions by element (each
 * pair under both its elements), built in reference/data.ts. */
export const KITS: KitProse[] = [
  {
    id: 'dragon',
    tagline: 'Fire at its peak: a wyrm whose burns fill its hoard, whose hoard hardens its scales, and who spends it all on one breath.',
    playsLike: 'Grows hotter and harder, then spends it all on one breath',
  },
  { id: 'crystal', tagline: 'Ice made perfect: flawless for allies, fatally flawed for enemies.', playsLike: 'Shatter combos on offense, burst-proof allies on defense' },
  { id: 'ocean', tagline: 'Water without limits: every skill rises and falls like a wave.', playsLike: 'A rhythm: plan which half of each skill lands when' },
  {
    id: 'thunder',
    tagline: "The sound after the flash: every strike lands twice, and the roar drowns out the enemy's tricks.",
    playsLike: "Hits twice, and switches off the enemy's tricks",
  },
  {
    id: 'cloud',
    tagline: 'Wind that gathers instead of rushing: slow, telegraphed, and heavy when it breaks.',
    playsLike: "Wind's speed traded for weight: slow, telegraphed, heavy",
  },
  { id: 'evolution', tagline: 'Poison that adapts: every use evolves the skill.', playsLike: "Weak openers that become the team's strongest skills" },
  {
    id: 'life',
    tagline: 'Earth that grows: a garden that becomes a grove, and a team that keeps getting bigger.',
    playsLike: 'A garden, and a team that keeps getting bigger',
  },
  {
    id: 'divine',
    tagline: 'Holy made absolute: one light that heals whoever it touches on your side and burns whoever it touches on theirs.',
    playsLike: 'Always useful: heal or smite as the turn needs',
  },
  { id: 'evil', tagline: 'Unholy with nothing held back: it poisons healing itself, and spends souls like coin.', playsLike: 'Punishes healers, feeds on souls' },
  {
    id: 'dimension',
    tagline: 'Shadow folded into space: pull a unit out of the fight, or tie two together so one effect lands twice.',
    playsLike: 'Takes a unit out of play; makes one effect count twice',
  },
  { id: 'apocalypse', tagline: 'The world ending both ways at once, and the shock where fire meets ice.', playsLike: 'Alternate fire and ice for combo damage' },
  { id: 'alchemy', tagline: 'Fire and water in the crucible: nothing is destroyed, only changed.', playsLike: 'Converts the board: their buffs become your weapons' },
  { id: 'plasma', tagline: 'Fire and lightning past their limits: power you ride until it melts down.', playsLike: 'Push your luck, then time the meltdown' },
  {
    id: 'mechanic',
    tagline: 'Fire in the boiler, wind in the bellows: machines you build, tune and send into the fight.',
    playsLike: 'A small workshop of machines, built and tuned',
  },
  { id: 'brimstone', tagline: 'Sulfur and hellfire: pack the enemy with fuel, then light it.', playsLike: 'Load them up, then light the fuse' },
  { id: 'sun', tagline: 'Fire over earth: a star that scorches the enemy and ripens everything on your side.', playsLike: 'A slow-burning star on your side of the board' },
  { id: 'phoenix', tagline: 'A holy flame that burns its foes, mends its friends, and rises from its own ashes.', playsLike: 'Burn the foe, mend the friend, rise again' },
  { id: 'devil', tagline: 'Fire and damnation: everything is for sale, and the bill always comes.', playsLike: 'Deals for allies, tempting gifts for enemies' },
  {
    id: 'ritual',
    tagline: 'Fire in the dark: candles, circles and rites that pay off only if nobody breaks them.',
    playsLike: 'Big payoffs the enemy must race to interrupt',
  },
  {
    id: 'glacier',
    tagline: "Ice that moves at its own pace: freeze the enemy's clock and let yours run.",
    playsLike: 'Freeze their clock, speed up yours',
    notes: ["A tempo kit: Ice's lockdown aimed at cooldowns, and Water's cooldown relief pushed further."],
  },
  {
    id: 'aurora',
    tagline: 'Ice and lightning lit up across the sky: the kit that bends energy colors.',
    playsLike: 'The energy-color kit: free yourself, scramble them',
    notes: ['Lightning changes how much energy a player has; Aurora changes which colors they have.'],
  },
  { id: 'winter', tagline: 'Ice on the wind: the season that pins everything in place.', playsLike: "Pins targets down, then uses Wind's tools against the Immobile" },
  {
    id: 'stasis',
    tagline: 'Cold that stops the clock on poison: freeze the afflictions in place, then let them all go at once.',
    playsLike: 'Freeze the poison, then release it all',
  },
  {
    id: 'myth',
    tagline: 'Ice and stone that remember: the old legends of the frozen north, and the hero who becomes one.',
    playsLike: 'A hero who becomes a giant of legend',
  },
  { id: 'prism', tagline: 'Light through ice: split it to reach everyone, or focus it to burn through one.', playsLike: 'Split light to spread it, focus it to burst' },
  {
    id: 'lich',
    tagline: 'Cold undeath: a sorcerer who hid their soul in a jar, and freezes the souls of others.',
    playsLike: "Break the jar first, or the Lich won't die",
  },
  {
    id: 'night',
    tagline: 'The cold that comes unseen, for enemies; chosen stillness, for allies.',
    playsLike: 'The cold that comes unseen, on a clock only you can see',
    notes: ['Dusk is hidden from the enemy, but the battle log still shows who used Evening Star on whom, so an attentive opponent can count the clocks.'],
  },
  { id: 'current', tagline: 'Water carries lightning: soak the enemy team, and one strike runs through all of them.', playsLike: 'Soak the team, and one hit becomes three' },
  { id: 'mist', tagline: "Water on the wind: a fog where nobody can tell who they're hitting.", playsLike: 'Hides who is vulnerable; shields a carry by chance' },
  {
    id: 'serum',
    tagline: 'Water and poison in one syringe: the dose makes the medicine, and the dose makes the poison.',
    playsLike: 'Medicine for allies, an overdose for enemies',
  },
  {
    id: 'slime',
    tagline: 'Water and earth become ooze: it splits when struck, swallows what it touches, and keeps coming back.',
    playsLike: 'A multiplying swarm that is hard to clear',
  },
  {
    id: 'anointment',
    tagline: 'Holy water: blessings that wash away what ails, and flow from one ally to the next.',
    playsLike: "Steady cleansing; Holy's Anoint shared around",
  },
  {
    id: 'blood',
    tagline: 'The one liquid in every body: spent like energy, and spilled until someone treats it.',
    playsLike: 'Health spent as energy; bleeds that worsen until treated',
  },
  { id: 'mirror', tagline: 'Still water in the dark: whatever the enemy does comes back at them, or is copied.', playsLike: "Turns the enemy's kit against them" },
  {
    id: 'storm',
    tagline: 'Lightning on the wind: a storm your team keeps fed turn after turn, until it breaks over everyone.',
    playsLike: 'Feed the storm every turn, or it dies down',
  },
  {
    id: 'battery',
    tagline: 'Stored lightning in a leaking cell: charge up slowly, let it all out at once, and let the acid eat through defenses.',
    playsLike: 'Charge up slowly while eating through defenses',
  },
  {
    id: 'magnet',
    tagline: 'Lightning in iron and stone: pull what the enemy relies on toward you, and push your problems onto them.',
    playsLike: 'Steals defenses and pushes problems back',
  },
  { id: 'vengeance', tagline: 'Holy lightning that answers every blow: hurt us, and the strike comes back harder.', playsLike: 'Hurt us, and we hit back harder' },
  { id: 'reanimation', tagline: 'Lightning in dead flesh: death is a setback, not an ending.', playsLike: 'Revival with a jolt, and a shelf life' },
  { id: 'ion', tagline: 'Lightning in the dark: a pulse that switches the enemy off.', playsLike: 'An EMP for buffs and minions' },
  { id: 'faerie', tagline: 'Wind and poison: fae mischief, pixie dust, and charms that turn friends on each other.', playsLike: 'Fae mischief: enemies hitting their friends' },
  {
    id: 'nomad',
    tagline: 'Wind over open ground: a wanderer who never stays in one place, and grows stronger for it.',
    playsLike: 'Never stay still: rotate skills to stay strong',
  },
  {
    id: 'angel',
    tagline: 'Holy wings: a guardian that takes the blows meant for others and pulls the fallen back from the edge.',
    playsLike: 'Takes the hits, and saves lives',
  },
  { id: 'ghost', tagline: 'Unholy on the wind: hard to touch, and haunting whoever it pleases.', playsLike: 'Hard to hit; a haunting that wanders their team' },
  { id: 'ninja', tagline: 'Wind and shadow: too quick to see, and never alone.', playsLike: 'Many small cuts, and a decoy for every threat' },
  {
    id: 'spore',
    tagline: 'Poison in the soil: an infection that spreads from host to host and fruits into a colony.',
    playsLike: 'Infect one, and the colony spreads',
  },
  {
    id: 'antidote',
    tagline: 'Poison made medicine by holy hands: protection that learns, and cleansing that strikes back.',
    playsLike: 'Protection that learns; cleansing that hits back',
  },
  { id: 'blight', tagline: 'Poison and death: a rot that takes what never grows back.', playsLike: 'Rot: permanent attrition that only cleansing answers' },
  {
    id: 'assassin',
    tagline: 'Poison from the dark: a contract only you can see, and a blade that ends it.',
    playsLike: "A hidden contract: they never know who's marked",
    notes: ['Death Mark is hidden from the enemy: the skill in playing against it is working out who is marked.'],
  },
  { id: 'sanctuary', tagline: 'Holy ground: stone raised into a fortress that shelters the whole team.', playsLike: 'Holy ground: a fortress for the whole team' },
  {
    id: 'grave',
    tagline: 'Earth that keeps the dead: every fallen body, on either side, becomes another soldier.',
    playsLike: 'Every death, on either side, feeds the army',
  },
  {
    id: 'moon',
    tagline: 'Stone that shines in the dark: a four-beat rhythm of hiding, growing, striking and draining.',
    playsLike: 'A four-beat rhythm: hide, grow, strike, drain',
    notes: ['The cycle is predictable, so both players can plan around the Full Moon.'],
  },
  {
    id: 'zealot',
    tagline: 'Holy and unholy in one soul: faith that feeds on suffering, and a death that serves the cause.',
    playsLike: 'Suffering fuels faith; even death helps',
  },
  {
    id: 'vigilante',
    tagline: 'Holy light from the shadows: justice outside the law, dragging hidden things into the open.',
    playsLike: "Works from the shadows to drag the enemy's into the light",
  },
  {
    id: 'curse',
    tagline: 'Unholy in the shadows: hexes that punish every kind of choice, and outlive their victims.',
    playsLike: 'Curses that punish choices and refuse to leave',
  },
];
