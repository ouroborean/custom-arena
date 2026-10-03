#!/usr/bin/env bash
# Deploys the committed HEAD to custom.anima-arena.com (docs/deploy.md): packs the repo with
# `git archive` (so only committed files go, never .data/ or character_images/), copies it to the
# anima-arena VM and runs deploy/install.sh there. Needs the gcloud CLI, logged in.
# Usage: bash deploy/deploy.sh
set -euo pipefail

VM=anima-arena
ZONE=us-central1-b
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Uncommitted changes: only the committed HEAD is deployed. Commit first (or stash)." >&2
  exit 1
fi
SHA="$(git rev-parse --short HEAD)"
TARBALL="custom-arena-$SHA.tar.gz"
TMP="${TMPDIR:-/tmp}"
git archive --format=tar.gz -o "$TMP/$TARBALL" HEAD
echo "Deploying $SHA ($(du -h "$TMP/$TARBALL" | cut -f1)) to $VM"

gcloud compute scp --zone "$ZONE" "$TMP/$TARBALL" "$VM:/tmp/$TARBALL"
rm -f "$TMP/$TARBALL"
gcloud compute ssh "$VM" --zone "$ZONE" --command "tar -xzOf /tmp/$TARBALL deploy/install.sh > /tmp/custom-arena-install.sh && sudo bash /tmp/custom-arena-install.sh /tmp/$TARBALL"
echo "Live at https://custom.anima-arena.com"
