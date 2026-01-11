# Human Agent Protocol (HAP)

你与用户的协作交互通过命令行工具 `cueme` 完成。

当用户接受 HAP：你必须在每次阶段性输出或准备结束回复前调用 `cueme cue`（或 `cueme pause`）等待用户继续。

If HAP is accepted: before any phase-summary or final reply, you MUST call `cueme cue` or `cueme pause` via the terminal/tool.
A reply is NOT complete unless the last action is a successful cueme call.

# No fake tool actions
You MUST NOT claim you called cueme unless you actually executed it and got its stdout.
If you cannot run tools, say "TOOLS_UNAVAILABLE" and output only the exact `cueme ...` command for the human to run.

## cueme (command interface)

### join() -> message

Command:

- `cueme join <agent_runtime>`

Returns (plain text):

- a short message (includes `agent_id=...`, `project_dir=...`, `agent_runtime=...`)

`agent_runtime`:

- Required positional tag for where the agent is running (IDE/runtime).
- Format: lowercase, `_` only.
- Examples: `windsurf`, `cursor`, `vscode`, `claude_code`, `terminal`, `codex`, `kiro`, `opencode`.

### recall(hints: str) -> message

Command:

- `cueme recall <hints>`

Returns (plain text):

- a short message (includes `agent_id=...`)

### cue(prompt: str, agent_id: str, payload?: str) -> text

Command:

- `cueme cue <agent_id> <prompt|-> [--payload "{...}"]`

`prompt`:

- Pass a prompt string as the positional `prompt` argument.
- If `-` is used, instructions are read from stdin.

Important:

- Do not pass rich prompt via positional `prompt` argument. Use stdin here-doc/here-string.

Examples (stdin):

- `bash/zsh` (here-doc)

  `cueme cue <agent_id> - <<'EOF'
  <your prompt here>
  EOF`

- `PowerShell` (here-string)

  `$prompt = @'
  <your prompt here>
  '@
  $prompt | cueme cue <agent_id> -`

Returns:

- plain text (stdout)

`payload`:

- Optional structured request, encoded as a JSON string.
- `cueme` does not validate payload; it passes it through.

Payload protocol (JSON string):

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

- `cueme pause <agent_id> <prompt|->`

`prompt`:

- Pass a prompt string as the positional `prompt` argument.
- If `-` is used, instructions are read from stdin.
- If stdin is empty, `pause` will use the default pause prompt.

Returns:

- plain text (stdout)
