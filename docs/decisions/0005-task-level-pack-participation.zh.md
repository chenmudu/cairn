<!-- translation of docs/decisions/0005-task-level-pack-participation.md at the ADR commit; the English file is authoritative -->

# 0005 — 按任务记录包的参与

- 状态：提议
- 日期：2026-10-31

## 背景

Mission #1 关闭时，B7 被标记为已覆盖。关闭后，owner 发现仓库里看不到每个任务的 superpowers
产物，也看不到 superpowers 与 Cairn 产品的关联。调查确认了这个缺口：

- 台账有 8 个 `task_done`，没有一个带 `packs`；每个负载都是 `base / head / commits / gates`。
- 台账有 3 个 `review_result`，只有 T8 最终 review 带 `packs`；两个里程碑 review 早于 T7
  修订。样例的形状相同：`packs` 在 `review_result`，不在 `task_done`。
- `src/cli.ts:220-231` 写死了 `task_done` 负载，从不读取任务报告。
- `docs/adapter.md` 只把 `packs` 放在 `review` 下。适配器报告没有执行层的包记录，所以一份
  合规报告也无法表达“superpowers 执行了这个任务”。
- `cairn next` 会向 packet 注入两条包记录，但 packet 自己写明“包是上下文，不是完成”。
  注入是建议，且没有回写。
- 会话记录显示：压缩前 528 条消息的上下文和当前 281 条消息的上下文里，实际 `Skill` 工具调用
  都是 0。仓库没有 `.superpowers/` 目录。TDD 和验证是手工做的，没有 invoke 包。
- 只有 T7 和 T8 有 `task_started`。T1–T6 早于 `cairn start` 和 packet 注入，所以大多数任务
  根本收不到包指令。

B7 写的是“task evidence records used, not-applicable, or absent”。没有任何任务证据做到。
mission 是靠 review 级证据加样例 fixture 关闭的，不是靠任务级记录。

## 决定

包的参与是任务属性，不是 review 的附属属性。

- `task_done` 必须携带 `packs` 记录，或引用携带它的任务报告。缺失或非法时，`cairn record`
  拒绝追加 `task_done`。
- 每个任务固定两条：
  - **superpowers**——代码任务用 `test-first`，文档或混合任务用 `verify-before-close`。
    `mode: use` 要写明 skill 和具体证据（测试路径 + RED→GREEN，或闸门命令）；包缺失时
    `mode: absent`，证据是地板。
  - **Impeccable**——有 UI 表面时用 `design-check`；否则 `design-review`，
    `mode: not-applicable` 并写原因。每个任务都要记录，不能省略。
- `cairn next` 明确要求执行者返回任务报告。报告写到 mission 的 `evidence/` 下，是
  `cairn record` 校验的输入。
- packet 仍然是上下文；台账和证据仍然是证明。这个 ADR 补的是任务级记录，不是把包报告变成
  闸门。

## 为什么

- 只有注入、没有必填的任务字段，任务可以零包参与而通过。Mission #1 就是这样。
- superpowers 按设计不写持久仓库产物：`task-start` 不写台账，progress journal 是外部
  scratch。Cairn 不记录，就什么都不剩。
- review 级 packs 回答的是“审查是否可靠”，不是“任务是否用了包”。owner 要的是后者，而且是
  每个任务。
- `withPacks` 已经有确定性的选择规则（代码 / UI / 文档）。缺的是记录和校验，不是选择。

## 后果

- 变更向后兼容。要求只适用于人类批准协议修订之后记录的 `task_done`。Mission #1 的事件继续
  有效，用一条 note 登记为 grandfather；不改写历史。
- 每个任务多一个证据产物。`cairn record` 多一条阻塞校验；没有包记录的任务变成未完成，而不是
  静默干净。
- Impeccable 的 `not-applicable` 会按任务可见并带原因，这对没有 UI 表面的仓库是正确结果。
- 这个 ADR 不实现变更。实现需要新 mission 或任务，以及 `approved_by: human` 的协议修订。

## 备选方案

- **保持 review 级 packs。** 拒绝：owner 要的按任务关联无法证明，B7 自己的措辞也没满足。
- **相信模型会 invoke skill 并报告。** 拒绝：实现者声明不是证据；会话显示 packet 点名了
  skill，实际调用仍为 0。
- **把 superpowers vendor 进仓库。** 拒绝：违反 ADR 0002 和 0004；包保持外部，Cairn 拥有
  接缝。
