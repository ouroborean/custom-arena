// Tutorial lessons: each coach script can be followed step by step against the lesson's own AI
// with its forced energy (every expected skill is affordable and legal when the step comes up).

import { describe, expect, it } from 'vitest';
import { applyCommand, createMatch, legalQueueCommands, viewFor, type ContentBundle, type GameState } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { encounterConfig, singlePlayerBotSeed } from '@arena/meta';
import { encounterBot } from '../src/index.js';

const content: ContentBundle = loadContentOrThrow();

describe('tutorial scripts', () => {
  for (const t of Object.values(content.tutorial)) {
    it(`${t.id} can be followed step by step`, () => {
      const enc = content.encounters[t.id]!;
      for (const seed of [1, 2, 3]) {
        const config = encounterConfig(content, enc, seed);
        let state: GameState = createMatch(content, config).state;
        const bot = encounterBot(enc, singlePlayerBotSeed(seed));
        t.steps.forEach((step, i) => {
          const e = step.expect;
          if (!e) return;
          expect(state.phase, `${t.id} ended before step ${i + 1}`).toBe('planning');
          if ('queue' in e) {
            const want = e.queue;
            const option = legalQueueCommands(content, state, 0).find((o) => {
              const defId = state.units.find((u) => u.id === o.actor)!.skills[o.slot]!.defId;
              return (defId === want.skill || defId.startsWith(`${want.skill}.`)) && (!want.target || o.targets[0] === want.target);
            });
            expect(option, `${t.id} step ${i + 1}: ${want.skill}${want.target ? ` on ${want.target}` : ''} (seed ${seed})`).toBeDefined();
            state = applyCommand(content, state, 0, option!).state;
          } else {
            state = applyCommand(content, state, 0, { t: 'endTurn' }).state;
            while (state.phase !== 'finished' && state.activePlayer === 1) {
              for (const cmd of bot.planTurn(content, viewFor(content, state, 1))) {
                state = applyCommand(content, state, 1, cmd).state;
                if (state.phase === 'finished') break;
              }
            }
          }
        });
      }
    });
  }
});
