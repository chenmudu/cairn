<!-- translation of .cairn/missions/002-completion-integrity/inbox/0011-t4-fixture-sync.md; the English file is authoritative -->

# 决策 0011 — T4 声明清单外的授权夹具同步

- Status: 2026-10-31 经人类批准（T4 指令）
- Date: 2026-10-31
- Serves: A4
- Scope: task-scoped（Mission #2 的 T4）

## 背景

T4 声明的文件是 `src/plan.ts`、`src/cli.ts`、`test/cli.test.mjs`、`test/plan.test.mjs`、
`test/complete.test.ts`、`docs/workflow.md`、`docs/workflow.zh.md`、`docs/i18n.md` 和本 mission
目录。`test/p0.test.mjs` 与 `test/packs-record.test.mjs` 不在其中。

D4 要求 `record` 之前必须有 `task_started`，并删掉了 `gitParent` 回退，所以 base 来自 start 事件，
且 base 与 HEAD 之间必须有提交。两个夹具都直接 `record`，从未 start。全量测试因此失败 13 条，
错误全部是 `refused: T1 has no task_started; run cairn start first`——`p0.test.mjs` 4 条，
`packs-record.test.mjs` 9 条。

## 决定

只把两个夹具更新到新规则，不动任何断言：

- `test/p0.test.mjs`：`initRepo(root, mission)` 在 base 提交与空的 `setup` 提交之间记一次
  `start T1`，于是 base 落在第一次提交，`setup` 提供工作量。
- `test/packs-record.test.mjs`：`verify` 辅助函数先 start（已 active 视为幂等），写并提交
  `src/work-<task>.ts`，然后 verify。

断言未改，也没有为让夹具通过而放宽新的 `start`、`record` 检查。

## 后果

新状态机下全量测试回到绿色。这是 T4 声明清单外的唯一写入；`audit-session` 可能报出来，
本决策即其授权。