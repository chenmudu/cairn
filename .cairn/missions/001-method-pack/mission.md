---
schema: cairn/mission@0.1
id: 001-method-pack
title: Make the method real
status: active
created: 2026-10-31
owner: chenmudu
acceptance:
  - id: B1
    check: cairn init creates .cairn/missions/<id>; cairn resolves .cairn/missions/<id> and still falls back to missions/<id>; Mission #0 is migrated with validate and reconcile at exit 0; the protocol amendment is recorded with approved_by human
  - id: B2
    check: every human-facing artifact has a Chinese companion; node scripts/check-bilingual.mjs exits 0; docs/i18n.md lists the current status
  - id: B3
    check: node scripts/check-method.mjs exits 0; the playbook maps every phase to a superpowers practice, an Impeccable standard, and a Cairn artifact or gate; standards and templates exist in both languages
  - id: B4
    check: docs/workflow.md covers roles, one-tick steps, human checkpoints, and failure paths; a fresh session can run a dry tick from it; method/examples contains a recorded worked example with ledger and evidence
  - id: B5
    check: a fresh-context reviewer names the goal, the .cairn layout, the next task, and the one-tick flow from the repository alone; the review_result is pass
  - id: B6
    check: node --test passes; Mission #0 ledger and evidence still validate and reconcile after migration; no blocking gate is weakened
---

# Make the method real

## Intent

Mission #0 proved that the runtime can carry its own delivery. It did not deliver the method
itself: the fusion of superpowers and Impeccable, the artifact layout, the bilingual
documentation, or the operator flow. This mission closes that gap with products, not with more
runtime mechanics.

The method is the project. Cairn is its first artifact. This mission produces the method pack
and uses it to build itself, so the next person can start from the repository alone.

## Non-goals

- No UI, database, or hosted service.
- No vendoring or merging of the superpowers or Impeccable repositories. They stay external
  sources, cited by version.
- No unattended scheduler or multi-tick loop. That is Mission #2.
- No rewrite of Mission #0's ledger, evidence, or history. It stays closed and valid.
- No new runtime feature outside the gaps named in the plan.
- No protocol change without `approved_by: human`.

## Constraints

- `.cairn/missions/<id>/` holds mission, policy, plan, ledger, evidence, and inbox.
  `.cairn/cache/` is never committed.
- English is canonical for machine-checked contracts. Every human-facing artifact has a
  Chinese companion. A translation never overrides the English file.
- A task is done only with a commit, a blocking gate at exit 0, and a `task_done` event.
- One tick advances at most one task.
- Mission #0 is historical. Its ledger is not edited; only the runtime may read it from its
  new path.

## Acceptance

- B1: the `.cairn` layout is real, `cairn init` works, legacy paths still resolve, and the
  protocol amendment is human-approved.
- B2: the bilingual claim is enforced, not asserted: every human-facing artifact has a
  Chinese companion and the check exits 0.
- B3: the fusion playbook maps every phase to a superpowers practice, an Impeccable standard,
  and a Cairn artifact or gate; standards and templates make it usable.
- B4: a newcomer can run one tick from the operator guide alone, and a recorded worked example
  proves the guide is executable.
- B5: a fresh session, given only the repository, can name the goal, the layout, the next
  task, and the one-tick flow.
- B6: the migration does not weaken the runtime: the existing tests pass and Mission #0 still
  validates and reconciles.

## Current action

The ledger is the source of truth. Run
`node scripts/goal-check.mjs .cairn/missions/001-method-pack` before starting; read
[`inbox/`](inbox/) for open decisions. The next task is derived from the ledger and the plan,
never from this section.
