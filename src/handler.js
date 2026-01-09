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
    if (!obj || typeof obj !== 'object') return { text: '', images: [] };
    return {
      text: typeof obj.text === 'string' ? obj.text : '',
      images: Array.isArray(obj.images) ? obj.images : [],
    };
  } catch {
    return { text: '', images: [] };
  }
}

function buildToolContentsFromUserResponse(userResp) {
  const contents = [];

  const text = (userResp.text || '').trim();
  const images = Array.isArray(userResp.images) ? userResp.images : [];

  if (text) {
    contents.push({ type: 'text', text: `用户希望继续，并提供了以下指令：\n\n${text}` });
  } else if (images.length > 0) {
    contents.push({ type: 'text', text: '用户希望继续，并附加了图片：' });
  }

  for (const img of images) {
    if (!img) continue;
    contents.push({
      type: 'image',
      data: img.base64_data,
      mimeType: img.mime_type,
    });
  }

  contents.push({ type: 'text', text: `\n\n${CUE_TODO_CONSTRAINT_TEXT}` });
  return contents;
}

async function handleJoin(db) {
  const agent_id = generateName();
  return {
    ok: true,
    data: {
      agent_id,
      message:
        `agent_id=${agent_id}\n\n` +
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
        'Timed out waiting for user response. Call pause(agent_id) to suspend and wait for resume.\n\n',
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
          response: { text: '', images: [] },
          contents: cancelledContentsForMode(mode),
        },
      };
    }

    const userResp = parseUserResponseJson(respRow.response_json);

    if (!userResp.text.trim() && (!userResp.images || userResp.images.length === 0)) {
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
        const cancelledResponse = JSON.stringify({ text: '', images: [] });
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
          response: { text: '', images: [] },
          contents: timeoutContentsForMode(mode),
        },
      };
    }

    throw err;
  }
}

async function handlePause(db, { agent_id, prompt }) {
  const pausePrompt = prompt || 'Waiting for your confirmation. Click Continue when you are ready.';
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

async function handleCommand({ subcommand, args }) {
  const { db, dbPath } = openDb();
  try {
    await initSchema(db);

    if (subcommand === 'join') return await handleJoin(db);

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

    return { ok: false, error: `unknown subcommand: ${subcommand}`, data: { db_path: dbPath } };
  } finally {
    db.close();
  }
}

module.exports = { handleCommand, getDbPath };
