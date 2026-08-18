#!/usr/bin/env bash
#
# Nightly backup of the file-based "database" (data/) + uploads + covers.
# Works on any Linux host — VPS (cron) and cPanel shared hosting (Cron Jobs).
#
#   bash scripts/backup.sh
#
# Optional off-site insurance (free): push each backup to a private Git remote
# (GitHub/GitLab private repos are free), so even a destroyed server loses
# nothing:
#
#   DATA_GIT_REPO=git@github.com:you/daaru-data-backup.git bash scripts/backup.sh
#
# Env vars: BACKUP_DIR (default <app>/backups), RETENTION (default 14),
#           DATA_GIT_REPO, DATA_GIT_BRANCH (default main)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
RETENTION="${RETENTION:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/daaru-data-$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

# Collect what exists — uploads/covers may be absent on a fresh checkout.
INCLUDES=("data")
[ -d "$APP_DIR/public/uploads" ] && INCLUDES+=("public/uploads")
[ -d "$APP_DIR/public/covers" ] && INCLUDES+=("public/covers")

tar -czf "$ARCHIVE" -C "$APP_DIR" "${INCLUDES[@]}"
echo "Backup written: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# Prune old backups, keeping the newest $RETENTION.
ls -1t "$BACKUP_DIR"/daaru-data-*.tar.gz 2>/dev/null | tail -n +$((RETENTION + 1)) | while read -r old; do
  rm -f "$old"
  echo "Pruned old backup: $old"
done

# Optional: push off-site so a lost server costs nothing.
if [ -n "${DATA_GIT_REPO:-}" ]; then
  GIT_BRANCH="${DATA_GIT_BRANCH:-main}"
  (
    cd "$BACKUP_DIR"
    git init -q 2>/dev/null || true
    git add -A
    git -c user.name="daaru-backup" -c user.email="backup@daaru.local" \
      commit -q -m "backup $TIMESTAMP" 2>/dev/null || true
    if git push -q "$DATA_GIT_REPO" "HEAD:$GIT_BRANCH" 2>/dev/null; then
      echo "Off-site copy pushed to: $DATA_GIT_REPO"
    else
      echo "WARN: off-site push failed — check DATA_GIT_REPO. Local backup kept." >&2
    fi
  )
fi

echo "Backup complete."
