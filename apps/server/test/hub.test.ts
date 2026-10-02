// The match service end to end: real WebSockets against a listening server, a fake clock for
// matchmaking and timers, and an in-memory PGlite database.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { planningState } from '@arena/ai';
import { applyCommand, legalQueueCommands, replay, type PlayerId, type PlayerView } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { bundleFromState, PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from '@arena/protocol';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { buildApp } from '../src/app.js';
import { openDb, type OpenDb } from '../src/db/client.js';
import { FakeClock } from '../src/match/clock.js';

const content = loadContentOrThrow();
const clock = new FakeClock();
let app: FastifyInstance;
let dbh: OpenDb;
let base = '';
let n = 0;

beforeAll(async () => {
  dbh = await openDb();
  app = await buildApp({ db: dbh.db, content, clock, rollSeed: () => 1000 + n++ });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  base = typeof addr === 'object' && addr ? `127.0.0.1:${addr.port}` : '';
});
afterAll(async () => {
  await app.close();
  await dbh.close();
});

type Msg<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>;

class Peer {
  msgs: ServerMessage[] = [];
  private waiters: (() => void)[] = [];
  closed: number | null = null;
  constructor(readonly ws: WebSocket) {
    ws.on('message', (d) => {
      this.msgs.push(JSON.parse(String(d)) as ServerMessage);
      for (const w of this.waiters.splice(0)) w();
    });
    ws.on('close', (code) => {
      this.closed = code;
      for (const w of this.waiters.splice(0)) w();
    });
  }
  send(m: ClientMessage) {
    this.ws.send(JSON.stringify(m));
  }
  /** Waits for (and consumes up to) the next message of a type. */
  async next<T extends ServerMessage['t']>(t: T, ms = 4000): Promise<Msg<T>> {
    const deadline = Date.now() + ms;
    for (;;) {
      const i = this.msgs.findIndex((m) => m.t === t);
      if (i >= 0) return this.msgs.splice(0, i + 1).at(-1) as Msg<T>;
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${t}; got ${this.msgs.map((m) => m.t).join(', ')}`);
      await new Promise<void>((r) => {
        this.waiters.push(r);
        setTimeout(r, 50);
      });
    }
  }
  async closedWith(ms = 4000): Promise<number> {
    const deadline = Date.now() + ms;
    while (this.closed === null && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
    return this.closed ?? -1;
  }
}

async function register(name: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: `${name}@arena.test`, password: 'password123', displayName: name },
  });
  expect(res.statusCode).toBe(201);
  const cookie = `arena_session=${res.cookies.find((c) => c.name === 'arena_session')!.value}`;
  // Three recruits make the active team.
  for (let i = 0; i < 3; i++) await app.inject({ method: 'POST', url: '/api/characters/roll', headers: { cookie } });
  return cookie;
}

async function connect(cookie: string | null, hello = true): Promise<Peer> {
  const ws = new WebSocket(`ws://${base}/api/ws`, cookie ? { headers: { cookie } } : {});
  const peer = new Peer(ws);
  await new Promise<void>((res, rej) => {
    ws.once('open', () => res());
    ws.once('error', rej);
  });
  if (hello) {
    peer.send({ t: 'hello', v: PROTOCOL_VERSION, contentVersion: content.version });
    await peer.next('welcome');
  }
  return peer;
}

/** Queues two new players and returns them seated (index = seat). */
async function matchedPair(mode: 'casual' | 'ranked') {
  const a = await connect(await register(`${mode}a${n}`));
  const b = await connect(await register(`${mode}b${n}`));
  a.send({ t: 'queue.join', mode });
  b.send({ t: 'queue.join', mode });
  await a.next('queue.status');
  await b.next('queue.status');
  clock.advance(1000);
  const [sa, sb] = await Promise.all([a.next('match.start'), b.next('match.start')]);
  const [ya, yb] = await Promise.all([a.next('match.sync'), b.next('match.sync')]);
  expect(sa.matchId).toBe(sb.matchId);
  expect(sa.you).not.toBe(sb.you);
  const seats: [Peer, Peer] = sa.you === 0 ? [a, b] : [b, a];
  const syncs: [Msg<'match.sync'>, Msg<'match.sync'>] = sa.you === 0 ? [ya, yb] : [yb, ya];
  return { matchId: sa.matchId, seats, syncs };
}

function planOne(view: PlayerView) {
  const p = view.viewer as PlayerId;
  let s = planningState(view);
  const opt = legalQueueCommands(content, s, p)[0];
  if (opt) s = applyCommand(content, s, p, opt).state;
  return bundleFromState(s, p);
}

describe('connection', () => {
  it('refuses connections without a session', async () => {
    const p = await connect(null, false);
    expect(await p.closedWith()).toBe(4401);
  });

  it('refuses a mismatched content version', async () => {
    const p = await connect(await register('stale'), false);
    p.send({ t: 'hello', v: PROTOCOL_VERSION, contentVersion: 'old' });
    expect((await p.next('error')).code).toBe('content_mismatch');
    expect(await p.closedWith()).toBe(4400);
  });

  it('a newer connection replaces the older one', async () => {
    const cookie = await register('twotabs');
    const first = await connect(cookie);
    await connect(cookie);
    expect(await first.closedWith()).toBe(4000);
  });

  it('rate-limits floods', async () => {
    const p = await connect(await register('flood'));
    for (let i = 0; i < 60; i++) p.send({ t: 'ping', at: i });
    expect((await p.next('error')).code).toBe('rate_limited');
  });
});

describe('matches', () => {
  it('casual: pairs two players, plays a turn, ends on surrender, and records a replay', async () => {
    const { matchId, seats, syncs } = await matchedPair('casual');
    expect(syncs[0].view.players[1].energy).toBeNull();

    seats[0].send({ t: 'turn.submit', matchId, turn: planOne(syncs[0].view) });
    const ev = await seats[1].next('match.events');
    expect(ev.view.activePlayer).toBe(1);

    seats[1].send({ t: 'surrender', matchId });
    const [end0, end1] = await Promise.all([seats[0].next('match.end'), seats[1].next('match.end')]);
    expect(end0.result.winner).toBe(0);
    expect(end1.rating).toBeUndefined(); // casual ratings stay hidden

    const history = await app.inject({ url: '/api/matches', headers: { cookie: await loginCookie(matchId, 0) } });
    const h = history.json().matches.find((m: { id: string }) => m.id === matchId);
    expect(h).toMatchObject({ outcome: 'win', endReason: 'surrender', kind: 'casual' });

    const rep = await app.inject({ url: `/api/matches/${matchId}/replay`, headers: { cookie: await loginCookie(matchId, 1) } });
    const { record } = rep.json();
    expect(replay(content, record).state.result?.winner).toBe(0);
  });

  it('ranked: rating changes arrive with the result', async () => {
    const { matchId, seats } = await matchedPair('ranked');
    seats[0].send({ t: 'surrender', matchId });
    const end = await seats[1].next('match.end');
    expect(end.rating!.after).toBeGreaterThan(end.rating!.before);
    const r = await app.inject({ url: '/api/ratings', headers: { cookie: await loginCookie(matchId, 1) } });
    expect(r.json().ranked.games).toBe(1);
  });

  it('private: create a code, join it; wrong codes are refused', async () => {
    const host = await connect(await register('host'));
    const guest = await connect(await register('guest'));
    host.send({ t: 'private.create', timer: null });
    const { code } = await host.next('private.created');
    guest.send({ t: 'private.join', code: 'NOPE99' });
    expect((await guest.next('error')).code).toBe('no_such_code');
    guest.send({ t: 'private.join', code: code.toLowerCase() });
    const [s1, s2] = await Promise.all([host.next('match.start'), guest.next('match.start')]);
    expect(s1).toMatchObject({ kind: 'private', timer: null });
    expect(s1.matchId).toBe(s2.matchId);
  });

  it("can't queue twice", async () => {
    const p = await connect(await register('double'));
    p.send({ t: 'queue.join', mode: 'casual' });
    await p.next('queue.status');
    p.send({ t: 'queue.join', mode: 'ranked' });
    expect((await p.next('error')).code).toBe('already_busy');
    p.send({ t: 'queue.leave' });
    await p.next('queue.left');
  });

  it('reconnects mid-match and resyncs only what was missed', async () => {
    const { matchId, seats, syncs } = await matchedPair('casual');
    const seen = syncs[1].seq;
    seats[0].msgs.length = 0; // drop the "opponent connected" notice from match start
    seats[1].ws.close();
    expect((await seats[0].next('match.presence')).opponentConnected).toBe(false);

    seats[0].send({ t: 'turn.submit', matchId, turn: planOne(syncs[0].view) });
    await seats[0].next('match.events');

    const back = await connect(await loginCookie(matchId, 1), false);
    back.send({ t: 'hello', v: PROTOCOL_VERSION, contentVersion: content.version });
    expect((await back.next('welcome')).activeMatch).toBe(matchId);
    back.send({ t: 'sync', matchId, lastSeq: seen });
    const sync = await back.next('match.sync');
    expect(sync.events[0]!.seq).toBe(seen + 1);
    expect(sync.view.activePlayer).toBe(1);
    expect((await seats[0].next('match.presence')).opponentConnected).toBe(true);
  });
});

/** Logs in as the player in a seat of a match (test accounts share one password). */
async function loginCookie(matchId: string, seat: PlayerId): Promise<string> {
  const { matches, users } = await import('../src/db/schema.js');
  const { eq } = await import('drizzle-orm');
  const [m] = await dbh.db.select().from(matches).where(eq(matches.id, matchId));
  const [u] = await dbh.db.select().from(users).where(eq(users.id, seat === 0 ? m!.p0User : m!.p1User));
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: u!.email, password: 'password123' } });
  return `arena_session=${res.cookies.find((c) => c.name === 'arena_session')!.value}`;
}
