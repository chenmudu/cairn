<!-- translation of docs/automation.md at the Mission #2 T6 revision; the English file is authoritative -->

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

它读取 ZCode `model-io-*.jsonl` 中最新的一次请求，报告六类信号。它不读消息最多的请求：
压缩后旧快照更大，审计旧快照会漏掉之后的工作。没有更晚的人类回合时，压缩摘要作为后续工作的
锚点；摘要之后还有人类回合时则跳过摘要，避免把重放的历史再判一次。mission 的 `evidence/`
下的写入是运行时产物，不算漂移。

| 信号 | 含义 |
|---|---|
| 目标纠正 | 人类不得不重述目标、定位或项目范围。守卫本应让这件事不必要。 |
| 无闸门声明 | 某一轮声称完成，但同一轮没有跑任何闸门。声明不是证据。 |
| 计划外写入 | `Write`/`Edit` 写到了没有任务声明、也没有 `authorization` 覆盖的路径。除非有 ruling、修订或授权记录，否则就是漂移。 |
| 无对应写入的授权 | `authorization` 点名的路径没有被任何写入触碰。计划中的写入没有发生。 |
| 禁用命令 | `Bash` 命令命中 `forbidden_commands`，且没有精确匹配的 `approved_exceptions`。 |
| 请求确认 | agent 把决定推回给人类。有些是合理的；这个数字是趋势，不是判决。 |

verdict 为 `drift` 表示存在无闸门声明、计划外写入或禁用命令；只有目标纠正、请求确认或未使用的
授权时为 `attention`；否则为 `clean`。审计是诊断工具，只有 `--strict` 会把 `drift` 变成退出 1。
会话记录包含完整对话，不要提交进仓库。

`--mission <dir>` 提供 plan 声明的文件列表、ledger、`authorization` 事件，以及 policy 的禁用
命令和已批准例外，让审计能区分计划内与计划外写入、被覆盖与违规的命令。默认是
`.cairn/config.json` 里的活动 mission（本仓库是 `.cairn/missions/002-completion-integrity`）。

## 规则、检查与注入

四件不同的事，不能互换：

| 层 | 作用 | 能否强制 | 位置 |
|---|---|---|---|
| 权威规则 | 只在一个地方陈述事实。 | 否 | `docs/*.md` |
| Script / test / CI | 判定通过或失败。 | 是 | `scripts/`, `test/`, `.github/workflows/gates.yml` |
| Hook | 在 session 开始、prompt 提交或 stop 时注入短锚点。 | 否 | `.zcode/hooks/`, `.zcode/config.json` |
| Skill | 在决策点给出程序。 | 否 | `.zcode/skills/<name>/SKILL.md` |
| `AGENTS.md` | 常驻兜底指针。 | 否 | `AGENTS.md` |
| Human / review | 判断不能机械化的东西。 | 是，靠权威 | `review_result`、inbox escalation |

注入让规则被知道；只有 script、test、CI 或 human/review 检查点让规则有约束力。只有注入没有
执行，是建议；只有执行没有注入，是埋伏。`docs/drift-control.md` 是执行地图；本文件是注入
地图。

ZCode 先加载用户 `AGENTS.md`，再加载一个 workspace `AGENTS.md`。它不合并多个 workspace 指令
文件，所以 workspace 文件是路由器：规则放 `docs/`，`AGENTS.md` 指向它们。Hook 支持七个事件；
本仓库用 `SessionStart` 做锚点，保留 `Stop` 做有界的尾部提醒。`Stop` hook 最多可以请求三次
continuation，所以它不是闸门。

Skill 是目录。`SKILL.md` 是 SOP；参考材料放 `docs/` 或 skill 的 `references/`；可执行检查在
共享时放 `scripts/`，私有则放 skill 的 `scripts/`。SOP 只点名检查，不粘贴脚本或文档。

## 接线

- **Skill**——`.zcode/skills/cairn-guard/SKILL.md` 要求 agent 开工前跑守卫、写决策前后跑决策
  检查、改规则执行点前后跑 enforcement 检查、声称完成前跑审计。
- **Hook**——`.zcode/config.json` 在 `startup`、`clear`、`compact` 时运行
  `.zcode/hooks/session-start.mjs`，把 `goal-check --brief` 作为 `additionalContext` 注入；
  brief 从 `docs/decision-routing.md` 读取路由规则，新会话因此从仓库里的锚点开始。ZCode 的
  工作区 hook 可能需要信任；脚本在任何 harness 里都能单独运行。
- **脚本**——`scripts/check-decisions.mjs` 校验两个决策家并拒绝放错位置的编号决策；
  `scripts/check-enforcement.mjs` 校验失败模式表的机器语法和中文 token 对等；
  `scripts/check-targets.mjs` 重建活动 mission 的目标哈希链，并与工作树比较。三者都是 CI
  步骤并读取各自的规则源；都不保留第二份规则。
  `check-targets` 只作用于活动 mission：已关闭 mission 的哈希描述它关闭时的树，不是后来的
  工作树，所以后续 mission 移动共享协议后，不会回头重查它。
- **Agent 指令**——`AGENTS.md` 指向同一批检查，并保持为路由器。hook 是适配器，不是契约。

要停用 hook，从 `.zcode/config.json` 删除 `SessionStart` 条目即可；命令仍然可用。

## 边界

审计是对文本的启发式检查。它可能漏掉措辞特殊的声明，也可能误报合理的确认。它无法判断目标本身
是否正确，也无法证明某个闸门真的度量了要紧的东西。那仍然是人类检查点和 milestone 审计的职责。
