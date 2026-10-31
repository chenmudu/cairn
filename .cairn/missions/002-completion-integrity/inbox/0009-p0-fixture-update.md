# Decision 0009 — Authorized edit outside T3's declared files

- Status: approved by the human on 2026-10-31 (T3 instruction)
- Date: 2026-10-31
- Serves: A2
- Scope: task-scoped (Mission #2, T3)

## Context

T3 declares `src/review.ts`, `src/complete.ts`, `src/cli.ts`, `test/review.test.ts`,
`test/complete.test.ts`, `test/cli.test.mjs`, `docs/workflow.md`, `docs/workflow.zh.md`,
`docs/i18n.md`, and this mission directory. `test/p0.test.mjs` is not on that list.

T3 changes the review contract from `{reviewer, verdict, findings, packs}` to the D2 shape, and
adds a required human `authorization` after the last review. `test/p0.test.mjs` closes a fixture
mission, so its `REVIEW` constant no longer satisfies the contract and its ledger has no
authorization event. The old test fails for a fixture reason, not because the D1 rule it guards
(commit the ledger, then close) is wrong.

## Decision

Edit `test/p0.test.mjs` only to bring the fixture up to the contract: add the review fields,
write `evidence/review.json` and `evidence/T1/code.json` in the fixture mission, and append an
`authorization` event in the shape of decision 0007 after the review.

No assertion in that file changes: the uncommitted refusal, the close after the ledger commit,
and the clean reconcile stay as they are. `src/review.ts`, `src/complete.ts`, and `src/cli.ts`
are not weakened to let the fixture pass.

## Consequences

The full suite returns to green without relaxing a gate. The one write outside T3's declared
files is this test fixture, recorded here; `audit-session` may report it as a write outside the
plan, and this decision is the authorization it cites.