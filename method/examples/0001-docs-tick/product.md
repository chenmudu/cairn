# One tick, one trail

## Problem

A new operator sees gates and a ledger but not what a completed tick leaves behind. The
protocol explains the rules; it does not show the shape of the result.

## Audience

A fresh session, a new contributor, or a reviewer who wants one concrete tick before running
a real mission.

## Promise

A small, verifiable example: one task, one product, one gate at exit 0, one evidence file, one
`task_done`, and one review that names the packs it used or why they did not apply.

## Non-goals

- No UI, database, or hosted service.
- No scheduler or multi-tick loop.
- No second ledger or pack-owned progress file.

## Acceptance

- `node scripts/check-example.mjs --example method/examples/0001-docs-tick` exits 0.
- The ledger contains a passing `gate_result` with existing evidence, a `task_done`, and a
  `review_result` with pack records.
- The review records Impeccable as `present, not-applicable` with a reason; it does not claim
  a detector run on markdown.
