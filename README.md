# cueme

<div align="center">

<strong><a href="./README.md">English</a></strong>
 ·
<strong><a href="./README.zh-CN.md">中文</a></strong>

</div>

---

[![npm](https://img.shields.io/npm/v/cueme?label=cueme&color=0B7285)](https://www.npmjs.com/package/cueme)
[![npm downloads](https://img.shields.io/npm/dm/cueme?color=0B7285)](https://www.npmjs.com/package/cueme)

[![Repo: cue-stack](https://img.shields.io/badge/repo-cue--stack-111827)](https://github.com/nmhjklnm/cue-stack)
[![Repo: cue-console](https://img.shields.io/badge/repo-cue--console-111827)](https://github.com/nmhjklnm/cue-console)
[![Repo: cue-command](https://img.shields.io/badge/repo-cue--command-111827)](https://github.com/nmhjklnm/cue-command)
![License](https://img.shields.io/badge/license-Apache--2.0-1E40AF)

[Contributing](./CONTRIBUTING.md) · [Trademark](./TRADEMARK.md)

A command protocol adapter for Cue, compatible with the existing SQLite mailbox (`~/.cue/cue.db`).

Note: image sending is currently unavailable (WIP).

## Quick start (3 steps)

### Step 1: Install cueme

```bash
npm install -g cueme
```

### Step 2: Configure the protocol.md as your system prompt

Copy the contents of `protocol.md` into your runtime's system prompt / persistent rules:

- [`protocol.md`](https://github.com/nmhjklnm/cue-command/blob/main/protocol.md)

If you installed via npm, `protocol.md` is also included in the package.

This file defines the Human Agent Protocol (HAP) rules and the `cueme` command interface.

### Step 3: Run the UI and connect

`cueme` speaks to the same SQLite mailbox used by the UI (`~/.cue/cue.db`). Start the UI:

```bash
npm install -g cue-console
cue-console start
```

Open `http://localhost:3000`, then in your runtime chat type:

`cue`

## Usage

### join

```bash
cueme join <agent_runtime>
```

### recall

```bash
cueme recall <hints>
```

### cue

```bash
cueme cue <agent_id> -
```

### pause

```bash
cueme pause <agent_id> -
```

All commands output plain text to stdout.

---

## QQ Group

<p align="center">
  <img src="./assets/qq.jpg" alt="QQ group QR code" width="25%" />
</p>
