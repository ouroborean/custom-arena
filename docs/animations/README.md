# Skill animations — concept spec

Every skill gets an animation built from the pixel-art library in `skill_animations/`: effects that
can be **tinted**, **resized**, **rotated**, **layered** and **chained**, playing on the user, the
target(s), or between them. This folder holds the *concepts* — what each skill should look like, in a
form a renderer can later play directly. Nothing here is wired into the game yet.

| File | What it is |
|---|---|
| `catalog.yaml` | Every animation in the library: frames, sizes, color variants, frame paths, and a by-eye description (look, motion, orientation, anchor, best uses). Generated — run `npx tsx scripts/animations/build-catalog.mts`; descriptions live in `catalog.notes.yaml`. |
| `catalog-index.md` | The same library one line per animation (size, orientation, anchor, loop, intensity, look, best uses) — the place to browse. Generated with the catalog. |
| `briefs/<group>.md` | Per group (base, 10 elements, 55 fusions): its skills, inline statuses, minions and their passive actions, and the named statuses and macros it owns. Generated — `npx tsx scripts/animations/digest.mts docs/animations/briefs`. |
| `concepts/<group>.yaml` | The concepts, one file per group (this spec). |
| `scripts/animations/validate.mts` | Checks concept files: every skill covered, every animation id real, every field valid. `npx tsx scripts/animations/validate.mts [group…]` |

## How a skill plays

A turn plays back as a stream of engine events (`packages/engine/src/types.ts`, `EventBody`). A
concept is a list of **cues**; each cue is bound to one kind of event and plays when that event
arrives, on the unit(s) the event names. Because cues hang off events rather than a fixed timeline,
the same concept works whatever order the effects resolve in, however many targets there are, and
whichever branch of a conditional fires.

| `on:` | Fires on | Default anchor |
|---|---|---|
| `cast` | `skillUsed`, once, before any effect — the user's wind-up | `actor` (only `actor`, `allySide` or `field`: see below) |
| `travel` | once per target, between `cast` and that target's first effect | from `actor` to `target` |
| `hit` | each `damage` event this skill causes | `target` (the damaged unit) |
| `blocked` | `damageBlocked`, or damage fully absorbed by Shield | `target` |
| `heal` | each `heal` event this skill causes | `target` (the healed unit) |
| `apply` | each `effectApplied` this skill causes; narrow with `status:` (an id, `buff`, `debuff`, `any`) | `bearer` |
| `remove` | each `effectRemoved` this skill causes (cleanses, steals, consumes) | `bearer` |
| `summon` | `summoned` | `minion` |
| `death` | a unit this skill kills (`died`) | `target` |
| `revive` | `revived` | `target` |
| `trigger` | an inline status of this skill firing its trigger later (a counter, a trap springing, a channel's next hit); name it with `status:` | `bearer` (who holds the status) |
| `resolve` | after the skill's last effect | `actor` |

Cues on the same event play together (layering); `delay` and `stagger` sequence them. A cue whose event
never happens simply doesn't play (a conditional branch not taken, a target that dodged).

**Nothing lands on `cast`.** A skill can be countered, reflected or refused after `skillUsed`, so art
that shows the skill *arriving* on a target binds to `travel`, `hit`, `heal`, `apply`, `remove` or
`resolve` — never to `cast`. `cast` is the user's wind-up: `at: actor` (or `allySide`/`field` for a
team-wide or board-wide wind-up).

