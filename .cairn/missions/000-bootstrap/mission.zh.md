<!-- translation of .cairn/missions/000-bootstrap/mission.md at the T2 commit; the English file is authoritative -->

# 用 Cairn 构建 Cairn

- **Schema**：`cairn/mission@0.1`
- **Mission**：`000-bootstrap`
- **状态**：已完成（`mission_done`）
- **创建**：2026-10-31
- **Owner**：chenmudu

## 验收标准

- **A1**：协议校验器接受本 mission，并拒绝缺少闸门的 fixture。
- **A2**：每个任务状态都能仅凭 `ledger.jsonl` 和 git 重建。
- **A3**：一个任务完整走过 `next → dispatch → verify → record`。
- **A4**：在 `verify` 和 `record` 之间杀掉进程，留下可解释的状态，且不重复提交。
- **A5**：新会话只凭仓库就能继续 mission，不需要之前的对话。
- **A6**：每个任务声明 `serves`，`cairn status --json` 输出验收覆盖图。
- **A7**：在每个里程碑，全新会话都能只凭仓库说出下一个任务、它的闸门和理由。
- **A8**：修改 mission、policy、plan 或 protocol 时，发出带新旧哈希的 `mission_amended`。

## 意图

构建 Cairn 的最小版本，让它能承载自己的开发，并从第一个 tick 开始用它构建自己。这个 mission 既是产品，也是证明：如果协议表达不了自己的交付，那就是协议错了。

这个 mission 验证的方法定义在 `README.md`。Cairn 是它的第一个产物；目标是可重复、可审计的构建产品的方式，而不是为了运行时本身。

## 非目标

- 不做 UI、数据库、托管服务。
- M0 不做 harness 专用适配器；通用 dispatch packet 足够。
- 不做这个 mission 不需要的功能。
- 不合并 superpowers 或 Impeccable 仓库。它们是内容和闸门包，按引用消费，不是要吸收的代码。

## 约束

- Git 是唯一的持久存储。任何索引或缓存都必须能从台账和 git 历史重建。
- `ledger.jsonl` 只追加，只有一个写入者：`cairn record`。适配器只返回报告，永不写台账。
- 任务只有在提交存在、阻塞闸门退出 0、台账里有 `task_done` 时才算完成。
- 每个任务在开始前必须能写进 `plan.md`。写不进去就先修订计划。
- 第一个 tick 是手动的。每个手动步骤都会随着对应命令落地而被替换。

## 验收

- **A1**：协议校验器接受本 mission，拒绝缺闸门的 fixture。
- **A2**：任务状态可从 `ledger.jsonl` + `git log` 重建，无需缓存。
- **A3**：一个任务不手改台账，跑通 `next → dispatch → verify → record`。
- **A4**：`verify` 和 `record` 之间的崩溃能被 reconcile 解释，不重跑任务、不重复提交。
- **A5**：全新会话只凭仓库能说出下一个任务和它的闸门。
- **A6**：每个任务声明 `serves`；`cairn status --json` 输出验收覆盖图。
- **A7**：每个里程碑，全新会话只凭仓库说出下一个任务、闸门和理由。
- **A8**：修改 `mission.md`、`policy.md`、`plan.md` 或 `docs/protocol.md` 时，发出带新旧哈希的 `mission_amended`。

## 当前动作

下一个任务以台账为准：运行 `node scripts/goal-check.mjs .cairn/missions/000-bootstrap` 或 `node src/cli.ts status --mission .cairn/missions/000-bootstrap`。开始前先读 [`inbox/`](inbox/)；计划在 T-001 之后修订过，加入了 `serves` 链接和漂移控制。

> 说明：Mission #0 已关闭，本文件保留为历史合同。当前活动 mission 是
> `001-method-pack`。
