<!-- translation of .cairn/missions/002-completion-integrity/plan.md at the mission creation event; the English file is authoritative -->

---
schema: cairn/plan@0.1
mission: 002-completion-integrity
tasks:
  - id: T1
    title: Bind completion to the verified tree
    deps: []
    risk: high
    status: todo
    serves: [A1]
    files:
      - src/verify.ts
      - src/complete.ts
      - src/reconcile.ts
      - src/cli.ts
      - src/plan.ts
      - test/p0.test.mjs
      - test/cli.test.mjs
      - test/reconcile.test.ts
      - test/complete.test.ts
      - test/helpers.mjs
      - docs/workflow.md
      - docs/workflow.zh.md
      - docs/i18n.md
      - .github/workflows/gates.yml
      - .cairn/missions/002-completion-integrity/
      - .cairn/missions/001-method-pack/inbox/0006-completion-integrity.md
      - .cairn/missions/001-method-pack/inbox/0006-completion-integrity.zh.md
      - .cairn/missions/001-method-pack/inbox/index.md
      - .cairn/missions/001-method-pack/inbox/index.zh.md
      - docs/decisions/0005-task-level-pack-participation.md
      - docs/decisions/0005-task-level-pack-participation.zh.md
    interfaces:
      produces:
        - "verify records head and tree in every gate_result"
        - "record requires the current head and tree and a clean worktree outside .cairn"
        - "mission_done requires the worktree ledger to equal the ledger at HEAD"
        - "reconcile reports a completion event that is not in the ledger at HEAD"
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: mission
        command: node
        args: ["scripts/validate-mission.mjs", ".cairn/missions/002-completion-integrity"]
        severity: block
      - id: targets
        command: node
        args: ["scripts/check-targets.mjs"]
        severity: block
      - id: reconcile
        command: node
        args: ["src/cli.ts", "reconcile"]
        severity: block

  - id: T2
    title: Record pack participation per task
    deps: [T1]
    risk: high
    status: todo
    serves: [A3]
    files:
      - src/packs.ts
      - src/packet.ts
      - src/verify.ts
      - src/complete.ts
      - src/cli.ts
      - test/packs-record.test.mjs
      - test/packs.test.ts
      - test/cli.test.mjs
      - test/complete.test.ts
      - docs/workflow.md
      - docs/workflow.zh.md
      - docs/i18n.md
      - .cairn/missions/002-completion-integrity/
    interfaces:
      produces:
        - "record --packs <file> validates the record and writes it into task_done"
        - "every evidence value passes isEvidenceFile"
        - "mission_done requires one superpowers mode use and the Impeccable hard constraint"
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: mission
        command: node
        args: ["scripts/validate-mission.mjs", ".cairn/missions/002-completion-integrity"]
        severity: block
      - id: targets
        command: node
        args: ["scripts/check-targets.mjs"]
        severity: block
      - id: reconcile
        command: node
        args: ["src/cli.ts", "reconcile"]
        severity: block

  - id: T3
    title: Bind acceptance and review evidence, authorize the close
    deps: [T2]
    risk: high
    status: todo
    serves: [A2]
    files:
      - src/review.ts
      - src/complete.ts
      - src/cli.ts
      - test/review.test.ts
      - test/complete.test.ts
      - test/cli.test.mjs
      - docs/workflow.md
      - docs/workflow.zh.md
      - docs/i18n.md
      - .cairn/missions/002-completion-integrity/
    interfaces:
      produces:
        - "review_result carries coverage, non_goals, cold_start, and reviewer provenance"
        - "mission_done requires a human authorization event for the close"
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: mission
        command: node
        args: ["scripts/validate-mission.mjs", ".cairn/missions/002-completion-integrity"]
        severity: block
      - id: targets
        command: node
        args: ["scripts/check-targets.mjs"]
        severity: block
      - id: reconcile
        command: node
        args: ["src/cli.ts", "reconcile"]
        severity: block

  - id: T4
    title: Enforce the task state machine
    deps: [T3]
    risk: medium
    status: todo
    serves: [A4]
    files:
      - src/plan.ts
      - src/cli.ts
      - test/cli.test.mjs
      - test/plan.test.mjs
      - test/complete.test.ts
      - docs/workflow.md
      - docs/workflow.zh.md
      - docs/i18n.md
      - .cairn/missions/002-completion-integrity/
    interfaces:
      produces:
        - "start refuses an unmet dependency or a second active task"
        - "record requires task_started for new events"
        - "answer records the human decision and resumes a parked task"
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: mission
        command: node
        args: ["scripts/validate-mission.mjs", ".cairn/missions/002-completion-integrity"]
        severity: block
      - id: targets
        command: node
        args: ["scripts/check-targets.mjs"]
        severity: block
      - id: reconcile
        command: node
        args: ["src/cli.ts", "reconcile"]
        severity: block

  - id: T5
    title: Make init, the validator, and CI match the contract
    deps: [T4]
    risk: high
    status: todo
    serves: [A5]
    files:
      - src/paths.ts
      - src/cli.ts
      - scripts/validate-mission.mjs
      - scripts/check-targets.mjs
      - test/cli.test.mjs
      - test/validate-mission.test.mjs
      - test/paths.test.ts
      - test/check-targets.test.mjs
      - .github/workflows/gates.yml
      - docs/i18n.md
      - .cairn/missions/002-completion-integrity/
    interfaces:
      produces:
        - "init appends mission_created with the scaffold hashes"
        - "record --amended writes mission_amended with old and new hashes"
        - "validate-mission requires mission_created, all blocking gates, resolvable commits, and active-mission hashes"
        - "CI runs reconcile and the P0 probe"
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: mission
        command: node
        args: ["scripts/validate-mission.mjs", ".cairn/missions/002-completion-integrity"]
        severity: block
      - id: targets
        command: node
        args: ["scripts/check-targets.mjs"]
        severity: block
      - id: reconcile
        command: node
        args: ["src/cli.ts", "reconcile"]
        severity: block

  - id: T6
    title: Make policy executable and record authorizations
    deps: [T5]
    risk: medium
    status: todo
    serves: [A6]
    files:
      - src/gates.ts
      - src/plan.ts
      - src/cli.ts
      - scripts/audit-session.mjs
      - test/gates.test.ts
      - test/cli.test.mjs
      - test/audit-session.test.mjs
      - docs/workflow.md
      - docs/workflow.zh.md
      - docs/automation.md
      - docs/automation.zh.md
      - docs/i18n.md
      - .cairn/missions/002-completion-integrity/
    interfaces:
      produces:
        - "gate commands are checked against allowed_commands and forbidden_commands"
        - "approved_exceptions records the standing main push authorization"
        - "record --authorized writes an authorization event"
        - "audit-session accepts writes covered by an authorization event"
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: mission
        command: node
        args: ["scripts/validate-mission.mjs", ".cairn/missions/002-completion-integrity"]
        severity: block
      - id: targets
        command: node
        args: ["scripts/check-targets.mjs"]
        severity: block
      - id: reconcile
        command: node
        args: ["src/cli.ts", "reconcile"]
        severity: block

  - id: T7
    title: Make the contract and status sources tell the truth
    deps: [T6]
    risk: medium
    status: todo
    serves: [A6]
    files:
      - docs/protocol.md
      - docs/protocol.zh.md
      - src/packet.ts
      - src/cli.ts
      - scripts/check-bilingual.mjs
      - test/bilingual.test.mjs
      - scripts/audit-session.mjs
      - test/audit-session.test.mjs
      - package.json
      - .github/workflows/gates.yml
      - test/gates.test.ts
      - README.md
      - README.zh-CN.md
      - docs/i18n.md
      - .cairn/missions/002-completion-integrity/
    interfaces:
      produces:
        - "docs/protocol.md matches the CLI and the event ownership map"
        - "every status surface names the ledger as the source"
        - "check-bilingual verifies the source path and a reachable commit"
        - "CI proves the Node floor and the Windows gate shell"
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: mission
        command: node
        args: ["scripts/validate-mission.mjs", ".cairn/missions/002-completion-integrity"]
        severity: block
      - id: targets
        command: node
        args: ["scripts/check-targets.mjs"]
        severity: block
      - id: reconcile
        command: node
        args: ["src/cli.ts", "reconcile"]
        severity: block
      - id: bilingual
        command: node
        args: ["scripts/check-bilingual.mjs"]
        severity: block

  - id: T8
    title: Mission-end review and close
    deps: [T7]
    risk: low
    status: todo
    serves: [A2]
    files:
      - .cairn/missions/002-completion-integrity/
      - README.md
      - README.zh-CN.md
      - docs/i18n.md
    interfaces:
      produces:
        - "a fresh-context review with per-criterion evidence and a cold-start check"
        - "an audit artifact under evidence/audit/"
        - "a human authorization event, then mission_done"
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: mission
        command: node
        args: ["scripts/validate-mission.mjs", ".cairn/missions/002-completion-integrity"]
        severity: block
      - id: targets
        command: node
        args: ["scripts/check-targets.mjs"]
        severity: block
      - id: reconcile
        command: node
        args: ["src/cli.ts", "reconcile"]
        severity: block
      - id: decisions
        command: node
        args: ["scripts/check-decisions.mjs"]
        severity: block
      - id: enforcement
        command: node
        args: ["scripts/check-enforcement.mjs"]
        severity: block
      - id: bilingual
        command: node
        args: ["scripts/check-bilingual.mjs"]
        severity: block
      - id: workflow
        command: node
        args: ["scripts/check-workflow.mjs"]
        severity: block
      - id: example
        command: node
        args: ["scripts/check-example.mjs", "--example", "method/examples/0001-docs-tick"]
        severity: block
      - id: method-playbook
        command: node
        args: ["scripts/check-method.mjs", "--playbook"]
        severity: block
      - id: method-products
        command: node
        args: ["scripts/check-method.mjs", "--products", "--strict"]
        severity: block
