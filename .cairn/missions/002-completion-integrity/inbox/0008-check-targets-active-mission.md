# Decision 0008 — Scope check-targets to the active mission

- Status: approved by the human on 2026-10-31 (T3 instruction)
- Date: 2026-10-31
- Serves: A5
- Scope: mission-scoped (Mission #2)

## Context

- `docs/protocol.md` is currently `sha256:f9498f31...`, the hash Mission #1 froze in its ledger
  (`.cairn/missions/001-method-pack/ledger.jsonl:44`).
- CI runs `node scripts/check-targets.mjs .cairn/missions/001-method-pack`
  (`.github/workflows/gates.yml:35`).
- `scripts/check-targets.mjs` has no active-mission logic; it rebuilds the hash chain for
  whatever mission it is given.
- T7 will change `docs/protocol.md` under a `mission_amended` event in Mission #2. Once the file
  changes, the Mission #1 chain no longer matches the worktree, so the existing CI step fails
  even though Mission #1's ledger and its own artifacts are untouched.

## Decision

T5 must make `check-targets` skip a closed mission that is not the active mission (read
`.cairn/config.json`), or remove the Mission #1 `check-targets` step from CI. T5 records the
reason in its task report or a decision. The Mission #1 ledger is not edited. T3 records this
obligation only; it does not change `scripts/check-targets.mjs`.

## Consequences

T7 can change `docs/protocol.md` without breaking the historical mission's CI step. The active
mission's target chain remains checked. A `check-targets` run against a non-active closed mission
reports a skip, not a false violation.
