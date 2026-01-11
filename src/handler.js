const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sleep } = require('./io');
const { generateName } = require('./naming');
const { openDb, initSchema, run, get, nowIso, getDbPath } = require('./db');

const CUE_TODO_CONSTRAINT_TEXT =
  '重要：【Human Agent Protocol 强制遵循】你必须遵循Human Agent Protocol协议：在每次完成我的指令之前或回答问题时，必须向我 cue（即调用 cue(prompt, agent_id, payload?) 让我继续输入）。未实际调用 cue之前，不得结束回复；\n\n' +
  "重要：【todo_list 强制检查】开始执行此条用户指令前，请检查当前 todo_list，并确保最后一条任务为'用 cue发送{{用户这条指令所对应的可能的响应}}'。 若不存在，必须立即补充添加。";

function newRequestId() {
  return 'req_' + crypto.randomBytes(6).toString('hex');
}

async function waitForResponse(db, requestId, timeoutSeconds) {
  const start = Date.now();
  while (true) {
    const row = await get(db, 'SELECT * FROM cue_responses WHERE request_id = ?', [requestId]);
    if (row) return row;

    if (timeoutSeconds != null) {
      const elapsed = (Date.now() - start) / 1000;
      if (elapsed > timeoutSeconds) {
        const err = new Error(`Timed out waiting for response: ${requestId}`);
        err.code = 'TIMEOUT';
        throw err;
      }
    }

    await sleep(500);
  }
}

function parseUserResponseJson(responseJson) {
  try {
    const obj = JSON.parse(responseJson);
    if (!obj || typeof obj !== 'object') return { text: '' };
    return {
      text: typeof obj.text === 'string' ? obj.text : '',
    };
  } catch {
    return { text: '' };
  }
}

async function getFilesByResponseId(db, responseId) {
  if (!responseId) return [];
  const rows = db
    .prepare(
      [
        'SELECT f.file AS file, f.mime_type AS mime_type',
        'FROM cue_response_files rf',
        'JOIN cue_files f ON f.id = rf.file_id',
        'WHERE rf.response_id = ?',
        'ORDER BY rf.idx ASC',
      ].join('\n')
    )
    .all(responseId);
  return Array.isArray(rows) ? rows : [];
}

function buildToolContentsFromUserResponse(userResp) {
  const contents = [];

  const text = (userResp.text || '').trim();
  const files = Array.isArray(userResp.files) ? userResp.files : [];
  const fileLines = files
    .map((f) => {
      const file = f && typeof f === 'object' ? String(f.file || '') : '';
      const mime = f && typeof f === 'object' ? String(f.mime_type || '') : '';
      if (!file) return '';
      const clean = file.replace(/^\/+/, '');
      const pathForAgent = `~/.cue/${clean}`;
      return `- ${pathForAgent}${mime ? ` (${mime})` : ''}`;
    })
    .filter(Boolean);

  if (text) {
    contents.push({ type: 'text', text: `用户希望继续，并提供了以下指令：\n\n${text}` });
  } else if (files.length > 0) {
    contents.push({ type: 'text', text: '用户希望继续，并附加了文件：' });
  }

  if (fileLines.length > 0) {
    contents.push({
      type: 'text',
      text: `\n\n附件文件路径如下（图片与其它文件统一为路径）。请你自行读取这些文件内容后再继续：\n${fileLines.join('\n')}`,
    });
  }

  contents.push({ type: 'text', text: `\n\n${CUE_TODO_CONSTRAINT_TEXT}` });
  return contents;
}

function normalizeAgentRuntime(raw) {
  const s = (raw == null ? '' : String(raw)).trim().toLowerCase().replace(/[-\s]+/g, '_');
  return s ? s : 'unknown';
}

async function handleJoin(db, agent_runtime) {
  const agent_id = generateName();
  const project_dir = process.cwd();
  const normalized_runtime = normalizeAgentRuntime(agent_runtime);
  return {
    ok: true,
    data: {
      agent_id,
      message:
        `agent_id=${agent_id}\n` +
        `project_dir=${project_dir}\n` +
        `agent_runtime=${normalized_runtime}\n\n` +
        'Use this agent_id when calling cue(prompt, agent_id).' +
        ' You must remember this agent_id: when calling cue(), pass it as agent_id so the system knows who you are.' +
        ' Before ending this session, call cue. Please use cue to provide a final summary, ask a question, or make a request.',
    },
  };
}