---

# Plan — Mission #2

frontmatter 是机器契约：每个任务都有验收链接、声明文件和阻塞闸门。判断完成的是台账，不是
这里的 `status` 提示。

## 任务规格

这些是约束性的。无法满足规格的任务返回 `NEEDS_CONTEXT`；它不得即兴发明更软的解释。

### T1 — 完成绑定（D1，A1）

先写 `test/p0.test.mjs`，在旧运行时上跑，确认它因为正确的原因失败：临时仓库、一条读取
`code.txt` 的阻塞闸门、好树 verify 退出 0、把文件改成坏的并提交、然后 `record` 在本该拒绝时
成功。然后实现：

- `verify` 拒绝 `.cairn/` 之外有改动的工作树，一次性捕获 `head` 和 `tree`，写进每个
  `gate_result`，并在运行期间被跟踪内容变化时失败。
- `record` 要求每条阻塞闸门的最新结果带当前 `head` 和 `tree`、退出 0、`.cairn/` 之外工作树
  干净、证据文件存在。不匹配时拒绝 `task_done`。
- `record --mission-done` 要求工作树台账与 HEAD 的台账 blob 完全相同。
- `reconcile` 报告工作树台账里有、HEAD 台账里没有的完成事件。
- 操作指南记录顺序：工作 → 提交工作 → verify → record → 只提交台账。
- CI 跑 P0 探针。`node --test` 已包含它；workflow 也点名它，让读者看到负向用例。

