// Development tool: a bot that plays online through the real protocol, so one person can test
// matchmaking, private matches, timers and reconnection. Plans with the greedy bot from its own
// redacted view, exactly like a client.
//
//   npm run bot -w @arena/server -- --mode casual            (queue)
//   npm run bot -w @arena/server -- --code ABC234            (join a private match)
//   options: --server http://127.0.0.1:8787  --account fixtures/bot-account.json  --slow 1500

import { readFileSync } from 'node:fs';
import { greedyBot } from '@arena/ai';
import { applyCommand, type PlayerId, type PlayerView } from '@arena/engine';
import { loadContentOrThrow } from '@arena/content';
import { bundleFromState, PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from '@arena/protocol';
import { planningState } from '@arena/ai';
import WebSocket from 'ws';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i]!.replace(/^--/, ''), process.argv[i + 1] ?? '');
const server = args.get('server') ?? 'http://127.0.0.1:8787';
const account = JSON.parse(readFileSync(args.get('account') ?? new URL('../fixtures/bot-account.json', import.meta.url), 'utf8')) as {
  email: string;
  password: string;
  displayName: string;
};
const slow = Number(args.get('slow') ?? 1500);
const content = loadContentOrThrow();

async function session(): Promise<string> {
  const post = (path: string, body: unknown) =>
    fetch(`${server}/api${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let res = await post('/auth/login', { email: account.email, password: account.password });
  if (res.status === 401) res = await post('/auth/register', account);
  if (!res.ok) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith('arena_session='));
  if (!cookie) throw new Error('no session cookie');
  return cookie.split(';')[0]!;
}

const cookie = await session();
const ws = new WebSocket(`${server.replace(/^http/, 'ws')}/api/ws`, { headers: { cookie } });
const send = (m: ClientMessage) => ws.send(JSON.stringify(m));
const bot = greedyBot(Date.now() % 100000);
let you: PlayerId = 0;

function play(matchId: string, view: PlayerView): void {
  if (view.phase === 'finished' || view.activePlayer !== you) return;
  setTimeout(() => {
    const cmds = bot.planTurn(content, view);
    let plan = planningState(view);
    for (const c of cmds) if (c.t !== 'endTurn') plan = applyCommand(content, plan, you, c).state;
    send({ t: 'turn.submit', matchId, turn: bundleFromState(plan, you) });
    console.log(`turn ${view.turn}: submitted ${plan.players[you].queue.length} action(s)`);
  }, slow);
}

ws.on('open', () => send({ t: 'hello', v: PROTOCOL_VERSION, contentVersion: content.version }));
ws.on('close', (code, reason) => {
  console.log(`closed ${code} ${String(reason)}`);
  process.exit(0);
});
ws.on('message', (data) => {
  const msg = JSON.parse(String(data)) as ServerMessage;
  switch (msg.t) {
    case 'welcome':
      console.log(`signed in as ${msg.user.displayName}`);
      if (msg.activeMatch) send({ t: 'sync', matchId: msg.activeMatch, lastSeq: 0 });
      else if (args.get('code')) send({ t: 'private.join', code: args.get('code')! });
      else send({ t: 'queue.join', mode: (args.get('mode') as 'casual' | 'ranked') ?? 'casual' });
      break;
    case 'queue.status':
      console.log(`queued (${msg.mode})`);
      break;
    case 'match.start':
      you = msg.you;
      console.log(`match ${msg.matchId} vs ${msg.opponent.displayName}; seat ${msg.you}`);
      break;
    case 'match.sync':
      you = msg.you;
      play(msg.matchId, msg.view);
      break;
    case 'match.events':
      play(msg.matchId, msg.view);
      break;
    case 'match.turnRejected':
      console.log(`turn rejected: ${msg.reason}`);
      break;
    case 'match.end':
      console.log(`match over: winner ${msg.result.winner} (${msg.reason})`);
      ws.close();
      break;
    case 'error':
      console.log(`error: ${msg.code} ${msg.message}`);
      if (msg.code !== 'rate_limited') ws.close();
      break;
    default:
      break;
  }
});
