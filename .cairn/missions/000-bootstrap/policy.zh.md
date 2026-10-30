<!-- translation of .cairn/missions/000-bootstrap/policy.md at the T2 commit; the English file is authoritative -->

# Policy — Mission #0

本文件是预先回答好的决策合同。在一个 tick 内，只有下面的停止条件需要升级；其余决定都记录为台账里的 ruling。

## 预算

- 每个任务三次尝试，每次尝试两轮修复。第三次失败把任务 park。
- 每个 tick 两小时墙钟时间。超时写 `task_parked`，`reason: budget_exhausted`。
- M0 不设 token 预算。先测量，M1 再加硬上限。
- 每完成三个任务，以及 mission 结束时，在开始下一个任务前运行 `docs/drift-control.md` 里的里程碑审计。

## 目标完整性

- 没有 `serves: [A#]` 链接的任务不开始。
- 目标产物（`mission.md`、`policy.md`、`plan.md`、`docs/protocol.md`）只能通过
  `mission_amended` 修改，事件带新旧哈希。在 `cairn record` 实现该事件之前（T-002），
  修订以携带相同字段的 `ruling` 记录。
- 没有验收链接的修订会让 mission park。疑似目标漂移、验收标准不可达、未经修订削弱闸门，
  也会 park。

## 命令

只允许运行 `node`、`pnpm`、`git` 和 `tsc`。M0 排除 `npx`，因为它会访问网络。需要其他命令的闸门
必须先修订本文件。

`git push`、发布、重写历史、递归删除都被禁止。它们也是停止条件：任务看起来需要这些操作时，
park 它。

## 停止条件

出现以下情况时，tick 停止并 park 任务，绝不猜测：

1. 下一步不可逆或具有破坏性。
2. 下一步涉及安全敏感内容（凭据、认证、签名、权限）。
3. 下一步要写到本仓库之外。
4. 计划无法执行，且每条前进路径都是猜测。
5. 疑似目标漂移：工作不再映射到验收标准，或者任务碰了非目标。
6. 验收标准在预算内看起来不可达。
7. 未经说明其仍能证明什么的修订，就削弱了闸门。

预算耗尽也是停止条件：park，不要即兴发挥。

## 升级默认值

- 缺少上下文：先读仓库；只有答案不在文件里时才问。
- 需求有歧义：选择与 mission 非目标一致的保守方案，并记录 `ruling`。
- 闸门不可能通过：park。不要为了让其通过而削弱闸门。
- 依赖冲突：park。不要静默升级或降级依赖。
- 目标冲突：park。目标不是 agent 可以重新谈判的；记录冲突。
- 没有验收链接的修订：park。服务不了任何东西的改动就是漂移。

## Rulings

每个没有人类参与的决定都记录为：

`Ruling: <决定了什么> — <为什么> — <错了会付出什么代价>`

没有记录的偏离就是秘密决定。这是协议违规。
