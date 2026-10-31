<!-- translation of docs/protocol.md at the T7 commit; the English file is authoritative -->

# Cairn 协议 v0.1

状态：草案。英文原文是契约，本文是译本；CLI 只是它的一种实现。

## 命题

完成是仓库的属性，不是对话的属性。

对话会被压缩，进程会死，harness 会换。提交、闸门退出码、只追加的台账事件，这三样都能活下来。
Cairn 把它们作为进度的定义，于是任何 agent 都能接上一个 mission，而不必继承前一个 agent 的上下文。

## 词汇

| 术语 | 含义 |
|---|---|
| Mission（使命） | 有验收标准的有界工作。 |
| Task（任务） | 最小单位，自带闸门与提交。 |
| Tick（轮次） | 一次事务。最多选择并完成一个任务。 |
| Gate（闸门） | 确定性命令。退出码就是判决。 |
| Evidence（证据） | 记录下来的闸门命令、退出码和输出。 |
| Ledger（台账） | 只追加的 JSONL 事件流。唯一的真相。 |
| Ruling（裁决） | 没有人类参与时做出的决定，记录进台账。 |
| Escalation（升级） | 留给人类的问题。只有提问的分支等待。 |

## 产物

```
.cairn/
  config.json     # 活动 mission 和布局版本
  cache/          # 可丢弃；永不提交
  missions/<mission-id>/
    mission.md      # 意图、非目标、验收
    policy.md       # 预算、允许的命令、停止条件
    plan.md         # 任务、依赖、文件、接口、闸门
    ledger.jsonl    # 只追加的事件；唯一的真相
    evidence/       # 每个任务的闸门输出
    inbox/          # 待处理的升级
```

`.cairn/config.json` 指明活动 mission。`cairn` 优先解析 `.cairn/missions/<id>`，同时保留
`missions/<id>` 的旧路径回退，所以迁移不会破坏已有 checkout。`.cairn/cache/` 可丢弃，永不提交。

`mission.md`、`policy.md` 和 `plan.md` 用 YAML frontmatter 承载机器可读字段，用正文承载人需要读的
部分。`ledger.jsonl` 只给机器读；markdown 视图是生成的，永远不手改。

台账是唯一的状态来源。`mission.md.status` 是初始声明；`plan.md` 的任务 `status` 是已弃用的提示。
新计划不再写它，已有值作为历史保留，不再修改。`cairn status`、`cairn next`、`goal-check` 和
`reconcile` 都从 `ledger.jsonl` 推导状态。

## 不变量

1. **一个 worktree 只有一个活动任务。** 并行发生在 worktree 之间，绝不发生在同一个 worktree 内。
2. **完成意味着三件事一致。** 只有当提交存在、阻塞闸门记录为退出 0、台账里存在 `task_done`
   事件时，任务才算完成。
3. **一个任务是一次提交事务。** 顺序是 工作 → 提交工作 → `verify` → `record` → 只提交台账。
   没有 `task_done` 的工作提交不是进度；没有工作提交的 `task_done` 也不是进度。
4. **实现者的声明不是证据。** 只有运行时跑过的闸门，或者记录了退出码和输出的命令，才算数。
5. **模型只有两个运行时决定。** 裁决（决定、记录、继续）或升级（停住这个分支，其余继续）。预算
   约束两者。
6. **状态可重建。** 任何索引或缓存都是可丢弃的；`ledger.jsonl` 加 git 历史必须足以重建 mission。
7. **目标只能通过修订改变。** 目标、非目标、验收标准和本协议都做哈希记录。变更必须发出
   `mission_amended`，带上旧/新哈希、它服务的验收标准、原因和批准者。不允许静默修改。
8. **每个任务都服务一个验收标准。** 任务声明 `serves: [A#]`。没有有效链接的任务无效；计划修订
   必须保持验收到任务的覆盖关系显式可见。
9. **完成在 milestone 被审计。** 每完成三个任务以及 mission 结束时，一个全新上下文的评审者回答：
   这一步推进了什么、是否碰了非目标、新会话能否推出同样的下一步？结论记为 `review_result`；
   失败则让 mission 停住。

