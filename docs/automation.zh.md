<!-- translation of docs/automation.md at the decision-routing loop; the English file is authoritative -->

# 自动化——目标守卫与会话审计

两个命令让方法变得可观测。它们是零依赖的 Node ESM，在仓库根目录运行。两者都不写 ledger。

## 开工前：`goal-check`

```bash
node scripts/goal-check.mjs                 # 可读报告
node scripts/goal-check.mjs --brief         # SessionStart 注入的锚点
node scripts/goal-check.mjs --json          # 机器可读
```

它读取 `mission.md`、`plan.md` 和 `ledger.jsonl`，然后打印：

- mission 的 intent 与 non-goals；
- 下一个任务（由 ledger 的 `task_done` 和 plan 的依赖推出）；
- 该任务服务的验收标准及其检查方式；
- 该任务的闸门；
- 验收覆盖表（`A# → 任务 id`）；
- 来自 `docs/decision-routing.md` 的决策路由规则：ADR 是 `docs/decisions/` 里的编号项目级
  决策；mission escalation 是关闭或阻塞某个 mission 验收、需要人类回答的决策，放在
  `.cairn/missions/<id>/inbox/`。`scripts/check-decisions.mjs` 执行这条规则。

退出码 1 表示停下：下一个任务没有 `serves` 链接、`serves` 指向未知验收、有验收标准无人覆盖、
没有可运行的任务，或者到了里程碑审计的时间。没有验收链接的任务不是工作，是尚未命名的漂移。

守卫也会执行审计节奏：距离上一个 `review_result` 已经完成三个任务，或者 mission 已完成但最后
一个 `task_done` 之后没有通过的审查，它都会退出 1 并指出是哪个检查点。完成 mission 且审查通过时
它退出 0 并打印 `Current task: none`；此时剩下的唯一写入是 `cairn record --mission-done`。

## 收工前：`audit-session`

```bash
node scripts/audit-session.mjs              # 最新的 ZCode 会话记录
node scripts/audit-session.mjs <file>       # 指定 model-io JSONL
node scripts/audit-session.mjs --strict     # verdict 为 drift 时退出 1
node scripts/audit-session.mjs --out report.md
```

它读取 ZCode `model-io-*.jsonl` 中最新的一次请求，报告四类信号。它不读消息最多的请求：
压缩后旧快照更大，审计旧快照会漏掉之后的工作。没有更晚的人类回合时，压缩摘要作为后续工作的
锚点；摘要之后还有人类回合时则跳过摘要，避免把重放的历史再判一次。mission 的 `evidence/`
下的写入是运行时产物，不算漂移。

| 信号 | 含义 |
|---|---|
| 目标纠正 | 人类不得不重述目标、定位或项目范围。守卫本应让这件事不必要。 |
| 无闸门声明 | 某一轮声称完成，但同一轮没有跑任何闸门。声明不是证据。 |
| 计划外写入 | `Write`/`Edit` 写到了没有任何任务声明的路径。除非有 ruling 或修订记录，否则就是漂移。 |
| 请求确认 | agent 把决定推回给人类。有些是合理的；这个数字是趋势，不是判决。 |

verdict 为 `drift` 表示存在无闸门声明或计划外写入；只有目标纠正或请求确认时为 `attention`；
否则为 `clean`。审计是诊断工具，只有 `--strict` 会把 `drift` 变成退出 1。会话记录包含完整对话，
不要提交进仓库。

`--mission <dir>` 提供 plan 声明的文件列表和 ledger，让审计能区分计划内与计划外写入。
默认是 `.cairn/config.json` 里的活动 mission（本仓库是 `.cairn/missions/001-method-pack`）。

## 接线

- **Skill**——`.zcode/skills/cairn-guard/SKILL.md` 要求 agent 开工前跑守卫、写决策前后跑决策
  检查、声称完成前跑审计。
- **Hook**——`.zcode/config.json` 在 `startup`、`clear`、`compact` 时运行
  `.zcode/hooks/session-start.mjs`，把 `goal-check --brief` 作为 `additionalContext` 注入；
  brief 从 `docs/decision-routing.md` 读取路由规则，新会话因此从仓库里的锚点开始。ZCode 的
  工作区 hook 可能需要信任；脚本在任何 harness 里都能单独运行。
- **脚本**——`scripts/check-decisions.mjs` 校验两个家、拒绝放错位置的编号决策，并作为 CI
  步骤。规则源是路由文档；脚本不保留第二份规则。
- **Agent 指令**——`AGENTS.md` 指向同一个检查。hook 是适配器，不是契约。

要停用 hook，从 `.zcode/config.json` 删除 `SessionStart` 条目即可；命令仍然可用。

## 边界

审计是对文本的启发式检查。它可能漏掉措辞特殊的声明，也可能误报合理的确认。它无法判断目标本身
是否正确，也无法证明某个闸门真的度量了要紧的东西。那仍然是人类检查点和 milestone 审计的职责。
