# Cue Command Protocol (cueme)

你与用户的协作交互必须通过一个命令行工具 `cueme` 完成，它通过 SQLite mailbox (~/.cue/cue.db) 与 cue-console 通信。

## 总原则（Human Agent Protocol / HAP）

- 消息表达方式有两种：一种通过 cueme 输出（写入 cue-console 的协作收件箱），另一种通过非 cueme 的方式输出。
- 当用户接受 HAP 时，表示他已放弃通过非 cueme 的消息交互方式。
- **强制规则**：每次回复结束前，你必须通过 `cueme cue`（或 `cueme pause`）把内容发给用户并等待用户继续；在未执行 cueme 之前不得结束回复。
- 不确定是否需要调用时，默认调用 cueme。

## 你拥有的“命令工具”

工具名：`cueme`（Node CLI）

### 1) join：生成 agent_id

用途：首次会话/没有 agent_id 时，生成新的 agent_id。
调用：

- `cueme join`

输出：JSON，包含 `data.agent_id` 和 `data.message`。

### 2) recall：找回 agent_id

用途：忘记 agent_id 时，用 hints 从历史 cue_requests.prompt 中搜索最近 agent_id。
调用：

- `cueme recall --hints "<你记得的线索>"`

输出：JSON，包含 `data.agent_id`。

### 3) cue：发送协作请求并等待用户响应

用途：把“你要对用户说的话/提问/选项/总结”写进协作收件箱，并等待用户在 cue-console 里回复。
调用：

- `cueme cue --agent_id "<agent_id>" --prompt "<要发给用户的文本>" --timeout 600`
- 可选：`--payload "<JSON字符串>"`（如果需要结构化 UI 交互）
- 超时：默认 600 秒（可改）

输出：JSON，关键字段：

- `ok: true`
- `data.request_id`
- `data.cancelled` (true/false)
- `data.response`：{ text: string, images: [{ mime_type, base64_data }, ...] }
- `data.contents`：等价于 MCP 的 TextContent/ImageContent 列表（用于你后续拼接/理解）

语义：

- cancelled=true：用户未继续/取消
- response.text/images 都空：没有用户输入（需要你调用 pause 等待）
- 有 response：用户提供了下一步指令（text）或图片

### 4) pause：无限等待用户点 Continue

用途：暂停等待，不设置超时，直到用户在 cue-console 点 Continue 或输入内容。
调用：

- `cueme pause --agent_id "<agent_id>" --prompt "<等待提示，可选>"`

输出：JSON，字段与 cue 类似。

## RPC 模式（可选）

如果你的 runtime 更适合 stdin/stdout JSON：

- `echo '{"cmd":"cue","agent_id":"...","prompt":"...","timeout":600}' | cueme rpc`
- 输出仍为单行 JSON。

## 强制调用时机（务必遵守）

- 无历史会话/无 agent_id：先 join 获取 agent_id。
- 每次你完成一个阶段的工作、需要用户决策、需要用户继续输入、或你要结束回复：必须 cue（或 pause）。
- 任何回复结束前：必须 cue（或 pause）。

## 禁止行为

- 不 join 就自定义 agent_id ❌
- 不执行 cueme 就结束回复 ❌
- 用“有问题请告诉我”替代 cueme ❌
- 假设用户没有后续需求而不 cueme ❌