# Mission #1 inbox

Decisions waiting for a human. One file per decision; every file has a Chinese companion. A
blocking question is an escalation: it parks the task until answered. A decision made without
a human is a ruling and is recorded in the ledger.

Placement: a decision that closes or blocks a mission acceptance criterion lives in this inbox.
`docs/decisions/` holds the project-wide ADR series; a mission decision is promoted there only
when it outlives the mission, as an explicit move.

Answered:

- `0005-packs-block.md` — inbox decision 0005, approved by the human on 2026-10-31. The `packs`
  block, the two CLI commands, and the invariant 3 wording are recorded as protocol amendments
  with `approved_by: human`; T7 is unblocked.

Waiting now:

- `0006-completion-integrity.md` — approve the Mission #2 remediation plan for completion
  binding, acceptance and review evidence, task-level pack participation, task state,
  validator and CI, policy execution, and contract truth. Mission #1 stays closed;
  implementation is Mission #2.

The T3 milestone audit has no open decision. The T6 audit findings are recorded in the ledger;
the example and bilingual repairs landed, and the remaining runtime gaps are T7 work. The
post-close audit and the Mission #2 plan are in `0006-completion-integrity.md`.
