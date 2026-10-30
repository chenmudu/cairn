# Cairn — Agent Instructions

## Read first

1. `README.md` — the positioning and what success means. Read this before the protocol.
2. `docs/protocol.md` — the contract.
3. `missions/000-bootstrap/mission.md` — the goal, non-goals, and acceptance criteria.
4. `missions/000-bootstrap/plan.md` — the current task and its gate.
5. `missions/000-bootstrap/inbox/` — decisions waiting for a human.

## Self-observation

- Before starting a task: `node scripts/goal-check.mjs`. It prints the mission intent, the next
  task, its `serves` link, the gates, and the coverage map. Exit 1 means stop and fix the plan.
- Before claiming done: run the gates, then `node scripts/audit-session.mjs`. It reads the
  actual transcript and reports alignment corrections, completion claims with no gate, writes
  outside the plan, and confirmation requests.
- The project skill `.zcode/skills/cairn-guard/` encodes the same checks. The SessionStart hook
  runs `goal-check --brief` and injects the anchor into every new or compacted session.
- Do not ask the human to restate the goal or positioning. Read `README.md`,
  `missions/000-bootstrap/mission.md`, and the ledger. If the guard is wrong, fix the guard.
- Documentation is bilingual: English is canonical for machine-checked contracts; Chinese
  companions are listed in `docs/i18n.md` and never override the canonical file.

## Work rules

- One tick advances at most one task.
- A task is done only when a commit exists, a blocking gate exits 0, and `task_done` is in the
  ledger.
- A task must declare `serves: [A#]`. If it cannot name the acceptance criterion it advances,
  do not start it.
- Never edit `ledger.jsonl` by hand after Mission #0. Only `cairn record` writes it.
- Implementer claims are not evidence. Run the gate.
- A green gate proves the step, not the goal. Report against `README.md`, not only exit codes.
- Every decision made without a human is a ruling; every blocking question is an escalation.
- If the plan cannot express the work, amend the plan first, and record the amendment.
- Target artifacts (`mission.md`, `policy.md`, `plan.md`, `docs/protocol.md`) change only by
  amendment with old and new hashes. See `docs/drift-control.md`.
- No push, publish, history rewrite, or destructive command without a human.

## Milestone audit

Every three completed tasks and at mission end, before starting the next task:

1. Coverage: which acceptance criteria did the completed work advance? Which remain unproven?
2. Non-goals: did any task touch a non-goal? Cite the task and the ruling.
3. Cold start: a fresh session with only the repository names the next task, its gate, and why
   it serves the mission. A wrong answer is drift.

Record the result as `review_result`; a fail parks the mission.

## Bootstrap exception

Until `cairn record` exists (end of `T-002`), the human is the only writer of
`ledger.jsonl`. A human may delegate one write to an adapter explicitly; the delegation is
recorded as a ruling and the events carry the adapter's name as `actor`. `T-001`, the
goal-integrity amendment, and the `T-006` plan amendment were written by `zcode` under such a
delegation. Hand-written events are marked `"actor":"human"`. Once `cairn record` lands, no
manual append is allowed.

## Current step

Run `node scripts/goal-check.mjs` before starting. It derives the next task from the ledger and
the plan, so this file does not go stale. `T-006` is the guard itself; after it, `T-002`.
Read `missions/000-bootstrap/inbox/` before starting; the plan was amended to add `serves`
links, drift controls, and the guard.
