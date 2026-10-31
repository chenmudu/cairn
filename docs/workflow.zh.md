<!-- translation of docs/workflow.md at the Mission #2 T6 revision; the English file is authoritative -->

# 一个 tick

这是操作手册。它假设仓库是事实源：mission、plan、ledger 和 evidence。一个 tick 推进一个任务，
留下提交、阻塞闸门退出 0，以及 `task_done` 事件。

## 角色

- **Owner**：设定 mission、非目标和验收；回答 escalation。Owner 不需要在每个会话里重复目标。
- **Coordinator**：运行 `goal-check`、`next`、`verify`、`record` 和 `reconcile`；拥有台账和
  packet。
- **Executor**：在声明的文件内做任务，返回带证据的报告。
- **Reviewer**：用全新上下文和审查清单；不相信 executor 的声明。

同一个人或 agent 可以兼任多个角色，但同一个改动的 reviewer 不能是 executor。

## 前置条件

- `.cairn/config.json` 指明活动 mission。
- `node scripts/goal-check.mjs` 退出 0。退出 1 就停下：计划、台账或审计节奏需要先修。
- 读 `.cairn/missions/<id>/inbox/`，看有没有等人类的决定。

## tick

1. **锚点。** 打印 mission、下一个任务、它的 `serves` 链接和闸门。

   ```sh
   node scripts/goal-check.mjs
   ```

2. **Start 与 packet。** 记录 base，然后读任务、文件、闸门、约束、packs 和 base 提交。
   packet 的 `packs` 列表就是任务必须交回的形状：两条，一条一个包，按声明文件选出。

   ```sh
   node src/cli.ts start <task>
   node src/cli.ts next
   ```

3. **工作。** diff 保持在声明的文件内。改变行为时先写测试，看到它因为预期原因失败。任务如果
   说不出它推进哪条验收标准，停下。

4. **提交工作。** 在验证前提交代码、测试和文档。`verify` 拒绝 `.cairn/` 之外有改动的工作区，
   因为闸门结果证明的是一棵树。

5. **验证。** 跑每个阻塞闸门并写证据。

   ```sh
   node src/cli.ts verify <task> --mission .cairn/missions/<id>
   ```

   `verify` 把 head 和 tree 写进每个 `gate_result`；闸门运行期间被跟踪内容变化就是漂移。
   任何闸门运行之前，它先拒绝不在 `allowed_commands` 的命令，或命中 `forbidden_commands`
   且没有已记录例外的命令。

6. **记录。** 只有最新的阻塞闸门结果指名当前 head 和 tree、工作区在 `.cairn/` 之外仍然干净、
   每个证据文件都在时，才追加 `task_done`。同时交任务返回的两条 pack 记录。

   ```sh
   node src/cli.ts record <task> --status done --packs <json> --mission .cairn/missions/<id>
   ```

   `record` 从声明文件重算 capability，代码任务不能自报 verify-before-close 逃避 test-first。
   只有一条、mode 不认识、capability 或 skill 与任务不符、证据在 mission 之外，都会被拒绝。
   mission 里第一条带 packs 的 `task_done` 之后，后续 `task_done` 缺记录一律拒绝。

7. **提交台账。** 只提交台账和证据。`task_done` 是仓库的属性，不是对话的属性。

8. **对账。** 对照 git 和证据检查台账。完成事件在工作区台账里、但不在 HEAD 的台账里，就是漂移。

   ```sh
   node src/cli.ts reconcile --mission .cairn/missions/<id>
   ```

9. **声明前审计。** 报告漂移信号；审计跑不了就记录失败和替代证据。

   ```sh
   node scripts/audit-session.mjs
   ```

包可用性是 advisory，不阻塞 tick：

```sh
node scripts/check-method.mjs --packs
```

## 创建与修订 mission

`cairn init` 是 `mission_created` 的写入者。它生成 `mission.md`、`plan.md`、`policy.md`，把三者的
sha256 冻结进台账；仓库里有 `docs/protocol.md` 时也一并冻结；最后把新 mission 设为活动 mission。

```sh
node src/cli.ts init <id> --title <title> --owner <owner> --approval-source <ids> \
  --approved-by cairn|human
```

`--owner` 默认 `replace-me`，`--approval-source` 默认 `none`，`--approved-by` 默认 `cairn`。
只有人类会传 `--approved-by human`；`init` 自己从不声称人类批准。

目标文件只能通过带旧哈希和新哈希的修订事件改变：

```sh
node src/cli.ts record --amended --artifact plan.md --why <why> --approved-by cairn
```

`plan.md` 可由 `cairn` 修订。`mission.md`、`policy.md` 和 `docs/protocol.md` 要求
`--approved-by human`。`validate-mission` 会为活动 mission 重算哈希链；不匹配就让 `mission`
闸门失败。

## 任务状态

任务状态由台账决定，不是 `plan.md`：

- `todo` — 既无 `task_started` 也无 `task_parked`；
- `active` — `task_started` 与 `task_parked` 中最后出现的是 start；
- `parked` — 最后出现的是 park；
- `done` — 存在 `task_done`，且它是终态。

