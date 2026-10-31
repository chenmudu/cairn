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

Approved:

- `0006-completion-integrity.md` — approved by the human on 2026-10-31. It defines Mission #2
  (`002-completion-integrity`), A1–A6, T1–T8, and the D1–D8 workstreams. The binding approval is
  the Mission #2 `mission_created` event with `approval_source: ["0006", "0005"]`; the decision
  file is not the record. Mission #1 stays closed.

Waiting now: nothing. Mission #2 is created by a human-authorized manual `mission_created`
freeze, the last bootstrap exception; T5 makes `cairn init` the writer.

The T3 milestone audit has no open decision. The T6 audit findings are recorded in the ledger;
the example and bilingual repairs landed, and the remaining runtime gaps are T7 work. The
post-close audit and the Mission #2 contract are in `0006-completion-integrity.md`.
