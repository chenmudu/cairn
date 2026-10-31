<!-- translation of .cairn/missions/002-completion-integrity/inbox/0012-t9-harness-claims.md; the English file is authoritative -->

# 决策 0012 — 把 T9 作为 harness 声明任务放在 T7 之前

- Status: approved by human
- Date: 2026-11-01
- Serves: A6
- Scope: mission-scoped（Mission #2）

## 背景

里程碑审计 2 确认了 T4–T6，并把 A6 的契约条款留给 T7。对 harness 的单独检查发现
SessionStart hook 和状态描述面可能与运行时不一致：`goal-check` 失败时 hook 会丢掉
目标锚点，hook 测试依赖真实仓库的审计状态，AGENTS.md 和文档描述的是设计意图而不是实际
行为。T7 负责协议与状态真相；harness 声明必须先与运行时对齐，否则 T7 会把仍在说谎的
描述面认证为真。人类于 2026-11-01 批准了 T9 及其在 T7 之前的位置（即本决策）。

## 决定

在 T6 与 T7 之间加入 T9“Make the harness claims match the runtime”。T9 依赖 T6。
T7 的依赖变为 [T6, T9]，因此被搁置的 T9 不能放行 T7 先跑。T9 服务 A6。

## 非目标检查——“No new runtime feature outside D1–D8”

T9 不新增运行时功能。证据：

- `scripts/goal-check.mjs` 是只读状态投影：没有写调用，只导入 `readMission`、
  `routingLines` 和 `resolveMission`。`--anchor` 输出 `--brief` 已经计算的同一份报告，
  只多加一行警告。它不写 ledger 事件、不定义新事件类型、不新增 `src/` 模块。
- `.zcode/hooks/session-start.mjs` 是适配器，不是运行时。它自己的头部写明契约是
  `scripts/goal-check.mjs`，任何 harness 都能不依赖 ZCode 直接运行。T9 只修它的失败路径，
  让它不再丢掉锚点；不增加能力。
- T9 的文件清单不含任何 `src/` 下的文件。运行时不受影响。

这项工作服务 A6（“every mechanizable audit finding has a negative test”）；失败时丢锚点
和过时的 harness 声明正是这类发现。人类于 2026-11-01 批准了 T9 及其在 T7 之前的位置
（即本决策）。

边界：新增 `src/` 模块、新增写 ledger 的命令、新增事件类型或调度器都算运行时功能，必须在
开始前做 `mission.md` 非目标 amendment，且 `approved_by: human`。T9 保持在现有非目标之内。