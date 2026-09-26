# Custom Arena

A 3v3 turn-based arena strategy game. See [docs/GDD.md](docs/GDD.md) for the design,
[docs/rules.md](docs/rules.md) for the formal ruleset, and [docs/glossary.md](docs/glossary.md) for keywords.

## Layout

```
packages/
  engine/    Pure, deterministic rules engine (no runtime deps). State + command → state + events.
  content/   YAML game data (skills, statuses, minions, classes) + Zod schemas, loader, validation.
  ai/        Bots (random, greedy) and a match runner that records replays.
apps/
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
npm run sim -- --seed 7 --save         # save replays/match-7.json
npm run sim -- --replay replays/match-7.json
npm run play               # play in the terminal against the greedy bot
```

## Adding content

Skills are data. See `packages/content/data/base/skills.yaml` for the 30 base skills and the op
language they use (`damage`, `heal`, `apply`, `summon`, `if`, `forEach`, …). Elemental variants
go in new files named `skills.<element>.yaml`. Every skill needs a scenario test in
`packages/content/test/`.