## 完成事务

1. 先工作，再提交工作。证据文件属于工作提交。
2. `cairn verify <task>` 要求 `.cairn/` 之外的工作区干净。它只捕获一次 `head` 和 `tree`，并写入
   每个 `gate_result`。运行期间被跟踪内容发生变化就是漂移，本次运行失败。
3. `cairn record <task> --status done` 要求存在 `task_started`、`base` 之后至少有一个提交，并且
   每个阻塞闸门的最新结果都匹配当前 `head` 和 `tree` 且退出 0。它还要求自 `verify` 以来
   `.cairn/` 之外没有工作区变更；一旦 mission 里任何 `task_done` 带了 `packs`，任务还必须提供
   `packs` 记录（ADR 0005）。
4. 只提交台账。`task_done` 落在这次提交里。
5. `cairn record --mission-done` 要求工作区台账等于 HEAD 处的台账，所以每个 `task_done` 都先
   提交；关闭由包含 `mission_done` 的那次提交证明。

## 目标完整性

目标不是注释。`mission.md`、`policy.md`、`plan.md` 和本文在 `mission_created` 时按哈希冻结。修改
其中任何一个都需要 `mission_amended` 事件，写明：

- `old` 和 `new`：每个被修改产物的 path → sha256；
- `acceptance`：这次修改服务的验收标准；
- `why`：原因；
- `approved_by`：目标、非目标、验收或协议变更填 `human`；在既有验收范围内修改计划填 `cairn`。

`cairn record --amended --artifact <path> --why <text> [--approved-by cairn|human]
[--acceptance <a,b>]` 是写入者。旧哈希来自冻结链，新哈希来自磁盘文件。它拒绝未知目标、从未
冻结的目标、缺失文件和 mission 未声明的验收 id。不给 `--acceptance` 时，事件记录 mission 的
全部验收标准；更窄的范围只写这次变更服务的标准。milestone 审计的三个问题和完整失败清单在
`docs/drift-control.md`。

## 事件 schema

每一行是一个 JSON 对象：

```json
{
  "ts": "2026-10-31T12:00:00.000Z",
  "event": "task_done",
  "mission": "000-bootstrap",
  "task": "T-001",
  "actor": "cairn",
  "data": {}
}
```

| 事件 | 写入者 | 必需 data | 含义 |
|---|---|---|---|
| `mission_created` | `cairn init` | `artifacts`（path → sha256）、`approved_by`、`approval_source` | mission 产物冻结。 |
| `mission_amended` | `cairn record --amended` | `old`、`new`（path → sha256）、`acceptance`、`why`、`approved_by` | 目标产物被有意修改。 |
| `task_started` | `cairn start`、`cairn answer` | `base`（提交） | 某个 tick 选择了这个任务。`answer` 追加 `answer` 和 `approved_by: human`。 |
| `gate_result` | `cairn verify` | `gate`、`command`、`exit_code`、`head`、`tree`、`evidence` | 某个闸门在某一棵已验证的树上跑过。 |
| `review_result` | `cairn review` | `reviewer`、`context`、`artifact`、`verdict`、`findings`、`packs`、`coverage`、`non_goals`、`cold_start`、`ui_surface` | 评审者判断了任务或 mission。 |
| `task_done` | `cairn record` | `base`、`head`、`tree`、`commits`、`gates`、`packs`（packs 激活后） | 任务满足全部完成条件。 |
| `authorization` | `cairn record --authorized` | `approved_by: human`、`why`、`date`；可选 `scope: mission_done`、`paths` | 人类授权某次写入或关闭。 |
| `mission_done` | `cairn record --mission-done` | `acceptance`（验收 → 证据） | 每条验收标准都有证据。 |
| `task_parked` | 保留 | `reason`、`inbox` | 任务等待人类。 |
| `ruling` | 保留 | `decision`、`why`、`cost_if_wrong` | 没有人类参与的决定。 |
| `mission_aborted` | 保留 | `reason` | mission 停止。 |
| `note` | 保留 | `text` | 控制器的注记。 |

