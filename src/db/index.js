import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { DB_PATH, SCHEMA_PATH } from '../config.js';

let db = null;

/**
 * Opens the SQLite database (creating the file and its folder on first run),
 * applies the schema, and caches the connection for the rest of the process.
 *
 * @returns {DatabaseSync}
 */
export function getDb() {
  if (db) {
    return db;
  }

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  db = new DatabaseSync(DB_PATH);

  // WAL lets reads continue while a bid is being written - important once
  // several bidders hit the same auction in Phase 6.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  // If another process holds the write lock (a seed script run while the
  // server is up, for example), wait a few seconds and then fail loudly.
  // Without this the server would block indefinitely on that lock.
  db.exec('PRAGMA busy_timeout = 5000');

  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Runs `work` inside a transaction, rolling back if it throws.
 *
 * @template T
 * @param {DatabaseSync} database
 * @param {() => T} work
 * @returns {T}
 */
export function transaction(database, work) {
  database.exec('BEGIN');
  try {
    const result = work();
    database.exec('COMMIT');
    return result;
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}

/** Current time as an ISO 8601 UTC string, the format every table stores. */
export function nowIso() {
  return new Date().toISOString();
}
