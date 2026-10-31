---
schema: cairn/policy@0.1
mission: 002-completion-integrity
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
stop_condition_labels:
  auto:
    - irreversible_or_destructive
    - write_outside_repo
    - budget_exhausted
    - gate_weakened_without_amendment
  human:
    - security_sensitive
    - plan_unrecoverable
    - goal_drift_suspected
    - acceptance_unreachable
approved_exceptions:
  - command: git push origin main
    scope: after each commit on main, on the human standing authorization
    approved_by: human
    date: 2026-10-31
    reason: standing authorization recorded in AGENTS.md; recorded here so policy and practice agree
merge_policy: push_main_after_commit_with_recorded_exception
---

# Policy — Mission #2

This is the pre-answered decision contract for the mission that makes completion a property of
the verified tree. The human approved decision 0006 and ADR 0005 on 2026-10-31. That approval
covers D1–D8, the order T1–T8, and the protocol text change in T7; it does not approve a new
acceptance criterion or a weaker gate.

## History and scope

- Mission #0 and Mission #1 are closed. Their ledgers, evidence, and target artifacts are not
  edited. The new rules apply only to new events.
- A new-shape check is gated by `mission_created.approval_source`, so a closed mission is never
  re-judged by a rule it predates.
- Mission #2 is created by a human-authorized manual `mission_created` freeze. It is the last
  bootstrap exception; T5 makes `cairn init` the writer.

## Protocol changes

- `docs/protocol.md` changes only by `mission_amended` with old and new sha256 hashes, the
  acceptance link, the reason, and `approved_by: human`. T5 adds the runtime writer; T7 records
  the amendment that matches the CLI.
- `mission.md`, `plan.md`, and `policy.md` are target artifacts. A change needs the same
  amendment record. The plan changes inside the approved acceptance envelope with
  `approved_by: cairn`; the mission contract and policy need `approved_by: human`.
- T1 is the single grandfather case for task-level packs: its `task_done` predates D3. From T2
  onward every `task_done` carries two valid pack entries.

## Budgets and stops

- Three attempts per task, two fix rounds per attempt. The third failure parks the task.
- Two hours of wall time per tick. Exceeding it writes `task_parked` with
  `reason: budget_exhausted`.
- Token budget is unset; measure this mission and set a cap in Mission #3.
- Every three completed tasks and at mission end, run the milestone audit before the next task.
- The `stop_condition_labels` split is the machine-readable part: `auto` conditions are
  detectable, `human` conditions are checkpoints. D6/T6 enforces the split; the runtime does not
  pretend to automate a judgment.
- Stop and park rather than guess when a step is destructive, security-sensitive, outside the
  repository, unrecoverable, over budget, or suspected of goal drift.

## Commands

Only `node`, `pnpm`, `git`, and `tsc` may run. `npx` is excluded because it reaches the network.
Publishing, history rewrites, and recursive deletion are forbidden.

`git push origin main` is forbidden by the default list and allowed by the recorded
`approved_exceptions` entry after each commit on `main`. The exception is a human standing
authorization, not an agent decision. A push to another branch, a force push, or a history
rewrite is not covered.

## Rulings

Every decision made without a human is recorded as:

`Ruling: <what was decided> — <why> — <what it costs if wrong>`

An unrecorded deviation is a decision made in secret. It is a protocol violation.
