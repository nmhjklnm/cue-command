# cueme

A command protocol adapter for Cue, compatible with the existing SQLite mailbox (`~/.cue/cue.db`).

## Quick start (2 steps)

### Step 1: Install cueme

```bash
npm install -g cueme
```

### Step 2: Configure the protocol.md as your system prompt

Add the contents of `cue-command/protocol.md` to your tool's system prompt / rules.

This file defines the Human Agent Protocol (HAP) rules and the `cueme` command interface.

## Usage

### join

```bash
cueme join
```

### recall

```bash
cueme recall --hints "refactored login"
```

### cue

```bash
cueme cue --agent_id "tavilron" --prompt "What should I do next?" --timeout 600
```

### pause

```bash
cueme pause --agent_id "tavilron" --prompt "Waiting..."
```

All commands output plain text to stdout.

## Release

Publishing is tag-driven (GitHub Actions). Create a tag `v<version>` that matches `package.json` `version`.

```bash
git tag v0.1.1
git push origin v0.1.1
```

The workflow publishes to npm using `NPM_TOKEN` from GitHub repo secrets.
