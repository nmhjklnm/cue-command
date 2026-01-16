const os = require('os');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

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
  const db = new Database(dbPath);
  return { db, dbPath };
}

async function run(db, sql, params = []) {
  const info = db.prepare(sql).run(params);
  return { lastID: info.lastInsertRowid, changes: info.changes };
}

async function get(db, sql, params = []) {
  const row = db.prepare(sql).get(params);
  return row || null;
}

async function initSchema(db) {
  await run(
    db,
    [
      'CREATE TABLE IF NOT EXISTS schema_meta (',
      '  key TEXT PRIMARY KEY,',
      '  value TEXT NOT NULL',
      ')',
    ].join('\n')
  );

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

  await run(
    db,
    [
      'CREATE TABLE IF NOT EXISTS cue_files (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  sha256 TEXT UNIQUE NOT NULL,',
      '  file TEXT NOT NULL,',
      '  mime_type TEXT NOT NULL,',
      '  size_bytes INTEGER NOT NULL,',
      '  created_at TEXT',
      ')',
    ].join('\n')
  );

  await run(db, 'CREATE INDEX IF NOT EXISTS ix_cue_files_sha256 ON cue_files(sha256)');

  await run(
    db,
    [
      'CREATE TABLE IF NOT EXISTS cue_response_files (',
      '  response_id INTEGER NOT NULL,',
      '  file_id INTEGER NOT NULL,',
      '  idx INTEGER NOT NULL,',
      '  PRIMARY KEY (response_id, idx)',
      ')',
    ].join('\n')
  );

  await run(db, 'CREATE INDEX IF NOT EXISTS ix_cue_response_files_response_id ON cue_response_files(response_id)');
  await run(db, 'CREATE INDEX IF NOT EXISTS ix_cue_response_files_file_id ON cue_response_files(file_id)');

  const versionRow = await get(db, 'SELECT value FROM schema_meta WHERE key = ?', ['schema_version']);
  if (!versionRow) {
    const reqCountRow = await get(db, 'SELECT COUNT(*) AS n FROM cue_requests');
    const respCountRow = await get(db, 'SELECT COUNT(*) AS n FROM cue_responses');
    const reqCount = reqCountRow ? Number(reqCountRow.n) : 0;
    const respCount = respCountRow ? Number(respCountRow.n) : 0;
    if (reqCount === 0 && respCount === 0) {
      await run(db, 'INSERT INTO schema_meta (key, value) VALUES (?, ?)', ['schema_version', '3']);
    }
  }
}

function nowIso() {
  const now = new Date();
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = (n) => String(Math.abs(n)).padStart(2, '0');
  const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
  const offsetMinutes = pad(Math.abs(offset) % 60);
  
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${sign}${offsetHours}:${offsetMinutes}`;
}

module.exports = { openDb, initSchema, run, get, nowIso, getDbPath };
