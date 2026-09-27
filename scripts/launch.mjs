// One-click local launcher, behind Play.cmd, "Play (installable build).cmd" and "Online test bot.cmd".
// It starts the API server and the client, waits until both answer, and opens the game in the
// browser. Pressing Q (or closing the window) stops what it started, closing the database cleanly.
// A server or client that's already running is reused and left alone. Plain Node, no dependencies,
// so it can run before `npm install`.
//
//   node scripts/launch.mjs             the game, dev client at http://localhost:5173
//   node scripts/launch.mjs --build     the production build at http://localhost:4173 (installable, works offline)
//   node scripts/launch.mjs --bot       an online bot that keeps joining the casual queue
//   --no-open                           don't open the browser

import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOGS = join(ROOT, '.data', 'logs');
const flags = new Set(process.argv.slice(2));
const mode = flags.has('--bot') ? 'bot' : flags.has('--build') ? 'build' : 'dev';
const SERVER = 'http://127.0.0.1:8787';
const CLIENT = mode === 'build' ? 'http://localhost:4173' : 'http://localhost:5173';
const WIN = process.platform === 'win32';

const bold = (s) => `\x1b[1m${s}\x1b[22m`;
const dim = (s) => `\x1b[2m${s}\x1b[22m`;
const red = (s) => `\x1b[31m${s}\x1b[39m`;
const say = (s = '') => console.log(s);

/** Processes this launcher started. */
const started = [];
let stopping = false;

// ---------------------------------------------------------------- processes

// npm through this Node where possible, rather than npm.cmd through a shell.
const NPM_CLI = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
function npm(args, options) {
  return existsSync(NPM_CLI)
    ? spawn(process.execPath, [NPM_CLI, ...args], { cwd: ROOT, ...options })
    : spawn('npm', args, { cwd: ROOT, shell: WIN, ...options });
}

function npmSync(args) {
  const r = existsSync(NPM_CLI)
    ? spawnSync(process.execPath, [NPM_CLI, ...args], { cwd: ROOT, stdio: 'inherit' })
    : spawnSync('npm', args, { cwd: ROOT, shell: WIN, stdio: 'inherit' });
  return r.status === 0;
}

function eachLine(stream, fn) {
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (d) => {
    buf += d;
    for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
      fn(buf.slice(0, i).replace(/\r$/, ''));
      buf = buf.slice(i + 1);
    }
  });
  stream.on('end', () => buf && fn(buf));
}

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

/** What of a server log line to show: its message, minus per-request noise (the log file has everything). */
function serverLine(line) {
  try {
    const j = JSON.parse(line);
    if (j.req || j.res || (j.level ?? 30) < 30) return null;
    return j.level >= 50 ? red(`${j.msg}${j.err?.message ? `: ${j.err.message}` : ''}`) : j.msg;
  } catch {
    return line.trim() ? line : null;
  }
}

function clientLine(line) {
  const plain = stripAnsi(line).trim();
  if (!plain || /press h \+ enter|use --host to expose/.test(plain)) return null;
  return line.trim();
}

/**
 * Tracks a started process: echoes its output through `filter` with a tag and logs all of it.
 * `graceful`: stop it by closing its IPC channel. `exits`: exiting is normal (the bot, after a match).
 */
function run(name, child, filter, { graceful = false, exits = false } = {}) {
  mkdirSync(LOGS, { recursive: true });
  const logPath = join(LOGS, `${name}.log`);
  const log = createWriteStream(logPath);
  const tag = dim(`[${name}]`.padEnd(8));
  const onLine = (line) => {
    log.write(`${stripAnsi(line)}\n`);
    const shown = filter(line);
    if (shown && !stopping) say(`${tag} ${shown}`);
  };
  eachLine(child.stdout, onLine);
  eachLine(child.stderr, onLine);
  const entry = { name, child, graceful, logPath, exited: new Promise((r) => child.on('exit', r)) };
  child.on('exit', (code) => {
    if (!stopping && !exits) say(red(`${tag} stopped unexpectedly (exit code ${code}). Full log: ${relative(ROOT, logPath)}`));
  });
  started.push(entry);
  return entry;
}

function forceKill(child) {
  if (child.exitCode !== null) return;
  if (WIN) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGKILL');
}

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  if (started.length) say('\nStopping…');
  for (const s of started) {
    // The server closes its database when its IPC channel goes; the client can simply be killed.
    if (s.graceful && s.child.connected) s.child.disconnect();
    else forceKill(s.child);
  }
  await Promise.race([Promise.all(started.map((s) => s.exited)), sleep(8000)]);
  for (const s of started) forceKill(s.child);
  process.exit(code);
}

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));
process.on('SIGHUP', () => void shutdown(0)); // the window was closed

/** Q or Ctrl+C in this window stops everything (raw mode keeps Ctrl+C from reaching the children). */
function listenForQuit() {
  const input = process.stdin;
  if (input.isTTY) input.setRawMode(true);
  input.setEncoding('utf8');
  input.on('data', (k) => {
    if (/[qQ\x03]/.test(k)) void shutdown(0);
  });
}

