#!/usr/bin/env node

const { main } = require('../src/cli');

main().catch((err) => {
  const msg = err && err.stack ? err.stack : String(err);
  process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
  process.exitCode = 1;
});
