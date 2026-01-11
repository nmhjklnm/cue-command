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
cue-console start
```

打开 `http://localhost:3000`，然后在你的 runtime 聊天里输入：

`cue`

## 用法

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

所有命令都以纯文本输出到 stdout。

---

## QQ 群

<p align="center">
  <img src="./assets/qq.jpg" alt="QQ 群二维码" width="25%" />
</p>
