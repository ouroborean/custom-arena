// The match service's connection hub (GDD §10.4): one WebSocket per signed-in user, matchmaking,
// private lobbies, and routing of in-match messages to rooms. Runs in the API process for now.

import { randomBytes, randomInt } from 'node:crypto';
import { ENGINE_VERSION, type MatchConfig, type PlayerId } from '@arena/engine';
import {
  parseClientMessage,
  PROTOCOL_VERSION,
  type ClientMessage,
  type MatchKind,
  type ServerMessage,
} from '@arena/protocol';
import type { WebSocket } from 'ws';
import { HttpError, type AppContext } from '../app.js';
import { audit } from '../audit.js';
import type { SessionUser } from '../auth.js';
import { matches } from '../db/schema.js';
import { activeTeamSpecs } from '../routes/roster.js';
import type { Clock, Timer } from './clock.js';
import { Matchmaker, type QueueEntry } from './matchmaker.js';
import { MatchRoom, type Connection } from './room.js';
import { dbRoomStore, ratingOf, ratingQueue } from './store.js';

/** Seconds per turn in matchmade games. */
export const QUEUE_TURN_SECONDS = 90;
/** Private lobbies expire if nobody joins. */
export const LOBBY_TTL_MS = 15 * 60_000;
/** Token bucket per connection: burst capacity and refill per second. */
export const RATE = { capacity: 30, perSecond: 15, abuseLimit: 60 };

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class Client implements Connection {
  helloed = false;
  private tokens = RATE.capacity;
  private refilledAt: number;
  violations = 0;

  constructor(
    readonly user: SessionUser,
    readonly socket: WebSocket,
    readonly ip: string,
    private readonly clock: Clock,
  ) {
    this.refilledAt = clock.now();
  }

  send(msg: ServerMessage): void {
    if (this.socket.readyState === this.socket.OPEN) this.socket.send(JSON.stringify(msg));
  }

  /** Spends a token; false when the client is sending too fast. */
  take(): boolean {
    const now = this.clock.now();
    this.tokens = Math.min(RATE.capacity, this.tokens + ((now - this.refilledAt) / 1000) * RATE.perSecond);
    this.refilledAt = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

interface Lobby {
  code: string;
  host: QueueEntry;
  timer: number | null;
  expiry: Timer;
}

export class MatchHub {
  private readonly rooms = new Map<string, MatchRoom>();
  private readonly userRoom = new Map<string, string>();
  private readonly clients = new Map<string, Client>();
  private readonly lobbies = new Map<string, Lobby>();
  private readonly hosting = new Map<string, string>();
  readonly matchmaker: Matchmaker;

  constructor(
    private readonly ctx: AppContext,
    private readonly clock: Clock,
    private readonly log: (msg: string, err?: unknown) => void = () => {},
  ) {
    this.matchmaker = new Matchmaker(clock, (a, b) => {
      this.startMatch(a.mode, a, b, QUEUE_TURN_SECONDS).catch((e) => this.log('could not start a match', e));
    });
  }

  /** The room a user is playing in, if any (tests and diagnostics). */
  roomOf(userId: string): MatchRoom | undefined {
    const id = this.userRoom.get(userId);
    return id ? this.rooms.get(id) : undefined;
  }

  handle(socket: WebSocket, user: SessionUser, ip: string): void {
    const client = new Client(user, socket, ip, this.clock);
    socket.on('message', (data, isBinary) => {
      if (!client.take()) {
        client.violations++;
        if (client.violations === 1) audit(this.ctx.db, 'rate_limited', { userId: user.id, ip, detail: { channel: 'ws' } });
        if (client.violations > RATE.abuseLimit) {
          audit(this.ctx.db, 'ws_abuse', { userId: user.id, ip });
          socket.close(4429, 'rate limited');
          return;
        }
        return client.send({ t: 'error', code: 'rate_limited', message: 'Slow down' });
      }
      const msg = isBinary ? null : parseClientMessage(String(data));
      if (!msg) return client.send({ t: 'error', code: 'bad_message', message: 'Unrecognized message' });
      this.dispatch(client, msg).catch((e) => {
        if (e instanceof HttpError) {
          const problems = (e.details?.problems as string[] | undefined) ?? [];
          return client.send({ t: 'error', code: 'invalid_team', message: e.message, ...(problems.length ? { problems } : {}) });
        }
        this.log('ws message failed', e);
        client.send({ t: 'error', code: 'bad_message', message: 'Something went wrong' });
      });
    });
    socket.on('close', () => this.disconnect(client));
  }

  private busy(userId: string): boolean {
    return this.userRoom.has(userId) || this.matchmaker.has(userId) || this.hosting.has(userId);
  }

  private async dispatch(c: Client, msg: ClientMessage): Promise<void> {
    const uid = c.user.id;
    if (msg.t === 'ping') return c.send({ t: 'pong', at: msg.at, serverTime: this.clock.now() });
    if (msg.t === 'hello') return this.hello(c, msg.v, msg.contentVersion);
    if (!c.helloed) return c.send({ t: 'error', code: 'bad_message', message: 'Say hello first' });

    switch (msg.t) {
      case 'queue.join': {
        if (this.busy(uid)) return c.send({ t: 'error', code: 'already_busy', message: "You're already queued or playing" });
        const specs = await activeTeamSpecs(this.ctx, uid);
        const { rating } = await ratingOf(this.ctx.db, uid, ratingQueue(msg.mode)!);
        if (this.busy(uid) || this.clients.get(uid) !== c) return;
        const e = this.matchmaker.join({ userId: uid, displayName: c.user.displayName, mode: msg.mode, rating, specs });
        return c.send({ t: 'queue.status', mode: msg.mode, since: e.joinedAt });
      }
      case 'queue.leave':
        this.matchmaker.leave(uid);
        return c.send({ t: 'queue.left' });

      case 'private.create': {
        if (this.busy(uid)) return c.send({ t: 'error', code: 'already_busy', message: "You're already queued or playing" });
        const specs = await activeTeamSpecs(this.ctx, uid);
        if (this.busy(uid) || this.clients.get(uid) !== c) return;
        let code = '';
        do code = Array.from(randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
        while (this.lobbies.has(code));
        const host: QueueEntry = { userId: uid, displayName: c.user.displayName, mode: 'casual', rating: 0, specs, joinedAt: this.clock.now() };
        const expiry = this.clock.after(LOBBY_TTL_MS, () => this.closeLobby(code, true));
        this.lobbies.set(code, { code, host, timer: msg.timer, expiry });
        this.hosting.set(uid, code);
        return c.send({ t: 'private.created', code, timer: msg.timer });
      }
      case 'private.cancel': {
        const code = this.hosting.get(uid);
        if (code) this.closeLobby(code, true);
        return;
      }
      case 'private.join': {
        if (this.busy(uid)) return c.send({ t: 'error', code: 'already_busy', message: "You're already queued or playing" });
        const lobby = this.lobbies.get(msg.code.trim().toUpperCase());
        if (!lobby || lobby.host.userId === uid) return c.send({ t: 'error', code: 'no_such_code', message: 'No open match with that code' });
        const specs = await activeTeamSpecs(this.ctx, uid);
        if (!this.lobbies.has(lobby.code) || this.busy(uid)) return;
        this.closeLobby(lobby.code, false);
        const guest: QueueEntry = { userId: uid, displayName: c.user.displayName, mode: 'casual', rating: 0, specs, joinedAt: this.clock.now() };
        await this.startMatch('private', lobby.host, guest, lobby.timer);
        return;
      }

      case 'sync':
      case 'turn.draft':
      case 'turn.submit':
      case 'surrender': {
        const room = this.rooms.get(msg.matchId);
        const seat = room?.seat(uid) ?? null;
        if (!room || seat === null) return c.send({ t: 'error', code: 'not_in_match', message: 'No such match' });
        if (msg.t === 'sync') return room.attach(seat, c, msg.lastSeq);
        if (msg.t === 'turn.draft') return room.draft(seat, msg.turn);
        if (msg.t === 'turn.submit') {
          room.submit(seat, msg.turn);
          return;
        }
        return room.surrender(seat);
      }
    }
  }

  private hello(c: Client, v: number, contentVersion: string): void {
    if (v !== PROTOCOL_VERSION) {
      c.send({ t: 'error', code: 'version_mismatch', message: `Server speaks protocol ${PROTOCOL_VERSION}` });
      return c.socket.close(4400, 'protocol version');
    }
    if (contentVersion !== this.ctx.content.version) {
      c.send({ t: 'error', code: 'content_mismatch', message: `Server runs content ${this.ctx.content.version}; reload the client` });
      return c.socket.close(4400, 'content version');
    }
    const previous = this.clients.get(c.user.id);
    this.clients.set(c.user.id, c);
    if (previous && previous !== c) previous.socket.close(4000, 'replaced by a newer connection');
    c.helloed = true;
    c.send({
      t: 'welcome',
      v: PROTOCOL_VERSION,
      user: { id: c.user.id, displayName: c.user.displayName },
      activeMatch: this.userRoom.get(c.user.id) ?? null,
      serverTime: this.clock.now(),
    });
  }

  private disconnect(c: Client): void {
    const uid = c.user.id;
    if (this.clients.get(uid) === c) {
      this.clients.delete(uid);
      this.matchmaker.leave(uid);
      const code = this.hosting.get(uid);
      if (code) this.closeLobby(code, false);
    }
    const room = this.roomOf(uid);
    const seat = room?.seat(uid);
    if (room && seat !== null && seat !== undefined) room.detach(seat, c);
  }

  private closeLobby(code: string, notify: boolean): void {
    const lobby = this.lobbies.get(code);
    if (!lobby) return;
    lobby.expiry.cancel();
    this.lobbies.delete(code);
    this.hosting.delete(lobby.host.userId);
    if (notify) this.clients.get(lobby.host.userId)?.send({ t: 'private.cancelled' });
  }

  /** Seats two players (first mover at random), persists the match and opens its room. */
  private async startMatch(kind: MatchKind, a: QueueEntry, b: QueueEntry, timer: number | null): Promise<void> {
    const [p0, p1] = randomInt(2) === 0 ? [a, b] : [b, a];
    const config: MatchConfig = { seed: randomInt(2 ** 31), teams: [p0.specs, p1.specs] };
    const [row] = await this.ctx.db
      .insert(matches)
      .values({
        kind,
        status: 'active',
        contentVersion: this.ctx.content.version,
        engineVersion: ENGINE_VERSION,
        config,
        p0User: p0.userId,
        p1User: p1.userId,
      })
      .returning({ id: matches.id });
    const room = new MatchRoom({
      id: row!.id,
      kind,
      content: this.ctx.content,
      config,
      players: [
        { userId: p0.userId, displayName: p0.displayName, rating: p0.rating },
        { userId: p1.userId, displayName: p1.displayName, rating: p1.rating },
      ],
      timerSeconds: timer,
      clock: this.clock,
      store: dbRoomStore(this.ctx.db, this.ctx.content, this.ctx.rollSeed),
      onEnd: (r) => this.closeRoom(r),
      log: this.log,
    });
    this.rooms.set(room.id, room);
    for (const [p, e] of [p0, p1].entries()) {
      this.userRoom.set(e.userId, room.id);
      const client = this.clients.get(e.userId);
      if (!client) {
        // They disconnected while being paired: start their reconnection window.
        room.startGrace(p as PlayerId);
        continue;
      }
      client.send({
        t: 'match.start',
        matchId: room.id,
        kind,
        you: p as PlayerId,
        opponent: { displayName: (p === 0 ? p1 : p0).displayName },
        timer,
      });
      room.attach(p as PlayerId, client);
    }
  }

  private closeRoom(room: MatchRoom): void {
    this.rooms.delete(room.id);
    for (const p of room.players) if (this.userRoom.get(p.userId) === room.id) this.userRoom.delete(p.userId);
    if (room.endReason === 'disconnect' || room.endReason === 'afk') {
      const loser = room.players[room.forfeitedBy ?? 0];
      audit(this.ctx.db, 'match_forfeit', { userId: loser.userId, detail: { matchId: room.id, reason: room.endReason } });
    }
  }

  /** Aborts matches in memory; used on shutdown. */
  stop(): void {
    this.matchmaker.stop();
    for (const l of this.lobbies.values()) l.expiry.cancel();
  }

}