// ---------------------------------------------------------------- checks

async function answers(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

async function waitFor(url, entry, seconds) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await answers(url)) return true;
    if (entry && entry.child.exitCode !== null) return false;
    await sleep(500);
  }
  return false;
}

function tail(path, lines = 15) {
  try {
    return readFileSync(path, 'utf8').trimEnd().split('\n').slice(-lines).join('\n');
  } catch {
    return '';
  }
}

async function fail(message, entry) {
  say(red(`\n${message}`));
  if (entry) {
    const t = tail(entry.logPath);
    if (t) say(`${dim(`Last lines of ${relative(ROOT, entry.logPath)}:`)}\n${t}`);
  }
  await shutdown(1);
}

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 22) return true;
  say(red(`Custom Arena needs Node.js 22 or newer (this is ${process.versions.node}): https://nodejs.org`));
  return false;
}

/** Installs dependencies when they're missing or package-lock.json changed since the last install. */
function ensureInstalled() {
  const marker = join(ROOT, 'node_modules', '.package-lock.json');
  const lock = join(ROOT, 'package-lock.json');
  if (existsSync(marker) && statSync(marker).mtimeMs >= statSync(lock).mtimeMs) return true;
  say(bold('Installing dependencies (first run or after an update)…'));
  return npmSync(['install', '--no-audit', '--no-fund']);
}

function openBrowser(url) {
  if (flags.has('--no-open')) return;
  const [cmd, args] = WIN ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true, windowsVerbatimArguments: WIN }).unref();
}

// ---------------------------------------------------------------- modes

async function startServer() {
  if (await answers(`${SERVER}/api/health`)) {
    say(`${dim('[server]')} already running at ${SERVER}; using it (it won't be stopped from here).`);
    return true;
  }
  say('Starting the game server…');
  // Node + tsx directly (not through npm) so the server has an IPC channel for a clean stop.
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: join(ROOT, 'apps', 'server'),
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  const entry = run('server', child, serverLine, { graceful: true });
  if (await waitFor(`${SERVER}/api/health`, entry, 90)) return true;
  await fail("The game server didn't start.", entry);
  return false;
}

async function startClient() {
  if (await answers(CLIENT)) {
    say(`${dim('[client]')} already running at ${CLIENT}; using it.`);
    return true;
  }
  if (mode === 'build') {
    say('Building the client…');
    if (!npmSync(['run', '-s', 'build'])) {
      await fail('The client build failed (see above).');
      return false;
    }
  }
  say(mode === 'build' ? 'Serving the production build…' : 'Starting the client…');
  const child = npm(['run', '-s', mode === 'build' ? 'preview' : 'dev', '-w', '@arena/client'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const entry = run('client', child, clientLine);
  if (await waitFor(CLIENT, entry, 90)) return true;
  await fail("The client didn't start.", entry);
  return false;
}

async function play() {
  say(bold(mode === 'build' ? 'Custom Arena — production build' : 'Custom Arena'));
  if (!(await startServer()) || !(await startClient())) return;
  listenForQuit();
  const line = '─'.repeat(64);
  say(`\n${line}`);
  say(`  ${bold('Custom Arena is running:')} ${bold(CLIENT)}`);
  say('');
  say('  • Sign in, or register any email and password (accounts are local).');
  say(`    A ready-made test account is in ${dim('apps/server/fixtures/dev-account.json')}.`);
  say('  • Online play on your own: double-click "Online test bot.cmd", then');
  say('    press Casual on the home screen. Or register a second account in a');
  say('    private browser window and queue from both.');
  if (mode === 'build') say('  • This build can be installed from the browser, and runs offline.');
  say('');
  say(`  ${bold('Press Q')} or close this window to stop.${started.length ? '' : ' (Nothing here to stop: both were already running.)'}`);
  say(`${line}\n`);
  openBrowser(CLIENT);
}

async function bot() {
  say(bold('Custom Arena — online test bot'));
  say('It signs in as "Practice Bot" and joins the casual queue; press Casual in the game to play it.');
  say(`It queues again after every match. ${bold('Press Q')} or close this window to stop it.\n`);
  listenForQuit();
  while (!stopping) {
    if (!(await answers(`${SERVER}/api/health`))) {
      say('Waiting for the game server… (start it with Play.cmd)');
      while (!stopping && !(await answers(`${SERVER}/api/health`))) await sleep(2000);
      if (stopping) break;
    }
    const child = npm(['run', '-s', 'bot', '-w', '@arena/server', '--', '--mode', 'casual'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const entry = run('bot', child, (l) => l.trim() || null, { exits: true });
    await entry.exited;
    started.splice(started.indexOf(entry), 1);
    if (!stopping) {
      say(dim('Queueing again in 3 seconds…'));
      await sleep(3000);
    }
  }
}

if (!checkNode() || !ensureInstalled()) process.exit(1);
await (mode === 'bot' ? bot() : play());
