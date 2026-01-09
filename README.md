# cue-command

A command protocol adapter for Cue (stdin/stdout JSON), compatible with the existing SQLite mailbox (`~/.cue/cue.db`).

## Install

```bash
npm install -g cue-command
```

## Usage

### join

```bash
cue-command join
```

### recall

```bash
cue-command recall --hints "refactored login"
```

### cue

```bash
cue-command cue --agent_id "tavilron" --prompt "What should I do next?" --timeout 600
```

### pause

```bash
cue-command pause --agent_id "tavilron" --prompt "Waiting..."
```

### rpc mode (stdin)

```bash
echo '{"cmd":"join"}' | cue-command rpc
```

All commands output one JSON object to stdout.

## Release

Publishing is tag-driven (GitHub Actions). Create a tag `v<version>` that matches `package.json` `version`.

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow publishes to npm using `NPM_TOKEN` from GitHub repo secrets.
