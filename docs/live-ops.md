# Polish and live ops (Phase 8)

This document covers:
- analytics: pick and win rates (§1);
- balance patches and patch notes (§2);
- localization (§3);
- ranked seasons (§4);
- art and audio (§5);
- the installable app and native shells (§6);
- accessibility (§7);
- what's left (§8).

The GDD sections are §2.2 (modes), §7.4 (portraits), §9.1 (settings), §12 (live service) and §13
(Phase 8).

## 1. Analytics

Pick and win rates come from finished online matches. Each match row stores its full config: teams,
skills and, since Phase 8, equipped item ids (`CharacterSpec.items`, which the engine ignores).

```bash
npm run analytics -w @arena/server                        # every finished match
npm run analytics -w @arena/server -- --kind ranked --since 2026-10-01 --min 20
npm run analytics -w @arena/server -- --content current   # only the content version running now
npm run analytics -w @arena/server -- --json > rates.json
```

With PGlite (the default), stop the dev server first: a data directory takes one process at a time.
With `DATABASE_URL` set, the script reads the live PostgreSQL database.

**How counting works** (`analyzeMatches` in `packages/meta/src/analytics.ts`):
- Counting is per side. A class, element, skill or item is *picked* by a side when any of its three
  characters has it, and it counts at most once per side per match.
- **Win rate** = wins ÷ picks, with a draw counting as half a win.
- **Pick rate** = picks ÷ sides played (two sides per match).
- **First-seat win rate** is the share of decided matches won by the side that moved first. It is a
  quick check on the first-mover rule (GDD §3.2).
- Rows with at least 20 picks are flagged ▲ above 55% and ▼ below 45%.

**How to read it:**
- Under about 100 matches the rates are anecdotes, and the script says so.
- Filter by content version when comparing across a patch.
- Cross-check against the simulator: `npm run sim -- --games 2000 --equip` runs bot-vs-bot games in
  random loadouts. Humans and bots misplay differently, so a skill that is strong in both is the
  real outlier.

## 2. Balance patches

Balance lives in content (GDD §12.1: "balance patches are new versions"), so a patch is a change to
the YAML under `packages/content/data`. Each content bundle has a version: a hash of the whole
bundle.

**Suggested cadence:** one patch every two weeks during a season, plus hotfixes for anything broken.
Avoid patching in the last week of a season, because final ratings decide rewards (§4).

1. Pull the rates for the current content version (§1), and simulate the suspects.
2. Edit the YAML. Run `npm run content:validate` and `npm test`: every skill has a scenario test.
3. Draft the patch notes against the last release:
   ```bash
   npm run content:diff -- v0.4.0                 # any git ref: a tag, a branch, a commit
   npm run content:diff -- master --out notes.md
   ```
   - The script lists added, removed and changed skills, statuses, minions, equipment, story
     encounters and chapters, achievements, tutorial lessons and economy sections.
   - Readable fields show before → after, for example "cooldown 1 → 2" or new text. Anything else
     in an entry shows as "rules changed".
   - Edit the draft before publishing. The script only knows *what* changed, not *why*.
   - Content from an older revision that no longer fits today's schema is read leniently, and the
     script says how many entries it left out.
4. Deploy the server and client together.
   - The server serves its content version.
   - Online play refuses mismatched clients (`content_mismatch`).
   - The service worker loads pages network-first, so an online client picks up the new build on
     its next load (§6).

**Replays across patches:** a replay records its engine and content versions, and only replays from
the running versions can be played back (`playable` on `GET /api/matches/:id/replay`). Older
replays stay in the history as records. To replay one, run the client and server built at that
content version.

## 3. Localization

The client's UI text goes through message catalogs (`apps/client/src/i18n/`).

- **`en.ts` is the source catalog.** Keys are grouped by screen (`home.*`, `story.*`, `over.*`,
  `season.*`, …) and `MessageKey` is the type of its keys, so a typo in `t('…')` fails to compile.
- **Params:** messages use `{name}` params, filled by `t(key, params)`. Numbers are formatted with
  `Intl.NumberFormat` for the locale.
- **Plurals:** a message can be an object of plural forms (`one`, `other`, and optionally `zero`,
  `two`, `few`, `many`), chosen by the `count` param through `Intl.PluralRules`.
- **Dates:** `formatDate()` formats them in the current locale.
- **Choosing the language:** Settings → Language. "Like my browser" picks the first of the
  browser's languages that has a catalog, else English. Missing keys fall back to English.
- **Pseudo-locale (`en-XA`):** a testing locale generated from English. It accents every letter
  outside params, pads the text about 40% and brackets it: `[Víçtöřý~~~]`.
  - Text that shows up unaccented is hard-coded.
  - Text that clips shows where a layout can't take longer strings.
  - A test checks that every message pseudo-localizes with its params intact.

**Adding a language:**
1. Add `xx.ts` exporting a `Partial<Messages>`.
2. Register it in `CATALOGS` in `i18n/index.ts` with its native name.
3. Translate plural messages with the forms that language needs.

