# Deploying to custom.anima-arena.com

The game runs at **https://custom.anima-arena.com** on the `anima-arena` Google Cloud VM
(`us-central1-b`, Debian), next to the other games hosted there (`play.anima-arena.com` and the rest
are untouched).

## How it's set up

| Piece | Where |
|---|---|
| DNS | Cloudflare, zone `anima-arena.com`: `A custom → 35.208.245.67`, **DNS only** (grey cloud), like `play`. |
| TLS | Let's Encrypt via certbot (`/etc/letsencrypt/live/custom.anima-arena.com`), renewed automatically by webroot through `/var/www/html`. |
| Client | The Vite build in `/var/www/custom-arena`, served by nginx (`deploy/nginx-custom-arena.conf` → `/etc/nginx/sites-available/custom-arena`). |
| Server | systemd unit `custom-arena` (`deploy/custom-arena.service`), user `custom-arena`, `127.0.0.1:8795`, `NODE_ENV=production`, `TRUST_PROXY=1`. nginx proxies `/api` (and the `/api/ws` socket) to it. |
| Code | `/opt/custom-arena/releases/<date>-<sha>`, with `/opt/custom-arena/current` pointing at the live one (the last 3 are kept). |
| Data | PGlite in `/var/lib/custom-arena/pglite`. It started empty on 2026-10-03 (no local accounts were copied). |

## Deploying an update

Commit first (only the committed `HEAD` is deployed, packed with `git archive`), then from Git Bash:

```bash
bash deploy/deploy.sh
```

It uploads the release, runs `npm ci` and the client build on the VM, publishes the client, switches
`current`, restarts the server (which runs pending database migrations on start) and checks
`/api/health`. Players get the new client the next time they load the page (the service worker
picks up the new build).

## Useful commands (on the VM)

```bash
sudo systemctl status custom-arena          # is it running
sudo journalctl -u custom-arena -n 100      # server logs
sudo systemctl restart custom-arena         # restart (closes PGlite cleanly)
curl -s http://127.0.0.1:8795/api/health    # engine and content versions
```

Rolling back: point `/opt/custom-arena/current` at an earlier release in `/opt/custom-arena/releases`,
copy its `apps/client/dist/.` into `/var/www/custom-arena/`, and restart the service. Back up
`/var/lib/custom-arena` (with the service stopped) before risky changes; a migration can't be undone.

## One-time setup (already done)

1. DNS record above.
2. `sudo certbot certonly --webroot -w /var/www/html -d custom.anima-arena.com`
3. Install `deploy/nginx-custom-arena.conf` as `/etc/nginx/sites-available/custom-arena`, link it into
   `sites-enabled`, `sudo nginx -t && sudo systemctl reload nginx`.
4. `bash deploy/deploy.sh` (creates the user, folders and the systemd unit).
