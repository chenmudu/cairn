# Decision 0011 — Authorized fixture sync outside T4's declared files

- Status: approved by the human on 2026-10-31 (T4 instruction)
- Date: 2026-10-31
- Serves: A4
- Scope: task-scoped (Mission #2, T4)

## Context

T4 declares `src/plan.ts`, `src/cli.ts`, `test/cli.test.mjs`, `test/plan.test.mjs`,
`test/complete.test.ts`, `docs/workflow.md`, `docs/workflow.zh.md`, `docs/i18n.md`, and the
mission directory. `test/p0.test.mjs` and `test/packs-record.test.mjs` are not on that list.

D4 makes `record` require a `task_started` and removes the `gitParent` fallback, so the base
commit comes from the start event and there must be a commit between that base and HEAD. Both
fixtures call `record` without ever starting the task. The full suite failed 13 times, all with
`refused: T1 has no task_started; run cairn start first` — 4 in `p0.test.mjs`, 9 in
`packs-record.test.mjs`.

## Decision

Bring the two fixtures up to the rule, without touching any assertion:

- `test/p0.test.mjs`: `initRepo(root, mission)` records `start T1` between the base commit and
  the empty `setup` commit, so the base is the first commit and `setup` is the work delta.
- `test/packs-record.test.mjs`: the `verify` helper starts the task (an already-active task is
  idempotent), writes and commits `src/work-<task>.ts`, then verifies.

No assertion changed, and the new `start` and `record` checks were not weakened to let a
fixture pass.

## Consequences

The suite returns to green under the new state machine. These are the only writes outside T4's
declared files; `audit-session` may report them, and this decision is the authorization it
cites.