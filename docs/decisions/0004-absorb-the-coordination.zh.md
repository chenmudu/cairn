<!-- translation of docs/decisions/0004-absorb-the-coordination.md at the decision commit; the English file is authoritative -->

# 0004 — 吸收协调层，不吸收包

- 状态：已接受
- 日期：2026-10-31

## 背景

决策 0002 定下了归属：superpowers 和 Impeccable 保持外部，按引用消费，Cairn 保留唯一的台账。
它没有回答“只有包才提供的能力”怎么办——superpowers 的进度台账、子 agent 编排、Impeccable 的
detector、浏览器 critique、live 模式。

最初的答案是“包不在就跳过”。这是错的。它让方法受制于一次安装，也在包存在时让包的状态无人
协调。正确的模型是三层：

1. **地板**——仓库内简单、始终可运行的版本，让方法继续走。
2. **包**——更好的实现，pin 住，可选。
3. **接缝**——把包的状态映射成 Cairn 状态、并决定谁赢的协调层。接缝归 Cairn。

人类在 2026-10-31 做了这个判断：地板是我们的，包在时更好，第二套账本必须有人协调。那个人
就是 Cairn。

## 决定

Cairn 是包与工作之间的协调层。

- **没有孤儿能力。** Cairn 使用的每个包能力都要登记：包与 pin、Cairn 归属产物、协调合同、
  简单回退、必选或可选。不在登记表里的能力不使用。
- **包可以保留自己的工作状态。** 那是适配器本地状态。Cairn 协调它、记录分歧，并保持自己是
  完成状态的唯一事实源。
- **回退必须可执行。** 它是有命令或产物的真实实践，不是占位符。它让方法继续走，但不冒充包。
- **包在也不能绕过闸门。** 包的报告是输入，`cairn verify` 才是证据。
- **缺失要记录，不隐藏。** 任务要写明用了哪个包和 pin，或者写 `absent, floor used`。
- **必需能力要升级。** 如果验收标准明确要求某个包能力，而包缺失或版本不符，park 并升级。
  不要用回退冒充包的结果。
- **检测，不靠记忆。** Cairn 检测包是否可用，并把结果注入任务。模型不是“装了什么、该用哪套
  流程”的权威。

决策 0002 仍然有效：不 vendor、不合并、不设第二套台账。0004 增加：没有回退就不能跳过能力，
包的状态不能无人协调。

## 登记表

初始登记表放在 `method/playbook.md`，由 `check-method` 检查。它的行：

| 能力 | 包与 pin | Cairn 归属 | 协调合同 | 简单回退 |
|---|---|---|---|---|
| 流程计划 | superpowers `writing-plans`、`executing-plans` @ 7.0.1 | `plan.md`、`cairn next` | 包在一个任务内做计划；packet 是边界 | 手写计划 + `goal-check` |
| 测试先行 | superpowers `test-driven-development` @ 7.0.1 | `test` 闸门 | RED→GREEN 证据进入 `gate_result` | 先写测试，再跑闸门 |
| 验证 | superpowers `verification-before-completion` @ 7.0.1 | `cairn verify` | 没有闸门证据的声明被拒绝 | 运行闸门 |
| 审查 | superpowers `requesting-code-review` @ 7.0.1 | `review_result` | findings 映射为结论；阻塞项阻塞 | 仓库内审查清单 |
| 子 agent | superpowers `dispatching-parallel-agents`、`subagent-driven-development` @ 7.0.1 | dispatch packet + report | 一个任务一个 packet；报告聚合；不写台账 | 单 agent 串行执行 |
| Worktree | superpowers `using-git-worktrees` @ 7.0.1 | `base`/`head`、一个活动任务 | 一个任务一个 worktree；`reconcile` 检查提交 | 单分支串行 |
| 进度台账 | superpowers `.superpowers/sdd/<plan>/progress.md` @ 7.0.1 | `ledger.jsonl` | 协调器把 `task-start`/`task-done` 映射成 Cairn 事件；分歧成为 finding | `cairn next/verify/record` |
| 设计上下文 | Impeccable `PRODUCT.md`/`DESIGN.md` @ 4.8.0 | mission/product 上下文 | 只引用一次；不复制 token 源 | 仓库内产品/设计 brief |
| 确定性设计检查 | Impeccable `detect`（62 条规则）@ 4.8.0 | 闸门证据 | JSON 映射为证据；error/warning/advisory 映射为 block/advisory | 仓库内清单 |
| 设计审查 | Impeccable `critique`/`audit` @ 4.8.0 | `review_result` | P0–P3 映射为 findings；只有约定严重度阻塞 | 仓库内审查清单 |
| Live 与 hook | Impeccable `live`、hooks @ 4.8.0 | 不在协议内 | 只用于人在环；永不走完成路径 | 显式 CLI + 证据 |

