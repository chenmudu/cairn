---
schema: cairn/mission@0.1
id: 000-bootstrap
title: Build Cairn with Cairn
status: active
created: 2026-10-31
owner: chenmudu
acceptance:
  - id: A1
    check: node scripts/validate-mission.mjs missions/000-bootstrap exits 0
  - id: A2
    check: cairn status --json reconstructs every task state from ledger + git alone
  - id: A3
    check: one task is delivered end-to-end through next -> dispatch -> verify -> record
  - id: A4
    check: killing the process between verify and record leaves a state reconcile explains, with no duplicate commit
  - id: A5
    check: a new session resumes the mission from the repository alone, without the prior conversation
---

# Build Cairn with Cairn

## Intent

Build the smallest version of Cairn that can carry its own development, and use it to build
itself from the first tick. The mission is both the product and the proof: if the protocol
cannot express its own delivery, the protocol is wrong.

## Non-goals

- No UI, no database, no hosted service.
- No harness-specific adapter in M0; the generic dispatch packet is enough.
- No feature that this mission does not need.
- No merge of the superpowers or Impeccable repositories. They are content and gate packs,
  consumed by reference, not code to absorb.

## Constraints

- Git is the only durable store. Any index or cache must be rebuildable from the ledger and
  git history.
- `ledger.jsonl` is append-only and has a single writer: `cairn record`. Adapters return
  reports; they never write the ledger.
- A task is done only with a commit, a blocking gate at exit 0, and a `task_done` event.
- Every task must be expressible in `plan.md` before it starts. If it is not, amend the plan
  first.
- The first tick is manual. Each manual step is replaced by a command as that command lands.

## Acceptance

- A1: the protocol validator accepts this mission and rejects a fixture with a missing gate.
- A2: task state is reconstructable from `ledger.jsonl` + `git log`, with no cache.
- A3: one task runs `next -> dispatch -> verify -> record` without a manual ledger edit.
- A4: a crash between `verify` and `record` is reconciled without re-running the task or
  duplicating its commit.
- A5: a fresh session, given only this repository, can name the next task and its gate.

## First action

`T-001` in [`plan.md`](plan.md). Nothing else starts first.