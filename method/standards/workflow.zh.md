<!-- translation of method/standards/workflow.md at the T4 commit; the English file is authoritative -->

# 流程标准

- 来源：Cairn 协议和活动 mission 合同；superpowers 7.0.1 提供执行纪律；Impeccable
  4.8.0+df3a4ab 只在存在 UI 表面时使用。
- 固定版本：cairn/standards@0.1；superpowers 7.0.1；Impeccable 技能 4.8.0 / 引擎 0.1.18 /
  源码 df3a4ab。

## 一个 tick

1. `node scripts/goal-check.mjs` 说出下一个任务、它的 `serves` 链接和闸门。
2. `cairn next` 打印 packet：任务、文件、闸门、约束、base 提交和 packs。
3. 做工作。任务改变行为时先写测试。
4. `cairn verify <task>` 跑每个阻塞闸门并写证据。
5. 提交工作、证据和 `gate_result` 事件。
6. `cairn record <task> --status done` 追加 `task_done`。
7. `cairn reconcile` 对照 git 和证据检查台账。

任务只有三样同时成立才算完成：提交、阻塞闸门退出 0、`task_done`。

## 文件和范围

- 只写任务声明的文件。清单之外的写入需要 ruling 或计划修订；它不是静默添加。
- 说不出它推进哪条验收标准的任务，不开始。
- 一个 tick 最多推进一个任务。不要把两个任务塞进一个提交。

## 包

- 每个任务报告写明用了哪个包和 pin，或者 `not-applicable` 加原因，或者
  `absent, floor used`。
- 包的报告是输入。闸门和台账才是证明。
- 包可以保留适配器本地临时状态。它永远不是第二事实源；`cairn reconcile` 比较它和台账，
  台账赢。
- 回退可执行时，缺包不是阻塞。验收标准明确要求该包能力时，缺包才是 escalation。

## 失败路径

- 阻塞闸门失败就停止 tick。记录命令、退出码和下一步；不记 `task_done`。
- 阻塞性问题是一次 escalation，任务 parked。没有人类参与的决定是 ruling，记录下来。
- 没有人类不 push、不发布、不改写历史、不跑破坏性命令。
- 审计检查跑不了时，记录失败和替代证据。永不把没跑的检查报告为通过。

## Impeccable

- 这个仓库没有 UI。design-check 行是 `not-applicable`；仓库内清单是回退。
- 存在 UI 表面时，`detect` 是确定性检查，`critique` 是人在环。Markdown 上空的 `detect`
  结果不是通过。
