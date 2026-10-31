# Cairn Protocol v0.1

Status: draft. This document is the contract; the CLI is one implementation of it.

## Thesis

Completion is a property of the repository, not of the conversation.

A conversation can be compacted, a process can die, a harness can change. A commit, a gate
exit code, and an append-only ledger event survive all three. Cairn makes those three the
definition of progress, so any agent can pick up a mission without inheriting the previous
agent's context.

## Vocabulary

| Term | Meaning |
|---|---|
| Mission | A bounded body of work with acceptance criteria. |
| Task | The smallest unit with its own gate and commit. |
| Tick | One transaction. Selects and completes at most one task. |
| Gate | A deterministic command. Its exit code is the verdict. |
| Evidence | The recorded command, exit code, and output of a gate. |
| Ledger | Append-only JSONL event stream. The only truth. |
| Ruling | A decision made without a human, recorded in the ledger. |
| Escalation | A question parked for a human. Only the asking branch waits. |

## Artifacts

```
.cairn/
  config.json     # active mission and layout version
  cache/          # disposable; never committed
  missions/<mission-id>/
    mission.md      # intent, non-goals, acceptance
    policy.md       # budgets, allowed commands, stop conditions
    plan.md         # tasks, dependencies, files, interfaces, gates
    ledger.jsonl    # append-only events; the only truth
    evidence/       # per-task gate output
    inbox/          # pending escalations
```

`.cairn/config.json` names the active mission. `cairn` resolves `.cairn/missions/<id>` first
and keeps a legacy `missions/<id>` fallback, so a migration does not break existing checkouts.
`.cairn/cache/` is disposable and never committed.

`mission.md`, `policy.md`, and `plan.md` use YAML frontmatter for machine-readable fields and
prose for the parts a human needs to read. `ledger.jsonl` is machine-only; markdown views are
generated, never edited.

The ledger is the only status source. `mission.md.status` is the initial declaration;
`plan.md` task `status` is a deprecated hint. New plans omit it, and existing values stay as
history and are not edited. `cairn status`, `cairn next`, `goal-check`, and `reconcile` derive
state from `ledger.jsonl`.

## Invariants

1. **One active task per worktree.** Parallelism happens across worktrees, never inside one.
2. **Done means three things agree.** A task is done only when a commit exists, a blocking
   gate recorded exit 0, and a `task_done` event exists in the ledger.
3. **A task is one commit transaction.** The order is work → commit the work → `verify` →
   `record` → commit the ledger only. A work commit without `task_done` is not progress; a
   `task_done` without its work commit is not progress.
4. **Implementer claims are not evidence.** Only a gate the runtime ran, or a command whose
   exit code and output were recorded, counts.
5. **The model has two runtime decisions.** A ruling (decide, record, continue) or an
   escalation (park this branch, continue the rest). Budgets bound both.
6. **State is rebuildable.** Any index or cache is disposable; `ledger.jsonl` plus git
   history must be enough to reconstruct the mission.
7. **Targets change only by amendment.** The goal, non-goals, acceptance criteria, and this
   protocol are hash-recorded. A change emits `mission_amended` with the old and new hashes,
   the acceptance criterion it serves, the reason, and the approver. No silent edit.
8. **Every task serves an acceptance criterion.** A task declares `serves: [A#]`. A task
   without a valid link is invalid; a plan amendment must keep the acceptance-to-task coverage
   explicit.
9. **Completion is audited at milestones.** Every three completed tasks and at mission end, a
   fresh-context reviewer answers: what did this advance, did it touch a non-goal, and can a
   fresh session derive the same next step? The verdict is a `review_result`; a fail parks the
   mission.

## Completion transaction

1. Work, then commit the work. Evidence files belong to the work commit.
2. `cairn verify <task>` requires a clean worktree outside `.cairn/`. It captures `head` and
   `tree` once and writes both into every `gate_result`. A tracked change during the run is
   drift, and the run fails.
3. `cairn record <task> --status done` requires a `task_started`, at least one commit after its
   `base`, and, for every blocking gate, a latest result with the current `head` and `tree`,
   exit 0. It also requires no worktree change outside `.cairn/` since `verify`, and the task's
   `packs` record once any `task_done` in the mission carries one (ADR 0005).
4. Commit the ledger only. `task_done` lands in that commit.
5. `cairn record --mission-done` requires the worktree ledger to equal the ledger at HEAD, so
   every `task_done` is committed before the close; the close is proven by the commit that
   contains `mission_done`.

## Goal integrity

The goal is not a comment. `mission.md`, `policy.md`, `plan.md`, and this document are frozen
at `mission_created` by hash. Changing any of them requires a `mission_amended` event naming:

- `old` and `new`: path → sha256 for every changed artifact;
- `acceptance`: the criterion the change serves;
- `why`: the reason;
- `approved_by`: `human` for a goal, non-goal, acceptance, or protocol change; `cairn` for a
  plan change inside the existing acceptance envelope.

