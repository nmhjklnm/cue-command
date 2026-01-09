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

这是 Cue 的命令行协议适配器，兼容现有的 SQLite mailbox（`~/.cue/cue.db`）。

提示：发送图片功能暂不可用（开发中）。

## 快速开始（2 步）

### 第 1 步：安装 cueme

```bash
npm install -g cueme
```

### 第 2 步：把 protocol.md 配置到你的系统提示词里

把 `protocol.md` 的内容复制到你正在使用的 runtime 的系统提示词 / 持久规则里：

- [`protocol.md`](https://github.com/nmhjklnm/cue-command/blob/main/protocol.md)

如果你是通过 npm 安装的，`protocol.md` 也会包含在安装包里。

该文件定义了 Human Agent Protocol（HAP）规则，以及 `cueme` 的命令接口。

### 第 3 步：启动 UI 并连接

`cueme` 会与 UI 共用同一个 SQLite mailbox（`~/.cue/cue.db`）。先启动 UI：

```bash
npm install -g cue-console
cue-console dev --port 3000
```

打开 `http://localhost:3000`，然后在你的 runtime 聊天里输入：

`cue`

## 用法

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

所有命令都以纯文本输出到 stdout。

## 发布

发布是 tag 驱动的（GitHub Actions）。创建一个 tag `v<version>`，并确保它与 `package.json` 的 `version` 一致。

```bash
git tag v0.1.1
git push origin v0.1.1
```

工作流会使用 GitHub 仓库 secrets 中的 `NPM_TOKEN` 发布到 npm。
