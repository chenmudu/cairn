<!-- translation of method/playbook.md at the T3 commit; the English file is authoritative -->

# 融合 playbook

这是方法的可执行地图。每个阶段都指名一个 Cairn 地板、让它更好的 superpowers 实践、适用的
Impeccable 标准、让 Cairn 保持事实源的接缝，以及一个具体回退。
`node scripts/check-method.mjs --playbook` 解析英文文件里的 JSON 块；本文件是同一张图的中文
解释，不参与解析。

这个 mission 里第一次使用 superpowers 是 `test-driven-development`，用于
`scripts/check-method.mjs`；证据是 `test/method.test.mjs`，记录在 `packs_used`。
Impeccable 已安装，但这个仓库没有 UI 表面，所以它的设计检查是带原因的 `not-applicable`，
不是“干净”。

## 阶段图

| 阶段 | Cairn 地板 | superpowers | Impeccable | 接缝 | 状态 |
|---|---|---|---|---|---|
| frame | README 定位 + mission 的意图、非目标、验收；`goal-check` | `brainstorming` @ 7.0.1，人在环 | `init`/`document`，not-applicable（无 UI） | Cairn 拥有 `mission.md` | exists |
| plan | 带 serves、文件、闸门的 `plan.md`；`goal-check` 覆盖图 | `writing-plans` @ 7.0.1 | `document`，not-applicable（无 UI） | Cairn 计划是权威 | exists |
| execute | 提交 + 阻塞闸门 + `task_done`；`cairn verify` | `test-driven-development` @ 7.0.1 | `detect`，not-applicable（markdown 返回 `[]`） | RED→GREEN 进入 `gate_result` | exists |
| review | 全新上下文审查者 + `review_result`；`cairn review` | `requesting-code-review` @ 7.0.1 | `critique`/`audit`，not-applicable（只适用 web，会问用户） | findings → `review_result` | planned:T7 |
| close | `cairn record`、`mission_done`、`audit-session` | `verification-before-completion` @ 7.0.1 | `polish`/`harden`，not-applicable（无 UI） | 绿色闸门 ≠ 目标 | exists |
| state | `ledger.jsonl` 是唯一事实 | `executing-plans` @ 7.0.1 | 无，not-applicable | 日志是临时状态；台账赢 | exists |
| design-check | 仓库内清单；UI 维度 not-applicable | 无，not-applicable | `detect`，not-applicable（无 markup/URL） | 空 `[]` 不是干净 | exists |
| handoff | dispatch packet + report | `subagent-driven-development` @ 7.0.1 | 无，not-applicable | 一个 packet，不写台账 | exists |
| unattended | packet + policy 停止条件 + 单 tick；Mission #2 加循环 | `executing-plans` @ 7.0.1，人在环 | 无，not-applicable | policy 停止条件是 Cairn 的 | exists |

## Pin

- superpowers `7.0.1`。
- Impeccable 技能 `4.8.0`，源码 `df3a4ab`，引擎 `0.1.18`。playbook 的 pin
  `4.8.0+df3a4ab` 命名技能和源码；`check-method --packs` 单独报告已安装引擎。
