---
schema: cairn/policy@0.1
mission: 000-bootstrap
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

# Policy — Mission #0

This file is the pre-answered decision contract. During a tick, only the stop conditions below
escalate; everything else is a ruling recorded in the ledger.

## Budgets

- Three attempts per task, two fix rounds per attempt. The third failure parks the task.
- Two hours of wall time per tick. A tick that exceeds it writes `task_parked` with
  `reason: budget_exhausted`.
- Token budget is unset in M0. Measure first; add a hard cap in M1.
- Every three completed tasks, and at mission end, run the milestone audit in
  `docs/drift-control.md` before starting the next task.

## Goal integrity

- A task without a `serves: [A#]` link is not started.
- A target artifact (`mission.md`, `policy.md`, `plan.md`, `docs/protocol.md`) changes only by
  `mission_amended` with old and new hashes. Until `cairn record` implements that event
  (`T-002`), the amendment is a `ruling` carrying the same fields.
- An amendment without an acceptance link parks the mission. So does a suspected goal drift, an
  unreachable acceptance criterion, or a gate weakened without an amendment.

## Commands

Only `node`, `pnpm`, `git`, and `tsc` may run. `npx` is excluded in M0 because it reaches the
network. A gate that needs another command amends this file first.

`git push`, publishing, history rewrites, and recursive deletion are forbidden. They are also
stop conditions: if a task appears to need one, park it.

## Stop conditions

A tick stops and parks the task — never guesses — when:

1. The next step is irreversible or destructive.
2. The next step is security-sensitive (credentials, auth, signing, permissions).
3. The next step writes outside this repository.
4. The plan cannot be followed and every path forward is a guess.
5. Goal drift is suspected: the work no longer maps to an acceptance criterion, or a task
   touched a non-goal.
6. An acceptance criterion looks unreachable within the budget.
7. A gate was weakened without an amendment that says what it still proves.

Budget exhaustion is also a stop: park, do not improvise.

## Escalation defaults

- Missing context: read the repository first; ask only if the answer is not in the files.
- Ambiguous requirement: choose the conservative option consistent with the mission's
  non-goals, and record a `ruling`.
- Gate impossible: park. Do not weaken the gate to make it pass.
- Dependency conflict: park. Do not silently upgrade or downgrade a dependency.
- Goal conflict: park. The goal is not the agent's to renegotiate; record the conflict.
- Amendment without an acceptance link: park. A change that serves nothing is drift.

## Rulings

Every decision made without a human is recorded as:

`Ruling: <what was decided> — <why> — <what it costs if wrong>`

An unrecorded deviation is a decision made in secret. It is a protocol violation.
