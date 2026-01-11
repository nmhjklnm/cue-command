const { readAllStdin } = require('./io');
const { handleCommand } = require('./handler');

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { _: [] };
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next == null || next.startsWith('--')) {
        out[key] = true;
        i += 1;
      } else {
        out[key] = next;
        i += 2;
      }
      continue;
    }
    out._.push(a);
    i += 1;
  }
  return out;
}

function extractTextFromResult(result) {
  if (!result || typeof result !== 'object') return '';
  if (result.ok === false) return result.error ? String(result.error) : '';

  const data = result.data;
  if (!data || typeof data !== 'object') return '';

  const contents = Array.isArray(data.contents) ? data.contents : [];
  const textParts = [];
  for (const c of contents) {
    if (c && c.type === 'text' && typeof c.text === 'string' && c.text.length > 0) {
      textParts.push(c.text);
    }
  }
  if (textParts.length > 0) return textParts.join('');

  if (typeof data.message === 'string') return data.message;
  return '';
}

async function main() {
  const parsed = parseArgs(process.argv);
  const sub = parsed._[0];
  const pos = parsed._.slice(1);

  if (!sub || sub === 'help' || sub === '-h' || sub === '--help') {
    process.stdout.write(
      [
        'cueme',
        '',
        'Usage:',
        '  cueme join <agent_runtime>',
        '  cueme recall <hints>',
        '  cueme cue <agent_id> [prompt|-] [--payload "{...}"]',
        '  cueme pause <agent_id> [prompt|-]',
        '  cueme migrate',
        '',
        'Output:',
        '  - join/recall/cue/pause: plain text (stdout)',
      ].join('\n') + '\n'
    );
    return;
  }

  if (parsed.timeout != null) {
    process.stderr.write('error: --timeout is not supported (fixed to 10 minutes)\n');
    process.exitCode = 2;
    return;
  }

  if (parsed.agent_id != null || parsed.prompt != null || parsed.hints != null) {
    process.stderr.write('error: --agent_id/--prompt/--hints flags are not supported; use positional args\n');
    process.exitCode = 2;
    return;
  }

  if (sub === 'join') {
    const agentRuntime = pos[0];
    if (!agentRuntime) {
      process.stderr.write('error: missing <agent_runtime>\n');
      process.exitCode = 2;
      return;
    }
    parsed.agent_runtime = String(agentRuntime);
  }

  if (sub === 'recall') {
    const hints = pos[0];
    if (!hints) {
      process.stderr.write('error: missing <hints>\n');
      process.exitCode = 2;
      return;
    }
    parsed.hints = String(hints);
  }

  if (sub === 'cue') {
    const agentId = pos[0];
    if (!agentId) {
      process.stderr.write('error: missing <agent_id>\n');
      process.exitCode = 2;
      return;
    }
    parsed.agent_id = String(agentId);

    const promptPos = pos[1];
    if (promptPos === '-') {
      parsed.prompt = await readAllStdin();
    } else if (promptPos != null) {
      parsed.prompt = String(promptPos);
    } else {
      parsed.prompt = '';
    }
  }

  if (sub === 'pause') {
    const agentId = pos[0];
    if (!agentId) {
      process.stderr.write('error: missing <agent_id>\n');
      process.exitCode = 2;
      return;
    }
    parsed.agent_id = String(agentId);

    const promptPos = pos[1];
    if (promptPos === '-') {
      const stdinPrompt = await readAllStdin();
      if (stdinPrompt && stdinPrompt.trim().length > 0) {
        parsed.prompt = stdinPrompt;
      }
    } else if (promptPos != null) {
      parsed.prompt = String(promptPos);
    }
  }

  const result = await handleCommand({ subcommand: sub, args: parsed });
  process.stdout.write(extractTextFromResult(result) + '\n');
}

module.exports = { main };
