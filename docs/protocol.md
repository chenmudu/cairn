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
missions/<mission-id>/
  mission.md      # intent, non-goals, acceptance
  policy.md       # budgets, allowed commands, stop conditions
  plan.md         # tasks, dependencies, files, interfaces, gates
  ledger.jsonl    # append-only events; the only truth
  evidence/       # per-task gate output
  inbox/          # pending escalations
```

`mission.md`, `policy.md`, and `plan.md` use YAML frontmatter for machine-readable fields and
prose for the parts a human needs to read. `ledger.jsonl` is machine-only; markdown views are
generated, never edited.

## Invariants

1. **One active task per worktree.** Parallelism happens across worktrees, never inside one.
2. **Done means three things agree.** A task is done only when a commit exists, a blocking
   gate recorded exit 0, and a `task_done` event exists in the ledger.
3. **The ledger and the code land in the same commit.** A commit without its ledger event is
   not progress; a ledger event without its commit is not progress.
4. **Implementer claims are not evidence.** Only a gate the runtime ran, or a command whose
   exit code and output were recorded, counts.
5. **The model has two runtime decisions.** A ruling (decide, record, continue) or an
   escalation (park this branch, continue the rest). Budgets bound both.
6. **State is rebuildable.** Any index or cache is disposable; `ledger.jsonl` plus git
   history must be enough to reconstruct the mission.

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

| Event | Required data | Meaning |
|---|---|---|
| `mission_created` | `artifacts` (path → sha256) | Mission artifacts frozen. |
| `task_started` | `base` (commit) | A tick selected this task. |
| `gate_result` | `gate`, `command`, `exit_code`, `evidence` | One gate ran. |
| `review_result` | `reviewer`, `verdict`, `findings` | A fresh reviewer judged the task. |
| `ruling` | `decision`, `why`, `cost_if_wrong` | A decision made without a human. |
| `task_done` | `base`, `head`, `commits`, `gates` | The task met all three conditions. |
| `task_parked` | `reason`, `inbox` | The task waits for a human. |
| `mission_done` | `acceptance` | Every acceptance criterion has evidence. |
| `mission_aborted` | `reason` | The mission stopped. |
| `note` | `text` | Human or controller annotation. |

Rules:

- `ts` is UTC ISO 8601.
- `actor` is `cairn`, `human`, or an adapter name.
- Events are appended, never edited. Corrections are new events.
- A single writer appends: `cairn record`. Adapters return reports; they never touch the
  ledger.

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
- A gate command is a fixed argv. No shell interpolation. Values go in `args`.

## CLI contract (v0.1)

| Command | Exit | Behavior |
|---|---|---|
| `cairn init <id>` | 0 | Scaffold a mission directory. |
| `cairn status [--json]` | 0 | Render mission state from the ledger. |
| `cairn reconcile` | 0 clean / 3 drift | Compare ledger, git, and evidence; repair the cache. |
| `cairn next` | 0 work / 2 none / 3 blocked | Print the next dispatch packet. |
| `cairn verify <task>` | 0 pass / 2 fail | Run the task's gates; write evidence and `gate_result` events. |
| `cairn record <task> --status done` | 0 / 2 refused | Append `task_done` only if the three conditions hold. |
| `cairn answer <task> --text ...` | 0 | Resolve an escalation and resume the branch. |
| `cairn export` | 0 | Render a human-readable report. |

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
  "base": "abc1234"
}
```

## Adapter contract

An adapter turns a dispatch packet into work. It may use any harness, model, or subagent
topology. It must return:

```json
{
  "status": "DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED",
  "commits": ["..."],
  "gates": [{ "id": "...", "exit_code": 0, "evidence": "..." }],
  "review": { "verdict": "pass | fail", "findings": [] },
  "rulings": [{ "decision": "...", "why": "...", "cost_if_wrong": "..." }],
  "escalations": [{ "question": "...", "options": [], "default": "..." }]
}
```

The adapter never marks a task done. The controller calls `cairn verify` and `cairn record`.
That split is what keeps the ledger trustworthy.

## Bootstrap

Mission #0 builds Cairn by hand, then replaces each manual step with a command:

1. Write the protocol and Mission #0 artifacts manually.
2. Build the validator and CLI skeleton.
3. Replace manual verification and ledger writes with `cairn verify` / `cairn record`.
4. Every later feature is delivered by a Cairn mission. If the protocol cannot express its
   own development, that is a protocol bug; fix the protocol, not the exception.