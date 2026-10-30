# 0001 — a recorded docs tick

This is a museum piece: a real, small tick recorded with the same shapes a live mission uses.
It is not a live mission and it is not a second source of truth for Cairn. The ledger's commit
ids are the real T6 commits that added this example, so the validator and `reconcile` accept
it.

## What happened

- **Task E1** wrote `product.md`, a one-page brief for a new operator.
- **Gate** `node scripts/check-example.mjs --product method/examples/0001-docs-tick` exited 0.
- **Evidence** is in `evidence/E1/example.json`.
- **Ledger** `ledger.jsonl` records `mission_created`, `gate_result`, `task_done`, and
  `review_result`.
- **Review** passed with the pack record below.

Run the full check from the repository root:

```sh
node scripts/check-example.mjs --example method/examples/0001-docs-tick
```

Run only the product gate:

```sh
node scripts/check-example.mjs --product method/examples/0001-docs-tick
```

## Pack record

- **superpowers 7.0.1**: `test-driven-development` was used to build the checker and this
  example. Evidence: `test/example.test.mjs` (RED first, then GREEN).
- **Impeccable 4.8.0+df3a4ab**: present, `not-applicable` for this surface. Reason: there is no
  markup or URL; `detect` on markdown returns `[]`, which is not a clean result. The review is
  criteria-based: `critique` (hierarchy, clarity, restraint) and `polish` (wording, no
  duplicated contract) were applied by reading the text, not by running a detector.
- **Engine** `0.1.18` is installed; this example does not invoke it because the surface is
  markdown. No detector claim is made.

## Why this is enough

The point is not the product. The point is the shape: one task, one gate, one evidence file,
one `task_done`, and a review that records what was used and what was not. A fresh session can
read this directory and see what a completed tick leaves behind.
