# 0001 — Open defects and risks after T-001

- Status: open (item 3), resolved (items 1, 2, 4)
- Updated: 2026-10-31
- Legacy: true

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

Default if undecided: the first option, accepted before `T-005`. `T-002` followed it: its
`task_done` head names the work commit and the event lands in the ledger commit after it.

## 4. T-002 needs a TypeScript toolchain — resolved

The plan expects `pnpm typecheck`, but `typescript` was not installed.

Resolution: `typescript@7.0.2` and `@types/node@26.6.6` are devDependencies; `pnpm-lock.yaml`
is committed; `pnpm typecheck` exits 0. Node 24 also strips types at runtime, so the CLI and
the tests run without a build step. No runtime dependency was added.
