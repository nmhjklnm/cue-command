const crypto = require('crypto');
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

function detectAgentTerminal() {
  const platform = process.platform;
  if (platform === 'win32') {
    const comspec = (process.env.ComSpec ?? '').toString().toLowerCase();
    const psModulePath = (process.env.PSModulePath ?? '').toString();
    const shell = (process.env.SHELL ?? '').toString().toLowerCase();
    const nuVersion = (process.env.NU_VERSION ?? '').toString();
    const msystem = (process.env.MSYSTEM ?? '').toString().toLowerCase();

    if (
      shell.includes('powershell') ||
      shell.includes('pwsh') ||
      comspec.includes('powershell') ||
      comspec.includes('pwsh') ||
      psModulePath
    ) {
      return 'powershell';
    }

    if (nuVersion || shell.includes('nushell') || shell.endsWith('/nu') || shell === 'nu') return 'nushell';

    if (shell.endsWith('/bash') || shell === 'bash' || msystem) return 'bash';

    if (comspec.endsWith('cmd.exe') || comspec.includes('\\cmd.exe') || comspec.includes('/cmd.exe')) return 'cmd';
    return 'unknown';
  }

  const isWsl = Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP);

  const shellPath = (process.env.SHELL ?? '').toString().toLowerCase();
  if (shellPath.endsWith('/zsh') || shellPath === 'zsh') return 'zsh';
  if (shellPath.endsWith('/bash') || shellPath === 'bash') return 'bash';
  if (shellPath.endsWith('/fish') || shellPath === 'fish') return 'fish';
  if (shellPath.endsWith('/nu') || shellPath === 'nu' || shellPath.includes('nushell')) return 'nushell';
  if (isWsl && (shellPath.endsWith('/bash') || shellPath === 'bash' || !shellPath)) return 'bash';
  return 'unknown';
}

async function handleJoin(db, agent_runtime) {
  await initSchema(db);
  const agent_id = generateName();
  const project_dir = process.cwd();
  const agent_terminal = detectAgentTerminal();
  const normalized_runtime = normalizeAgentRuntime(agent_runtime);
  const updated_at = nowIso();

  await run(
    db,
    [
      'INSERT INTO agent_envs (agent_id, agent_runtime, project_dir, agent_terminal, updated_at)',
      'VALUES (?, ?, ?, ?, ?)',
      'ON CONFLICT(agent_id) DO UPDATE SET',
      '  agent_runtime = excluded.agent_runtime,',
      '  project_dir = excluded.project_dir,',
      '  agent_terminal = excluded.agent_terminal,',
      '  updated_at = excluded.updated_at',
    ].join('\n'),
    [agent_id, normalized_runtime, project_dir, agent_terminal, updated_at]
  );
  
  let message =
    `agent_id=${agent_id}\n` +
    `project_dir=${project_dir}\n` +
    `agent_terminal=${agent_terminal}\n` +
    `agent_runtime=${normalized_runtime}\n\n`;
  
  // Windows PowerShell encoding fix reminder
  if (process.platform === 'win32') {
    message +=
      'Windows detected. To fix encoding issues with Chinese characters:\n' +
      '1. Run: cueme fix powershell_utf-8\n' +
      '2. Restart your terminal\n\n';
  }
  
  message +=
    'Use this agent_id when calling: cueme cue <agent_id> -\n' +
    'Then provide stdin with tag-block envelope (stdin MUST NOT be empty):\n' +
    '<cueme_prompt>\n...\n</cueme_prompt>\n' +
    '<cueme_payload>\n...\n</cueme_payload>\n\n' +
    'Remember this agent_id (but do NOT store it in any memory module). Before ending this session, call cue to provide a final summary, ask a question, or make a request.';
  
  return {
    ok: true,
    data: {
      agent_id,
      message,
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

async function handleMigrate(db) {
  await initSchema(db);

  await run(
    db,
    [
      'CREATE TABLE IF NOT EXISTS conversation_pins (',
      '  conv_type TEXT NOT NULL,',
      '  conv_id TEXT NOT NULL,',
      '  view TEXT NOT NULL,',
      '  pin_order INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,',
      '  UNIQUE(conv_type, conv_id, view)',
      ')',
    ].join('\n')
  );

  await run(db, 'UPDATE schema_meta SET value = ? WHERE key = ?', ['3', 'schema_version']);
  await run(db, 'INSERT OR IGNORE INTO schema_meta (key, value) VALUES (?, ?)', [
    'schema_version',
    '3',
  ]);

  return { ok: true, data: { message: 'migrated schema_version to 3' } };
}

async function handleCommand({ subcommand, args }) {
  const { db, dbPath } = openDb();
  try {
    if (subcommand === 'join') return await handleJoin(db, args.agent_runtime);

    if (subcommand === 'migrate') return await handleMigrate(db);

    await initSchema(db);

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

    return { ok: false, error: `unknown subcommand: ${subcommand}`, data: { db_path: dbPath } };
  } finally {
    db.close();
  }
}

module.exports = { handleCommand, getDbPath };
