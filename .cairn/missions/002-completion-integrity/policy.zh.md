<!-- translation of .cairn/missions/002-completion-integrity/policy.md at the mission creation event; the English file is authoritative -->

---
schema: cairn/policy@0.1
mission: 002-completion-integrity
budgets:
  max_attempts_per_task: 3
  max_fix_rounds: 2
  max_wall_time_per_tick_minutes: 120
  max_tokens_per_tick: null
  max_completed_tasks_between_audits: 3
allowed_commands:
  - node
  - pnpm
  - git
  - tsc
forbidden_commands:
  - npm publish
  - git push
  - git reset --hard
  - rm -rf
stop_conditions:
  - irreversible_or_destructive
  - security_sensitive
  - write_outside_repo
  - plan_unrecoverable
  - budget_exhausted
  - goal_drift_suspected
  - acceptance_unreachable
  - gate_weakened_without_amendment
stop_condition_labels:
  auto:
    - irreversible_or_destructive
    - write_outside_repo
    - budget_exhausted
    - gate_weakened_without_amendment
  human:
    - security_sensitive
    - plan_unrecoverable
    - goal_drift_suspected
    - acceptance_unreachable
approved_exceptions:
  - command: git push origin main
    scope: after each commit on main, on the human standing authorization
    approved_by: human
    date: 2026-10-31
    reason: standing authorization recorded in AGENTS.md; recorded here so policy and practice agree
merge_policy: push_main_after_commit_with_recorded_exception
---

# Policy — Mission #2

这是本 mission 的预答决策契约：让完成成为被验证树的属性。人类于 2026-10-31 批准了决策 0006
和 ADR 0005。该批准覆盖 D1–D8、T1–T8 顺序，以及 T7 的协议文本变更；它不批准新的验收标准，
也不批准削弱闸门。

## 历史与范围

- Mission #0 和 Mission #1 已关闭。它们的台账、证据和目标产物不编辑。新规则只作用于新事件。
- 新形状检查由 `mission_created.approval_source` 触发，所以已关闭 mission 不会被它之前不存在的
  规则重判。
- Mission #2 由人类授权的一次手工 `mission_created` 冻结创建。这是最后一次 bootstrap 例外；
  T5 让 `cairn init` 成为写者。

## 协议变更

- `docs/protocol.md` 只能通过 `mission_amended` 变更，带旧/新 sha256、验收链接、原因和
  `approved_by: human`。T5 加运行时写者；T7 记录与 CLI 一致的修订。
- `mission.md`、`plan.md`、`policy.md` 是目标产物。变更需要同样的修订记录。计划在已批准的
  验收范围内变更用 `approved_by: cairn`；mission 契约和策略需要 `approved_by: human`。
- T1 是任务级 packs 的唯一 grandfather：它的 `task_done` 早于 D3。从 T2 起每个 `task_done`
  都带两个合法包条目。

## 预算与停止

- 每个任务三次尝试，每次尝试两轮修复。第三次失败使任务进入 parked。
- 每个 tick 两小时墙钟时间。超出时写 `task_parked`，`reason: budget_exhausted`。
- token 预算未设置；测量本 mission，在 Mission #3 设定上限。
- 每完成三个任务和 mission 结束时，在下一个任务之前跑 milestone 审计。
- `stop_condition_labels` 是机器可读的部分：`auto` 条件可检测，`human` 条件是检查点。
  D6/T6 执行这个拆分；运行时不假装自动判断。
- 步骤具有破坏性、安全敏感、在仓库之外、不可恢复、超预算或疑似目标漂移时，停止并 park，
  不要猜。

## 命令

只允许 `node`、`pnpm`、`git`、`tsc` 运行。`npx` 被排除，因为它访问网络。发布、历史改写和
递归删除被禁止。

`git push origin main` 被默认列表禁止，但由已记录的 `approved_exceptions` 条目允许：每次
`main` 提交之后。这个例外是人类的长期授权，不是 agent 的决定。推其他分支、force push 或
历史改写不在覆盖范围内。

## 裁决

没有人类参与的决定记录为：

`Ruling: <what was decided> — <why> — <what it costs if wrong>`

未记录的偏离是秘密做出的决定。这是协议违规。
