// MatchRoom behavior with a fake clock, fake connections and an in-memory store.

import { describe, expect, it } from 'vitest';
import { planningState, randomConfig } from '@arena/ai';
import { applyCommand, legalQueueCommands, type Command, type PlayerId, type PlayerView } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { bundleFromState, type ServerMessage, type TurnBundle } from '@arena/protocol';
import { FakeClock } from '../src/match/clock.js';
import { DISCONNECT_GRACE_MS, MatchRoom, MAX_TIMEOUTS, type EndReason, type RoomStore } from '../src/match/room.js';

const content = loadContentOrThrow();

class Conn {
  msgs: ServerMessage[] = [];
  send(m: ServerMessage) {
    this.msgs.push(m);
  }
  last<T extends ServerMessage['t']>(t: T): Extract<ServerMessage, { t: T }> | undefined {
    return [...this.msgs].reverse().find((m) => m.t === t) as Extract<ServerMessage, { t: T }> | undefined;
  }
  view(): PlayerView {
    const m = [...this.msgs].reverse().find((x) => x.t === 'match.events' || x.t === 'match.sync') as { view: PlayerView };
    return m.view;
  }
}

class MemStore implements RoomStore {
  actions: { seq: number; player: PlayerId; command: Command }[] = [];
  result: { winner: PlayerId | null; endReason: EndReason; turns: number } | null = null;
  async appendActions(_id: string, a: { seq: number; player: PlayerId; command: Command }[]) {
    this.actions.push(...a);
  }
  async finish(_id: string, r: { winner: PlayerId | null; endReason: EndReason; turns: number }) {
    this.result = r;
    return null;
  }
}

function setup(timerSeconds: number | null = 60) {
  const clock = new FakeClock();
  const store = new MemStore();
  const room = new MatchRoom({
    id: 'm1',
    kind: 'casual',
    content,
    config: randomConfig(content, 11),
    players: [
      { userId: 'u0', displayName: 'Ann' },
      { userId: 'u1', displayName: 'Ben' },
    ],
    timerSeconds,
    clock,
    store,
  });
  const c0 = new Conn();
  const c1 = new Conn();
  room.attach(0, c0);
  room.attach(1, c1);
  return { clock, store, room, c: [c0, c1] as const };
}

/** A legal one-skill plan from the player's own redacted view. */
function plan(view: PlayerView): TurnBundle {
  const p = view.viewer as PlayerId;
  let s = planningState(view);
  const opt = legalQueueCommands(content, s, p)[0];
  if (opt) s = applyCommand(content, s, p, opt).state;
  return bundleFromState(s, p);
}

describe('MatchRoom', () => {
  it('sends each player a redacted sync, then numbered events per turn', () => {
    const { room, c } = setup();
    const sync = c[0].last('match.sync')!;
    expect(sync.you).toBe(0);
    expect(sync.opponent.displayName).toBe('Ben');
    expect(sync.view.players[1].energy).toBeNull(); // opponent energy is hidden
    expect(sync.deadline).not.toBeNull();

    expect(room.submit(0, plan(c[0].view()))).toBe(true);
    const ev = c[1].last('match.events')!;
    expect(ev.events.map((e) => e.seq)).toEqual(ev.events.map((_, i) => ev.seq - ev.events.length + i + 1));
    expect(room.active).toBe(1);
  });

  it('rejects turns out of order or for the wrong turn, without changing anything', () => {
    const { room, c } = setup();
    expect(room.submit(1, { turn: 1, queue: [] })).toBe(false);
    expect(c[1].last('match.turnRejected')?.reason).toMatch(/isn't your turn/);
    expect(room.submit(0, { turn: 5, queue: [] })).toBe(false);
    expect(room.active).toBe(0);
  });

  it('resync after reconnecting returns only the missed events', () => {
    const { room, c } = setup();
    room.submit(0, plan(c[0].view()));
    const seenBy1 = c[1].last('match.events')!.seq;
    room.detach(1, c[1]);
    expect(c[0].last('match.presence')).toMatchObject({ opponentConnected: false });
    room.submit(1, { turn: room.turn, queue: [] }); // no connection: nothing sent, still applied
    room.submit(0, plan(c[0].view()));
    const back = new Conn();
    room.attach(1, back, seenBy1);
    const sync = back.last('match.sync')!;
    expect(sync.events.length).toBeGreaterThan(0);
    expect(sync.events[0]!.seq).toBe(seenBy1 + 1);
    expect(c[0].last('match.presence')).toMatchObject({ opponentConnected: true });
  });

  it('a timeout auto-commits the latest valid draft', async () => {
    const { room, c, clock, store } = setup(30);
    const draft = plan(c[0].view());
    expect(draft.queue).toHaveLength(1);
    room.draft(0, draft);
    clock.advance(30_000);
    expect(room.active).toBe(1);
    await room.idle();
    expect(store.actions.filter((a) => a.command.t === 'queue')).toHaveLength(draft.queue.length);
  });

  it(`${MAX_TIMEOUTS} timeouts in a row forfeit the match (afk)`, async () => {
    const { room, clock, store } = setup(30);
    for (let i = 0; i < MAX_TIMEOUTS * 2; i++) clock.advance(30_000);
    await room.finished;
    expect(store.result).toMatchObject({ winner: 1, endReason: 'afk' });
  });

  it('a disconnected player forfeits after the grace period, unless they return', async () => {
    const a = setup(null);
    a.room.detach(1, a.c[1]);
    a.clock.advance(DISCONNECT_GRACE_MS - 1);
    a.room.attach(1, new Conn());
    a.clock.advance(DISCONNECT_GRACE_MS);
    expect(a.room.isOver).toBe(false);

    const b = setup(null);
    b.room.detach(1, b.c[1]);
    b.clock.advance(DISCONNECT_GRACE_MS);
    await b.room.finished;
    expect(b.store.result).toMatchObject({ winner: 0, endReason: 'disconnect' });
    expect(b.c[0].last('match.end')?.result.winner).toBe(0);
  });

  it('surrender ends the match and logs every command for replay', async () => {
    const { room, c, store } = setup();
    room.submit(0, plan(c[0].view()));
    room.surrender(1);
    await room.finished;
    expect(store.result).toMatchObject({ winner: 0, endReason: 'surrender' });
    expect(store.actions.map((a) => a.seq)).toEqual(store.actions.map((_, i) => i + 1));
    expect(store.actions.at(-1)!.command).toEqual({ t: 'surrender' });
    expect(c[1].last('match.end')).toBeDefined();
  });
});