规则：

- `ts` 是 UTC ISO 8601。
- `actor` 是 `cairn`、`human` 或适配器名。
- 事件只追加，不修改。更正用新事件。
- 每种事件只有一个运行时所有者：`cairn init` 拥有 `mission_created`；`cairn start` 和
  `cairn answer` 拥有 `task_started`；`cairn verify` 拥有 `gate_result`；`cairn review` 拥有
  `review_result`；`cairn record` 拥有 `task_done`、`mission_amended`、`authorization` 和
  `mission_done`。适配器返回报告，永远不碰台账。
- `task_parked`、`ruling`、`mission_aborted` 和 `note` 通过校验器，但 v0.1 没有运行时写入者。
  存在 `task_parked` 事件时，`cairn answer` 可以解决它。

## 闸门契约

```json
{
  "id": "typecheck",
  "command": "pnpm",
  "args": ["typecheck"],
  "cwd": ".",
  "timeout_ms": 600000,
  "severity": "block",
  "scope": "workspace",
  "output": { "tail": 16384 }
}
```

- `severity: block` 决定任务。`severity: advisory` 记录但不改变退出状态。
- `scope: workspace` 每个任务跑一次。`scope: changed` 只跑变更文件。
- 任务声明的最强闸门必须在 `task_done` 之前至少跑过一次，即使更快的闸门已经通过。
- 闸门命令是固定 argv。不做 shell 插值。值放在 `args` 里。在 Windows 上，如果命令无法直接执行
  （包管理器 `.cmd` shim 抛出 `ENOENT` 或 `EINVAL`），运行时会用 shell 重试同一份由计划控制的
  argv。这个回退不是输入；测试是 `test/gates.test.ts`。

## CLI 契约（v0.1）

| 命令 | 退出 | 行为 |
|---|---|---|
| `cairn init <id>` | 0 / 2 拒绝 | 脚手架生成 mission 目录，设为活动 mission，并用冻结哈希追加 `mission_created`。 |
| `cairn status [--json]` | 0 | 从台账渲染 mission 状态。 |
| `cairn reconcile` | 0 干净 / 3 漂移 | 比较台账、git 和证据；修复缓存。 |
| `cairn next` | 0 有工作 / 2 无 / 3 阻塞 | 打印下一个 dispatch packet。 |
| `cairn start <task>` | 0 / 2 拒绝 | 以当前 HEAD 为 `base` 追加 `task_started`；拒绝已完成、已暂停、已开始、依赖未满足，或已有其他活动任务时启动。 |
| `cairn answer <task> --text <text>` | 0 / 2 拒绝 | 解决一个暂停任务的升级：追加带答案的人类 `task_started`，恢复该分支。 |
| `cairn verify <task>` | 0 通过 / 2 失败 | 在干净的树上跑任务的闸门；写证据和带 `head`、`tree` 的 `gate_result` 事件。 |
| `cairn review --file <json>` | 0 / 2 拒绝 | 校验审查记录，然后追加 `review_result`。 |
| `cairn record <task> --status done [--packs <json>]` | 0 / 2 拒绝 | 只有全部完成条件都成立才追加 `task_done`。 |
| `cairn record --amended --artifact <path> --why <text> [--approved-by cairn\|human] [--acceptance <a,b>]` | 0 / 2 拒绝 | 用旧、新哈希追加 `mission_amended`。 |
| `cairn record --authorized --why <text> --approved-by human [--scope writes\|mission_done] [--paths <a,b>] [--date <YYYY-MM-DD>]` | 0 / 2 拒绝 | 为人类批准的写入追加 `authorization`；`date` 默认今天。 |
| `cairn record --mission-done` | 0 / 2 拒绝 | 每条验收标准都有证据且台账已提交在 HEAD 时追加 `mission_done`。 |

`cairn next` 只在 stdout 打印 **dispatch packet**，不打印别的。诊断信息走 stderr。

