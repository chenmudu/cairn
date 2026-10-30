# Cairn — Agent Instructions

## Read first

1. `docs/protocol.md` — the contract.
2. `missions/000-bootstrap/mission.md` — why this repository exists.
3. `missions/000-bootstrap/plan.md` — the current task and its gate.

## Work rules

- One tick advances at most one task.
- A task is done only when a commit exists, a blocking gate exits 0, and `task_done` is in the
  ledger.
- Never edit `ledger.jsonl` by hand after Mission #0. Only `cairn record` writes it.
- Implementer claims are not evidence. Run the gate.
- Every decision made without a human is a ruling; every blocking question is an escalation.
- If the plan cannot express the work, amend the plan first.
- No push, publish, history rewrite, or destructive command without a human.

## Bootstrap exception

Until `cairn record` exists (end of `T-002`), the human is the single writer of
`ledger.jsonl`. Manual events are marked `"actor":"human"` and must follow the event schema.
Once `cairn record` lands, no manual append is allowed.

## Current step

`T-001` in `missions/000-bootstrap/plan.md`. Do not start `T-002` before `T-001`'s gate is
green and recorded.