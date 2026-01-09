const os = require('os');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');

function getDbPath() {
  return path.join(os.homedir(), '.cue', 'cue.db');
}

function ensureDbDir() {
  const p = getDbPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

function openDb() {
  const dbPath = ensureDbDir();
  const db = new sqlite3.Database(dbPath);
  return { db, dbPath };
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

async function initSchema(db) {
  await run(
    db,
    [
      'CREATE TABLE IF NOT EXISTS cue_requests (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  request_id TEXT UNIQUE,',
      '  agent_id TEXT DEFAULT "",',
      '  prompt TEXT NOT NULL,',
      '  payload TEXT,',
      '  status TEXT DEFAULT "PENDING",',
      '  created_at TEXT,',
      '  updated_at TEXT',
      ')',
    ].join('\n')
  );

  await run(db, 'CREATE INDEX IF NOT EXISTS ix_cue_requests_request_id ON cue_requests(request_id)');
  await run(db, 'CREATE INDEX IF NOT EXISTS ix_cue_requests_agent_id ON cue_requests(agent_id)');

  await run(
    db,
    [
      'CREATE TABLE IF NOT EXISTS cue_responses (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  request_id TEXT UNIQUE,',
      '  response_json TEXT NOT NULL,',
      '  cancelled INTEGER DEFAULT 0,',
      '  created_at TEXT',
      ')',
    ].join('\n')
  );

  await run(db, 'CREATE INDEX IF NOT EXISTS ix_cue_responses_request_id ON cue_responses(request_id)');
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = { openDb, initSchema, run, get, nowIso, getDbPath };
