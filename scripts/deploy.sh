#!/usr/bin/env bash
#
# Safe redeploy for VPS deployments (Hostinger KVM / TrueHost Cloud VPS).
#
# Why this never loses data:
#   1. data/ is gitignored, so `git pull` only updates code — it cannot touch
#      the live records.
#   2. If the data folder was ever wiped (fresh box, manual mistake), this
#      script restores the latest backup BEFORE starting the app.
#   3. Backups are made daily by scripts/backup.sh (cron) and, optionally,
#      pushed off-site to a private Git remote.
#
# Run on the server, inside the app directory:
#   bash scripts/deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

echo "==> Pulling latest code (data/ is gitignored — untouched by git)"
git pull --ff-only

echo "==> Self-heal check: is live data present?"
if [ ! -f "$APP_DIR/data/books.json" ] || [ ! -f "$APP_DIR/data/orders.json" ]; then
  echo "    Live data missing — restoring latest backup before starting…"
  # Best-effort: a brand-new server has no backup yet, and that's fine
  # (store starts empty until reseeded or restored later).
  if ! bash "$SCRIPT_DIR/restore.sh"; then
    echo "WARN: no backup to restore — starting fresh (empty store)." >&2
  fi
else
  echo "    Live data present — nothing to restore."
fi

echo "==> Installing dependencies + building"
npm ci
npm run build

echo "==> Restarting the app"
if command -v pm2 >/dev/null 2>&1; then
  pm2 startOrReload ecosystem.config.js --env production
  pm2 save
else
  echo "WARN: pm2 not found — start the app with your host's process manager."
fi

echo "==> Deploy complete. Live data is at $APP_DIR/data (or \$DATA_DIR)."
