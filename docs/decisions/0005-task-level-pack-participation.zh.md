<!-- translation of docs/decisions/0005-task-level-pack-participation.md at the Mission #2 approval revision; the English file is authoritative -->

# 0005 — 按任务记录包的参与

- 状态：提议。人类于 2026-10-31 通过决策 0006 接受了本 ADR。具有约束力的记录是 Mission #2
  的 `mission_created` 事件，其 `approval_source: ["0006", "0005"]`；这一行只是指针，不是记录。
- 日期：2026-10-31
- 范围：项目级 ADR。任务级包参与适用于每个 mission，所以这个决策放在 `docs/decisions/`，
  不放在某个 mission 的收件箱。
- 后续：决策
  [0006](../../.cairn/missions/001-method-pack/inbox/0006-completion-integrity.md) 的工作流
  D3；Mission #2 的任务 T2 和验收 A3。

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

- `task_done` 必须携带 `packs` 记录，包含两个条目：superpowers 和 Impeccable。缺失或非法时，
  `cairn record` 拒绝追加 `task_done`。
- 每个任务固定两条：
  - **superpowers**——代码任务用 `test-first`，文档或混合任务用 `verify-before-close`。
    `mode: use` 要写明 skill 和具体证据；包缺失时 `mode: absent`，证据是地板。
  - **Impeccable**——有 UI 表面时用 `design-check`；否则 `design-review`，
    `mode: not-applicable` 并写原因。每个任务都要记录，不能省略。
- 台账记录就是证明。`cairn next` 明确要求执行者返回包记录；`cairn record --packs <file>`
  校验后写进 `task_done`。`evidence/<task>/packs.json` 下的详细任务报告是可选的。
- 每个 `evidence` 值都是 mission 相对路径，指向 mission 的 `evidence/` 下真实存在的文件，且必须
  通过 `isEvidenceFile`。文字声明不是证据。
- packet 仍然是上下文；台账和证据仍然是证明。这个 ADR 补的是任务级记录，不是把包报告变成
  闸门。

### 硬约束

- **superpowers**：每个 mission 至少有一个 `task_done` 的 superpowers 条目是 `mode: use`，
  且该条目的 `evidence` 通过 `isEvidenceFile`。对 `test-first`，证据文件要记录测试命令的
  RED 结果，随后是 GREEN 结果。
- **Impeccable**：只有 mission 声明没有 UI 表面，且收尾的 `review_result` 记录
  `ui_surface: none` 时，才允许全部 `not-applicable`。任何任务声明了标记、样式或组件文件时，
  至少有一个 `task_done` 带 `design-check` 且 `mode: use`。
- **absent**：同时要求 `reason` 和指向实际运行地板的 `evidence` 文件。

## 为什么

- 只有注入、没有必填的任务字段，任务可以零包参与而通过。Mission #1 就是这样。
- superpowers 按设计不写持久仓库产物：`task-start` 不写台账，progress journal 是外部
  scratch。Cairn 不记录，就什么都不剩。
- review 级 packs 回答的是“审查是否可靠”，不是“任务是否用了包”。owner 要的是后者，而且是
  每个任务。
- `withPacks` 已经有确定性的选择规则（代码 / UI / 文档）。缺的是记录和校验，不是选择。
- 必须通过 `isEvidenceFile` 的路径可以被运行时检查；自由文本声明不行。

## 后果

- 变更向后兼容。要求适用于从 T2 开始的 `task_done` 事件，也就是实现并记录本 ADR 的那个任务；
  人类批准记录在 Mission #2 `mission_created` 事件的 `approval_source` 里。T1 由决策 0006
  登记为 grandfather，Mission #1 的 8 个事件继续有效，不改写历史。
- 每个任务多一个包记录，其证据条目是真实文件。`cairn record` 多一条阻塞校验；没有包记录的
  任务变成未完成，而不是静默干净。
- Impeccable 的 `not-applicable` 会按任务可见并带原因，这对没有 UI 表面的仓库是正确结果。
- 这个 ADR 不实现变更。实现是 Mission #2 T2；协议文本在 T7 追平，T7 拥有
  `docs/protocol.md`。

## 备选方案

- **保持 review 级 packs。** 拒绝：owner 要的按任务关联无法证明，B7 自己的措辞也没满足。
- **相信模型会 invoke skill 并报告。** 拒绝：实现者声明不是证据；会话显示 packet 点名了
  skill，实际调用仍为 0。
- **把 superpowers vendor 进仓库。** 拒绝：违反 ADR 0002 和 0004；包保持外部，Cairn 拥有
  接缝。
- **只校验记录，不要求证据文件。** 拒绝：那会把文字声明当作证明，正是本 ADR 要关闭的缺陷。
