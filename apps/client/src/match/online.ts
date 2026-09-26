// The WebSocket connection to the match service: hello/versioning, reconnection with backoff,
// lobby state (queues, private codes), and routing of match messages to RemoteMatch sessions.

import { PROTOCOL_VERSION, type ClientMessage, type QueueMode, type ServerMessage } from '@arena/protocol';
import { create } from 'zustand';
import { content } from '../content.js';
import { useMeta } from '../meta.js';
import { useStore } from '../store.js';
import { RemoteMatch } from './RemoteMatch.js';

export type Lobby =
  | { kind: 'idle' }
  | { kind: 'queued'; mode: QueueMode; since: number }
  | { kind: 'hosting'; code: string; timer: number | null }
  | { kind: 'inMatch'; matchId: string };

interface OnlineState {
  status: 'offline' | 'connecting' | 'ready';
  lobby: Lobby;
  error: string | null;
  problems: string[];
  /** Server clock minus local clock, for countdowns. */
  offset: number;
  /** A match still in progress that the player left the screen of. */
  current: RemoteMatch | null;
}

export const useOnline = create<OnlineState>(() => ({
  status: 'offline',
  lobby: { kind: 'idle' },
  error: null,
  problems: [],
  offset: 0,
  current: null,
}));

/** Server time now (epoch ms). */
export function serverNow(): number {
  return Date.now() + useOnline.getState().offset;
}

class OnlineLink {
  private ws: WebSocket | null = null;
  private wanted = false;
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly sessions = new Map<string, RemoteMatch>();

  connect(): void {
    this.wanted = true;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    this.open();
  }

  disconnect(): void {
    this.wanted = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close(1000, 'bye');
    this.ws = null;
    useOnline.setState({ status: 'offline', lobby: { kind: 'idle' } });
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else useOnline.setState({ error: 'Not connected to the match server' });
  }

  joinQueue(mode: QueueMode) {
    useOnline.setState({ error: null, problems: [] });
    this.send({ t: 'queue.join', mode });
  }
  leaveQueue() {
    this.send({ t: 'queue.leave' });
  }
  createPrivate(timer: number | null) {
    useOnline.setState({ error: null, problems: [] });
    this.send({ t: 'private.create', timer });
  }
  joinPrivate(code: string) {
    useOnline.setState({ error: null, problems: [] });
    this.send({ t: 'private.join', code });
  }
  cancelPrivate() {
    this.send({ t: 'private.cancel' });
    useOnline.setState({ lobby: { kind: 'idle' } });
  }

  private open(): void {
    useOnline.setState({ status: 'connecting' });
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retries = 0;
      ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, contentVersion: content.version } satisfies ClientMessage));
    };
    ws.onmessage = (e) => {
      try {
        this.handle(JSON.parse(String(e.data)) as ServerMessage);
      } catch (err) {
        console.error('bad server message', err);
      }
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      useOnline.setState({ status: 'offline' });
      // 4400 version, 4401 signed out, 4000 replaced by another tab: don't fight it.
      if (!this.wanted || e.code === 4400 || e.code === 4401 || e.code === 4000) {
        if (e.code === 4000) useOnline.setState({ error: 'Opened in another tab' });
        return;
      }
      const delay = Math.min(10_000, 500 * 2 ** this.retries++);
      this.retryTimer = setTimeout(() => this.open(), delay);
    };
  }

  private session(matchId: string, init: Extract<ServerMessage, { t: 'match.start' | 'match.sync' }>): RemoteMatch {
    let s = this.sessions.get(matchId);
    if (!s) {
      s = new RemoteMatch(content, matchId, { kind: 'online', you: init.you, opponent: init.opponent.displayName, matchKind: init.kind, timer: init.timer }, this);
      this.sessions.set(matchId, s);
    }
    return s;
  }

  private handle(msg: ServerMessage): void {
    switch (msg.t) {
      case 'welcome': {
        useOnline.setState({ status: 'ready', offset: msg.serverTime - Date.now(), error: null });
        // Resume the match we were in, or learn that it ended while we were away.
        for (const [id, s] of this.sessions) if (id !== msg.activeMatch && !s.finished) s.abandon();
        if (msg.activeMatch) {
          const s = this.sessions.get(msg.activeMatch);
          this.send({ t: 'sync', matchId: msg.activeMatch, lastSeq: s?.seq ?? 0 });
          useOnline.setState({ lobby: { kind: 'inMatch', matchId: msg.activeMatch } });
        } else if (useOnline.getState().lobby.kind === 'inMatch') useOnline.setState({ lobby: { kind: 'idle' } });
        return;
      }
      case 'pong':
        useOnline.setState({ offset: msg.serverTime - (msg.at + Date.now()) / 2 });
        return;
      case 'error':
        useOnline.setState({ error: msg.message, problems: msg.problems ?? [] });
        return;
      case 'queue.status':
        useOnline.setState({ lobby: { kind: 'queued', mode: msg.mode, since: msg.since } });
        return;
      case 'queue.left':
      case 'private.cancelled':
        useOnline.setState({ lobby: { kind: 'idle' } });
        return;
      case 'private.created':
        useOnline.setState({ lobby: { kind: 'hosting', code: msg.code, timer: msg.timer } });
        return;
      case 'match.start':
        this.session(msg.matchId, msg);
        useOnline.setState({ lobby: { kind: 'inMatch', matchId: msg.matchId } });
        return;
      case 'match.sync': {
        const s = this.session(msg.matchId, msg);
        const first = !s.ready;
        s.handle(msg);
        useOnline.setState({ current: s, lobby: { kind: 'inMatch', matchId: msg.matchId } });
        // Show the battle when the match first becomes visible (start, or resuming after a reload).
        if (first && useStore.getState().match !== s) useStore.getState().newSession(s, 'home');
        return;
      }
      case 'match.end': {
        this.sessions.get(msg.matchId)?.handle(msg);
        useOnline.setState({ lobby: { kind: 'idle' } });
        // Rewards changed the wallet and inventory.
        if (msg.reward) void useMeta.getState().refresh();
        return;
      }
      case 'match.events':
      case 'match.presence':
      case 'match.turnRejected':
        this.sessions.get(msg.matchId)?.handle(msg);
        return;
    }
  }
}

export const online = new OnlineLink();