`cairn record --amended --artifact <path> --why <text> [--approved-by cairn|human]
[--acceptance <a,b>]` is the writer. It takes the old hash from the frozen chain, hashes the
file on disk, and appends the event. It refuses an unknown target, a target that was never
frozen, a missing file, and an acceptance id the mission does not declare. Without
`--acceptance`, the event records every mission criterion; a narrower scope names only the
criteria the change serves. The milestone audit's three questions and the full failure
register live in `docs/drift-control.md`.

## Event schema

Every line is one JSON object:

```json
{
  "ts": "2026-10-31T12:00:00.000Z",
  "event": "task_done",
  "mission": "000-bootstrap",
  "task": "T-001",
  "actor": "cairn",
  "data": {}
}
```

| Event | Writer | Required data | Meaning |
|---|---|---|---|
| `mission_created` | `cairn init` | `artifacts` (path → sha256), `approved_by`, `approval_source` | Mission artifacts frozen. |
| `mission_amended` | `cairn record --amended` | `old`, `new` (path → sha256), `acceptance`, `why`, `approved_by` | Target artifacts changed on purpose. |
| `task_started` | `cairn start`, `cairn answer` | `base` (commit) | A tick selected this task. `answer` adds `answer` and `approved_by: human`. |
| `gate_result` | `cairn verify` | `gate`, `command`, `exit_code`, `head`, `tree`, `evidence` | One gate ran on one verified tree. |
| `review_result` | `cairn review` | `reviewer`, `context`, `artifact`, `verdict`, `findings`, `packs`, `coverage`, `non_goals`, `cold_start`, `ui_surface` | A reviewer judged the task or mission. |
| `task_done` | `cairn record` | `base`, `head`, `tree`, `commits`, `gates`, `packs` (once packs are active) | The task met every completion condition. |
| `authorization` | `cairn record --authorized` | `approved_by: human`, `why`, `date`; optional `scope: mission_done`, `paths` | A human authorized a write or the close. |
| `mission_done` | `cairn record --mission-done` | `acceptance` (criterion → evidence) | Every acceptance criterion has evidence. |
| `task_parked` | reserved | `reason`, `inbox` | The task waits for a human. |
| `ruling` | reserved | `decision`, `why`, `cost_if_wrong` | A decision made without a human. |
| `mission_aborted` | reserved | `reason` | The mission stopped. |
| `note` | reserved | `text` | Controller annotation. |

Rules:

- `ts` is UTC ISO 8601.
- `actor` is `cairn`, `human`, or an adapter name.
- Events are appended, never edited. Corrections are new events.
- Each event type has one runtime owner: `cairn init` owns `mission_created`; `cairn start` and
  `cairn answer` own `task_started`; `cairn verify` owns `gate_result`; `cairn review` owns
  `review_result`; `cairn record` owns `task_done`, `mission_amended`, `authorization`, and
  `mission_done`. Adapters return reports; they never touch the ledger.
- `task_parked`, `ruling`, `mission_aborted`, and `note` are validator-accepted but have no
  v0.1 runtime writer. `cairn answer` resolves a `task_parked` event when one exists.

## Gate contract

```json
{
  "id": "typecheck",
  "command": "pnpm",
  "args": ["typecheck"],
  "cwd": ".",
  "timeout_ms": 600000,
  "severity": "block",
  "scope": "workspace",
  "output": { "tail": 16384 }
}
```

- `severity: block` decides the task. `severity: advisory` is recorded but never changes the
  exit state.
- `scope: workspace` runs once per task. `scope: changed` runs on changed files.
- The **strongest gate** a task declares must run at least once before `task_done`, even if a
  faster gate already passed.
- A gate command is a fixed argv. No shell interpolation. Values go in `args`. On Windows, if
  the command cannot be executed directly (a package-manager `.cmd` shim raises `ENOENT` or
  `EINVAL`), the runtime retries the same plan-controlled argv through the shell. The fallback
  is not input; the test is `test/gates.test.ts`.

## CLI contract (v0.1)

