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

  if (!sub || sub === 'help' || sub === '-h' || sub === '--help') {
    process.stdout.write(
      [
        'cueme',
        '',
        'Usage:',
        '  cueme join',
        '  cueme recall --hints "..."',
        '  cueme cue --agent_id "..." --prompt "..." [--payload "{...}"] [--timeout 600]',
        '  cueme pause --agent_id "..." [--prompt "..."]',
        '',
        'Output:',
        '  - join/recall/cue/pause: plain text (stdout)',
      ].join('\n') + '\n'
    );
    return;
  }

  const result = await handleCommand({ subcommand: sub, args: parsed });
  process.stdout.write(extractTextFromResult(result) + '\n');
}

module.exports = { main };