**Primary and splash.** `hit`, `heal`, `apply` and `remove` cues can take `only: primary` (the unit(s)
the player targeted) or `only: others` (everyone else this skill reaches: splash on their allies, random
extras, the user's own recoil). Use it to give the primary target the big impact and the splash a
smaller one — not `cast`.

**Anchors inside triggers.** In a `trigger` cue (a skill's inline status, a named status's `trigger`
default, a minion passive): `bearer` is the unit holding the status; `source` is the unit whose action
set it off (the attacker a counter answers, the enemy whose skill sprang a trap); `target` is each unit
the triggered effect lands on (the enemy a minion bites, the unit a Mark detonates on); `actor` is
whoever applied the status in the first place.

**Once per skill.** A cue anchored at `allySide`, `enemySide` or `field` plays once per skill use, on
the first event that matches it, however many units that event kind reaches.

**Statuses: replace or add.** An `apply`/`remove`/`trigger` cue naming a specific status *replaces*
that status's default for this skill. One filtered by `buff`, `debuff` or `any` *adds* to whatever
defaults play.

**Macros.** Damage, healing and statuses produced inside a macro (`explode`…) play the macro's cues, not
the calling skill's `hit`/`heal`/`apply` cues — an Explosion looks like an Explosion whoever set it off.

Effects a skill causes *later*, through its own inline statuses (a Snipe firing next turn, a Channel's
later pulses, a Trap or counter springing), still belong to that skill: they play its `hit`, `heal`,
`apply`… cues when they happen, and its `trigger` cue for that status plays first, at the moment it
fires. So a Snipe's `cast` is the wind-up, its `trigger` the shot, its `hit` the impact.

**Visibility.** The renderer only plays cues for events the viewer receives. Invisible skills and
hidden statuses are already withheld from the opponent by the engine, so their cues are seen only by
their owner; design them so what the opponent *does* see later (the trap springing, the counter) reads
on its own. For skills tagged **HiddenTarget**, never use a `travel` or anything that points at the
target before the hit lands — the opponent mustn't learn who is targeted.

## Concept file format

```yaml
group: fire                 # the group id (file name)

statuses:                   # default animations for the named statuses (and minion passives) this group owns
  ignite:
    apply:  [ { fx: directional_fire_burst_001, at: bearer, face: up, scale: 0.7 } ]
    tick:   [ { fx: fire_looping_001, at: bearer, scale: 0.5, repeat: 1 } ]   # its periodic effect
    remove: [ { fx: directional_smoke_burst_005, at: bearer, face: up, variant: gray, scale: 0.5 } ]

macros:                     # default animations for the macros this group owns (played per unit the macro acts on)
  explode:
    - { fx: stylized_explosion_001, at: target, scale: 1.3 }

skills:
  strike.fire:
    beat: A burning slash that leaves the target alight.       # one line: the visual idea
    cues:
      - { on: cast, fx: scifi_charge_up_002, at: actor, scale: 0.6 }
      - { on: hit,  fx: warrior_3, at: target, face: fromActor, tint: Fire }
      # Ignite's own default plays when it's applied: nothing to add.
```

### Cue fields

| Field | Values | Notes |
|---|---|---|
| `on` | see the table above | required |
| `status` | status id, inline status id, `buff`, `debuff`, `any` | for `apply`, `remove`, `trigger` |
| `fx` | a catalog id | required. Never a `duplicateOf` entry; never a text banner (`symbol_*_text_*`) |
| `at` | `actor`, `target`, `bearer`, `minion`, `source`, `allies`, `enemies`, `allySide`, `enemySide`, `field` | `allies`/`enemies` play on every living unit of that side; `allySide`/`enemySide` play once, centered on that side's row, for sweeping area effects; `field` is the whole board (reserve for the biggest skills) |
| `from`, `to` | same anchors | `travel` cues only: where the effect starts and ends |
| `path` | `straight`, `arc`, `drop`, `rise`, `beam`, `return` | `travel` only. `drop` falls onto `to` from above; `rise` climbs out of `to`; `beam` stretches the art between `from` and `to` instead of moving it; `return` goes out and back. Travel art orients itself along its path (its drawn direction leads), so travel cues take no `face` |
| `only` | `primary`, `others` | `hit`/`heal`/`apply`/`remove`: just the targeted unit(s), or just the rest (see Primary and splash) |
| `face` | `fromActor`, `toActor`, `toTarget`, `up`, `down`, `left`, `right`, or degrees | rotates directional art so its drawn direction (catalog `orientation`) points this way. `fromActor`: along the line from the actor through this unit — the way a blow travels, so sprays and slashes on a target carry on past it. `toActor`: back toward the actor (essence drained home). `toTarget`: from this unit toward the skill's target (a muzzle flash on the user). `left`/`right` are screen directions; the board-relative ones work whichever side or layout the units are in. Art drawn as a `sweep-arc`, `rises-from-ground`, `falls-from-above`, `horizontal-band` or `vertical-band`, or anchored on the `ground`, is only ever *mirrored* to face left or right, never rotated (a slash stays level, a ground burst stays on the ground); `points-*` and `diagonal-*` art rotates freely |
| `size` | `large`, `small` | which drawn size to use (palette art has both; class art only `native`). Default `large` |
| `scale` | 0.2 – 4 | relative to the portrait: 1 means the art's height matches a portrait's height. Default 1 |
| `tint` | `element`, `element2`, `duo`, `source`, `neutral`, an element name (`Fire`…), `native` | see Tinting. Default: `element` for palette art, `native` for class art. Raw `#rrggbb` is accepted but discouraged — use a token and `tone` so colors stay consistent |
| `tone` | `light`, `dark` | shift the tint one stop up or down its ramp (a white-hot Fire core, a deep Unholy shadow) |
| `variant` | a color the catalog lists for that animation (`black`, `white`…) | use a drawn color as-is instead of tinting |
| `offset` | `[x, y]` in portrait units (+y is up) | e.g. `[0, 0.6]` above the head |
| `delay` | milliseconds after the event | default 0 |
| `stagger` | milliseconds between successive units | for cues that play on several units (`allies`, `enemies`, many `hit`s) |
| `repeat` | 1 – 6 | play back-to-back |
| `speed` | 0.5 – 2 | playback rate (default 20 frames per second at 1×, before the player's speed setting) |
| `layer` | `over`, `under` | over the portrait (default) or behind it |
| `opacity` | 0.1 – 1 | |
| `flip` | `x`, `y` | mirror the art (applied to the drawn art before any orientation, so it also works on travel art) |
| `frames` | `[first, last]`, 0-based, inclusive | play only part of the animation: skip a long empty wind-up, stop before a part that reads wrong. An animation otherwise plays once, start to end, and vanishes after its last frame |
| `note` | text | anything the implementer needs that the fields can't say (a screen shake, a portrait lunge, a flash) |

### Status and macro defaults

A named status's default animations play whenever it is applied, ticks, triggers or ends — whichever
skill applied it. The keys: `apply`, `tick` (its periodic effect at turn start or end), `trigger` (its
reactive effect: Mark detonating, Sleep breaking, a counter), `remove` (consumed, cleansed or broken),
`expire` (ran out), and optionally `aura`: a single loopable cue drawn while the status is present —
use auras only where seeing the status matters at a glance (Stun, Sleep, Invulnerable, Taunt), and
keep them subtle.

A skill doesn't repeat a status's default. To change it for one skill, add its own `apply` cue for that
status (it replaces the default for that skill), or `{ on: apply, status: x, fx: none }` to silence it.
Minion passives (the `wolf_bite` kind, acting at turn end) go under `statuses:` like named statuses,
using `trigger` for their action.

Macros (`explode`, …) get one cue list played for each unit the macro acts on (`at: target`).

### Board-wide fallbacks (`base.yaml` only)

`defaults:` holds what plays when nothing more specific does — damage or healing from an item passive,
an effect no concept covers, the engine's own outcomes. Keys: `hit`, `blocked` (damage stopped or fully
absorbed), `shieldBreak` (a Shield depleted), `heal`, `death`, `revive`, `summon`, `counter` (a skill
countered), `effectBlocked` (a status refused, e.g. by Immune), `skillFailed`, `interrupted` (a channel
or delayed effect broken by a stun or death). Each is a cue list
(no `on`); `tint: source` follows whatever caused it. Keep them neutral and light — they're the floor,
not the show.

## Tinting

Every color is a **ramp of three stops** — dark, mid, light. Palette art (`tint: palette` in the
catalog) is a four-color swap: its outline and shade take the dark stop, its body the mid stop, its
highlight the light stop, and its white core stays white. Class art (`tint: colorize`) is multi-hued; a
tint recolors it by brightness onto the same ramp, which flattens its hues, so leave it `native` unless
its colors fight the element. `tone: light` shifts every stop one step brighter (dark→mid, mid→light,
light→white); `tone: dark` one step darker.

| Token | Means |
|---|---|
| `element` | the skill's element ramp (a fusion: its first parent; the base group: `neutral`) |
| `element2` | a fusion's second parent (= `element` for a pure element) |
| `duo` | shadows from `element`'s dark stop, body and highlights from `element2`'s mid and light — the fusion look |
| `source` | the element of whatever applied it — for base status defaults, so Might from a Fire skill glows Fire |
| `neutral` | steel: the elementless base look |
| `native` | no tint |

Inside a status or macro default, `element`/`element2`/`duo` mean the *owning group's* element(s) —
Ignite's default is Fire-colored even when Dragon applies it — while `source` follows the applier.

| Ramp | Dark | Mid | Light | Families that suit it |
|---|---|---|---|---|
| Fire | `#a82a00` | `#ff6a00` | `#ffc266` | Fire, Explosions, smoke (dark aftermath), slashes tinted Fire |
| Ice | `#3a8ab8` | `#8fd8ff` | `#e6f7ff` | Frost Knight, Frost Mage, `spell_ice_001`, shards and rings |
| Water | `#12308f` | `#2f6bff` | `#9ec0ff` | splatters, bubble bursts, sprays (smoke/particles tinted Water), wave-like art |
| Lightning | `#5a1aa8` | `#a24dff` | `#d9b8ff` | Lightning, sci-fi sparks and charge-ups, Starcaller (already violet) |
| Wind | `#8fa0b4` | `#dfe8ef` | `#ffffff` | smoke bursts, slashes and impacts, warps — pale and fast |
| Poison | `#3f7a12` | `#8be03c` | `#d4ff9a` | Slime, Deathbringer (lime), `spell_poison_001`, `status_poison_001`, splatters and smoke |
| Earth | `#6b4420` | `#b5793a` | `#e8c48c` | impacts, smoke and splatters as dust and rubble, ground-anchored bursts |
| Holy | `#b38600` | `#ffcc00` | `#ffe98a` | Paladin, light and sparkle bursts, heals, star bursts |
| Unholy | `#6e0f22` | `#b3203a` | `#ff6680` | Blood Knight, Necromancer, `spell_death_001`, skull smoke, debuff art |
| Shadow | `#1f1f26` | `#4d4d57` | `#a8a8bc` | Dark Mage, black smoke, warps |
| Neutral | `#5c6675` | `#a3adbb` | `#e8ecf2` | the base group: Warrior art, steel impacts |

Shadow's light stop keeps pale highlights on palette art, so Shadow stays visible on the dark board
without hand-picked colors; for a mostly-dark effect on a dark board, add a light rim layer or `tone:
light`. Close ramps (Fire/Unholy, Ice/Water/Shadow-blue Dark Mage art, Wind/Holy/Neutral pale art) can't
be told apart by hue alone — differ in *material* (which art), not just color.

## Design rules

1. **Show every mechanic that changes the board.** Each damaged unit gets a `hit`; each healed unit a
   `heal`; buffs on the user show on the user; area skills touch every unit they affect; conditional
   extras (the bonus Explosion, the second random target) get their own cue so they read as extra.
   Statuses already have defaults — rely on them unless the skill's take is special.
2. **Read in about a second.** A skill's own cues should finish within ~1.2 s at 1×; most need 2–4
   cues. Big skills (cooldown 4+, `allEnemies`, Titan, multi-step) may use more and go larger.
3. **Scale with power.** Damage 5–15: small, quick (`size: small`, scale ≤ 0.8). 20–30: standard.
   35+ or area: large, layered, maybe a `field` or `*Side` sweep. Cost and cooldown are the tell.
4. **Keep the archetype's motion, change its matter.** All 66 versions of an archetype should feel
   related by *motion* (a Shot always flies, a Smash always lands hard), while the element changes
   what it's made of. Suggested motion per archetype:

   | Archetype | Motion | Archetype | Motion |
   |---|---|---|---|
   | Strike | quick melee slash on the target | Stab | thin, fast piercing impact |
   | Smash | heavy impact, splash on the target's allies | Ravage | brutal multi-layer hit |
   | Charge | dash: trail from user to target, impact | Mislead | trickery on the target (warp, smoke, mirage) |
   | Riposte | guard flash on the user; counter-slash when it triggers | Stun | hit plus a stagger |
   | Rage | power surge on the user | Dance | swirl of motion around the user |
   | Shot | small projectile, small impact | Heal | rising light on the ally |
   | Snipe | user charges (channel), then a fast precise strike next turn | Bless | gift descending onto the ally |
   | Trap | something set on the target, springs on trigger | Curse | darkness settling onto the enemy |
   | Maneuver | evasive blink or veil on the user | Smite | strike falling from above |
   | Companion | one minion arrives | Prayer | the whole team uplifted |
   | Bolt | magic projectile, bursting impact | Cleave | sweeping arc across targets |
   | Blast | the enemy side engulfed | Shout | shockwave from the user |
   | Consume | essence pulled from the target into the user | Withstand | barrier forming on the user |
   | Summon | several minions arrive | Taunt | a challenge from the user (`!`) at the target |
   | Channel | repeated pulses over its turns | Titan | the user transforms: the biggest self effect |

5. **Vary within a kit, and across kits.** In one group, don't use the same main `fx` for more than
   three skills, and don't give two skills of the same archetype family the same look. Across groups,
   an archetype shares its *motion*, not its art: the validator warns when more than six groups give an
   archetype the same main `fx`. Reach for a different asset, or layer the shared one with something
   that's yours.
6. **Fusions evolve their parents.** A fusion's skills draw on both parents' families and colors
   (`duo`, or `element` + `element2` on separate layers) and add a signature motif of their own. A
   same-element fusion (Dragon, Crystal, Ocean…) is that element turned up: heavier, larger, more layered.
7. **Symbols are tells, not decoration.** `symbol_alert_*` (Taunt, alarms), `symbol_question_001`
   (Confusion), `symbol_lightbulb_001` (Focus, insight), `symbol_warning_001`, `symbol_crown_001`,
   thumbs, check and cross marks are fine as small `offset` tells. Text banners never appear in skills.
8. **Status signatures are reserved.** The art a base status's `apply` or `aura` default uses is how
   players recognise that status everywhere. Don't use it as flavor in a skill that doesn't apply that
   status (the validator warns). Base statuses in turn take distinctive, glyph-like art for their
   signatures, leaving the generic bursts and impacts free for skills.
9. **Leave room.** Prefer `layer: under` for ground and aura effects so portraits stay readable, and
   keep persistent auras subtle.

## Open questions for implementation

- **Cause links.** Damage and heal events don't say which status or trigger produced them; ticks,
  counters and passives need a `cause` on the event (status id or skill id) for `tick`/`trigger` cues to
  attach. Until then the renderer can only infer it.
- **Packing.** The raw library is ~59,000 PNGs. Only the animations concepts actually use (and only the
  sizes and one color each, tinted at runtime) should be packed into sprite sheets for the client.
- **Tint method.** Palette art: map its four colors to a ramp of the tint. Class art: luminance
  colorize. `duo` needs the ramp to blend two colors.
- **Frame rate** (20 fps assumed), the player's speed setting, and a reduced-motion option.
