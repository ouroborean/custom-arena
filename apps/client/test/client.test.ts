import { beforeEach, describe, expect, it } from 'vitest';
import { replay, stateFingerprint, type MatchConfig } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { LocalMatch } from '../src/match/LocalMatch.js';
import { assignBench, damageDetail, toFloat } from '../src/match/playback.js';
import { useStore } from '../src/store.js';

const content = loadContentOrThrow();

const config = (p0: string[][], p1: string[][], seed = 3): MatchConfig => ({
  seed,
  teams: [
    p0.map((skills, i) => ({ name: `A${i + 1}`, skills })),
    p1.map((skills, i) => ({ name: `B${i + 1}`, skills })),
  ],
});

describe('LocalMatch', () => {
  it('runs the bot after the human ends their turn and records a replayable match', () => {
    const m = new LocalMatch(content, config([['shot'], ['shot']], [['shot'], ['shot']]), { kind: 'vsBot', bot: 'normal', human: 0 });
    for (let i = 0; i < 6 && !m.finished; i++) {
      const a = m.availability(0).find((x) => x.targets.length > 0);
      if (a) m.command(0, { t: 'queue', actor: a.actor, slot: a.slot, targets: a.targets[0]! });
      m.command(0, { t: 'endTurn' });
      m.runBots();
      if (!m.finished) expect(m.active).toBe(0);
    }
    const again = replay(content, m.record);
    expect(stateFingerprint(again.state).length).toBeGreaterThan(0);
    expect(again.state.turn).toBe(m.turn);
  });

  it('refuses commands for bot-controlled players', () => {
    const m = new LocalMatch(content, config([['shot']], [['shot']]), { kind: 'vsBot', bot: 'easy', human: 1 });
    expect(() => m.command(0, { t: 'endTurn' })).toThrow(/bot/);
  });
});

describe('playback helpers', () => {
  it('describes damage and builds floating numbers', () => {
    const e = { t: 'damage', source: 'a', target: 'b', amount: 10, absorbed: 5, type: 'Normal', direct: true, hp: 90, base: 20, bonus: 5, armor: -10 } as const;
    expect(damageDetail(e)).toBe('20 base +5 modifiers −10 armor 5 absorbed by shield (direct)');
    expect(toFloat(e, 1)).toEqual({ id: 1, unit: 'b', text: '−10', kind: 'damage' });
    expect(toFloat({ t: 'heal', source: 'a', target: 'b', amount: 0, hp: 100 }, 2)).toBeNull();
  });
});

describe('minion bench', () => {
  it('keeps survivors in place and fills the lowest free slot', () => {
    let slots = assignBench([], ['m1', 'm2'], 4);
    expect(slots).toEqual(['m1', 'm2', null, null]);
    slots = assignBench(slots, ['m2', 'm3'], 4); // m1 died, m3 summoned
    expect(slots).toEqual(['m3', 'm2', null, null]);
    slots = assignBench(slots, ['m2', 'm3', 'm4', 'm5', 'm6'], 4); // more than the cap never overflows
    expect(slots).toEqual(['m3', 'm2', 'm4', 'm5']);
  });
});