**Not yet localized:**
- **Screens still on hard-coded English:** the battle HUD, roster, character and inventory screens,
  match history, sign-in, sandbox setup, and most of the online panel. These screens are already on
  catalogs: Home, Settings, Tutorial, the coach, Story, the end-of-match overlays and the season
  line. Move each remaining screen when it is next touched.
- **Content text:** skill, status, class and item names and descriptions live in content YAML.
  - Translations shouldn't go into the content bundle: that would change its version hash, and with
    it every replay.
  - The plan is client catalogs keyed by content id (`skill.<id>.name`), falling back to the YAML
    text.
- **Server messages:** errors and validation problems are English.

## 4. Ranked seasons

Ranked ratings are per season. Casual keeps one hidden rating that never resets. The schedule is
`apps/server/seasons.json`, or the file named by `SEASONS_FILE`. It is checked at startup, and the
server logs the running season.

```json
{
  "seasons": [
    { "id": "ranked-s1", "name": "Season 1", "start": "2026-09-01T00:00:00Z", "end": "2026-12-01T00:00:00Z" },
    { "id": "ranked-s2", "name": "Season 2", "start": "2026-12-01T00:00:00Z" }
  ],
  "softReset": { "keep": 0.5, "rd": 200 },
  "minGames": 10,
  "tiers": [{ "id": "gold", "name": "Gold", "min": 1400, "reward": { "currency": { "gold": 350 } } }]
}
```

**The schedule:**
- A season runs from `start` up to, but not including, `end`.
- Only the last season may leave out `end`; it then runs until the next one is scheduled.
- Seasons may not overlap.
- A gap between seasons closes the ranked queue (`off_season`). The online panel shows when the
  next season starts.
- Season ids are rating queues, so never rename or reuse one. `ranked-s1` is the queue Phase 5
  ratings were already stored in.

**Ratings within a season:**
- **Which season a match counts toward:** a ranked match rates into the season it *started* in,
  even if it finishes after the season ends.
- **Soft reset:** a player's first ranked game of a season starts from their latest earlier
  season's rating, pulled toward 1500 by `keep` (0.5 halves the distance). RD rises to at least
  `rd`, capped at a new player's 350. Players without an earlier season start fresh.
- **Placement and tiers:**
  - A player needs `minGames` ranked games in the season to place.
  - The tier is decided by the final *display rating* (rating − 2·RD, the conservative estimate),
    so it takes both a good rating and enough games to be sure of it.
  - Tiers are listed in ascending `min`.
- **What players see:** `GET /api/ratings` returns the running season, the player's rating, the
  placement games left, their current tier, and their last season reward. The online panel on
  Home shows the same.

**Closing a season:** once it has ended, pay its rewards:

```bash
npm run season:close -w @arena/server -- ranked-s1 --dry-run   # who would get what
npm run season:close -w @arena/server -- ranked-s1
```

- The script refuses before the season's end, and while ranked matches that started in the season
  are still being played.
- Each placed player gets their tier's reward (currency and items) once. A `season_rewards` row is
  the at-most-once key, written in the same transaction as the grant. Running the script again
  skips players already paid.
- Players below `minGames`, or below the lowest tier, are counted as unplaced and get nothing.

**Starting the next season:** add it to `seasons.json` and give the current last season an `end`,
before that season is due to end, then restart the server. Reward numbers are first guesses: tune
them like any economy data.

## 5. Art and audio

**Until art exists:**
- Portraits are generated monograms: class initials on the element's colors.
- Every sound effect is synthesized with the Web Audio API.

**Assets are optional:** both manifests may be empty, and a missing file or manifest is never an
error.

**Portraits** (`apps/client/public/assets/portraits/manifest.json`):
- Keys are `<class>.<element>` for characters (element lowercase, `none` for no element) and
  `minion.<id>` for minions.
- Each key lists image files in that folder; 512×512 WebP is recommended.
- A character's `portraitId` (`<class>.<element>.NN`) picks its NN-th file, so rolled characters
  keep their look.
- A key without art falls back to the monogram.

**Sounds** (`apps/client/public/assets/audio/manifest.json`):
- It maps a cue to an OGG or MP3 file. A cue without a file keeps its synthesized sound.
- The cues are: `hit`, `bigHit` (30+ damage), `shieldHit`, `heal`, `buff`, `debuff`, `stun`,
  `counter`, `death`, `skill`, `turn` (your turn starts), `victory`, `defeat`.
- Battle events map to cues in `apps/client/src/match/cues.ts`.
- Sounds follow the volume and mute settings, and are skipped while the battle fast-forwards. The
  exception is the victory or defeat sting, which always plays.
- The same cue is played at most once every 60 ms.

**Skill and status icons** (`apps/client/public/assets/icons/manifest.json`):
- `skills` maps each archetype (lowercase) to one glyph; every elemental and fusion version of a
  skill shares it. Minion skills all have the Minion archetype, so `skillsById` gives each its own
  glyph by skill id (reusing other skills' icons is fine; they're seen far less often). `statuses`
  maps status ids to glyphs; near-identical twins share a file, and every story boss passive uses
  one crowned-skull icon.
