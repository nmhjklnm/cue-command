function parseTagBlocksEnvelope(raw, opts = {}) {
  const allowPayload = opts.allow_payload !== false;
  const text = String(raw == null ? '' : raw);
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: false,
      error:
        'error: stdin cannot be empty. You MUST provide input using tag-block envelope:\n' +
        '<cueme_prompt>\n...\n</cueme_prompt>\n' +
        (allowPayload ? '<cueme_payload>\n...\n</cueme_payload>\n' : '') +
        'This is critical for proper interaction flow.\n',
    };
  }

  if (trimmed.startsWith('{')) {
    return {
      ok: false,
      error:
        'error: legacy JSON envelope is not supported. Use <cueme_prompt>...</cueme_prompt> and optional <cueme_payload>...</cueme_payload>\n',
    };
  }

  const promptOpen = '<cueme_prompt>';
  const promptClose = '</cueme_prompt>';
  const payloadOpen = '<cueme_payload>';
  const payloadClose = '</cueme_payload>';

  function findTagLineIndex(lines, tag) {
    return lines.findIndex((l) => l.trim() === tag);
  }

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const pOpenIdx = findTagLineIndex(lines, promptOpen);
  const pCloseIdx = findTagLineIndex(lines, promptClose);
  if (pOpenIdx < 0 || pCloseIdx < 0 || pCloseIdx <= pOpenIdx) {
    return { ok: false, error: 'error: missing <cueme_prompt> block\n' };
  }

  const pre = lines.slice(0, pOpenIdx).join('\n');
  if (pre.trim().length > 0) {
    return { ok: false, error: 'error: only whitespace is allowed outside blocks\n' };
  }

  const promptText = lines.slice(pOpenIdx + 1, pCloseIdx).join('\n');
  if (!promptText.trim()) {
    return { ok: false, error: 'error: <cueme_prompt> content must be non-empty\n' };
  }

  const remainingLines = lines.slice(pCloseIdx + 1);
  const remainingText = remainingLines.join('\n');

  const rOpenIdx = findTagLineIndex(remainingLines, payloadOpen);
  const rCloseIdx = findTagLineIndex(remainingLines, payloadClose);

  let payload = null;

  if (rOpenIdx >= 0 || rCloseIdx >= 0) {
    if (!allowPayload) {
      return { ok: false, error: 'error: <cueme_payload> is not supported for pause\n' };
    }

    if (rOpenIdx < 0 || rCloseIdx < 0 || rCloseIdx <= rOpenIdx) {
      return { ok: false, error: 'error: invalid <cueme_payload> block\n' };
    }

    const between = remainingLines.slice(0, rOpenIdx).join('\n');
    const after = remainingLines.slice(rCloseIdx + 1).join('\n');
    if (between.trim().length > 0 || after.trim().length > 0) {
      return { ok: false, error: 'error: only whitespace is allowed outside blocks\n' };
    }

    const payloadRaw = remainingLines.slice(rOpenIdx + 1, rCloseIdx).join('\n').trim();
    if (!payloadRaw || payloadRaw === 'null') {
      payload = null;
    } else {
      let parsed;
      try {
        parsed = JSON.parse(payloadRaw);
      } catch {
        return { ok: false, error: 'error: <cueme_payload> must be JSON object or null\n' };
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, error: 'error: <cueme_payload> must be JSON object or null\n' };
      }
      payload = parsed;
    }
  } else {
    if (remainingText.trim().length > 0) {
      return { ok: false, error: 'error: only whitespace is allowed outside blocks\n' };
    }
  }

  return { ok: true, prompt: promptText, payload };
}

module.exports = { parseTagBlocksEnvelope };