## 检测与激活

只写文档，仍然靠模型记得去读。接缝必须是可运行的：

1. **检测。** `check-method --packs`（以后是 `cairn packs`）检查配置路径和已知安装位置，读取
   版本，报告 `present`、`invocable`、`pinned`。检测是确定性的、advisory 的，永不阻塞闸门。
2. **注入。** `cairn next` 在 dispatch packet 里带一个 `packs` 块。对任务用到的每个能力，写明
   包、pin、路径、确切的 skill 或命令，以及回退。适配器收到的是指令，不是参考书目。
3. **记录。** 适配器报告写明用了哪些包、有什么偏离。包缺失就写 `absent, floor used`。
4. **校验。** 包的输出成为证据；`cairn verify` 仍是证明。`cairn reconcile` 检查包侧状态和
   台账是否一致。

这就是“方法提到 superpowers”和“运行时把 superpowers 交到执行者手里”的区别。模型仍然执行；
但它不是“存在什么、什么算完成”的权威。

具体激活：

- **superpowers**：packet 写明 `superpowers:test-driven-development` @ 7.0.1 和 skill 路径。
  适配器调用 skill 或读它；输出是测试和闸门证据。安装根目录从 `CAIRN_SUPERPOWERS_DIR` 开始找，
  然后是 harness 插件缓存。
- **Impeccable**：packet 写明从 pin 的 checkout 运行 `impeccable detect --json`，命令是
  `node cli/bin/cli.js detect --json`。运行时绝不用 `npx`：它访问网络，违反 policy。Detector
  JSON 成为证据。
- **回退**：每条注入指令都带回退命令或清单，所以包缺失时得到的是计划好的路径，不是即兴发挥。

检测路径是配置，不是硬编码的机器路径。两个包都不在的仓库仍然要通过所有闸门；检测报告缺失，
packet 写 `absent, floor used`。

`packs` 块会改变 packet 和 report schema。那是协议修订，需要 `approved_by: human`。在它落地
之前，playbook 和 dispatch 模板把它作为扩展携带；运行时注入是计划中的，不是静默加入的。

## 样例：第二套台账

superpowers 执行任务时，可能保留 `.superpowers/sdd/<plan>/progress.md`，并运行自己的
`task-start`/`task-done` 脚本。Cairn 不假装这个文件不存在，也不让它变成第二个事实源。

- 协调器从 Cairn packet 启动适配器。
- 适配器返回报告，可以保留自己的日志。
- 协调器在 `ledger.jsonl` 记录 `task_started`、`gate_result`、`task_done`。
- `cairn reconcile` 比较适配器日志和台账；缺失或多余条目是 finding，不是静默覆盖。
- Cairn 台账赢。日志是证据，或者在协调后丢弃。

没有 superpowers 时，同一个循环用 `cairn next`、`cairn verify`、`cairn record` 运行。这就是
简单版，足够走完。

## 样例：设计标准

包在时，Impeccable 的 detector 和 critique 比手写清单更好。

- `PRODUCT.md` 和 `DESIGN.md` 作为上下文引用，永不复制进 mission 文件。
- Detector JSON 成为闸门证据；严重度映射固定在 policy 里，不按次决定。
- `critique`/`audit` 的 findings 成为 `review_result`；只有 policy 约定的严重度可以阻塞。
- 没有 Impeccable 时，用仓库内标准。如果 UI 验收明确要求 detector，缺失是升级，不是清单
  通过。

## 后果

- `method/playbook.md` 把每个阶段映射成三列：Cairn 地板、包增强、接缝。`check-method` 拒绝
  缺少地板或回退的行。
- `method/standards` 是 docs、code、workflow 的地板；Impeccable 增强 UI 部分。
- T3 加 `check-method --packs`；T7 加 packet 注入和 `cairn review`。packet/report schema 的
  变更走人类批准的协议修订。
- 登记表先落文档，但检测不是：检查器每次运行都报告可用性，缺包是可见的，不是假设的。
- 方法在零包时可执行。包让它更好，不是让它可行。
