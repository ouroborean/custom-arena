// Every story encounter plays to completion against a bot-controlled player, and scripted rules
// fire when they should.

import { describe, expect, it } from 'vitest';
import { createMatch, applyCommand, viewFor, type ContentBundle } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { encounterConfig } from '@arena/meta';
import { encounterBot, normalBot, playMatch, randomConfig, scriptedBot } from '../src/index.js';

const content: ContentBundle = loadContentOrThrow();

describe('story encounters', () => {
  it('each one plays to a finish with its own AI', () => {
    let seed = 1;
    for (const enc of Object.values(content.encounters)) {
      const player = randomConfig(content, seed).teams[0];
      const config = encounterConfig(content, enc, seed, player);
      const { state } = playMatch(content, config, [normalBot(seed), encounterBot(enc, seed + 1)]);
      expect(state.phase, enc.id).toBe('finished');
      seed++;
    }
  }, 120_000);

  it('a script rule queues its skill on its turn, then the tier plans the rest', () => {
    const enc = content.encounters.embers_3!;
    const config = encounterConfig(content, enc, 5, randomConfig(content, 5).teams[0]);
    let { state } = createMatch(content, config);
    state = applyCommand(content, state, 0, { t: 'endTurn' }).state; // the player passes
    const bot = scriptedBot(enc.ai.script!, enc.ai.tier, 9);
    const cmds = bot.planTurn(content, viewFor(content, state, 1));
    const first = cmds[0]!;
    expect(first.t).toBe('queue');
    if (first.t === 'queue') {
      const unit = state.units.find((u) => u.id === first.actor)!;
      expect(unit.id).toBe('p1c0');
      expect(unit.skills[first.slot]!.defId.startsWith('strike')).toBe(true);
    }
    expect(cmds.at(-1)).toEqual({ t: 'endTurn' });
  });
});
