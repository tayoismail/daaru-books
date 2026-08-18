#!/usr/bin/env bash
#
# Restore the latest backup (data/ + public/uploads + public/covers).
# Use after a fresh install, or when a redeploy wiped the data folder.
#
#   bash scripts/restore.sh            # latest local backup
#   bash scripts/restore.sh <file>     # a specific backup archive
#
# If no local backup exists and DATA_GIT_REPO is set, it pulls the newest
# backup from the off-site copy (see scripts/backup.sh).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"

ARCHIVE="${1:-}"
if [ -z "$ARCHIVE" ]; then
  ARCHIVE="$(ls -1t "$BACKUP_DIR"/daaru-data-*.tar.gz 2>/dev/null | head -1 || true)"
fi

# Fallback: no local backup — try the off-site Git copy.
if [ -z "$ARCHIVE" ] && [ -n "${DATA_GIT_REPO:-}" ]; then
  echo "No local backup found — pulling from off-site repo $DATA_GIT_REPO..."
  TMP_DIR="$(mktemp -d)"
  if ! git clone -q --depth 1 "$DATA_GIT_REPO" "$TMP_DIR" 2>/dev/null; then
    rm -rf "$TMP_DIR"
    echo "ERROR: could not pull off-site repo (check DATA_GIT_REPO)." >&2
    exit 1
  fi
  ARCHIVE="$(ls -1t "$TMP_DIR"/daaru-data-*.tar.gz 2>/dev/null | head -1 || true)"
fi

if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "ERROR: no backup archive found (looked in $BACKUP_DIR)." >&2
  exit 1
fi

# Hardening: refuse archives containing parent-dir or absolute paths, in case
# the off-site copy was tampered with.
if tar -tzf "$ARCHIVE" | grep -qE '(^|/)\.\.(/|$)|^/'; then
  echo "ERROR: backup archive contains unsafe paths — refusing to extract." >&2
  [ -n "${TMP_DIR:-}" ] && rm -rf "$TMP_DIR"
  exit 1
fi

echo "Restoring from: $ARCHIVE"
tar -xzf "$ARCHIVE" -C "$APP_DIR"
[ -n "${TMP_DIR:-}" ] && rm -rf "$TMP_DIR"
echo "Restored data/, public/uploads and public/covers into $APP_DIR"
echo "Restart the app now (e.g. pm2 startOrReload ecosystem.config.js --env production)."