async function handleRecall(db, hints) {
  const row = await get(
    db,
    "SELECT agent_id FROM cue_requests WHERE agent_id != '' AND prompt LIKE ? ORDER BY created_at DESC LIMIT 1",
    [`%${hints}%`]
  );

  if (row && row.agent_id) {
    return {
      ok: true,
      data: {
        agent_id: row.agent_id,
        message: `agent_id=${row.agent_id}\n\nUse this agent_id when calling cue(prompt, agent_id).`,
      },
    };
  }

  const agent_id = generateName();
  return {
    ok: true,
    data: {
      agent_id,
      message:
        'No matching record found; generated a new agent_id.\n\n' +
        `agent_id=${agent_id}\n\n` +
        'Use this agent_id when calling cue(prompt, agent_id).',
    },
  };
}

function cancelledContentsForMode(mode) {
  if (mode === 'pause') {
    return [
      {
        type: 'text',
        text:
          'The user did not continue. Call pause(agent_id) to suspend and wait for resume.\n\n' +
          CUE_TODO_CONSTRAINT_TEXT,
      },
    ];
  }
  return [
    {
      type: 'text',
      text: 'The user did not continue. Call pause(agent_id) to suspend and wait for resume.\n\n',
    },
  ];
}

function emptyContentsForMode(mode) {
  if (mode === 'pause') {
    return [
      {
        type: 'text',
        text: 'The user resumed the conversation.\n\n' + CUE_TODO_CONSTRAINT_TEXT,
      },
    ];
  }
  return [
    {
      type: 'text',
      text:
        'No user input received. Call pause(agent_id) to suspend and wait for resume.\n\n' +
        CUE_TODO_CONSTRAINT_TEXT,
    },
  ];
}

function timeoutContentsForMode(mode) {
  if (mode === 'pause') {
    return [
      {
        type: 'text',
        text:
          'Tool call was cancelled. Call pause(agent_id) to suspend and wait for resume.\n\n',
      },
    ];
  }
  return [
    {
      type: 'text',
      text:
        'Timed out waiting for user response. You MUST NOT continue or add any extra output. Immediately call pause(agent_id) and stop output until resumed.\n\n',
    },
  ];
}

async function handleCueLike(db, { mode, agent_id, prompt, payload, timeoutSeconds }) {
  const request_id = newRequestId();
  const created_at = nowIso();

  await run(
    db,
    [
      'INSERT INTO cue_requests (request_id, agent_id, prompt, payload, status, created_at, updated_at)',
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
    ].join('\n'),
    [request_id, agent_id, prompt, payload ?? null, 'PENDING', created_at, created_at]
  );

  try {
    const respRow = await waitForResponse(db, request_id, timeoutSeconds);

    if (respRow.cancelled) {
      return {
        ok: true,
        data: {
          request_id,
          cancelled: true,
          response: { text: '' },
          contents: cancelledContentsForMode(mode),
        },
      };
    }

    const userResp = parseUserResponseJson(respRow.response_json);
    userResp.files = await getFilesByResponseId(db, respRow.id);

    if (!userResp.text.trim() && (!userResp.files || userResp.files.length === 0)) {
      if (mode === 'cue') {
        const updated_at = nowIso();
        await run(
          db,
          'UPDATE cue_requests SET status = ?, updated_at = ? WHERE request_id = ?',
          ['COMPLETED', updated_at, request_id]
        );
      }
      return {
        ok: true,
        data: {
          request_id,
          cancelled: false,
          response: userResp,
          contents: emptyContentsForMode(mode),
        },
      };
    }

    return {
      ok: true,
      data: {
        request_id,
        cancelled: false,
        response: userResp,
        contents: buildToolContentsFromUserResponse(userResp),
        constraint_text: CUE_TODO_CONSTRAINT_TEXT,
      },
    };
  } catch (err) {
    if (err && err.code === 'TIMEOUT') {
      const updated_at = nowIso();
      await run(
        db,
        'UPDATE cue_requests SET status = ?, updated_at = ? WHERE request_id = ?',
        ['CANCELLED', updated_at, request_id]
      );

      const existing = await get(db, 'SELECT id FROM cue_responses WHERE request_id = ?', [request_id]);
      if (!existing) {
        const cancelledResponse = JSON.stringify({ text: '' });
        await run(
          db,
          'INSERT INTO cue_responses (request_id, response_json, cancelled, created_at) VALUES (?, ?, ?, ?)',
          [request_id, cancelledResponse, 1, updated_at]
        );
      }

      return {
        ok: true,
        data: {
          request_id,
          cancelled: true,
          response: { text: '' },
          contents: timeoutContentsForMode(mode),
        },
      };
    }

    throw err;
  }
}

