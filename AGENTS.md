# Cairn — Agent Instructions

## Read first

1. `README.md` — what this project is for and what success means.
2. `docs/protocol.md` — the contract.
3. `missions/000-bootstrap/mission.md` — why this repository exists.
4. `missions/000-bootstrap/plan.md` — the current task and its gate.

## Work rules

- One tick advances at most one task.
- A task is done only when a commit exists, a blocking gate exits 0, and `task_done` is in the
  ledger.
- Never edit `ledger.jsonl` by hand after Mission #0. Only `cairn record` writes it.
- Implementer claims are not evidence. Run the gate.
- Every decision made without a human is a ruling; every blocking question is an escalation.
- If the plan cannot express the work, amend the plan first.
- No push, publish, history rewrite, or destructive command without a human.
- A green gate proves the step, not the thesis. Report against the goal in `README.md`, not
  only against exit codes.

## Bootstrap exception

Until `cairn record` exists (end of `T-002`), the human is the only writer of
`ledger.jsonl`. A human may delegate one write to an adapter explicitly; the delegation is
recorded as a ruling and the events carry the adapter's name as `actor`. `T-001` was written
by `zcode` under such a delegation. Hand-written events are marked `"actor":"human"` and must
follow the event schema. Once `cairn record` lands, no manual append is allowed.

## Current step

`T-002` in `missions/000-bootstrap/plan.md`. Read
`missions/000-bootstrap/inbox/0001-plan-defects.md` first: `T-002`'s done-when is stale after
`T-001`.
