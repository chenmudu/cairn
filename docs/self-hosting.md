# Self-hosting — one tick at a time

Cairn is built by the method it describes. Mission #0 is the proof: every task after the
bootstrap was selected by `cairn next`, verified by `cairn verify`, and completed by
`cairn record`. No one edited `ledger.jsonl` to mark a task done after `cairn verify` existed.

## One tick

```bash
node scripts/goal-check.mjs                 # why this task, and what it serves
node src/cli.ts next                        # dispatch packet, base commit included
node src/cli.ts verify <task>               # run every gate; write evidence and gate_result
# commit the work (the task's code plus its evidence)
node src/cli.ts record <task> --status done # all three conditions, then task_done
node src/cli.ts reconcile                   # ledger, git, and evidence agree
```

The adapter step in the middle is deliberately unspecified. A subagent, a model, or a shell
script can do the work; `docs/adapter.md` defines the report it returns. The controller runs
`verify` and `record`, so an adapter cannot certify itself.

`cairn next` prints the packet on stdout and nothing else. Diagnostics go to stderr. The packet
carries the task, the acceptance link, the declared files, the policy, the gates, the last five
ledger events, and `base`. `src/packet.ts` renders the same packet as a markdown brief for a
model; the template lives in `templates/dispatch.md`.

## The crash window

`cairn verify` writes evidence and `gate_result` events. `cairn record` writes `task_done` only
after a commit exists. A crash between them leaves:

- evidence files on disk;
- `gate_result` events in the ledger;
- no `task_done`;
- no second commit.

`cairn reconcile` reports that state as `pending`, not drift: the gates passed, the record is
missing. `cairn record` refuses if the task is already done, so re-running it cannot duplicate
`task_done`. If the process dies before the work commit, `reconcile` still sees the pending
gates and no `task_done`; the next tick can recommit and record, or re-run `verify` to refresh
the evidence.

## Cold start

A fresh session does not need the previous conversation. The repository carries the mission,
the plan, the ledger, and the evidence. The SessionStart hook injects
`node scripts/goal-check.mjs --brief`, which names the current task, the acceptance criterion it
serves, its gates, and the coverage map. If the hook is unavailable, the same command run by
hand gives the same answer.

The milestone audit tests this directly: a fresh reviewer, given only the repository, must name
the next task, its gate, and why it serves the mission. A wrong answer is drift even when every
gate is green.

## Milestone audit

Every three completed tasks and at mission end, before the next task:

1. **Coverage** — which acceptance criteria advanced, which remain unproven, with evidence.
2. **Non-goals** — did any task touch a non-goal, and which ruling allowed it.
3. **Cold start** — can a fresh session derive the same next step from the repository?

The verdict is a `review_result` event. `fail` parks the mission.

## What Mission #0 exercised

| Acceptance | Evidence in this repository |
|---|---|
| A1 validator accepts the mission, rejects a missing-gate fixture | `evidence/T-001/`, `--expect-invalid` test |
| A2 state reconstructs from ledger + git | `cairn status --json`, `test/plan.test.mjs` |
| A3 next → dispatch → verify → record | `test/cli.test.mjs`, T-003/T-004/T-005 `task_done` events |
| A4 crash between verify and record | `test/reconcile.test.ts`, `cairn reconcile` pending report |
| A5 new session resumes from the repository | SessionStart hook, final `review_result` |
| A6 every task serves an acceptance criterion | `goal-check`, coverage map in `status --json` |
| A7 audit names the next task from the repository | milestone `review_result` events |
| A8 target changes emit `mission_amended` | live `mission_amended` events with old/new hashes |

The table is a map, not a certificate. The gates and the ledger are the evidence; the final
audit records the verdict against the repository at the mission's last commit.

## Limits

Self-hosting proves the runtime can carry its own delivery. It does not prove the goal is the
right goal, or that a gate measures what matters. Those remain human judgments; the protocol
makes them visible and auditable instead of implicit.
