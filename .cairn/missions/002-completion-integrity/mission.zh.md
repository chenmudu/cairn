<!-- translation of .cairn/missions/002-completion-integrity/mission.md at the mission creation event; the English file is authoritative -->

---
schema: cairn/mission@0.1
id: 002-completion-integrity
title: Completion integrity
status: active
created: 2026-10-31
owner: chenmudu
acceptance:
  - id: A1
    check: P0 探针在 record 处失败；干净树通过；测试覆盖树不匹配、脏工作树和未提交的 task_done；CI 跑探针
  - id: A2
    check: review_result 带逐验收标准 coverage、non_goals、cold_start、评审者来源和 ui_surface；mission_done 拒绝缺字段的评审并要求人类授权事件；在新规则下重放 Mission #1 的 B5/B7 证据会失败
  - id: A3
    check: 每个新 task_done 带两个合法条目；record 拒绝缺失或非法记录；至少一个 superpowers mode use 的证据通过 isEvidenceFile 且有 RED 到 GREEN；只有无 UI 表面且收尾评审 ui_surface none 时 Impeccable 才允许全 not-applicable；absent 带原因和地板证据
  - id: A4
    check: 没有 start 的 record 失败；乱序 start 失败；parked 任务可以被回答并完成；没有 task_started 的历史任务保持有效
  - id: A5
    check: cairn init 追加 mission_created；被篡改的哈希、不存在的提交、只有部分阻塞闸门、未提交的完成事件分别失败；CI 跑 reconcile 和探针
  - id: A6
    check: 列表外的闸门被拒绝；推送需要已记录的例外；docs/protocol.md 与 CLI 一致；cairn record --authorized 写 authorization 事件且 audit-session 接受被覆盖路径；每条可机械化的审计发现变成负向测试，不可机械化的标 human 或 review
---

# Completion integrity

## 意图

Mission #1 交付了方法。关闭后的审计显示：它的完成声明没有绑定到产出工作的树——红树可以记录
`task_done` 并关闭 mission。Mission #2 让完成符合 `README.md` 的说法：证明工作的是仓库，不是
对话。它把闸门绑定到被验证的树，把验收与评审证据绑定到验收标准，按任务记录包参与，执行状态
机，让 `init`、校验器和 CI 检查契约，让策略可执行，记录人类授权，并让契约和状态来源说真话。

`.cairn/missions/001-method-pack/inbox/` 里的决策 0006 是完整契约。本 mission 实现它，不重开
争论。

## 非目标

- 不改写 Mission #0 或 Mission #1 的台账、证据或目标产物。它们保持字节不变且有效；新规则只
  作用于新事件。
- 不 vendor、不合并 superpowers 或 Impeccable 仓库。它们保持外部。
- 不做 UI 表面、设计系统或托管服务。Impeccable 的参与是标准式的；`not-applicable` 是预期
  结果，必须记录。
- 不做无人值守调度器或多 tick 循环。完成完整性优先；循环放到后续 mission。
- D1–D8 之外不加新的运行时功能。
- 不重开 GitHub issues #1–#5。它们已按被决策 0006 取代关闭；只有决策被拒绝才重开。
- 协议变更必须 `approved_by: human`。

## 约束

- 一个 tick 最多推进一个任务。任务完成需要提交、被验证树上的阻塞闸门退出 0、以及台账里的
  `task_done` 事件。
- 顺序是 工作 → 提交工作 → verify → record → 只提交台账。`verify` 在 `.cairn/` 之外的干净
  工作树上运行。
- 英文是机器校验契约的权威。每个面向人的产物都有中文 companion。译本永远不覆盖英文文件。
- Mission #0 和 Mission #1 是历史。它们的台账、证据和目标产物不编辑。
- 决策 0006 是本 mission 的契约：A1–A6、T1–T8、D1–D8。

## 验收

- A1：完成绑定到被验证的树。
- A2：验收和评审证据指名验收标准；评审者是证据；`mission_done` 需要人类授权事件。
- A3：按任务记录包参与（ADR 0005）。
- A4：任务状态机被执行。
- A5：`init`、校验器和 CI 与契约一致。
- A6：策略可执行或标注人类，契约与 CLI 一致，每条审计发现都有覆盖。

## 当前动作

台账是唯一状态来源。开始前运行 `node scripts/goal-check.mjs`；读 `plan.md` 里的下一个任务、
它服务的验收标准和闸门。下一个任务从台账和计划推导，永远不从这一节推导。