`start` 拒绝未完成的依赖并点名，也拒绝第二个活动任务并点名。`record` 要求任务自己的
`task_started`，base 提交来自该事件，不再回退到 HEAD 的父提交。在规则生效之前已经记为 done 的任务
仍然有效。

escalation 由人回答，不由执行者回答：

```sh
node src/cli.ts answer <task> --text "决定内容" --mission .cairn/missions/<id>
```

`answer` 只对 parked 任务有效，追加一条带 `base`、`answer`、`approved_by: human` 的
`task_started`，任务由此恢复，可以继续 verify 和 record。它是目前唯一恢复任务的写入者；还没有
`park` 命令，该事件的所有权在 T7 随契约一起收口。

## 关闭 mission

`record --mission-done` 要求工作区台账逐字节等于 HEAD 的台账，因为关闭也是仓库的属性。关闭是两次提交：

1. 提交 `task_done`、review、authorization 和证据；
2. `node src/cli.ts record --mission-done --mission .cairn/missions/<id>`；
3. 提交 `mission_done`；
4. `node src/cli.ts reconcile --mission .cairn/missions/<id>` 退出 0。

只改了工作区台账、HEAD 没跟上的 `record --mission-done` 会被拒绝。不要编辑台账去凑，提交它。

### review 记录

`cairn review` 拒绝缺少下列任一字段的 review，`cairn record --mission-done` 会再检查最后一条：

| 字段 | 含义 |
| --- | --- |
| `reviewer`、`context` | 谁审的，以及 `fresh` 或 `coordinator` |
| `artifact` | mission 内的 review 文件，必须存在 |
| `verdict`、`findings` | `pass` 或 `fail`，以及发现了什么 |
| `packs` | 两条 pack 记录，规则同 `task_done` |
| `coverage` | 每个验收 id 一条，不重复、不出现未知 id |
| `non_goals` | mission 声明的每个非目标一条 |
| `cold_start` | `{ reviewer, artifact, verdict }`：冷启动会话能说出下一个任务 |
| `ui_surface` | `none` 或 `present` |

一条 coverage 记录形如：

```json
{ "criterion": "A2", "tasks": ["T3"],
  "evidence": [{ "gate": "test", "path": "evidence/T3/test.json" }],
  "verdict": "pass" }
```

`evidence` 放引用，不放叙述。带 `gate` 的引用必须对应一条服务于该验收项的 exit-0
`gate_result`；不带 `gate` 的只要求文件存在。只挂任务链接不算证据。

### authorization

审查者证明工作，人授权关闭。最后一条 review 之后追加一条事件：

```json
{ "event": "authorization", "actor": "human",
  "data": { "scope": "mission_done", "approved_by": "human",
            "why": "人接受关闭的理由", "date": "2026-10-31" } }
```

`scope` 和 `approved_by` 会被检查，`why` 与 `date` 不能为空，事件必须晚于最后一条
`review_result`。`paths` 可以把授权收窄到指定路径。形状见决策 0007，不存在第二个 reason 字段。

## 策略、预算与授权

`policy.md` 在可执行的地方就是可执行的：

- **闸门命令。** 任何闸门运行之前，`verify` 先用首个 token 查 `allowed_commands`，再用完整
  命令精确匹配 `approved_exceptions`，最后按精确或空格前缀匹配 `forbidden_commands`。拒绝
  会点名 gate 和 policy 路径，且发生在命令运行之前。
- **尝试次数。** 任务的 `task_started` 数量达到 `max_attempts_per_task` 后，`start` 和
  `answer` 拒绝。
- **墙钟时间。** 从当前尝试的 start 起超过 `max_wall_time_per_tick_minutes` 时，`record` 以
  `budget_exhausted` 拒绝；需要人类扩展预算。
- **停止标签。** `stop_condition_labels.auto` 中的条件可检测，并在拒绝信息里点名；`human`
  条件保持检查点，永不自动化。
- **不测量。** `max_fix_rounds` 和 token 预算没有可靠来源。运行时不会假装执行它们，保持
  human/unmeasured。

`git push origin main` 默认被禁止，只由已记录的 `approved_exceptions` 条目放行。
`git push origin dev` 和 `git push --force origin main` 不匹配该例外，会被拒绝。

声明文件之外的写入需要人类授权事件：

```sh
node src/cli.ts record --authorized --paths a.md,dir/ --why <why> --approved-by human
```

事件形状是 `{scope: "writes", paths, approved_by: "human", why, date}`。此后
`audit-session` 接受这些路径内的写入，仍然报告没有对应写入的授权，也仍然报告路径外的写入。
`--approved-by` 必须是 `human`；agent 不能给自己授权。

## 人类检查点

以下情况停下问 owner：

- 协议变更、新 mission，或修订 `mission.md`、`policy.md`、`plan.md`、`docs/protocol.md`；
- push、发布、改写历史或破坏性命令；
- 扩大任务声明的范围；
- 仓库回答不了的阻塞性问题；
- 验收标准明确要求某个包能力，但包缺失时却想接受。

阻塞性问题是一次 escalation，任务 parked。没有人类参与的决定是 ruling：记入台账，继续，并
写明错了的代价。

