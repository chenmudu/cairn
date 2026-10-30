<!-- translation of .cairn/missions/001-method-pack/policy.md at the T2 commit; the English file is authoritative -->

# Policy — Mission #1

这是把运行时变成可用方法的 mission 的预先回答决策合同。人类在 2026-10-31 批准了 `.cairn`
布局、Mission #0 迁移和方法包形式。这些批准覆盖计划方向，但不等于自动批准每一次协议编辑。

## 布局与历史

- 运行时状态存放在 `.cairn/missions/<id>/`。`.cairn/cache/` 不提交。
- Mission #0 是迁移，不是重写。它的台账和证据保持字节一致；只有路径移动。
- 旧的 `missions/<id>/` 目录仍可解析，已有 checkout 不会被破坏。

## 双语规则

- 每个面向人的产物在同一个任务里交付中文 companion。
- 校验器或运行时解析的内容以英文为权威。中文 companion 永不改变机器检查字段。
- 源文件变化后，译本即过期。头部标明源文件和它翻译的任务或提交。

## 协议变更

- `docs/protocol.md` 只能通过 `mission_amended` 修改，带新旧 sha256 哈希、验收链接、原因和
  `approved_by: human`。
- `.cairn` 布局就是这样的变更：人类在 2026-10-31 批准。
- 不变量 3（哪个提交持有台账事件）不被静默重写。T7 记录决策；仍然需要人类修订。

## 预算与停止

- 每个任务三次尝试，每次尝试两轮修复。第三次失败把任务 park。
- 每个 tick 两小时墙钟时间。超时写 `task_parked`，`reason: budget_exhausted`。
- token 预算未设；测量本 mission，在 Mission #2 里定上限。
- 每完成三个任务和 mission 结束时，在开始下一个任务前运行里程碑审计。
- 步骤具有破坏性、安全敏感、写到仓库外、不可恢复、超预算或疑似目标漂移时，停止并 park，
  不要猜测。

## 命令

只允许运行 `node`、`pnpm`、`git` 和 `tsc`。`npx` 被排除，因为它访问网络。`git push`、发布、
重写历史、递归删除都被禁止。

## Rulings

每个没有人类参与的决定都记录为：

`Ruling: <决定了什么> — <为什么> — <错了会付出什么代价>`

没有记录的偏离就是秘密决定。这是协议违规。