完成判据：P0 探针在 `record` 处失败；干净树通过；测试覆盖树不匹配、脏工作树和未提交的
`task_done`；全部闸门退出 0。

### T2 — 任务级包（D3，ADR 0005，A3）

实现 ADR 0005。`cairn next` 要求执行者返回包记录；`cairn record --packs <file>` 校验后写进
`task_done`。恰好一个 superpowers 条目和一个 Impeccable 条目；`mode` 是 `use`、
`human-in-loop`、`not-applicable`、`absent` 之一；`not-applicable` 要求原因；`absent` 要求
原因和地板证据。每个 `evidence` 值都是 mission 相对路径，指向真实文件并通过
`isEvidenceFile`。

`mission_done` 的 mission 级检查：至少一个 superpowers `mode: use` 的证据通过
`isEvidenceFile`；只有当没有声明文件带 UI 扩展名，且收尾评审记录 `ui_surface: none` 时，
Impeccable 才允许全 `not-applicable`。

先写 `test/packs-record.test.mjs` 并确认 RED：`record` 拒绝缺失记录、只有一条的记录、坏
mode、没有原因的 not-applicable、没有地板的 absent、以及 mission 之外的证据路径。同一个文件
随后用合法记录完成一个任务。T1 是 grandfather：它的 `task_done` 没有 packs。T2 是第一个带
packs 的 `task_done`，本 mission 至少有一个 superpowers `mode: use`，其证据是真实的
RED→GREEN 测试。

完成判据：测试覆盖拒绝用例和合法记录；之后每个 `task_done` 都有两个合法条目；记录的证据文件
通过 `isEvidenceFile`；全部闸门退出 0。

### T3 — 验收与评审绑定（D2，A2）

`review_result` 带每个验收 id 的 `coverage`（验收标准、任务、证据、verdict）、`non_goals`、
`cold_start`、`reviewer`、`context`、`artifact` 和 `ui_surface`。`mission_done` 校验每个被
引用的产物、每个被引用的闸门结果退出 0，并要求最后一次评审之后有一条 `scope: mission_done`
的人类 `authorization` 事件。在新规则下重放 Mission #1 的 B5/B7 证据必须失败；把它记录成测试
fixture。

