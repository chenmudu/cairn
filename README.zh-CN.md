<!-- translation of README.md at the Mission #0 close; the English file is authoritative -->

# Cairn

> 留下轨迹，而不是对话记录。

[English](README.md) · 英文是契约的权威语言；中文是对应译本。语言政策见 [`docs/i18n.md`](docs/i18n.md)。

我们正在把“构建产品”从依赖对话、依赖手感的手艺，变成一套可重复、可审计、可自举的生产方式。
Cairn 是这套工作方式的第一个产物。

这套方法融合两个已有的包：

- **superpowers**——流程：技能、子代理工作流、执行纪律。
- **Impeccable**——标准：设计与评审准则。

目标是更快、以更高的下限构建产品——文档、代码、工作流——并让长周期任务在无人值守时依然稳定。
Cairn 是运行与证据层：它让 mission 跨会话延续，从仓库证明完成，并在计划演化时保持目标可见。

方法用自己验证自己。Mission #0 用 Cairn 构建 Cairn：只有当命令已经存在、并且闸门证明了它，
手工步骤才会被替换成命令。如果协议表达不了自己的交付，那就是协议错了。

成功不是“闸门全绿”。成功是：

- 一个全新的会话，只拿到这个仓库，就能在没有先前对话的情况下继续 mission；并且
- milestone 审计确认工作仍然服务目标，而不只是服务计划。

状态：pre-alpha。Mission #0 已完成；`mission_done` 事件和验收证据都在台账里。Mission #1（方法包）
已完成；`mission_done` 事件和验收证据在 `.cairn/missions/001-method-pack/`。

## 模型

- **Mission（使命）**——有验收标准的有界工作。
- **Task（任务）**——最小单位，自带闸门、提交和验收链接。
- **Tick（轮次）**——一次事务；最多推进一个任务。
- **Gate（闸门）**——确定性命令；退出码就是判决。
- **Ledger（台账）**——只追加的 JSONL；唯一的真相。
- **State（状态）**——`.cairn/missions/<id>/`；除 `.cairn/cache/` 外都提交。

一个任务只有在三件事同时成立时才算完成：存在提交、阻塞闸门退出 0、ledger 里有 `task_done`。
实现者的声明不是证据。

## 定位

Cairn 位于 harness 与两个包之间：

- **在 harness 之上**：ZCode 是第一个执行环境；契约、台账和证据格式与 harness 无关。适配器负责执行，
  Cairn 负责记录（`T-004`）。
- **在 git 之内**：提交和台账是持久状态；任何缓存都可重建。
- **与两个包并列**：superpowers 说“怎么干”，Impeccable 说“什么叫好”，Cairn 说“什么算完成、目标
  是否仍然成立”。

第一个用户是作者：先在这里证明，再谈泛化。

它不是 agent、不是编排器、不是 prompt 包、不是聊天 UI、不是托管服务，也不是两个来源仓库的合并体。

## 从这里开始

1. 读 [`docs/protocol.md`](docs/protocol.md)。
2. 读 [`docs/workflow.md`](docs/workflow.md) 的单 tick 操作流程：角色、步骤、人类检查点和失败
   路径。
3. 读 [`.cairn/missions/001-method-pack/`](.cairn/missions/001-method-pack/)。
4. 台账就是状态：[`ledger.jsonl`](.cairn/missions/001-method-pack/ledger.jsonl)。
5. 跑当前闸门：`node scripts/validate-mission.mjs .cairn/missions/001-method-pack`。
6. 开工前跑 `node scripts/goal-check.mjs`。它会指出下一个任务、该任务服务的验收标准，以及闸门。
   SessionStart hook 会跑同一个检查，并把锚点注入新会话或压缩后的会话。
7. 声称完成前跑 `node scripts/audit-session.mjs`。它读取真实会话记录并报告漂移信号；同一轮里
   没有跑闸门的完成声明就是其中之一。

仓库被设计成自包含的：新会话应当只凭文件就能接上。这个性质在每个 milestone 被测试，而不是被假设。
自我观测工具见 [`docs/automation.md`](docs/automation.md)。

## 非目标

- 不是 prompt 包。
- 不是厂商编排器。
- 不是聊天 UI。
- 不是托管服务。
- 不是把 superpowers 或 Impeccable 合并进这个仓库。

## 许可证

待定。