## Dispatch packet

```json
{
  "mission": { "id": "000-bootstrap", "title": "Build Cairn with Cairn" },
  "task": { "id": "T-001", "title": "...", "files": [], "interfaces": {} },
  "policy": { "budgets": {}, "allowed_commands": [], "stop_conditions": [] },
  "constraints": ["..."],
  "gates": [{ "id": "typecheck", "command": "pnpm", "args": ["typecheck"] }],
  "ledger_tail": ["...last 5 events..."],
  "base": "abc1234",
  "packs": [
    {
      "capability": "test-first",
      "pack": "superpowers",
      "version": "7.0.1",
      "mode": "use",
      "instruction": "superpowers:test-driven-development",
      "fallback": {
        "text": "write the test first, then the implementation, then run the gate",
        "product": { "kind": "gate", "ref": "test" }
      }
    }
  ]
}
```

`packs` 是确定性上下文，永远不是完成信号。每个 packet 恰好两个条目：

- **superpowers**：任一声明文件以 `.ts`、`.tsx`、`.js`、`.mjs`、`.cjs`、`.jsx`、`.py`、
  `.rs`、`.go`、`.java`、`.rb` 或 `.sh` 结尾时用 `test-first`；否则用 `verify-before-close`
  （`superpowers:verification-before-completion`）。
- **Impeccable**：任一声明文件以 `.html`、`.htm`、`.css`、`.scss`、`.sass`、`.less`、
  `.tsx`、`.jsx`、`.vue`、`.svelte`、`.astro` 或 `.svg` 结尾时用 `design-check`；否则用
  `design-review`，`mode: not-applicable` 并给出原因。

`mode` 只能是 `use`、`human-in-loop`、`not-applicable`、`absent`。`version` 是检测到的版本；
包缺失时用 pin。检测结果为 `absent`、`mismatch` 或 `not-invocable` 时，packet 条目都是
`absent`，`fallback` 就是指令。`not-applicable` 必须写 `reason`。

## 适配器契约

适配器把 dispatch packet 变成工作。它可以使用任何 harness、模型或子代理拓扑。它必须返回：

```json
{
  "status": "DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED",
  "commits": ["..."],
  "gates": [{ "id": "...", "exit_code": 0, "evidence": "..." }],
  "review": {
    "verdict": "pass | fail",
    "findings": [],
    "packs": [
      {
        "capability": "test-first",
        "pack": "superpowers",
        "version": "7.0.1",
        "mode": "use",
        "evidence": "test/example.test.mjs, RED then GREEN"
      },
      {
        "capability": "design-review",
        "pack": "impeccable",
        "version": "4.8.0+df3a4ab",
        "mode": "not-applicable",
        "reason": "no markup or URL target",
        "evidence": "README.md criteria-based review"
      }
    ]
  },
  "rulings": [{ "decision": "...", "why": "...", "cost_if_wrong": "..." }],
  "escalations": [{ "question": "...", "options": [], "default": "..." }]
}
```

适配器永远不把任务标记为完成。控制器调用 `cairn verify` 和 `cairn record`。这个分工是台账可信的
原因。

每个 `review_result` 的 `packs` 都是非空列表。每个条目有非空的 `capability`、`pack`、
`version`、`mode`、`evidence`；`pack` 只能是 `superpowers` 或 `impeccable`；`mode` 使用与
packet 相同的四个值。`not-applicable` 必须有原因。`absent` 的 `evidence` 必须指明跑过的地板
（gate id、命令或路径）。包报告是输入；闸门证据才是证明，审查不能把红闸门变绿。

## 自举

Mission #0 手工构建 Cairn，然后把手动步骤逐一换成命令：

1. 手工写协议和 Mission #0 产物。
2. 构建校验器和 CLI 骨架。
3. 用 `cairn verify` / `cairn record` 替换手动验证和台账写入。
4. 之后的每个功能都由一个 Cairn mission 交付。如果协议表达不了自己的开发，那是协议 bug；修协议，
   不设例外。
