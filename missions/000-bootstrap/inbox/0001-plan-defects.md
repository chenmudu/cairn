# 0001 — Plan and protocol defects found during T-001

- Status: open
- Needs: a human decision before the named task starts
- Recorded: 2026-10-31

## 1. `T-003`'s `fixture` gate has the wrong polarity

`plan.md` declares, with `severity: block`:

    node scripts/validate-mission.mjs test/fixtures/missing-gate

That fixture is deliberately invalid, so the command exits 1. A blocking gate that can never
exit 0 makes `T-003` impossible to finish.

Options:

- Add `--expect-invalid` to the validator and use it in the gate.
- Add a small assertion wrapper that exits 0 only when the validator rejects the fixture.

Default if undecided: `--expect-invalid` — one tool, fixed argv.

## 2. `T-002`'s done-when is stale after `T-001`

`T-002` is done when `cairn record T-001 --status done` refuses because T-001 has no evidence.
T-001 now has evidence, so that refusal cannot happen.

Options:

- Use `T-002` itself as the refusal target; it has no evidence yet.
- Keep `T-001` and test a different missing condition.

Default if undecided: use `T-002` itself.

## 3. Invariant 3 cannot hold for a self-referential head

`task_done.head` names the work commit. The ledger line containing it can only be written
after that commit exists, so the ledger and the code cannot land in the same commit.

Options:

- Define the convention: the ledger event lands in the commit immediately after `head`, and
  `reconcile` accepts it.
- Redefine `head` as a tree object, or have `cairn record` amend the commit.
- Record a bootstrap-only exception for Mission #0.

Default if undecided: the first option, accepted before `T-005`.
