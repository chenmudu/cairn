<!-- translation of .cairn/missions/000-bootstrap/inbox/0003-mission-end-audit.md at the T3 amendment; the English file is authoritative -->

# 0003 — mission 结束审计失败：需要决定

- 状态：已解决——选项 A，随后一次全新审计通过
- 提出：2026-10-31
- Legacy: true
- 阻塞：`mission_done`（已不再阻塞）
- 结论：`fail`（`ledger.jsonl` 中的 `review_result`，2026-10-30T20:43:08.058Z）；重新审计
  `pass`（`review_result`，2026-10-30T20:52:40.670Z）

## 通过的部分

A1、A2、A3、A4、A5、A6、A8 由闸门、证据和提交证明。58/58 测试通过；
`node scripts/validate-mission.mjs missions/000-bootstrap` 退出 0；`cairn reconcile` 干净；
每个 `task_done` 的 head 都存在，每个证据文件都存在。技术运行时是工作的。

## 失败的部分

1. **T-005 没有满足它的 `Done when` 就完成了。** 计划要求 T-005 有 `task_started`、
   `gate_result`、`review_result` 和 `task_done`。台账里没有任何任务的 `task_started`，
   而且 T-005 的 `task_done` 在 T-005 审查之前就记录了。它声明的产物——一次记录为
   `review_result` 的通过里程碑审计——在 T-005 时没有产生。
2. **里程碑节奏被跳过。** T-002 之后跑过一次审计。T-003、T-004、T-005 完成后，在计划 T-007
   之前没有再审计。这是漂移控制的失败模式 15，也让 A7 在那个检查点未被证明。
3. **`mission_done` 没有受 sanction 的写入者。** `cairn record` 只接受
   `<task> --status done`；没有命令追加 `mission_done`，而在 `cairn verify` 落地后手工追加
   被禁止。Mission #0 没有命令或委托就无法关闭。
4. **文档漂移。** `docs/automation.md` 说 `goal-check` 在没有可运行任务时退出 1；实际所有
   任务都完成时它退出 0 并打印 `Current task: none`。`plan.md` 仍把 T-002..T-007 标为
   `status: todo`；台账是权威，但停在 `plan.md` 的冷会话会误读状态。
5. **协议不变量 3 仍是文本漂移。** 协议说台账和代码落在同一个提交；每个 `task_done` 的
   head 指向工作提交，事件落在下一个提交。inbox 0001 第 3 项记录了约定，但协议修订需要人类。
6. **`reconcile` 闸门名夸大了它的命令。** T-005 的闸门运行的是校验器，不是 `cairn
   reconcile`；A4 的证明依赖 `test/reconcile.test.ts` 和记录的 pending/clean 快照。

## 选项

### A. 补救，然后重新审计（推荐）

增加一个任务 `T-008`：

- `cairn record --mission-done`（或 `cairn complete`）追加 `mission_done`，带验收映射，并在
  还有未完成任务或验收缺少证据时拒绝。
- `goal-check` 在三个完成任务之后没有 `review_result` 时拒绝开始新任务，让节奏失败由守卫
  发现，而不是靠记忆。
- 修复 `docs/automation.md` 的退出语义，并加一条计划注记：status 是建议性的。

然后为 T-005 记录 `review_result`（冷启动 + 审计），发出 ruling 接受迟到的 T-005 证据和被
跳过的中途检查点由终审覆盖，跑一次全新的 mission 结束审计，并用 `mission_done` 关闭。

### B. 现在接受偏离

记录 ruling 接受 T-005 的迟到证据和被跳过的检查点，委托一次手工 `mission_done` 写入，然后
关闭。不增加任务。历史流程缺口保持记录但未缓解，缺失的写入者留给 Mission #1。

### C. Park

让 mission 保持打开，等待人类审查。不再改动。

## 建议

A。它把审计发现变成产品行为（真正的 `mission_done` 写入者和强制的审计节奏），而不是例外；
它也让台账对迟到的 T-005 证据保持诚实。它需要一条明确的 ruling，因为历史检查点无法追溯
重审。

## 解决

选项 A 被选中。T-008 增加了 `cairn record --mission-done`、`goal-check` 里的节奏守卫和文档
修复；它通过闸门并被记录。随后一个全新审查者通过了 T-005 和 mission：A1–A6 和 A8 被证明，
A7 被跳过的中途检查点由 ruling 接受（`2026-10-30T20:45:39.492Z`），不阻塞；inbox 项不阻塞。

两次通过的审查在补救 ruling（`2026-10-30T20:52:40.667Z`）下追加，因为还没有 `cairn review`
写入者。随后 `cairn record --mission-done` 在 `2026-10-30T20:53:53.283Z` 追加
`mission_done`，带验收证据映射。最终 `node --test`（68/68）、`goal-check`、`reconcile` 和
校验器都退出 0。

剩余发现——没有 `review_result` 或 `task_started` 写入者、协议不变量 3、`.zcode` 非目标措辞、
`reconcile` 闸门名、计划状态新鲜度、无人值守循环——记录在
`0004-mission-1-follow-ups.md`。
