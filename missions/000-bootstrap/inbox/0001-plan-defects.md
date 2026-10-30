# 0001 — Open defects and risks after T-001

- Status: open (items 3, 4), resolved (items 1, 2)
- Updated: 2026-10-31

## 1. T-003's fixture gate polarity — resolved

The plan was amended: the gate is now
`node scripts/validate-mission.mjs --expect-invalid test/fixtures/missing-gate`, and `T-003`
adds the flag to the validator.

## 2. T-002's done-when is stale after T-001 — resolved

The plan was amended: the refusal target is `T-002` itself, which has no evidence yet.

## 3. Invariant 3 cannot hold for a self-referential head — open

`task_done.head` names the work commit. The ledger line containing it can only be written
after that commit exists, so the ledger and the code cannot land in the same commit.

Options:

- Define the convention: the ledger event lands in the commit immediately after `head`, and
  `reconcile` accepts it.
- Redefine `head` as a tree object, or have `cairn record` amend the commit.
- Record a bootstrap-only exception for Mission #0.

Default if undecided: the first option, accepted before `T-005`.

## 4. T-002 needs a TypeScript toolchain — open

The plan expects `pnpm typecheck`, but `typescript` is not installed.

Options:

- Add `typescript` as a devDependency and run `pnpm install` (network).
- Write the CLI in plain ESM and keep `node --check` as the gate (no new dependency).

Default if undecided: install `typescript` as a devDependency; fall back to plain ESM if the
network is unavailable.
