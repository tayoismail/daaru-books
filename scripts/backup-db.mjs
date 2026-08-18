#!/usr/bin/env node

/**
 * Backup the Daaru Books SQLite database.
 *
 * Usage:
 *   node scripts/backup-db.mjs
 *
 * Creates a timestamped copy in data/backups/ and keeps the last 30 backups.
 * Set DATA_DIR env var to use a custom data directory.
 *
 * Cron example (daily at 2am):
 *   0 2 * * * cd /path/to/daaru-books && node scripts/backup-db.mjs
 */

import { copyFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "daaru.db");
const BACKUP_DIR = join(DATA_DIR, "backups");
const MAX_BACKUPS = 30;

function main() {
  // Check database exists
  if (!existsSync(DB_PATH)) {
    console.error("❌ Database file not found:", DB_PATH);
    process.exit(1);
  }

  // Ensure backup directory exists
  mkdirSync(BACKUP_DIR, { recursive: true });

  // Create timestamped filename
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupFile = join(BACKUP_DIR, `daaru-${timestamp}.db`);

  // Copy the database
  copyFileSync(DB_PATH, backupFile);
  console.log(`✅ Backup created: ${backupFile}`);

  // Clean up old backups (keep most recent MAX_BACKUPS)
  const backups = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("daaru-") && f.endsWith(".db"))
    .sort()
    .reverse();

  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(MAX_BACKUPS);
    for (const file of toDelete) {
      unlinkSync(join(BACKUP_DIR, file));
      console.log(`  🗑  Removed old backup: ${file}`);
    }
    console.log(`  Kept ${MAX_BACKUPS} most recent backups.`);
  } else {
    console.log(`  📦 ${backups.length} backup(s) stored.`);
  }
}

main();