## 失败路径

- **阻塞闸门失败。** 停下。记录命令、退出码和下一步。不记 `task_done`。
- **证据缺失。** 当作闸门失败。重新跑；不要手写证据。
- **`audit-session` 失败或读不了 transcript。** 记录失败和替代证据（闸门、validate、
  reconcile、全新上下文审查）。永不报告审计通过。
- **包缺失。** 用可执行回退，记录 `absent, floor used`。除非验收标准要求该包，否则不是阻塞。
- **pack 记录缺失或被拒绝。** `record` 退出 2 并给出原因。按拒绝要求补两条记录和证据；不要
  换成更弱的能力重试，也不要干脆不交。mission 里出现第一条带 packs 的 `task_done` 之后，交不出
  记录是阻塞性问题，不是可以省略的项。
- **包是 `mismatch` 或 `not-invocable`。** 用回退，记录检测到的版本。不要调会下载引擎的
  启动器。
- **没有可运行任务。** 检查依赖链、台账和 `goal-check`。计划表达不了下一步时，修订计划，
  不要即兴发挥。
- **台账和 git 不一致。** `cairn reconcile` 会指出崩溃窗口。不要编辑台账；记录修正事件或
  停下等人类。

## 包

地板始终可执行。包在时更好，且要 pin。接缝是 Cairn 的：检测、注入、记录、对账。

### pack 记录

mission 里第一条带 packs 的 `task_done` 之后，每个任务交回两条，一条一个包：

```json
[
  {
    "capability": "test-first",
    "pack": "superpowers",
    "skill": "superpowers:test-driven-development",
    "version": "7.0.1",
    "mode": "use",
    "evidence": "evidence/T2/superpowers-use.txt"
  },
  {
    "capability": "design-review",
    "pack": "impeccable",
    "skill": "impeccable:design-review",
    "version": "4.8.0+df3a4ab",
    "mode": "not-applicable",
    "reason": "task files contain no markup or URL target",
    "evidence": "evidence/T2/impeccable-none.txt"
  }
]
```

- `mode` 是 `use`、`human-in-loop`、`not-applicable` 或 `absent`。
- `capability` 和 `skill` 跟着声明文件走：代码文件是 `test-first` /
  `superpowers:test-driven-development`，UI 文件是 `design-check` /
  `impeccable:design-check`，其余是 `verify-before-close` /
  `superpowers:verification-before-completion` 和 `design-review` /
  `impeccable:design-review`。`record` 会重算这条规则，不一致就拒绝。
- `not-applicable` 要写 `reason`；`absent` 要写 `reason` 和地板的证据。
- 每个 `evidence` 都是 mission 内的文件。`use` 的证据必须是文本文件，首行含 skill id；
  test-first 的证据还要有 `RED` 段和 `GREEN` 段。只写文件名什么都不证明。
- 检测出的 `invocable` 只是文件系统事实，不是会话真的能调用的证明。只有实际调用的证据算数。

### 两包都在

- superpowers 提供流程纪律：`brainstorming` 框定，`writing-plans` 写可选计划，
  `test-driven-development` 执行，`requesting-code-review` 审查，
  `verification-before-completion` 声明前验证。
- Impeccable 提供设计标准。只对 markup 或 URL 跑 `detect`；`critique` 是人在环；`audit`
  只适用 web/native。docs 和 code 用标准，UI 专用维度标 `not-applicable` 并写原因。
- 任务报告记录包、pin 和证据。

### 只有 superpowers

用 superpowers 做框定、TDD、审查和声明前验证。Impeccable 行在 docs 和 code 上保持
`not-applicable`。仓库内标准是设计地板。

### 只有 Impeccable

只在存在 UI 表面时用 detector 和 critique。流程地板是 Cairn 的：`goal-check`、`next`、
`verify`、`record`、`reconcile`。superpowers 记 `absent, floor used`。

### 两包都不在

全程用地板：

1. `node scripts/goal-check.mjs`
2. `node src/cli.ts next`
3. 先写测试，再改
4. 提交工作
5. `node src/cli.ts verify <task>`
6. `node src/cli.ts record <task> --status done`
7. 提交台账和证据
8. `node src/cli.ts reconcile`
9. 用仓库内清单做全新上下文审查

每个任务报告写 `absent, floor used`。闸门仍然通过；这才是地板的测试。

## 完成

任务只有三样同时成立才算完成：

- 提交存在；
- 每个阻塞闸门在被验证的树上退出 0 并有证据；
- `task_done` 在 HEAD 的台账里。

绿色闸门证明这一步，不是 mission。mission 结束时跑里程碑审计，把结论写进「review 记录」
规定形状的 JSON 文件并记录，追加人类 `authorization`，提交台账，然后才
`cairn record --mission-done`。之后再提交 `mission_done`。见「关闭 mission」。

```sh
node src/cli.ts review --file review.json --mission .cairn/missions/<id>
```

## 计划状态只是提示

`plan.md` 的 `status` 字段是计划提示。台账里的 `task_done` 才是事实。不要从计划推断完成；
运行 `node scripts/goal-check.mjs` 或 `node src/cli.ts status`。
