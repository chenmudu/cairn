<!-- translation of .cairn/missions/001-method-pack/mission.md at the T3 amendment; the English file is authoritative -->

# 让方法真正落地

- **Schema**：`cairn/mission@0.1`
- **Mission**：`001-method-pack`
- **状态**：进行中
- **创建**：2026-10-31
- **Owner**：chenmudu

## 验收标准

- **B1**：`cairn init` 创建 `.cairn/missions/<id>`；`cairn` 优先解析 `.cairn/missions/<id>`，
  同时保留 `missions/<id>` 回退；Mission #0 迁移后 validate 和 reconcile 都退出 0；协议修订
  带 `approved_by: human`。
- **B2**：每个面向人的文件都有中文 companion；`node scripts/check-bilingual.mjs` 退出 0；
  `docs/i18n.md` 反映当前状态。
- **B3**：`node scripts/check-method.mjs` 退出 0；playbook 把每个阶段映射到 superpowers 实践、
  Impeccable 标准、Cairn 产物或闸门；标准和模板中英双份。
- **B4**：`docs/workflow.md` 覆盖角色、单 tick 步骤、人工检查点和失败路径；新人只读手册能跑一个
  dry tick；`method/examples` 里有一个带台账和证据的真实样例。
- **B5**：全新上下文的审查者只凭仓库说出目标、`.cairn` 布局、下一个任务和单 tick 流程；
  `review_result` 为 pass。
- **B6**：`node --test` 通过；迁移后 Mission #0 的台账和证据仍然 validate、reconcile；没有阻塞
  闸门被削弱。
- **B7**：两个包与 Cairn 磨合完成；`check-method --packs` 报告可用性；`cairn next` 注入对应
  能力；任务证据记录 used、not-applicable 或 absent 加 floor 回退；至少一个 tick 记录
  superpowers 用于执行，一个 tick 记录 Impeccable 用于审查（没有 web 界面时按标准审查），
  各自带 pin 和证据；`check-method --products` 退出 0；两个包都不在时所有闸门仍然通过。

## 意图

Mission #0 证明了运行时能承载自己的交付。它没有交付方法本身：superpowers 与 Impeccable 的融合、
产物布局、双语文档、操作流程都没有。这个 mission 用产品补上这个缺口，不再增加运行时机制。

方法是项目本身。Cairn 是它的第一个产物。这个 mission 产出方法包，并用它构建自己，让下一个人只凭
仓库就能开始。

包是方法的一部分，不是装饰：Cairn 检测它们，在它们更好时使用它们，在它们缺失时保留简单的
地板。

## 非目标

- 不做 UI、数据库、托管服务。
- 不 vendor、不合并 superpowers 或 Impeccable 仓库。它们保持外部内容源，按版本引用。
- 不做无人值守调度器或多 tick 循环。那是 Mission #2。
- 不重写 Mission #0 的台账、证据或历史。它保持关闭且有效。
- 不做计划之外的新运行时功能。
- 没有 `approved_by: human` 不改协议。

## 约束

- `.cairn/missions/<id>/` 存放 mission、policy、plan、ledger、evidence 和 inbox。
  `.cairn/cache/` 永不提交。
- 英文是机器检查合同的权威。每个面向人的产物都有中文 companion。译本永不覆盖英文文件。
- 任务只有在提交存在、阻塞闸门退出 0、台账里有 `task_done` 时才算完成。
- 一个 tick 最多推进一个任务。
- Mission #0 是历史。它的台账不编辑；运行时只从新路径读取它。

## 验收

- **B1**：`.cairn` 布局真实可用，`cairn init` 可用，旧路径仍可解析，协议修订经人类批准。
- **B2**：双语是可检查的承诺，不是口头声明：每个面向人的产物有中文 companion，检查退出 0。
- **B3**：融合 playbook 把每个阶段映射到 superpowers 实践、Impeccable 标准、Cairn 产物或闸门；
  标准和模板让它可用。
- **B4**：新人只读操作手册就能跑一个 tick；一个记录在案的样例证明手册可执行。
- **B5**：全新会话只凭仓库说出目标、布局、下一个任务和单 tick 流程。
- **B6**：迁移不削弱运行时：既有测试通过，Mission #0 仍然 validate、reconcile。
- **B7**：两个包磨合完成：检测、注入、记录使用、`not-applicable` 或回退；至少各有一个真实
  tick 使用；一次能解析每个 playbook 行的产物对比；两个包都不在时所有闸门仍然通过。

## 当前动作

台账是唯一事实源。开始前运行
`node scripts/goal-check.mjs .cairn/missions/001-method-pack`；先读 [`inbox/`](inbox/)。
下一个任务由台账和计划推出，永远不由本节缓存。
