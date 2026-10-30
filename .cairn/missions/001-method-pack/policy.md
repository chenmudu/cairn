---
schema: cairn/policy@0.1
mission: 001-method-pack
budgets:
  max_attempts_per_task: 3
  max_fix_rounds: 2
  max_wall_time_per_tick_minutes: 120
  max_tokens_per_tick: null
  max_completed_tasks_between_audits: 3
allowed_commands:
  - node
  - pnpm
  - git
  - tsc
forbidden_commands:
  - npm publish
  - git push
  - git reset --hard
  - rm -rf
stop_conditions:
  - irreversible_or_destructive
  - security_sensitive
  - write_outside_repo
  - plan_unrecoverable
  - budget_exhausted
  - goal_drift_suspected
  - acceptance_unreachable
  - gate_weakened_without_amendment
escalation_defaults:
  missing_context: read_repo_then_ask
  ambiguous_requirement: choose_conservative_option_consistent_with_non_goals
  gate_impossible: park
  dependency_conflict: park
  goal_conflict: park
  amendment_without_acceptance_link: park
merge_policy: no_push_without_human
---

# Policy — Mission #1

This is the pre-answered decision contract for the mission that turns the runtime into a
usable method. The human approved the `.cairn` layout, the Mission #0 migration, and the
method-pack form on 2026-10-31. Those approvals cover the plan's direction, not automatic
approval of every protocol edit.

## Layout and history

- Runtime state lives in `.cairn/missions/<id>/`. `.cairn/cache/` is not committed.
- Mission #0 is migrated, not rewritten. Its ledger and evidence stay byte-identical; only
  their paths move.
- A legacy `missions/<id>/` directory still resolves, so existing checkouts do not break.

## Bilingual rule

- Every human-facing artifact ships with a Chinese companion in the same task.
- English stays canonical for anything the validator or runtime parses. A Chinese companion
  never changes a machine-checked field.
- A translation is stale when its source changes. The header names the source and the task or
  commit it translates.

## Protocol changes

- `docs/protocol.md` changes only by `mission_amended` with old and new sha256 hashes, the
  acceptance link, the reason, and `approved_by: human`.
- The `.cairn` layout is such a change: the human approved it on 2026-10-31.
- Invariant 3 (which commit holds the ledger event) is not silently rewritten. T7 records the
  decision; a human amendment is still required.

## Budgets and stops

- Three attempts per task, two fix rounds per attempt. The third failure parks the task.
- Two hours of wall time per tick. Exceeding it writes `task_parked` with
  `reason: budget_exhausted`.
- Token budget is unset; measure this mission and set a cap in Mission #2.
- Every three completed tasks and at mission end, run the milestone audit before the next
  task.
- Stop and park rather than guess when a step is destructive, security-sensitive, outside the
  repository, unrecoverable, over budget, or suspected of goal drift.

## Commands

Only `node`, `pnpm`, `git`, and `tsc` may run. `npx` is excluded because it reaches the
network. `git push`, publishing, history rewrites, and recursive deletion are forbidden.

## Rulings

Every decision made without a human is recorded as:

`Ruling: <what was decided> — <why> — <what it costs if wrong>`

An unrecorded deviation is a decision made in secret. It is a protocol violation.