describe('store', () => {
  beforeEach(() => useStore.getState().toSetup());

  it('queues self-target skills on click and single-target skills after choosing a target', () => {
    const s = useStore.getState();
    s.newMatch(content, config([['maneuver'], ['shot']], [['shot']]), { kind: 'hotseat' });
    useStore.getState().flush();
    useStore.getState().match!.view(0); // sanity
    // Turn 1 has 1 energy: queue Maneuver (self) directly.
    useStore.getState().selectSkill('p0c0', 0);
    expect(useStore.getState().match!.view(0).players[0].queue).toHaveLength(1);
    // Shot needs a target, but the only energy is reserved → rejected with a toast.
    useStore.getState().selectSkill('p0c1', 0);
    expect(useStore.getState().targeting).toBeNull();
    expect(useStore.getState().toast).toMatch(/energy/i);
    useStore.getState().unqueue(0);
    useStore.getState().selectSkill('p0c1', 0);
    expect(useStore.getState().targeting?.options).toEqual([['p1c0']]);
    useStore.getState().chooseTarget('p1c0');
    expect(useStore.getState().match!.view(0).players[0].queue?.[0]?.targets).toEqual(['p1c0']);
  });

  it('plays events back, then hands the device over in hotseat without leaking hidden info', () => {
    const s = useStore.getState();
    s.newMatch(content, config([['riposte']], [['shot']]), { kind: 'hotseat' });
    useStore.getState().flush();
    useStore.getState().selectSkill('p0c0', 0);
    useStore.getState().commit({});
    expect(useStore.getState().pending.length).toBeGreaterThan(0);
    expect(useStore.getState().displayView).not.toBeNull();
    useStore.getState().flush();
    const st = useStore.getState();
    expect(st.displayView).toBeNull();
    expect(st.handoff).toBe(1);
    const p1Log = st.logs[0].map((l) => l.text).join('\n');
    const p2Log = st.logs[1].map((l) => l.text).join('\n');
    expect(p1Log).toMatch(/uses Riposte/);
    expect(p2Log).not.toMatch(/Riposte/); // Invisible to the opponent
    st.acceptHandoff();
    expect(useStore.getState().viewer).toBe(1);
  });

  it('shows each skill’s outcome as it plays, not only once the whole exchange has', () => {
    useStore.getState().newMatch(content, config([['curse']], [['shot']]), { kind: 'vsBot', bot: 'normal', human: 0 });
    useStore.getState().flush();
    useStore.getState().selectSkill('p0c0', 0);
    useStore.getState().chooseTarget('p1c0');
    useStore.getState().commit({});
    const confused = () => useStore.getState().displayView?.effects.some((e) => e.bearer === 'p1c0' && e.defId === 'confusion') ?? false;
    expect(confused()).toBe(false); // the board as the turn started
    // Play until the Curse has landed: Confusion shows while the bot's turn is still to come.
    let guard = 0;
    while (!useStore.getState().logs[0].some((l) => l.text.includes('Confusion')) && guard++ < 50) useStore.getState().step();
    expect(useStore.getState().pending.some((e) => e.t === 'turnStart' && e.player === 1)).toBe(true);
    expect(confused()).toBe(true);
    useStore.getState().flush();
    expect(useStore.getState().displayView).toBeNull();
  });

  it('vs bot: committing plays the bot turn and returns control to the human', () => {
    useStore.getState().newMatch(content, config([['shot']], [['shot']]), { kind: 'vsBot', bot: 'normal', human: 0 });
    useStore.getState().flush();
    useStore.getState().commit({});
    useStore.getState().flush();
    const st = useStore.getState();
    expect(st.match!.active).toBe(0);
    expect(st.match!.turn).toBe(3);
    expect(st.logs[0].some((l) => l.text.includes('Turn 2'))).toBe(true);
  });
});

describe('RemoteMatch', () => {
  it("slots the server's checkpoint views in after the events they follow", async () => {
    const { createMatch, viewFor } = await import('@arena/engine');
    const { RemoteMatch } = await import('../src/match/RemoteMatch.js');
    const cfg = config([['shot']], [['shot']]);
    const state = createMatch(content, cfg).state;
    const view = viewFor(content, state, 0);
    const m = new RemoteMatch(content, 'm1', { kind: 'online', you: 0, opponent: 'Ben', matchKind: 'casual', timer: null }, { send: () => undefined });
    const got: { t: string; n?: number }[][] = [];
    m.onUpdate = (events) => void got.push(events.map((e) => (e.t === 'checkpoint' ? { t: e.t, n: e.n } : { t: e.t })));
    m.handle({ t: 'match.sync', matchId: 'm1', you: 0, opponent: { displayName: 'Ben' }, view, events: [], seq: 2, deadline: null, opponentConnected: true } as never);
    const a = { ...view, turn: 7 };
    const b = { ...view, turn: 8 };
    m.handle({
      t: 'match.events',
      matchId: 'm1',
      events: [
        { seq: 3, event: { t: 'skillUsed', actor: 'p0c0', skill: 'shot', targets: ['p1c0'] } },
        { seq: 4, event: { t: 'turnEnd', turn: 1, player: 0 } },
      ],
      seq: 4,
      view: b,
      deadline: null,
      checkpoints: [
        { afterSeq: 3, view: a },
        { afterSeq: 4, view: b },
      ],
    } as never);
    const events = got[got.length - 1]!;
    expect(events).toEqual([{ t: 'skillUsed' }, { t: 'checkpoint', n: 0 }, { t: 'turnEnd' }, { t: 'checkpoint', n: 1 }]);
    expect(m.checkpointView(0, 0)?.turn).toBe(7);
    expect(m.checkpointView(1, 0)?.turn).toBe(8);
    expect(m.checkpointView(0, 1)).toBeNull(); // only ever the recipient's own view
  });
});
