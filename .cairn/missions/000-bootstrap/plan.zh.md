<!-- translation of .cairn/missions/000-bootstrap/plan.md at the T2 commit; the English file is authoritative -->

# 计划 — Mission #0

> 英文 frontmatter 是机器合同；本文件是解释性译本，不参与解析。任务状态以台账里的
> `task_done` 为准，本文件里的 `status` 只是历史标注。

## 修订记录

- 2026-10-31 第一次修订：每个任务声明 `serves`；T-002 加入验收覆盖和
  `mission_amended`；T-003 使用 `--expect-invalid`；T-005 加入里程碑审计。修订以带新旧哈希的
  ruling 记录。
- 2026-10-31 第二次修订：T-006（目标守卫与会话审计）提前到 T-002 之前，T-002 依赖它。
  本文件里的任务状态是建议性的；状态由台账的 `task_done` 决定。

一个任务是自带闸门、提交和验收链接的最小单位。按顺序执行；每个任务的 interface 块是下一个
任务可以依赖的内容。

## 任务总表

| 任务 | 标题 | 服务 | 阻塞闸门 | 结果 |
|---|---|---|---|---|
| T-001 | 协议 schema 与校验器 | A1 | validate | 已交付 |
| T-002 | 台账与 CLI 骨架 | A2, A6, A8 | typecheck, test | 已交付 |
| T-003 | verify 与闸门注册表 | A3 | test, fixture | 已交付 |
| T-004 | 通用适配器与 dispatch packet | A3, A7 | typecheck, packet | 已交付 |
| T-005 | 自举第一个 tick | A3, A4, A5, A7 | test, reconcile | 已交付 |
| T-006 | 目标守卫与会话审计 | A5, A7 | test, goal, validate | 已交付 |
| T-007 | 稳定 mission 结束时的测试 | A5, A7 | test | 已交付 |
| T-008 | mission 完成与审计节奏 | A3, A7 | test, goal | 已交付 |

## T-001 — 协议 schema 与校验器

**目标**：在任何运行时代码之前，让协议可以被机器检查。

**交付物**：零依赖的 Node ESM 脚本 `scripts/validate-mission.mjs`，校验一个 mission 目录：

- `mission.md`、`policy.md`、`plan.md` 的必填 frontmatter 字段；
- 任务 id 唯一、依赖可解析、状态合法；
- 每个任务至少有一个 `severity: block` 闸门；
- `ledger.jsonl` 每行是一个 JSON 对象，事件名已知；
- 每个 `task_done` 带 `base`、`head` 和至少一个退出 0 的阻塞闸门；
- 台账引用的每个证据路径都存在。

同时加入 `package.json`（`"type": "module"`，无依赖）。

**闸门**：`node scripts/validate-mission.mjs missions/000-bootstrap`

**完成条件**：命令在本 mission 上退出 0，在缺少闸门的 fixture 上退出非 0。交付时带
`test/validate-mission.test.mjs` 和 `test/fixtures/missing-gate/`。

## T-002 — 台账与 CLI 骨架

**目标**：台账只有一个写入者，计划可读，验收映射显式。

**交付物**：`src/ledger.ts`、`src/plan.ts`、`src/cli.ts`、`tsconfig.json`。命令：

- `cairn status [--json]`：从台账推导任务状态，输出验收覆盖图（`A# → 任务 id`）；未覆盖的
  验收标准会被报告，不隐藏。
- `cairn next`：返回台账中第一个未完成、且依赖已完成的任务，作为 dispatch packet 打到
  stdout；没有时退出 2。
- `cairn record <task> --status done`：只有提交存在、阻塞闸门退出 0、任务声明了有效
  `serves`、证据文件存在时才写 `task_done`。

`appendEvent` 是唯一写路径：追加一行并 fsync；支持 `mission_amended`（新旧哈希、验收、原因、
批准者），拒绝非单调时间戳。

**闸门**：`pnpm typecheck` 和 `node --test`

**完成条件**：`cairn record T-002 --status done` 因缺证据被拒绝，拒绝信息指出缺失条件；
`cairn status --json` 输出的覆盖图中，每条验收要么有任务，要么显式标为缺失。

## T-003 — verify 与闸门注册表

**目标**：运行时自己跑闸门；实现者的报告不是证据。

**交付物**：`src/gates.ts`、`src/verify.ts` 和测试。`cairn verify <task>`：

- 从 `plan.md` 读取任务的闸门；
- 以固定 argv、超时和输出上限运行每个闸门；
- 写 `evidence/<task>/<gate>.json`（命令、argv、退出码、耗时、尾部输出）；
- 每个闸门追加一个 `gate_result`；
- 任何阻塞闸门失败时退出 2。

给 `scripts/validate-mission.mjs` 加 `--expect-invalid`：mission 被拒绝时退出 0，被接受时退出 1，
这样故意无效的 fixture 也能当阻塞闸门。

advisory 闸门会被记录，但永不改变退出状态。

**闸门**：`node --test` 加上
`node scripts/validate-mission.mjs --expect-invalid test/fixtures/missing-gate`。

**完成条件**：失败的闸门写退出 1，`cairn record` 仍然拒绝；advisory 失败不阻塞；无效 fixture
因为被拒绝而通过。

## T-004 — 通用适配器与 dispatch packet

**目标**：任何编码 agent 都能从文件执行任务，不需要 Cairn 专用运行时。

**交付物**：`docs/adapter.md`、`templates/dispatch.md`、`src/packet.ts`。packet 包含 mission
目标、任务服务的验收标准（`serves`）、policy、约束、闸门、台账尾部和 base 提交。适配器合同返回
`docs/protocol.md` 定义的 JSON 报告；它永不写台账。

