const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { catalog } = require('./stickers');

function createDatabase(dataDir = process.env.DATA_DIR || './data') {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'mila.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id), topic TEXT NOT NULL CHECK(topic IN ('school','family','food')), turn_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT);
    CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL REFERENCES sessions(id), role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS stickers (id TEXT PRIMARY KEY, topic TEXT NOT NULL, name TEXT NOT NULL, asset_path TEXT NOT NULL, sort_order INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS user_stickers (user_id TEXT NOT NULL REFERENCES users(id), sticker_id TEXT NOT NULL REFERENCES stickers(id), unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, sticker_id));
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
    CREATE INDEX IF NOT EXISTS idx_user_stickers_user ON user_stickers(user_id);
  `);
  const insert = db.prepare('INSERT OR IGNORE INTO stickers (id, topic, name, asset_path, sort_order) VALUES (?, ?, ?, ?, ?)');
  db.transaction(() => catalog.forEach((s, i) => insert.run(s[0], s[1], s[2], `/assets/stickers/${s[3]}`, i % 6)))();
  return db;
}
module.exports = { createDatabase };