async function handlePause(db, { agent_id, prompt }) {
  const pausePrompt = prompt || 'Paused. Click Continue when you are ready.';
  const payload =
    '{"type":"confirm","variant":"pause","text":"Paused. Click Continue when you are ready.","confirm_label":"Continue","cancel_label":""}';

  return handleCueLike(db, {
    mode: 'pause',
    agent_id,
    prompt: pausePrompt,
    payload,
    timeoutSeconds: null,
  });
}

async function ensureSchemaV2OrGuideMigrate(db) {
  const versionRow = await get(db, 'SELECT value FROM schema_meta WHERE key = ?', ['schema_version']);
  const version = versionRow && versionRow.value != null ? String(versionRow.value) : '';
  if (version === '2') return { ok: true };

  const reqCountRow = await get(db, 'SELECT COUNT(*) AS n FROM cue_requests');
  const respCountRow = await get(db, 'SELECT COUNT(*) AS n FROM cue_responses');
  const reqCount = reqCountRow ? Number(reqCountRow.n) : 0;
  const respCount = respCountRow ? Number(respCountRow.n) : 0;

  if (reqCount === 0 && respCount === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    error:
      'Database schema is outdated (pre-file storage). Please migrate: cueme migrate\n' +
      '数据库结构已过期（旧的 base64 存储）。请先执行：cueme migrate',
  };
}

function filesRootDir() {
  return path.join(os.homedir(), '.cue', 'files');
}

function extFromMime(mime) {
  const m = (mime || '').toLowerCase().trim();
  if (m === 'image/png') return 'png';
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  return 'bin';
}

