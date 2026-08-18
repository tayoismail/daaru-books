# Deployment Guide (Hostinger / TrueHost)

This app is a Next.js store with a **file-based backend**: every record lives in
`data/*.json` (gitignored), uploads in `public/uploads`, covers in
`public/covers`. There is **no database** to provision.

**The one rule that protects your business:** *never* deploy in a way that
recreates the app folder or bakes `data/` into a fresh image. Use git-based
deploys (code only), keep the data folder untouched, and back it up nightly.

---

## Data-safety toolkit (in this repo)

| File | What it does |
|---|---|
| `scripts/backup.sh` | Nightly tar of `data/` + uploads + covers into `backups/` (keeps last 14). Optionally pushes each backup to a **free private Git repo** (GitHub/GitLab) for off-site insurance. |
| `scripts/restore.sh` | Restores the latest backup; falls back to the off-site Git copy if the server has nothing local. |
| `scripts/deploy.sh` | **VPS safe redeploy**: git pull → self-heal data from backup if missing → build → PM2 restart. |
| `ecosystem.config.js` | PM2 config. Can point `DATA_DIR` outside the deploy folder. |
| `lib/db.ts` (`DATA_DIR`) | The app reads/writes data wherever `DATA_DIR` points (default `<cwd>/data`). |

---

## Option A — Cheapest plan: shared hosting (cPanel Node.js) — works, with rules

Both Hostinger Business shared and TrueHost shared support Node.js via cPanel's
"Setup Node.js App". Data survives redeploys **as long as you never delete the
app folder** (`data/` lives inside it). This is the cheapest possible route.

Setup:
1. Create the Node.js app in cPanel (application root, e.g. `~/nodeapps/daaru`).
2. Upload the repo **without** `.git`, `node_modules`, `backups/`, or `data/`
   — `data/` is gitignored, so **a fresh clone has no data folder and the
   store starts empty.** After `npm ci` + `npm run build`, bring your records
   in one of two ways:
   - `bash scripts/restore.sh` (restores your latest backup — recommended), or
   - start the app and re-add books/orders manually via the admin panel.
3. Subsequent updates: upload **only changed code files** (or `git pull` if the
   host gives you SSH/git access). **Never re-create or delete the app root.**

Nightly backup via cPanel → Cron Jobs:
```
0 2 * * * bash /home/USER/nodeapps/daaru/scripts/backup.sh
```
Then download `backups/` regularly, or enable the off-site Git push:

```
0 2 * * * DATA_GIT_REPO=git@github.com:you/daaru-data-backup.git bash /home/USER/nodeapps/daaru/scripts/backup.sh
```

---

## Option B — Recommended: VPS (Hostinger KVM / TrueHost Cloud VPS)

A VPS makes data loss effectively impossible because the data folder is a
normal folder on a disk you control — `git pull` only ever touches code.

Setup (once):
```bash
# 1. Install Node 20 + PM2 on the server
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm i -g pm2

# 2. Clone the app (code only — data/ is gitignored and not in the repo)
git clone <your-repo-url> /home/daaru/app && cd /home/daaru/app
npm ci
npm run build

# 3. Optional best practice: keep data outside the deploy folder
sudo mkdir -p /var/lib/daaru/data && sudo chown -R $USER /var/lib/daaru/data
# then uncomment DATA_DIR in ecosystem.config.js

# 4. First run + boot persistence
pm2 startOrReload ecosystem.config.js --env production
pm2 save
pm2 startup   # paste the printed command

# 5. Nightly backup (also add DATA_GIT_REPO for off-site insurance)
crontab -e
0 2 * * * bash /home/daaru/app/scripts/backup.sh
```

**Every future deploy — safe, never loses data:**
```bash
cd /home/daaru/app
bash scripts/deploy.sh
```

Restoring after a disaster (fresh server): `git clone` → `npm ci` → `npm run
build` → `bash scripts/restore.sh` (pulls the newest backup, from the off-site
Git copy if needed) → start PM2.

---

## ⚠️ What NOT to do (the only real ways to lose data)

1. **Don't redeploy via Docker** without a persistent volume. The repo's
   `Dockerfile` copies `data/` into the image at build time — a fresh image
   replaces the live folder and wipes runtime records. If you must use Docker,
   mount a volume over `/app/data`.
2. **Don't delete/re-create the app folder** on shared hosting (Option A).
3. **Don't run the app without backups** for more than a day. `orders.json` is
   your business.
4. **Never commit `data/`, `public/uploads`, `public/covers` or `backups/`**
   to a public repo — they contain customer PII. (All already gitignored.)
