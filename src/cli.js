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

async function main() {
  const parsed = parseArgs(process.argv);
  const sub = parsed._[0];

  if (!sub || sub === 'help' || sub === '-h' || sub === '--help') {
    process.stdout.write(
      [
        'cueme (stdin/stdout JSON)',
        '',
        'Usage:',
        '  cueme join',
        '  cueme recall --hints "..."',
        '  cueme cue --agent_id "..." --prompt "..." [--payload "{...}"] [--timeout 600]',
        '  cueme pause --agent_id "..." [--prompt "..."]',
        '  cueme rpc   # read one JSON object from stdin: {"cmd":...}',
        '',
        'All commands output a single JSON object to stdout.',
      ].join('\n') + '\n'
    );
    return;
  }

  let input = null;
  if (sub === 'rpc' || parsed.json) {
    const raw = await readAllStdin();
    if (raw.trim().length > 0) {
      input = JSON.parse(raw);
    }
  }

  const result = await handleCommand({ subcommand: sub, args: parsed, input });
  process.stdout.write(JSON.stringify(result) + '\n');
}

module.exports = { main };
