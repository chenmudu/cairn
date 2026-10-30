<!-- translation of .cairn/missions/001-method-pack/plan.md at the T3 amendment; the English file is authoritative -->

# 计划 — Mission #1

> 英文 frontmatter 是机器合同；本文件是解释性译本，不参与解析。任务状态以台账里的
> `task_done` 为准。

frontmatter 是机器合同：每个任务都有验收链接、声明的文件和至少一个阻塞闸门。任务顺序让基础
先落地，然后是方法包，最后是样例。

## 任务说明

- **T1** 是唯一允许移动 Mission #0 的任务。它用人类批准的修订更新协议布局，加入路径解析和
  `cairn init`，迁移目录，并证明旧 mission 仍能 validate 和 reconcile。
- **T2** 把双语从承诺变成检查。它覆盖 mission 合同、决策记录、guard skill 和 dispatch 模板。
- **T3** 写阶段映射：frame、plan、execute、review、close 和无人值守准备。每行指名一个
  superpowers 实践、一个 Impeccable 标准，以及一个 Cairn 产物或闸门。
- **T4** 让 playbook 可用：docs、code、workflow 的标准，以及 mission、task、review、ADR、
  handoff 的模板。
- **T5** 写操作手册：角色、命令、人工检查点和失败路径。
- **T6** 在一个真实的小 tick 上运行手册，记录台账和证据。样例证明手册可执行。
- **T7** 加入 `cairn review`，并记录 `task_started` 决策。协议不变量 3 仍然是一个单独的人类
  决定；这里不静默重写它。
- **T8** 是冷启动审查和 `mission_done`。mission 关闭前，全新会话必须只凭仓库解释这个方法。

## 包接入

顺序是先 superpowers、后 Impeccable；先后不强制，但每一步都要落在有证据的任务里，不能最后
一次性补。

- **T3** 对账三者产物，并用一个 superpowers 实践做自己的工作；记录包和 pin，或
  `absent, floor used`。
- **T4** 把 Impeccable 可迁移的标准蒸馏进仓库地板；UI 专用的 detector 和 live 留在外部。
- **T6** 在适用处用接入的包跑样例。
- **T7** 检测两个包，并把对应能力注入 dispatch packet；`packs` 块是协议修订。
- **T8** 从冷启动验证磨合，包括两个包都不在的情况。

## 已知依赖

T1 的协议修订和 T7 的不变量 3 决策都需要 `approved_by: human`。计划不把 agent 自己的批准当作
充分条件。

## 任务总表

| 任务 | 标题 | 服务 | 依赖 | 阻塞闸门 |
|---|---|---|---|---|
| T1 | 采用 `.cairn` 布局并迁移 Mission #0 | B1, B6 | — | typecheck, test, mission, legacy, reconcile |
| T2 | 让每个面向人的产物中英双份 | B2 | T1 | test, bilingual |
| T3 | 写融合 playbook 并对账两个包 | B2, B3, B7 | T2 | test, method |
| T4 | 加入标准和模板 | B3 | T3 | test, method |
| T5 | 写单 tick 操作手册 | B4 | T4 | test, workflow |
| T6 | 跑一个记录在案的样例 tick | B4 | T5 | test, example |
| T7 | 补上阻塞方法落地的运行时缺口 | B1, B3, B6, B7 | T6 | typecheck, test, mission |
| T8 | 冷启动审查与 mission 关闭 | B5, B7 | T7 | test, mission |
