<!-- translation of .cairn/missions/002-completion-integrity/inbox/0010-review-coverage-scope.md; the English file is authoritative -->

# 决策 0010 — 全覆盖要求属于关闭评审

- Status: 2026-10-31 经人类批准（里程碑审计指令）
- Date: 2026-10-31
- Serves: A2
- Scope: mission-scoped（Mission #2）

## 背景

D2 要求 `review_result` 的 `coverage` 覆盖每个验收 id（`plan.md:463`、
`0006-completion-integrity.md:150`）。T3 把它实现成了 `recordReview` 的规则，于是最后一个任务完成
前记录的任何 review 都会被拒。第一次里程碑审计就撞上了：A4–A6 尚未推进，评审只能覆盖 A1–A3，
被拒信息是 `coverage must name every acceptance criterion: missing A4, A5, A6`。

`AGENTS.md` 要求每三个已完成任务记一次 `review_result`，所以按当前实现，审计节奏本身无法执行：
中途审计不可能覆盖还没开始的任务所对应的验收项。

## 决定

“覆盖每个验收 id”约束的是 `mission_done` 校验的那条关闭评审，不是每一条 review。里程碑评审覆盖
它审计到的验收项，并在 findings 里列出仍未证明的部分。

运行时上：`recordReview` 仍然拒绝未知或重复的 criterion，也仍然检查 review 产物存在，但不再要求
覆盖全部验收项。`completeMission` 保留完整要求，因此关闭评审必须写全六条。

## 后果

里程碑审计可以被记录。关闭保证不变：`mission_done` 会用开启的 `requireAll` 重新校验最后一条
review，漏掉验收项的评审仍然会挡住关闭。唯一不再在记录时检查的是“是否有意遗漏某项”，这个判断
由审计报告和关闭评审承担。