# Custom Arena

A 3v3 turn-based arena strategy game. See [docs/GDD.md](docs/GDD.md) for the design,
[docs/rules.md](docs/rules.md) for the formal ruleset, [docs/meta.md](docs/meta.md) for characters,
equipment and the API, [docs/equipment.md](docs/equipment.md) for item passives and the economy,
[docs/multiplayer.md](docs/multiplayer.md) for online play, [docs/single-player.md](docs/single-player.md)
for bots, the story, achievements and the tutorial, [docs/live-ops.md](docs/live-ops.md) for analytics,
patches, seasons, localization, assets and the installable app, and [docs/glossary.md](docs/glossary.md)
for keywords.

## Layout

```
packages/
  engine/    Pure, deterministic rules engine (no runtime deps). State + command → state + events.
  content/   YAML game data (skills, statuses, minions, classes, items, economy, story, tutorial) + Zod schemas, loader, validation.
  ai/        Bots (Easy/Normal/Hard, scripted encounters) and a match runner that records replays.
  meta/      Out-of-battle rules shared by server and client: rarity, character rolls, loadouts, economy, story, achievements, Glicko-2.
  protocol/  WebSocket messages and turn bundles shared by server and client.
apps/
  client/    React client (Vite, installable PWA): account, roster, loadouts, online play, story, tutorial, and a sandbox.
  server/    API + match service (Fastify + Drizzle + WebSockets): auth, roster, equipment, matchmaking, rooms, seasons.
  cli/       Headless simulator and a terminal game against a bot.
docs/        GDD, rules, glossary.
```

## Commands

Requires Node 22+.

```bash
npm install
npm run ci                 # typecheck + lint + content validation + tests
npm test                   # tests only
npm run content:validate   # check all content files
npm run sim                # one bot-vs-bot match with a full battle log
npm run sim -- --games 2000            # aggregate results + per-skill win rates
npm run sim -- --games 2000 --equip    # rolled characters in random loadouts, + per-item win rates
npm run sim -- --bots normal,hard      # choose bots: easy | normal | hard | greedy | random
npm run sim -- --story --games 20      # story difficulty curve (a Normal bot's win rate per encounter)
npm run sim -- --seed 7 --save         # save replays/match-7.json
npm run sim -- --replay replays/match-7.json
npm run play               # play in the terminal against the greedy bot
npm run server             # API server at http://127.0.0.1:8787 (PGlite data in apps/server/.data)
npm run dev                # client at http://localhost:5173, proxying /api (and the WebSocket) to the server
npm run bot -w @arena/server -- --mode casual   # a bot that plays online, for testing alone
npm run build              # production build of the client (apps/client/dist, with the service worker)
npm run preview -w @arena/client       # serve that build at http://localhost:4173 (installable, works offline)
npm run assets:check       # validate the portrait and sound manifests, and report art coverage
npm run content:diff -- master         # draft patch notes: content changes since a git ref
npm run analytics -w @arena/server     # pick and win rates from finished online matches
npm run season:close -w @arena/server -- ranked-s1 --dry-run   # pay a finished season's rewards
```

Run `npm run server` and `npm run dev` together for the full game; without the server, the client
offers the offline sandbox. Set `DATABASE_URL=postgres://…` to use a PostgreSQL server instead of
the embedded PGlite database. A local test account is described in `apps/server/fixtures/dev-account.json`.

## Adding content

Skills are data. See `packages/content/data/base/skills.yaml` for the 30 base skills and the op
language they use (`damage`, `heal`, `apply`, `summon`, `if`, `forEach`, …). Elemental variants
go in new files named `skills.<element>.yaml`. Every skill needs a scenario test in
`packages/content/test/`.
