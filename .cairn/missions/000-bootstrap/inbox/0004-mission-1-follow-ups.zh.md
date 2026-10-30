<!-- translation of .cairn/missions/000-bootstrap/inbox/0004-mission-1-follow-ups.md at the T3 amendment; the English file is authoritative -->

# 0004 — Mission #0 关闭时留给 Mission #1 的后续项

- 状态：未决（计划输入，不是阻塞项）
- 提出：2026-10-31
- Legacy: true
- 来源：通过的 mission 结束审查（`review_result`，2026-10-30T20:52:40.670Z）和失败的首次审计
  （`review_result`，2026-10-30T20:43:08.058Z）

Mission #0 已关闭。这些是关闭时暴露的真实缺口，记录下来，让 Mission #1 从证据开始而不是从
记忆开始。

## 产品缺口

1. **没有受 sanction 的 `review_result` 写入者。** T-005 和 mission 结束的审查是在人类补救
   ruling（`2026-10-30T20:52:40.667Z`）下直接追加的。其他每次写入都有命令；审查没有。加入
   `cairn review`（任务或 mission、结论、审查者、findings），让手工追加不再必要。
2. **没有 `task_started` 写入者。** T-005 的 `Done when` 要求 `task_started`，但没有命令写它。
   `2026-10-30T20:47:47.530Z` 的 ruling 为 M0 接受其缺失。要么在 `cairn next`/`cairn verify`
   里写它，要么从合同里移除；不要把不匹配留给 ruling。
3. **协议不变量 3 需要人类修订。** 协议说台账和代码落在同一个提交。实践中每个 `task_done`
   指向工作提交，事件落在下一个提交。用新旧哈希和 `approved_by: human` 修订合同，或者让
   运行时匹配文本。
4. **`.zcode` 非目标措辞。** 计划禁止 “M0 的 harness 专用适配器”，而 SessionStart hook 和
   项目 skill 作为可选胶水存在（ruling `2026-10-30T20:13:52.390Z`）。Mission #1 应该说明
   可选 harness 胶水是否在范围内，而不是依赖一次性豁免。
5. **`reconcile` 闸门名夸大了它的命令。** T-005 的 `reconcile` 闸门运行的是校验器，不是
   `cairn reconcile`。A4 由 `test/reconcile.test.ts` 和记录的 pending/clean 快照证明，
   不是由那个闸门 id 证明。下次触碰 T-005 证据时重命名闸门或替换命令；不要静默改变用途。

## 流程卫生

6. **`plan.md` 的 status 是历史性的。** T-002..T-008 仍写着 `status: todo`；台账是事实，
   `goal-check` 从它推导。Mission #1 应该决定：计划在关闭时冻结并加状态注记，还是暴露派生
   视图而不是手工维护 status。
7. **mission 结束测试依赖台账状态。** 两个测试断言真实 mission 的守卫结果，所以它们在最后
   一个 `task_done` 和通过审查之间会变红。T-007 把大多数检查移到临时 mission；剩余的真实
   mission 断言是有意的，但意味着红色测试套件可能是一个正确的关闭前状态。在测试里说明，或
   收窄断言。
8. **无人值守循环。** Mission #0 证明的是人类 pacing 下一次一个 tick。原始目标还要求长周期
   无人值守执行。`cairn tick`/调度器设计、预算和停止条件是 Mission #1 范围，不是在这里
   追溯补上。