function safeParseJson(s) {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function decodeBase64(b64) {
  try {
    return { ok: true, value: Buffer.from(String(b64 || ''), 'base64') };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function normalizeUserResponseForV2(parsed) {
  const obj = parsed && typeof parsed === 'object' ? parsed : {};
  const text = typeof obj.text === 'string' ? obj.text : '';
  const mentions = Array.isArray(obj.mentions) ? obj.mentions : undefined;
  return mentions ? { text, mentions } : { text };
}

async function handleMigrate(db) {
  const root = filesRootDir();
  fs.mkdirSync(root, { recursive: true });

  const versionRow = await get(db, 'SELECT value FROM schema_meta WHERE key = ?', ['schema_version']);
  const version = versionRow && versionRow.value != null ? String(versionRow.value) : '';
  if (version === '2') {
    return { ok: true, data: { message: 'Already migrated (schema_version=2).' } };
  }

  const rows = db
    .prepare('SELECT id, request_id, response_json, cancelled FROM cue_responses ORDER BY id ASC')
    .all();

  const total = Array.isArray(rows) ? rows.length : 0;
  let processed = 0;
  let migrated = 0;
  let deleted = 0;

  const deleteResponseStmt = db.prepare('DELETE FROM cue_responses WHERE id = ?');
  const cancelRequestStmt = db.prepare('UPDATE cue_requests SET status = ? WHERE request_id = ?');
  const upsertFileStmt = db.prepare(
    [
      'INSERT INTO cue_files (sha256, file, mime_type, size_bytes, created_at)',
      'VALUES (@sha256, @file, @mime_type, @size_bytes, @created_at)',
      'ON CONFLICT(sha256) DO UPDATE SET',
      '  file = excluded.file,',
      '  mime_type = excluded.mime_type,',
      '  size_bytes = excluded.size_bytes',
    ].join('\n')
  );
  const getFileIdStmt = db.prepare('SELECT id FROM cue_files WHERE sha256 = ?');
  const deleteResponseFilesStmt = db.prepare('DELETE FROM cue_response_files WHERE response_id = ?');
  const insertRespFileStmt = db.prepare(
    'INSERT INTO cue_response_files (response_id, file_id, idx) VALUES (?, ?, ?)'
  );
  const updateResponseJsonStmt = db.prepare('UPDATE cue_responses SET response_json = ? WHERE id = ?');

  const tx = db.transaction((row) => {
    const parsed = safeParseJson(row.response_json);
    if (!parsed.ok) {
      deleteResponseStmt.run(row.id);
      cancelRequestStmt.run('CANCELLED', row.request_id);
      return { migrated: false, deleted: true };
    }

    const images = Array.isArray(parsed.value.images) ? parsed.value.images : [];

    deleteResponseFilesStmt.run(row.id);

    for (let i = 0; i < images.length; i += 1) {
      const img = images[i];
      const mime = img && typeof img === 'object' ? String(img.mime_type || '') : '';
      const b64 = img && typeof img === 'object' ? img.base64_data : '';

      const decoded = decodeBase64(b64);
      if (!decoded.ok) {
        deleteResponseStmt.run(row.id);
        cancelRequestStmt.run('CANCELLED', row.request_id);
        return { migrated: false, deleted: true };
      }

      const buf = decoded.value;
      if (!buf || buf.length === 0) {
        deleteResponseStmt.run(row.id);
        cancelRequestStmt.run('CANCELLED', row.request_id);
        return { migrated: false, deleted: true };
      }

      const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
      const ext = extFromMime(mime);
      const rel = path.join('files', `${sha256}.${ext}`);
      const abs = path.join(os.homedir(), '.cue', rel);

      if (!fs.existsSync(abs)) {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, buf);
      }

      const created_at = nowIso();
      upsertFileStmt.run({
        sha256,
        file: rel,
        mime_type: mime || 'application/octet-stream',
        size_bytes: buf.length,
        created_at,
      });
      const fileRow = getFileIdStmt.get(sha256);
      const fileId = fileRow ? Number(fileRow.id) : null;
      if (!fileId) {
        deleteResponseStmt.run(row.id);
        cancelRequestStmt.run('CANCELLED', row.request_id);
        return { migrated: false, deleted: true };
      }

      insertRespFileStmt.run(row.id, fileId, i);
    }

    const v2 = normalizeUserResponseForV2(parsed.value);
    updateResponseJsonStmt.run(JSON.stringify(v2), row.id);
    return { migrated: true, deleted: false };
  });

  for (const row of rows) {
    processed += 1;
    const res = tx(row);
    if (res.deleted) deleted += 1;
    if (res.migrated) migrated += 1;
    if (processed % 50 === 0 || processed === total) {
      process.stderr.write(`migrate: ${processed}/${total} (migrated=${migrated}, deleted=${deleted})\n`);
    }
  }

  await run(db, 'INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)', ['schema_version', '2']);

  return {
    ok: true,
    data: {
      message: `Migrate completed. total=${total} migrated=${migrated} deleted=${deleted}`,
    },
  };
}

async function handleCommand({ subcommand, args }) {
  const { db, dbPath } = openDb();
  try {
    await initSchema(db);

    if (subcommand !== 'join' && subcommand !== 'migrate') {
      const schemaCheck = await ensureSchemaV2OrGuideMigrate(db);
      if (!schemaCheck.ok) return { ok: false, error: schemaCheck.error, data: { db_path: dbPath } };
    }

    if (subcommand === 'join') return await handleJoin(db, args.agent_runtime);

    if (subcommand === 'recall') {
      const hints = (args.hints ?? '').toString();
      return await handleRecall(db, hints);
    }

    if (subcommand === 'cue') {
      const agent_id = (args.agent_id ?? '').toString();
      const prompt = (args.prompt ?? '').toString();
      const payload = args.payload == null ? null : args.payload.toString();
      const timeoutSeconds = args.timeout == null ? 600 : Number(args.timeout);
      return await handleCueLike(db, { mode: 'cue', agent_id, prompt, payload, timeoutSeconds });
    }

    if (subcommand === 'pause') {
      const agent_id = (args.agent_id ?? '').toString();
      const prompt = args.prompt == null ? null : args.prompt.toString();
      return await handlePause(db, { agent_id, prompt });
    }

    if (subcommand === 'migrate') {
      return await handleMigrate(db);
    }

    return { ok: false, error: `unknown subcommand: ${subcommand}`, data: { db_path: dbPath } };
  } finally {
    db.close();
  }
}

module.exports = { handleCommand, getDbPath };
