---
schema: cairn/mission@0.1
id: 0001-docs-tick
title: One tick, one trail
status: closed
created: 2026-10-31
owner: cairn
acceptance:
  - id: A1
    check: node scripts/check-example.mjs --example method/examples/0001-docs-tick exits 0
  - id: A2
    check: the ledger records a passing gate, task_done, and a review with pack records
---

# One tick, one trail

## Intent

A new operator can read the protocol and still not see what a completed tick leaves behind.
This example is a real, small tick: one task, one product, one gate, one evidence file, one
`task_done`, and one review. It is a museum piece, not a live mission.

## Non-goals

- No UI, database, or hosted service.
- No scheduler or multi-tick loop.
- No second ledger.

## Constraints

- The example is self-contained under this directory.
- The gate is runnable from the repository root.
- The pack record names what was used, or `not-applicable` with a reason.

## Acceptance

- A1: `node scripts/check-example.mjs --example method/examples/0001-docs-tick` exits 0.
- A2: the ledger has a `gate_result` at exit 0 with evidence, a `task_done`, and a
  `review_result` with pack records.

## Current action

This mission is closed. The ledger is the record; the product is `product.md`.