| Command | Exit | Behavior |
|---|---|---|
| `cairn init <id>` | 0 / 2 refused | Scaffold a mission directory, make it active, and append `mission_created` with the frozen hashes. |
| `cairn status [--json]` | 0 | Render mission state from the ledger. |
| `cairn reconcile` | 0 clean / 3 drift | Compare ledger, git, and evidence; repair the cache. |
| `cairn next` | 0 work / 2 none / 3 blocked | Print the next dispatch packet. |
| `cairn start <task>` | 0 / 2 refused | Append `task_started` with the current HEAD as `base`; refuse a task that is done, parked, already started, missing a dependency, or while another task is active. |
| `cairn answer <task> --text <text>` | 0 / 2 refused | Resolve a parked task's escalation: append a human `task_started` carrying the answer, which resumes the branch. |
| `cairn verify <task>` | 0 pass / 2 fail | Run the task's gates on a clean tree; write evidence and `gate_result` events with `head` and `tree`. |
| `cairn review --file <json>` | 0 / 2 refused | Validate the review record, then append `review_result`. |
| `cairn record <task> --status done [--packs <json>]` | 0 / 2 refused | Append `task_done` only when every completion condition holds. |
| `cairn record --amended --artifact <path> --why <text> [--approved-by cairn\|human] [--acceptance <a,b>]` | 0 / 2 refused | Append `mission_amended` with the old and new hashes. |
| `cairn record --authorized --why <text> --approved-by human [--scope writes\|mission_done] [--paths <a,b>] [--date <YYYY-MM-DD>]` | 0 / 2 refused | Append `authorization` for a human-approved write; `date` defaults to today. |
| `cairn record --mission-done` | 0 / 2 refused | Append `mission_done` when every criterion has evidence and the ledger is committed at HEAD. |

`cairn next` prints a **dispatch packet** and nothing else on stdout. Diagnostics go to stderr.

## Dispatch packet

```json
{
  "mission": { "id": "000-bootstrap", "title": "Build Cairn with Cairn" },
  "task": { "id": "T-001", "title": "...", "files": [], "interfaces": {} },
  "policy": { "budgets": {}, "allowed_commands": [], "stop_conditions": [] },
  "constraints": ["..."],
  "gates": [{ "id": "typecheck", "command": "pnpm", "args": ["typecheck"] }],
  "ledger_tail": ["...last 5 events..."],
  "base": "abc1234",
  "packs": [
    {
      "capability": "test-first",
      "pack": "superpowers",
      "version": "7.0.1",
      "mode": "use",
      "instruction": "superpowers:test-driven-development",
      "fallback": {
        "text": "write the test first, then the implementation, then run the gate",
        "product": { "kind": "gate", "ref": "test" }
      }
    }
  ]
}
```

`packs` is deterministic context, never a completion signal. Every packet carries two entries:

- **superpowers**: `test-first` when a declared file ends in `.ts`, `.tsx`, `.js`, `.mjs`,
  `.cjs`, `.jsx`, `.py`, `.rs`, `.go`, `.java`, `.rb`, or `.sh`; otherwise `verify-before-close`
  (`superpowers:verification-before-completion`).
- **Impeccable**: `design-check` when a declared file ends in `.html`, `.htm`, `.css`, `.scss`,
  `.sass`, `.less`, `.tsx`, `.jsx`, `.vue`, `.svelte`, `.astro`, or `.svg`; otherwise
  `design-review` with `mode: not-applicable` and a reason.

`mode` is one of `use`, `human-in-loop`, `not-applicable`, `absent`. `version` is the detected
version, or the pin when the pack is absent. Detection returns `absent`, `mismatch`, or
`not-invocable`; all three make the packet entry `absent` and the fallback is the instruction.
`reason` is required for `not-applicable`.

## Adapter contract

An adapter turns a dispatch packet into work. It may use any harness, model, or subagent
topology. It must return:

```json
{
  "status": "DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED",
  "commits": ["..."],
  "gates": [{ "id": "...", "exit_code": 0, "evidence": "..." }],
  "review": {
    "verdict": "pass | fail",
    "findings": [],
    "packs": [
      {
        "capability": "test-first",
        "pack": "superpowers",
        "version": "7.0.1",
        "mode": "use",
        "evidence": "test/example.test.mjs, RED then GREEN"
      },
      {
        "capability": "design-review",
        "pack": "impeccable",
        "version": "4.8.0+df3a4ab",
        "mode": "not-applicable",
        "reason": "no markup or URL target",
        "evidence": "README.md criteria-based review"
      }
    ]
  },
  "rulings": [{ "decision": "...", "why": "...", "cost_if_wrong": "..." }],
  "escalations": [{ "question": "...", "options": [], "default": "..." }]
}
```

The adapter never marks a task done. The controller calls `cairn verify` and `cairn record`.
That split is what keeps the ledger trustworthy.

The review `packs` list is non-empty on every `review_result`. Each entry has non-empty
`capability`, `pack`, `version`, `mode`, and `evidence`; `pack` is `superpowers` or
`impeccable`; `mode` uses the same four values as the packet. `not-applicable` requires a
reason. `absent` requires evidence naming the floor that ran (a gate id, command, or path). A
pack report is input; gate evidence is proof, and a review never turns a red gate green.

## Bootstrap

Mission #0 builds Cairn by hand, then replaces each manual step with a command:

1. Write the protocol and Mission #0 artifacts manually.
2. Build the validator and CLI skeleton.
3. Replace manual verification and ledger writes with `cairn verify` / `cairn record`.
4. Every later feature is delivered by a Cairn mission. If the protocol cannot express its
   own development, that is a protocol bug; fix the protocol, not the exception.