# Human Agent Protocol (HAP)

你与用户的协作交互通过命令行工具 `cueme` 完成。

当用户接受 HAP：你必须在每次阶段性输出或准备结束回复前调用 `cueme cue`（或 `cueme pause`）等待用户继续。

If HAP is accepted: before any phase-summary or final reply, you MUST call `cueme cue` via the terminal/tool.
A reply is NOT complete unless the last action is a successful cueme call.

- 首次连接 / 无 agent_id：先执行 `join()` 获取 agent_id，再执行 `cue()`。

- 重连 / 已有 agent_id（例如网络波动导致 cue 中断但对话仍在继续）：用户再次发送 `cue` 时，优先直接用已有 agent_id 执行 `cue()`；仅当无法确认 agent_id 时才重新 `join()`。

## No fake tool actions

You MUST NOT claim you called cueme unless you actually executed it and got its stdout.
If you cannot run tools, say "TOOLS_UNAVAILABLE" and output only the exact `cueme ...` command for the human to run.

**IMPORTANT: cueme 命令不可放在后台运行。** All cueme commands must run in blocking/foreground mode to ensure proper interaction flow.

## cueme (command interface)

### join() -> message

Command:

- `cueme join <agent_runtime>`

Returns (plain text):

- a short message (includes `agent_id=...`, `project_dir=...`, `agent_terminal=...`, `agent_runtime=...`)

`agent_runtime`:

- Required positional tag for where the agent is running (IDE/runtime).
- Format: lowercase, `_` only.
- Examples: `windsurf`, `cursor`, `vscode`, `claude_code`, `terminal`, `codex`, `kiro`, `opencode`.

### recall(hints: str) -> message

Command:

- `cueme recall <hints>`

Returns (plain text):

- a short message (includes `agent_id=...`)

### cue(prompt: str, agent_id: str, payload?: object | null) -> text

Command:

`cueme cue <agent_id> -`

stdin envelope (tag blocks; tags must be alone on their line):

<cueme_prompt>
...raw prompt text...
</cueme_prompt>

<cueme_payload>
...JSON object or null...
</cueme_payload>

Rules:

- `<cueme_prompt>` block required; content must be non-empty after trim.
- `<cueme_payload>` block optional; if present: JSON object or null. Blank content is treated as null.
- Only whitespace allowed outside these blocks.
- Legacy JSON envelope is not supported.

Tip: when you need clearer structured interaction, prefer `payload` (choice/confirm/form) over encoding structure in `prompt`.

Returns:

- plain text (stdout)

Payload protocol (payload object):

- required: {"type": "choice" | "confirm" | "form"}
- choice: {"type":"choice","options":["...",...],"allow_multiple":false}
- confirm: {"type":"confirm","text":"...","confirm_label":"Confirm","cancel_label":"Cancel"}
- form: {"type":"form","fields":[{"label":"...","kind":"text","options":["...",...],"allow_multiple":false}, ...]}

Minimal examples:

- choice: {"type":"choice","options":["Continue","Stop"]}
- confirm: {"type":"confirm","text":"Continue?"}
- form: {"type":"form","fields":[{"label":"Env","options":["prod","staging"]}]}

### pause(agent_id: str, prompt?: str) -> text

Command:
- `cueme pause <agent_id> [<prompt> | -]`

stdin envelope (when `-` is used): tag blocks (prompt only; tags must be alone on their line):

<cueme_prompt>
...raw prompt text...
</cueme_prompt>

Returns:
- plain text (stdout)
