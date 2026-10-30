<!-- translation of docs/decisions/0002-packs-and-runtime-boundary.md at the T3 amendment; the English file is authoritative -->

# 0002 — 消费这两个包，不合并它们

- 状态：已接受
- 日期：2026-10-31
- 部分细化：0004（适配器本地日志；单一台账规则不变）

## 背景

项目起源于一个问题：能否把 **superpowers**（MIT；流程 skill、子 agent 工作流、执行纪律）和
**Impeccable**（Apache-2.0；设计与批评标准）融合成一种工作方式，提高文档、代码和工作流的
质量与速度，并支撑无人值守的长周期工作？

两个约束塑造了答案：

- 运行时通常是 ZCode，但也可能是别的编码 agent；不能依赖 ZCode 独有 API。
- 项目必须在自身上证明自己：Mission #0 用 Cairn 构建 Cairn。

## 决定

1. **不合并代码。** superpowers 和 Impeccable 保持外部仓库，按引用消费。吸收任何一个都会
   fork 它并失去上游更新。
2. **角色分工。** superpowers 提供流程内容（“怎么工作”），Impeccable 提供审查标准
   （“什么算好”），Cairn 提供运行时和证据层（“什么算完成”）。
3. **harness 中立的边界。** Cairn 拥有协议、dispatch packet 和台账。适配器执行任务并返回
   报告；它们永不写台账（`T-004`）。
4. **一个台账。** 包不能自带进度文件。如果 skill 需要持久状态，就表达为台账事件，否则不用。

## 状态注记（2026-10-31）

0004 细化了上面的一句话。包可以保留适配器本地日志（例如
`.superpowers/sdd/<plan>/progress.md`），但日志永远不是事实源：完成只来自 Cairn 台账事件，
`cairn reconcile` 比较日志和台账，影响完成的持久状态表达为台账事件。不合并、适配器边界和
单一台账规则不变。“Impeccable 没有作为 skill 安装”记录的是 T-001 时的状态。2026-10-31 它被
安装到用户级（`~/.zcode/skills/impeccable`，skill 4.8.0，engine 0.1.18），按引用检测；仍然没有
vendor 进这个仓库。

## 来自 T-001 的证据

用 superpowers 执行 T-001 时，正好暴露了这个决定描述的边界：

- `executing-plans` 期望 `.superpowers/sdd/<plan>/progress.md` 台账、专用 git worktree 和
  `task-start` / `task-done` 脚本。Cairn 已经有台账和“每个 worktree 一个活动任务”的规则。
  我们采纳了纪律——简短、RED→GREEN、声明前先验证、每个未被要求的决定都记 ruling——但没有
  让第二套记账系统落地。
- `test-driven-development` 要求持久测试。这产生了 `test/validate-mission.test.mjs`，它在
  `T-001` 声明的文件清单之外；它在台账里被记录为 ruling，而不是静默加入。
- Impeccable 在 T-001 时没有作为 skill 安装。它的标准按引用作为审查标准。2026-10-31 它被安装
  到用户级（见 0004），仍然是外部内容；只有整体采用时才会 vendor 成 skill。

## 后果

- 未来任何包集成都只能是适配器或闸门，永远不是第二个事实源。
- 如果包的流程无法用 Cairn 协议表达，那是要修的协议 bug，不是要授予的例外。
- 编码 agent 的集成点是 `docs/protocol.md`（`T-004`）里的 dispatch packet 和报告合同。
