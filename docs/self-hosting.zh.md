<!-- translation of docs/self-hosting.md at the T1 commit; the English file is authoritative -->

# 自举——一次一个 tick

Cairn 用它自己描述的方法构建自己。Mission #0 就是证明：bootstrap 之后的每个任务都由
`cairn next` 选出、由 `cairn verify` 验证、由 `cairn record` 标记完成。`cairn verify` 存在之后，
没有人再手工编辑 `ledger.jsonl` 来把任务标成完成。

## 状态放在哪里

运行时状态放在 `.cairn/`：

- `.cairn/config.json` 指明活动 mission。
- `.cairn/missions/<id>/` 存放 `mission.md`、`policy.md`、`plan.md`、`ledger.jsonl`、
  `evidence/` 和 `inbox/`。
- `.cairn/cache/` 可丢弃，永不提交。

`cairn init <id> --title "<title>"` 生成新 mission 的骨架。骨架的闸门故意失败，因此在合同被编辑
成真实任务之前，它无法被记录为完成。mission、ledger 和 evidence 都提交；clone 之后不需要原始对话
就能继续和审计。旧的 `missions/<id>/` 路径仍然可以解析。

## 一个 tick

```bash
node scripts/goal-check.mjs                 # 为什么是这个任务，它服务哪条验收
node src/cli.ts next                        # dispatch packet，包含 base 提交
node src/cli.ts verify <task>               # 跑每个 gate，写证据和 gate_result
# 提交工作（任务代码和证据）
node src/cli.ts record <task> --status done # 三个条件都满足后写 task_done
node src/cli.ts reconcile                   # ledger、git、证据三者一致
node src/cli.ts record --mission-done       # 所有任务完成，每条验收都有证据
```

最后一行只有在最后一个 `task_done` 之后存在通过的 `review_result` 时才写 `mission_done`；有未完成
任务、未覆盖验收、缺失证据或审查失败时它会拒绝。

中间的执行步骤故意不做规定。子代理、模型或 shell 脚本都可以干活；它们返回的报告由
`docs/adapter.md` 定义。控制器负责 `verify` 和 `record`，所以适配器无法给自己发证书。

`cairn next` 只在 stdout 打印 packet，诊断信息走 stderr。packet 携带任务、验收链接、声明的
文件、policy、gate、最近五个 ledger 事件和 `base`。`src/packet.ts` 把同一个 packet 渲染成给
模型看的 markdown 简报；模板在 `templates/dispatch.md`。

## 崩溃窗口

`cairn verify` 写证据和 `gate_result` 事件。`cairn record` 只在提交存在后写 `task_done`。两者
之间崩溃会留下：

- 磁盘上的证据文件；
- ledger 里的 `gate_result` 事件；
- 没有 `task_done`；
- 没有第二个提交。

`cairn reconcile` 把这种状态报告为 `pending`，不是 drift：gate 通过，记录缺失。`cairn record`
在任务已完成时拒绝执行，所以重跑不会重复写 `task_done`。如果进程在工作提交之前就死了，
`reconcile` 仍然会看到 pending 的 gate 和缺失的 `task_done`；下一个 tick 可以重新提交并记录，
或者重跑 `verify` 刷新证据。

## 冷启动

新会话不需要上一段对话。仓库携带 mission、plan、ledger 和证据。SessionStart hook 配置在
`startup|resume`，运行 `node scripts/goal-check.mjs --anchor`，给出当前任务、任务服务的验收
标准、gate 和路由规则。工作区 hook 在
`~/.zcode/security/workspace-hook-trust-v1.json` 包含它之前处于 `pending_trust`；在此之前
手动运行同一条命令。授信并开启新会话后，上下文中出现 `Cairn goal anchor` 才是真实注入的
证据。脚本通过测试不等于 harness 真的运行了它。

里程碑审计直接检验这件事：一个只拿到仓库的全新审查者，必须说出下一个任务、它的 gate，以及
它为什么服务 mission。即使所有 gate 都是绿的，答错也算 drift。

## 里程碑审计

每完成三个任务以及 mission 结束时，在开始下一个任务之前：

1. **覆盖**——哪些验收标准推进了，哪些仍未证明，证据是什么。
2. **非目标**——是否有任务碰了非目标，哪条 ruling 允许了它。
3. **冷启动**——全新会话能否仅凭仓库推导出同样的下一步？

结论写成 `review_result` 事件。`fail` 会让 mission 停住。

## Mission #0 实际跑通了什么

| 验收 | 本仓库中的证据 |
|---|---|
| A1 校验器接受 mission，拒绝缺 gate 的 fixture | `evidence/T-001/`、`--expect-invalid` 测试 |
| A2 状态可从 ledger + git 重建 | `cairn status --json`、`test/plan.test.mjs` |
| A3 next → dispatch → verify → record | `test/cli.test.mjs`、T-003/T-004/T-005 的 `task_done` 事件 |
| A4 verify 与 record 之间崩溃 | `test/reconcile.test.ts`、`cairn reconcile` 的 pending 报告 |
| A5 新会话从仓库恢复 | SessionStart hook、最终 `review_result` |
| A6 每个任务声明 serves | `goal-check`、`status --json` 的覆盖率图 |
| A7 审计仅凭仓库说出下一个任务 | 各里程碑的 `review_result` 事件 |
| A8 改目标产物会发出 `mission_amended` | 带新旧哈希的真实 `mission_amended` 事件 |

这张表是地图，不是证书。gate 和 ledger 才是证据；最终审计在 mission 最后一个提交上记录结论。

## 边界

自举证明运行时能承载自己的交付。它不证明目标本身正确，也不证明 gate 度量了真正重要的东西。
那些仍然是人的判断；协议做的是把它们变得可见、可审计，而不是隐式存在。
