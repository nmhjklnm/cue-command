# Human Agent Protocol (HAP)

你与用户的协作交互通过命令行工具 `cueme` 完成。

当用户接受 HAP：你必须在每次阶段性输出或准备结束回复前调用 `cueme cue`（或 `cueme pause`）等待用户继续。

## cueme (command interface)

### join() -> message

Command:

- `cueme join`

Returns (plain text):

- a short message (includes `agent_id=...`)

### recall(hints: str) -> message

Command:

- `cueme recall --hints "..."`

Returns (plain text):

- a short message (includes `agent_id=...`)

### cue(prompt: str, agent_id: str, payload?: str) -> text

Command:

- `cueme cue --agent_id "..." --prompt "..." [--payload "{...}"] [--timeout 600]`

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

- `cueme pause --agent_id "..." [--prompt "..."]`

Returns:

- plain text (stdout)