- Glyphs are white on transparent and drawn as CSS masks, so the client paints them: neutral grey
  with no element, the element's color, or a diagonal gradient between a fusion's two elements (a
  doubled element fades into a deeper shade). The element colors are the `--el-*` tokens in
  `theme.css`: Fire orange, Unholy dark red, Water blue, Ice light blue, Wind white, Shadow dark grey,
  Holy yellow, Lightning purple, Poison light green, Earth brown; no element is grey.
- A status takes its own element; an effect defined inside a skill shows that skill's glyph and
  element. Anything without a glyph (item passives and item trackers) keeps its letter code.
- The picks live in the repo's `icons/` folder (`_*-candidates.json`, `_minion-skill-icons.json`);
  after changing them, run
  `python icons/_build-client-icons.py` (needs Pillow) to rebuild the assets and manifest.
- They are precached with the app shell, so battles show them offline.

**Checking assets:** `npm run assets:check` checks that every key names a real class, element,
minion, cue, archetype or status, and that every listed file exists. It also reports how much of the
roster (class × element) has art and how many archetypes and statuses have icons.

## 6. The installable app and native shells

The client is a Progressive Web App.

**Installing it:**
- On desktop Chrome or Edge, use *Install app*; on phones, *Add to Home Screen*.
- It then runs in its own window, with the app icon.
- Settings → App shows an Install button where the browser offers one, and otherwise explains how
  to install.

**The manifest and icons:**
- The manifest is `apps/client/public/manifest.webmanifest`.
- The icons are drawn by `npm run icons -w @arena/client` (no image dependencies). Commit the PNGs
  it writes.

**The service worker:**
- `service-worker.js` is a template: the build fills in the build's file list and a content-hash
  version, and emits `/sw.js`.
- It is registered in production builds only.
- **Pages are network-first.** An online client always loads the build its server runs, which
  matters because online play needs matching content (§2). Offline, the cached shell starts, the
  API is unreachable, and the Offline screen offers the local sandbox.
- **The app shell is precached per build:** the hashed bundles, icons and asset manifests. A new
  build installs a new shell and drops the old one.
- **The API is never cached.** The server is the source of truth for accounts, rewards and
  matches.
- **Everything else is stale-while-revalidate:** fonts, portrait and sound files.

**Trying it locally:** `npm run build`, then `npm run preview -w @arena/client` serves the build on
:4173, with `/api` proxied to the server. It is the `client-build` launch configuration.

**Native shells** wrap the same build. Neither toolchain was installed when this was written, so
neither shell is scaffolded yet.
- **Desktop — Tauri:**
  - Needs Rust (`rustup`) and, on Windows, WebView2, which ships with Windows 11.
  - Run `npm create tauri-app` in `apps/desktop`, point `frontendDist` at `../client/dist`, and set
    the API origin (see below).
- **Mobile — Capacitor:**
  - Needs Android Studio (for Android) or Xcode on a Mac (for iOS).
  - Run `npm i @capacitor/core @capacitor/cli`, then `npx cap init` in `apps/client` with
    `webDir: dist`, then `npx cap add android` or `npx cap add ios`.
- **What both need from the client:**
  - An absolute API origin: today the client calls `/api` on its own origin, through the dev
    proxy.
  - Cookies that work cross-origin: `SameSite=None; Secure` on the session cookie, and CORS on the
    server.
- **Store builds:** they are separate release artifacts, and each needs its own content-version
  check. A store build can lag behind the server, and the PWA can't.

## 7. Accessibility

- **Energy is never color alone.** Each energy type has a shape:
  - Strength: red square.
  - Agility: green triangle.
  - Intelligence: blue diamond.
  - Willpower: white hexagon.
  - Random: dashed hollow square.
  Costs are also labeled for screen readers ("Cost: Strength, Random").
- **Motion:** Settings → Motion is *Like my device*, *Reduced* or *Full*. Reduced sets
  `<html data-motion="reduce">`, which turns off animations and transitions app-wide.
- **Battle playback:** 1×, 2× or Instant, with sound volume and mute.
- **Screen readers:** a polite live region announces the latest battle log lines as they happen.
- **All settings are per device** (local storage) and can be reset to defaults.

## 8. What's left

- **Localization:** move the remaining screens and content text onto catalogs, then add a first
  real language (§3).
- **Art and audio:** commission portraits and sounds; the manifests and checks are ready (§5).
- **Native shells:** scaffold Tauri and Capacitor once their toolchains are installed (§6).
- **Leaderboards:** display ratings per season exist, but there is no leaderboard endpoint or
  screen yet.
- **Analytics:**
  - It reads the matches table directly, which is fine at this scale.
  - A large deployment would roll up nightly into a warehouse table.
  - Economy and retention metrics aren't tracked yet.
