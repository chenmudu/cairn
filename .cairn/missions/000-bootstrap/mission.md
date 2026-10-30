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
  - id: A6
    check: every task declares serves, and cairn status --json prints the acceptance coverage map
  - id: A7
    check: at each milestone a fresh session names the next task, its gate, and why, from the repository alone
  - id: A8
    check: changing mission, policy, plan, or protocol emits a mission_amended event with old and new hashes
---

# Build Cairn with Cairn

## Intent

Build the smallest version of Cairn that can carry its own development, and use it to build
itself from the first tick. The mission is both the product and the proof: if the protocol
cannot express its own delivery, the protocol is wrong.

The method this mission tests is defined in `README.md`. Cairn is its first artifact; the goal
is a repeatable, auditable way of building products, not a runtime for its own sake.

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
- A6: every task declares `serves`; `cairn status --json` prints the acceptance coverage map.
- A7: at each milestone, a fresh session names the next task, its gate, and why, from the
  repository alone.
- A8: changing `mission.md`, `policy.md`, `plan.md`, or `docs/protocol.md` emits a
  `mission_amended` event with old and new hashes.

## Current action

The ledger is the source of truth for the next task: run `node scripts/goal-check.mjs` or
`node src/cli.ts status`. Read [`inbox/`](inbox/) first; the plan was amended after `T-001`
to add `serves` links and drift controls.