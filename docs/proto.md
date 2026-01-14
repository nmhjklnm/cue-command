# cueme proto

This document describes the `cueme proto` command family.

## What it does

`cueme proto` injects the shared `protocol.md` into a specific agent file by composing:

`final_proto = prefix(agent) + "\n\n" + protocol.md`

The injected content is managed between sentinel markers and may be overwritten by `cueme proto apply`.

## Config

Config file path:

`~/.cue/cueme.json`

Required keys:

- `cueme.proto.path`: map of injection target paths by `<platform>.<agent>`
  - `platform`: `linux` | `macos` | `windows`
  - supports `~` and `%ENV%` expansions (e.g. `%APPDATA%`, `%USERPROFILE%`)
- `cueme.proto.prefix`: map of prefix by `<agent>`
  - can be a string or string array (joined with `\n`)
- `cueme.proto.protocol_path`: absolute or relative path to the shared `protocol.md`
  - supports `~` and `%ENV%` expansions

Example:

```json
{
  "cueme.proto.path": {
    "macos.vscode": "~/Library/Application Support/Code/User/prompts/human_proto.md",
    "macos.windsurf": "~/.codeium/windsurf/memories/global_rules.md",

    "windows.vscode": "%APPDATA%\\Code\\User\\prompts\\human_proto.md",
    "windows.windsurf": "%USERPROFILE%\\.codeium\\windsurf\\memories\\global_rules.md",

    "linux.vscode": "~/.config/Code/User/prompts/human_proto.md",
    "linux.windsurf": "~/.codeium/windsurf/memories/global_rules.md"
  },
  "cueme.proto.prefix": {
    "vscode": [
      "---",
      "applyTo: '**'",
      "---"
    ],
    "windsurf": []
  },
  "cueme.proto.protocol_path": "~/path/to/protocol.md"
}
```

## Sentinel markers

Injected content is managed between these markers:

```text
<!-- HUMAN_AGENT_PROTO_BEGIN -->
... managed content ...
<!-- HUMAN_AGENT_PROTO_END -->
```

Notes:

- Markers are written in the standardized `HUMAN_*` form.
- Existing files that still use `HUAMN_*` markers are also recognized for replacement.

## Commands

### Render (print to stdout)

```bash
cueme proto <agent>
```

Generates and prints `final_proto` to stdout.

### Apply (inject into agent file)

```bash
cueme proto apply <agent>
```

Behavior:

- Resolves the target path using `cueme.proto.path["<platform>.<agent>"]`.
- Writes/updates the managed block in the target file.
- Preserves the target file's existing EOL style when updating.

### Init (create config)

```bash
cueme proto init
```

Creates `~/.cue/cueme.json` if missing (never overwrites).

Auto-detect (current platform only):

- `vscode`: `.vscode/prompts/human_proto.md` (workspace) then platform user path
- `windsurf`: `.codeium/windsurf/memories/global_rules.md` (workspace) then platform user path

### Helpers

```bash
cueme proto ls
cueme proto path <agent>
```