完成判据：缺任一字段的评审被拒绝；逐验收标准评审通过；没有人类授权事件的 `mission_done` 被
拒绝；全部闸门退出 0。

### T4 — 状态机（D4，A4）

`start` 拒绝未满足的依赖或第二个活动任务。`record` 对新事件要求 `task_started`；
`gitParent` 回退删除。`cairn answer <task> --text ...` 追加人类决定并恢复 parked 任务；
`task_started` 和 `task_parked` 中较晚者决定状态。没有 `task_started` 的历史任务保持有效。

完成判据：直接 `record` 失败；乱序 `start` 失败；parked 任务可以被回答并完成；Mission #0 和
#1 的台账仍然校验通过；全部闸门退出 0。

### T5 — init、校验器、CI（D5，A5）

`init` 追加 `mission_created`，带 mission id、owner、批准来源，以及脚手架文件的 sha256（仓库
有 `docs/protocol.md` 时也包含它）。`cairn record --amended` 写 `mission_amended`，带
`old`、`new`、`acceptance`、`why`、`approved_by`。校验器要求 `mission_created`、全部阻塞
闸门、可解析的 `base`/`head`、以及活动 mission 的目标哈希；新形状检查只适用于
`mission_created` 带 `approval_source` 的 mission。packs 要求是单调的：第一个带 packs 的
`task_done` 开启要求，之后每个 `task_done` 都必须带；`mission_done` 要求至少一个
superpowers `mode: use`。CI 跑 `reconcile` 和 P0 探针。

完成判据：`init` 产生非空台账并带 `mission_created`；被篡改的哈希、不存在的提交、只有部分
阻塞闸门、未提交的完成事件分别失败；历史 mission 仍然校验通过；全部闸门退出 0。

### T6 — 策略与授权（D6，D8，A6）

闸门运行前用 `allowed_commands` 和 `forbidden_commands` 检查命令；被禁止的命令拒绝该 tick，
列表外的命令带策略路径拒绝。把 `stop_conditions` 拆成 `auto` 和 `human`；执行可测量的预算。
在策略里记录 `approved_exceptions`，包括 `main` 的长期推送授权。
`cairn record --authorized --paths <a,b> --why <text> --approved-by human` 追加
`authorization` 事件；`audit-session` 把落在这些路径内的写入视为已授权，仍然报告没有对应
写入的授权，也仍然报告路径外的写入。

完成判据：列表外的闸门被拒绝；没有已记录例外的推送被拒绝；已授权写入不算漂移；路径外写入仍然
是漂移；全部闸门退出 0。

### T7 — 契约与状态真实性（D7，A6）

让 `docs/protocol.md` 追平 CLI 和新事件形状，包括 D1 顺序、任务级 `packs` 记录、
`authorization` 事件和归属表。删除过时的 T-002 文本和 `cairn export`；删除未使用的
`renderDispatch` 路径。修复 plan/i18n 不一致；让 `check-bilingual` 校验源路径和命名的可达
提交。为 Node ≥ 22.18 添加 `engines.node`，在 CI 测试支持的版本；记录并测试 Windows 闸门
shell。`audit-session` 在报告里记录选中的会话记录路径；mission 收尾报告写到
`evidence/audit/`。更新 `README.md`，点名 Mission #2。

协议变更是目标产物变更：在 `verify` 之前用 T5 写者记录带旧/新哈希和 `approved_by: human` 的
`mission_amended`。

完成判据：`docs/protocol.md` 与 CLI 一致；每个状态表面都指明台账；双语检查检查它声称的内容；
CI 证明 Node 下限；全部闸门退出 0。

### T8 — mission 收尾评审与关闭（A2，覆盖 A1–A6）

跑一次全新上下文评审，带逐验收标准 coverage、non-goals、cold start、评审者来源和
`ui_surface: none`（本 mission 没有 UI）。审计报告写到 `evidence/audit/` 并被引用。记录评审，
记录 `mission_done` 的人类授权事件，然后关闭。更新 `README.md`，说明 Mission #2 已完成以及
它证明了什么。

完成判据：评审通过且字段齐全；审计产物存在；授权事件在 `mission_done` 之前；`mission_done`
在 HEAD 的台账里；CI 绿。

## 已知依赖

T7 的协议变更需要 `approved_by: human`。人类通过决策 0006 批准了 D1–D8；T7 记录修订，不再
要求新决策。发现批准不覆盖其变更的任务返回 `NEEDS_CONTEXT`。
