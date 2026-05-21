import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadConfig } from './config.js';
import { getLogger } from './logger.js';

export type DB = Database.Database;

let cached: DB | null = null;

function ensureDir(filePath: string) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function getDb(): DB {
  if (cached) return cached;
  const cfg = loadConfig();
  const dbPath = join(cfg.dataDir, 'cache.db');
  ensureDir(dbPath);

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  applyMigrations(db);

  cached = db;
  return db;
}

/**
 * 마이그레이션 — 각 모듈은 init()에서 자체 테이블을 생성할 수도 있지만,
 * 공통/공유 테이블은 여기서 보장한다.
 */
function applyMigrations(db: DB) {
  const log = getLogger('db');
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      resource TEXT PRIMARY KEY,
      last_cursor TEXT,
      last_synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  log.debug('migrations applied');
}

export function closeDb() {
  if (cached) {
    cached.close();
    cached = null;
  }
}