**闸门**：`pnpm typecheck` 和 `node --test test/packet.test.ts`

**完成条件**：`cairn next` 的输出符合文档中的 packet schema；packet 指明任务服务的验收标准；
人类可以把 `templates/dispatch.md` 交给另一个编码 agent 并拿回报告。

## T-005 — 自举第一个 tick

**目标**：证明协议能承载自己的开发，包括目标保真。

**交付物**：通过循环写出 `docs/self-hosting.md`：`cairn next` 选中 T-005，一个全新 agent 按
packet 执行，`cairn verify` 跑闸门，`cairn record` 追加 `task_done`。不手改台账。然后运行
`docs/drift-control.md` 的里程碑审计，记录为 `review_result`。

**闸门**：`node scripts/validate-mission.mjs missions/000-bootstrap`

**完成条件**：台账里 T-005 有 `task_started`、`gate_result`、`review_result`、`task_done`；
`cairn status` 显示 mission 完成；冷启动测试通过；审计结论为 `pass`。

> 历史注记：实际交付时没有 `task_started` 写入者，T-005 的审查也晚于 `task_done`。终审在
> `2026-10-30T20:45:39.492Z` 的 ruling 中接受这一历史缺口，并以 `2026-10-30T20:52:40.670Z`
> 的 `review_result` 通过。Mission #1 的 T7 处理这个写入者缺口。

## T-006 — 目标守卫与会话审计

**目标**：让目标对齐和漂移可以通过命令观察，而不是靠人的记忆。

**交付物**：两个零依赖脚本和一个共享读取器：

- `scripts/goal-check.mjs` 读取 mission、plan、ledger，打印 mission 意图、下一个任务、它的
  `serves` 链接、验收检查、闸门、非目标和覆盖图。下一个任务没有有效 `serves`，或有验收标准
  无人覆盖时退出 1。`--brief` 是 SessionStart 形式；`--json` 给工具用。
- `scripts/audit-session.mjs` 读取 ZCode `model-io-*.jsonl`，报告：人类的目标纠正、同一轮没有
  跑闸门的完成声明、计划声明文件之外的写入、把决定推回人类的确认请求。它是诊断工具，不是闸门；
  `--strict` 让关键信号退出 1。
- `scripts/validate-mission.mjs` 导出 `readMission(dir)`，让校验器和守卫共用一个解析器。

把守卫接进 harness，但不让 harness 成为依赖：`.zcode/skills/cairn-guard/SKILL.md` 告诉 agent
何时运行脚本；`SessionStart` hook 把 `goal-check --brief` 作为附加上下文注入。其他 harness 可以
直接运行同样的脚本；hook 是适配器，不是合同。

同一个任务加入 `docs/i18n.md` 的双语合同：英文是机器检查合同的权威；中文 companion 标明它翻译
的提交，不做哈希冻结，永不覆盖英文文件。README、protocol、drift control 和本计划的说明先有
companion；其余登记为待办，不静默地半翻译。

**闸门**：`node --test`、`node scripts/goal-check.mjs missions/000-bootstrap`、
`node scripts/validate-mission.mjs missions/000-bootstrap`。

**完成条件**：goal check 说出下一个任务和 `serves`；audit 能从 transcript 复现本会话的漂移信号；
全新会话通过 hook 或 skill 得到锚点，不需要之前的对话。

## T-007 — 稳定 mission 结束时的测试

**目标**：任务全部完成后，测试仍然可运行，不依赖“当前还有任务”这一假设。

**交付物**：用临时 mission 和状态无关断言重写 `test/goal-check.test.mjs`；增加完整 mission 在
最后 `task_done` 之后有通过审查的测试。

**闸门**：`node --test`

**完成条件**：Mission #0 完成前后，测试都通过；没有测试依赖真实台账的当前任务。

## T-008 — mission 完成与审计节奏

**目标**：补上终审发现的缺口：协议定义了 `mission_done`，但没有命令写它；守卫也不强制三任务
审计节奏。

**交付物**：`src/complete.ts` 和 `cairn record --mission-done`。命令只在以下条件全部满足时写入：
每个任务完成、每条验收都有带证据的完成任务、最后一个 `task_done` 之后存在 `pass` 的
`review_result`。`goal-check` 在距离上一个 `review_result` 已完成三个任务时失败，也在 mission
完成但最后任务后没有通过审查时失败。更新 `docs/automation.md` 及其中文 companion。

**闸门**：`node --test` 和 `node scripts/goal-check.mjs missions/000-bootstrap`。

**完成条件**：临时 mission 能带 `mission_done` 关闭；命令拒绝未完成任务、未覆盖验收、缺失证据和
失败审查；goal-check 在三个完成任务且无审查的 fixture 上报节奏错误。

## 审查重点

最可能咬人的失败模式，每个都由某个任务的测试拥有：

1. **台账/提交分叉**：`task_done` 没有提交，或有提交没有事件。T-002 必须拒绝；T-005 必须
   reconcile。
2. **适配器写台账**：两个写入者，重复事件。T-004 的合同规定适配器只返回报告；T-005 证明它。
3. **永不失败的闸门**：永远退出 0 的命令让每个任务看起来都完成。T-003 需要一个会失败的 fixture。
4. **Windows 路径和大小写**：`C:\` vs `/`、大小写不敏感文件系统、换行。T-001 和 T-003 先在
   win32 上跑；`.gitattributes` 固定 LF。
5. **台账顺序和时间戳**：并发追加或时钟偏差。T-002 fsync 并拒绝非单调 `ts`。
6. **目标漂移**：任务没有 `serves`、验收无人覆盖、目标文件被静默修改。T-002 检查覆盖和修订；
   T-005 运行审计。
