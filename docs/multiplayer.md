# Multiplayer (Phase 5)

Online play runs through the **match service**: a WebSocket hub inside the API server
(`apps/server/src/match/`). It follows GDD §10.4 and §11.7: the server is the only holder of the
full game state, clients get redacted views, and planning is local-first.

## 1. Protocol (`packages/protocol`)

- **Versioned.** The client's first message is `hello` with the protocol version and its content
  version. A mismatch is refused (`version_mismatch` / `content_mismatch`) instead of letting two
  engines disagree.
- **Local-first turns.** The client rehearses its queue with the engine on a planning copy of its own
  redacted view (the same way the bots plan), then sends the whole turn as one **bundle**: the queue
  in resolution order, the tick order and the random-cost allocation. The server applies it
  atomically (`applyTurnBundle`); a bad bundle changes nothing and is answered with
  `match.turnRejected`. A test shows a bundle planned on the redacted view reproduces direct play
  byte-for-byte.
- **Drafts.** While planning, the client sends `turn.draft` (debounced). If the turn timer runs out,
  the server commits the latest valid draft, or an empty turn (GDD §9.2).
- **Redaction and sequence numbers.** Each player has their own redacted event log. Every event
  carries a per-player `seq`; a client that reconnects sends `sync` with the last `seq` it saw and gets
  the current view plus only the events it missed.

| Client → server | |
|---|---|
| `hello` | Protocol + content version |
| `queue.join` / `queue.leave` | Casual or ranked matchmaking |
| `private.create` / `private.join` / `private.cancel` | Private matches by code; the host picks a turn timer or none |
| `turn.draft` / `turn.submit` | Planning draft; finished turn (bundle) |
| `surrender`, `sync`, `ping` | |

| Server → client | |
|---|---|
| `welcome` | User, the match they're in (to resume), server time |
| `queue.status`, `queue.left`, `private.created`, `private.cancelled` | Lobby state |
| `match.start`, `match.sync` | A match began; full resync (view + missed events + deadline + presence) |
| `match.events` | New redacted events and the resulting view |
| `match.presence` | Opponent disconnected / reconnected, forfeit time |
| `match.turnRejected`, `match.end` | Rejection reason; result, end reason, ranked rating change |
| `error` | `bad_message`, `already_busy`, `invalid_team` (with the loadout problems), `no_such_code`, `rate_limited`, … |

## 2. Rooms

A `MatchRoom` holds one match's authoritative state. The rules:

| Rule | Value |
|---|---|
| Turn timer (casual, ranked) | 90 s; private matches choose 60 / 90 / 180 s or none |
| Timeout | The latest valid draft is committed, otherwise an empty turn |
| Abandonment (afk) | 3 timeouts in a row forfeit the match |
| Disconnect | 60 s to reconnect, then the match is forfeited; the opponent sees a countdown |
| First mover | Random |
| Seed | Server-side secret; stored with the match, sent only in finished replays |
| Replay log | Every engine command, in order (`match_actions`) |

A second connection from the same account replaces the first (the old socket is closed with 4000).
Rooms live in memory: matches still active when the server stops are marked **aborted** on the next
start (no ratings change).

## 3. Matchmaking and ratings

- **Queues:** casual and ranked. Players are paired within a rating band that starts at ±100 and
  widens 10 points per second of waiting, up to ±800; the closest rating wins.
- **Teams:** the active team is validated when queueing (the same checks as practice), so an invalid
  loadout is caught before a match starts.
- **Ratings:** Glicko-2 (tested against Glickman's worked example), one match per rating period.
  Ranked has a visible season rating (`ranked-s1`); casual keeps a hidden rating used only for
  pairing; private matches are unrated. A forfeit counts as a loss.
- The queue is in-process. Its interface (`join`, `leave`, `tick`) is small enough to move to Redis
  when the server runs as several processes (GDD §10.2).

## 4. History and replays

`GET /api/matches` lists the player's matches (result, opponent, end reason, turns, ranked rating
change). `GET /api/matches/:id/replay` returns the record (seed, frozen teams, commands) to
participants of finished matches; the client replays it locally with the engine from the player's
seat, turn by turn. Replays need the same engine and content versions they were recorded with.

## 5. Anti-abuse

- Every action is validated by the engine on the server; clients never send state.
- Credential endpoints are rate limited per IP (20 per minute by default).
- WebSocket messages go through a per-connection token bucket (burst 30, 15/s). Floods get
  `rate_limited`; persistent abuse closes the connection (4429).
- Frames over 32 KB are refused, and messages are schema-validated.
- An **audit log** records registrations, logins, failed logins, rate limiting, abuse and forfeits.

## 6. Client

Home has an **Online** panel: Casual, Ranked (with the current rating), private matches (create a
code or join one), and Resume for a match in progress. The battle screen shows the turn clock and
the opponent's connection status; an online match can't be left mid-game, only surrendered. The page
can be reloaded mid-match: it reconnects and resumes. **Match history** lists past matches and
opens replays.

To test alone, run a bot that plays online as a second account:

```bash
npm run bot -w @arena/server -- --mode casual        # queue (or ranked)
npm run bot -w @arena/server -- --code ABC234        # join your private match
```

## 7. Known limits

- One server process; rooms and the matchmaking queue are in memory.
- Stealthy-action redaction (R6) is partial: damage and effect events still name the actor.
- No spectators, chat, or leaderboards yet.
