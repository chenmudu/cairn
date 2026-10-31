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

The frontmatter is the machine contract: every task has an acceptance link, declared files,
and blocking gates. The ledger, not the `status` hint here, says what is done.

## Task specs

These are binding. A task that cannot meet its spec returns `NEEDS_CONTEXT`; it does not
improvise a softer interpretation.

### T1 — completion binding (D1, A1)

Write `test/p0.test.mjs` first and run it against the old runtime to see it fail for the right
reason: a temporary repository, one blocking gate that reads `code.txt`, a good tree verified at
exit 0, the file changed to bad and committed, then `record` succeeding when it must refuse.
Then implement:

- `verify` refuses a worktree with changes outside `.cairn/`, captures `head` and `tree` once,
  writes both into every `gate_result`, and fails if the tracked content changes during the run.
- `record` requires the current `head` and `tree` on every blocking gate's latest result, exit 0,
  a clean worktree outside `.cairn/`, and the evidence file. A mismatch refuses `task_done`.
- `record --mission-done` requires the worktree ledger to equal the ledger blob at HEAD.
- `reconcile` reports a completion event that exists in the worktree ledger but not at HEAD.
- The operator guide records the order: work → commit the work → verify → record → commit the
  ledger only.
- CI runs the P0 probe. `node --test` already includes it; the workflow also names it so a
  reader sees the negative case.

Done when: the P0 probe fails at `record`; a clean tree passes; tests cover a tree mismatch, a
dirty worktree, and an uncommitted `task_done`; all gates exit 0.

### T2 — task-level packs (D3, ADR 0005, A3)

Implement ADR 0005. `cairn next` requires the executor to return a pack record; `cairn record
--packs <file>` validates it and writes it into `task_done`. Exactly one superpowers entry and
one Impeccable entry; `mode` is one of `use`, `human-in-loop`, `not-applicable`, `absent`;
`not-applicable` requires a reason; `absent` requires a reason and floor evidence. Every
`evidence` value is a mission-relative path to a real file and passes `isEvidenceFile`.

Mission-level checks in `mission_done`: at least one superpowers `mode: use` whose evidence
passes `isEvidenceFile`; Impeccable is all-`not-applicable` only when no declared file has a UI
extension and the closing review records `ui_surface: none`.

Write `test/packs-record.test.mjs` first and confirm RED: `record` refuses a missing record, a
one-entry record, a bad mode, a not-applicable without a reason, an absent without a floor, and
an evidence path outside the mission. The same file then completes a task with a valid record.
T1 is grandfathered: its `task_done` has no packs. T2 is the first `task_done` with packs, and
this mission has at least one superpowers `mode: use` whose evidence is a real RED→GREEN test.

Done when: the tests cover the refusal cases and the valid record; every later `task_done` has
two valid entries; the record's evidence files pass `isEvidenceFile`; all gates exit 0.

### T3 — acceptance and review binding (D2, A2)

`review_result` carries `coverage` for every acceptance id (criterion, tasks, evidence, verdict),
`non_goals`, `cold_start`, `reviewer`, `context`, `artifact`, and `ui_surface`. `mission_done`
validates each referenced artifact, each referenced gate result at exit 0, and requires a human
`authorization` event with `scope: mission_done` after the last review. Replaying Mission #1's
B5/B7 evidence under the rule must fail; record that as a test fixture.

Done when: a review missing any field is refused; a per-criterion review passes; a
`mission_done` without the human authorization event is refused; all gates exit 0.

### T4 — state machine (D4, A4)

`start` refuses an unmet dependency or a second active task. `record` requires `task_started`
for new events; the `gitParent` fallback is gone. `cairn answer <task> --text ...` appends the
human decision and resumes the parked task; the latest of `task_started` and `task_parked`
decides the state. Historical tasks without `task_started` stay valid.

Done when: a direct `record` fails; an out-of-order `start` fails; a parked task can be answered
and completed; the Mission #0 and #1 ledgers still validate; all gates exit 0.

### T5 — init, validator, CI (D5, A5)

`init` appends `mission_created` with the mission id, owner, approval source, and the sha256 of
the scaffold files (plus `docs/protocol.md` when present). `cairn record --amended` writes
`mission_amended` with `old`, `new`, `acceptance`, `why`, and `approved_by`. The validator
requires `mission_created`, all blocking gates, resolvable `base`/`head`, and the active
mission's target hashes; new-shape checks apply only to missions whose `mission_created` carries
`approval_source`. The packs requirement is monotonic: the first `task_done` with a packs record
opens it, every later `task_done` must carry it, and `mission_done` requires at least one
superpowers `mode: use`. CI runs `reconcile` and the P0 probe.

Done when: `init` produces a non-empty ledger with `mission_created`; a tampered hash, a
non-existent commit, a partial blocking-gate set, and an uncommitted completion event each
fail; the historical missions still validate; all gates exit 0.

### T6 — policy and authorization (D6, D8, A6)

Check gate commands against `allowed_commands` and `forbidden_commands` before they run; a
forbidden command refuses the tick and an out-of-list command refuses with the policy path.
Split `stop_conditions` into `auto` and `human`; enforce the budgets that are measurable. Record
`approved_exceptions` in the policy, including the standing `main` push authorization.
`cairn record --authorized --paths <a,b> --why <text> --approved-by human` appends an
`authorization` event; `audit-session` treats writes inside those paths as authorized, still
reports an authorization with no matching write, and still reports a write outside the paths.

Done when: an out-of-list gate is refused; a push without the recorded exception is refused; an
authorized write is not drift; a write outside the paths is still drift; all gates exit 0.

### T7 — contract and status truth (D7, A6)

Bring `docs/protocol.md` up to the CLI and the new event shapes, including the D1 order, the
task-level `packs` record, the `authorization` event, and the ownership map. Remove the stale
T-002 text and `cairn export`; delete the unused `renderDispatch` path. Fix the plan/i18n
mismatch; make `check-bilingual` verify the source path and a named reachable commit. Add
`engines.node` for Node ≥ 22.18 and test the supported versions in CI; document and test the
Windows gate shell. `audit-session` records the chosen transcript path in its report; the
mission-end report goes under `evidence/audit/`. Update `README.md` to name Mission #2.

The protocol change is a target-artifact change: record `mission_amended` with old and new
hashes and `approved_by: human` before `verify`, using the T5 writer.

Done when: `docs/protocol.md` matches the CLI; every status surface names the ledger; the
bilingual check checks what it claims; CI proves the Node floor; all gates exit 0.

### T8 — mission-end review and close (A2, covers A1–A6)

Run a fresh-context review with per-criterion coverage, non-goals, cold start, reviewer
provenance, and `ui_surface: none` (the mission has no UI). Write the audit report under
`evidence/audit/` and reference it. Record the review, record the human authorization event for
`mission_done`, then close. Update `README.md` to state that Mission #2 is complete and what it
proved.

Done when: the review is a pass with every field; the audit artifact exists; the authorization
event precedes `mission_done`; `mission_done` is in the ledger at HEAD; CI is green.

## Known deps

The protocol change in T7 requires `approved_by: human`. The human approved D1–D8 through
decision 0006; T7 records the amendment, it does not ask for a new decision. A task that finds
the approval does not cover its change returns `NEEDS_CONTEXT`.
