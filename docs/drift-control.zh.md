<!-- translation of docs/drift-control.md at the enforcement-map commit; the English file is authoritative -->

# 漂移控制

长周期工作有两种失败方式：停下来，或者继续朝错误方向走。停下来容易发现——台账不再增长。漂移代价高，
因为每一步看起来都合规。本文列出我们预期会发生的失败、捕获它的信号，以及阻止它的机制。没有执行点的
机制只是愿望，所以每一行都写明它在哪被执行。

## 执行与注入

一条规则需要两样东西，它们不能互换：

- **执行（enforcement）**判定通过或失败：脚本、测试、CI，或 `human`/`review` 检查点。
  只有执行让规则有约束力。
- **注入（injection）**在正确时点把规则放进 agent 的上下文：hook、skill 程序，或
  `AGENTS.md`。注入让规则被知道，不让它发生。

只有注入没有执行，是建议。只有执行没有注入，是埋伏。下面每个失败模式都写明执行点；
注入接线在 `docs/automation.md`。

### 执行点

| 执行点 | 是什么 | 能否强制 |
|---|---|---|
| Script / test / CI | 违规时退出非零的确定性命令。 | 是 |
| Human（人类） | 有权停下或改变目标的检查点。 | 是 |
| Review（评审） | milestone 时全新上下文的 `review_result`。 | 是，靠判断 |
| Gate（闸门） | `plan.md` 声明的确定性命令；它调用脚本或测试。 | 是 |
| Ledger（台账） | 只追加的事件；状态来源，本身不是检查。 | 否 |
| Policy（策略） | 预算与停止条件；规则来源，不是执行器。 | 否，直到 D6 |

### 注入点

| 注入点 | 做什么 | 能否强制 |
|---|---|---|
| Hook | 在 session 开始、提交 prompt 或 stop 时注入短锚点。 | 否 |
| Skill | 在决策点给 agent 一段程序。 | 否 |
| `AGENTS.md` | 常驻 workspace 指令；兜底指针。 | 否 |
| 权威文档 | 只保存一份规则；脚本和 hook 读取它。 | 否 |

## 失败模式

**执行点**单元格是机器检查的。它只允许逗号分隔的反引号仓库路径（脚本或测试），或
`human` / `review`。脚本必须由 CI 或测试运行；测试由 `node --test` 运行。不允许任务号，
不允许散文。`scripts/check-enforcement.mjs` 对两份语言表执行这条语法。

| # | 失败 | 早期信号 | 机制 | 执行点 |
|---|---|---|---|---|
| 1 | 目标被静默改写 | 目标哈希变化但没有修订事件 | 目标冻结 + `mission_amended`；D5 加哈希验证 | `human` |
| 2 | 任务与目标无关 | 任务没有 `serves` | 验收可追溯 | `scripts/validate-mission.mjs`, `scripts/goal-check.mjs` |
| 3 | 计划扩大范围 | 任务无法追溯到验收标准 | 修订必须引用验收标准 | `review` |
| 4 | 闸门不可能失败 | 闸门永远不会退出非零 | 一个必须被拒绝的 fixture | `test/validate-mission.test.mjs` |
| 5 | 闸门被削弱 | 通过修订降低 severity 或命令强度 | 修订要说明它仍证明什么；旧证据保留 | `review` |
| 6 | 实现者自我认证 | 实现者自己写 `task_done` | 控制器调用 verify/record；适配器只交报告 | `test/cli.test.mjs` |
| 7 | 台账与代码分叉 | 有提交无事件，或有事件无提交 | `reconcile` | `test/reconcile.test.ts` |
| 8 | verify 与 record 之间崩溃 | 过期证据、无事件或重复提交 | 台账即状态；`reconcile` | `test/reconcile.test.ts` |
| 9 | 新会话误读状态 | frontmatter 与台账不一致 | 从台账推导状态 | `scripts/goal-check.mjs`, `test/plan.test.mjs` |
| 10 | 决定随上下文丢失 | 推理只存在于对话里 | ruling、note、inbox 文件 | `scripts/check-decisions.mjs`, `human` |
| 11 | tick 内范围蔓延 | diff 里出现计划外文件 | 一 tick 一任务；声明文件 | `scripts/audit-session.mjs`, `review` |
| 12 | 预算烧穿 | 3 次尝试、2 轮修复、2 小时 | 停住，不要即兴发挥；D6 执行或标注预算 | `human` |
| 13 | 工具链或平台失败 | 闸门跑不起来；路径或行尾不匹配 | 固定白名单；`.gitattributes`；大声失败 | `human` |
| 14 | 被包或 harness 锁死 | 某个技能带来自己的台账或状态 | 适配器边界；单一台账；`check-method --packs` 只报存在 | `review` |
| 15 | 评审疲劳 | milestone 审计被跳过 | 固定节奏；人类检查点 | `scripts/goal-check.mjs` |

## Milestone 审计

每完成三个任务之后、以及 mission 结束时，在开始下一个任务之前运行。结论记为 `review_result`；
`fail` 让 mission 停住。

1. **覆盖。** 已完成的工作推进了哪些验收标准？哪些仍未证明？引用任务和它的证据。
2. **非目标。** 是否有任务碰了非目标？引用任务和允许它的 ruling。
3. **冷启动。** 一个全新会话，只拿到仓库，说出下一个任务、它的闸门，以及它为什么服务 mission。
   答错就是漂移，即使所有闸门都是绿的。

## 修订

修改 `mission.md`、`policy.md`、`plan.md` 或 `docs/protocol.md` 需要 `mission_amended` 事件：

- `old` 和 `new`：每个被修改产物的 path → sha256；
- `acceptance`：这次修改服务的验收标准；
- `why`：原因；
- `approved_by`：目标、非目标、验收或协议变更填 `human`；在既有验收范围内修改计划填 `cairn`。

在 `T-002` 实现该事件之前，修订记录为携带同样字段的 `ruling`。不允许静默修改。

## 这套机制保证不了什么

- 它无法发现一个从一开始就错误的目标。那是人类检查点的职责。
- 它无法替代 milestone 时的人类判断；它只能让“跳过”变得可见。
- 它无法让一个闸门证明它没有度量的东西。
