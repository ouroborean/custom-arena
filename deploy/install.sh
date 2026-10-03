#!/usr/bin/env bash
# Runs on the VM as root (deploy/deploy.sh calls it): unpacks a release, installs dependencies, builds
# the client, publishes it, points /opt/custom-arena/current at the release and restarts the server.
# Keeps the last 3 releases. Usage: sudo bash install.sh /tmp/custom-arena-<sha>.tar.gz
set -euo pipefail

TARBALL="$1"
BASE=/opt/custom-arena
DATA=/var/lib/custom-arena
WEB=/var/www/custom-arena
NAME="$(basename "$TARBALL" .tar.gz)"
DIR="$BASE/releases/$(date +%Y%m%d-%H%M%S)-${NAME#custom-arena-}"

id custom-arena >/dev/null 2>&1 || useradd --system --home "$DATA" --shell /usr/sbin/nologin custom-arena
mkdir -p "$BASE/releases" "$DATA" "$WEB"
chown custom-arena:custom-arena "$DATA"

echo "== unpacking into $DIR"
mkdir -p "$DIR"
tar -xzf "$TARBALL" -C "$DIR"
cd "$DIR"

echo "== installing dependencies"
npm ci --no-audit --no-fund --loglevel=error
echo "== building the client"
npm run build --silent

echo "== publishing"
# Copy the new build over the old one (fresh mtimes); old hashed bundles stay a week for open tabs.
cp -r apps/client/dist/. "$WEB/"
find "$WEB/assets" -type f -mtime +7 -delete 2>/dev/null || true
ln -sfn "$DIR" "$BASE/current"

install -m 644 deploy/custom-arena.service /etc/systemd/system/custom-arena.service
systemctl daemon-reload
systemctl enable custom-arena >/dev/null 2>&1
echo "== restarting the server"
systemctl restart custom-arena
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8795/api/health >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:8795/api/health && echo

echo "== pruning old releases"
ls -1dt "$BASE"/releases/* | tail -n +4 | xargs -r rm -rf
rm -f "$TARBALL"
echo "== done: $DIR"
