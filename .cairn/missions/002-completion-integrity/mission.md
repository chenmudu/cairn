---
schema: cairn/mission@0.1
id: 002-completion-integrity
title: Completion integrity
status: active
created: 2026-10-31
owner: chenmudu
acceptance:
  - id: A1
    check: the P0 probe fails at record; a clean tree passes; tests cover a tree mismatch, a dirty worktree, and an uncommitted task_done; CI runs the probe
  - id: A2
    check: review_result carries per-criterion coverage, non_goals, cold_start, reviewer provenance, and ui_surface; mission_done rejects a review missing any field and requires a human authorization event; replaying Mission #1 B5/B7 evidence under the rule fails
  - id: A3
    check: every new task_done carries two valid pack entries; record refuses a missing or invalid record; at least one superpowers mode use has evidence passing isEvidenceFile with RED then GREEN; Impeccable is all-not-applicable only with no UI surface and a closing review ui_surface none; absent carries a reason and floor evidence
  - id: A4
    check: record without start fails; an out-of-order start fails; a parked task can be answered and completed; historical tasks without task_started stay valid
  - id: A5
    check: cairn init appends mission_created; a tampered hash, a non-existent commit, a partial blocking-gate set, and an uncommitted completion event each fail; CI runs reconcile and the probe
  - id: A6
    check: an out-of-list gate is refused; a push requires a recorded exception; docs/protocol.md matches the CLI; cairn record --authorized writes an authorization event and audit-session accepts covered paths; every mechanizable audit finding has a negative test and every non-mechanizable one is labelled human or review
---

# Completion integrity

## Intent

Mission #1 delivered the method. A post-close audit showed that its completion claims were not
bound to the tree that produced them: a red tree could record `task_done` and close the mission.
Mission #2 makes completion mean what `README.md` says: the repository, not the conversation,
proves the work. It binds gates to the verified tree, binds acceptance and review evidence to
criteria, records pack participation per task, enforces the state machine, makes `init`, the
validator, and CI check the contract, makes policy executable, records human authorizations, and
makes the contract and status sources tell the truth.

Decision 0006 in `.cairn/missions/001-method-pack/inbox/` is the full contract. This mission
implements it; it does not re-open the debate.

## Non-goals

- No rewrite of Mission #0's or Mission #1's ledgers, evidence, or target artifacts. They stay
  byte-identical and valid; the new rules apply only to new events.
- No vendoring or merging of the superpowers or Impeccable repositories. They stay external.
- No UI surface, design system, or hosted service. Impeccable participation is criteria-based;
  `not-applicable` is expected and must be recorded.
- No unattended scheduler or multi-tick loop. Completion integrity comes first; the loop is a
  later mission.
- No new runtime feature outside D1–D8.
- No reopening GitHub issues #1–#5. They are closed as superseded by decision 0006; reopen one
  only if the decision is rejected.
- No protocol change without `approved_by: human`.

## Constraints

- One tick advances at most one task. A task is done only with a commit, a blocking gate at
  exit 0 on the verified tree, and a `task_done` event in the ledger.
- The order is work → commit the work → verify → record → commit the ledger only. `verify` runs
  on a clean worktree outside `.cairn/`.
- English is canonical for machine-checked contracts. Every human-facing artifact has a Chinese
  companion. A translation never overrides the English file.
- Mission #0 and Mission #1 are historical. Their ledgers, evidence, and target artifacts are
  not edited.
- Decision 0006 is the contract for this mission: A1–A6, T1–T8, and D1–D8.

## Acceptance

- A1: completion is bound to the verified tree.
- A2: acceptance and review evidence name the criterion; the reviewer is evidence; `mission_done`
  requires a human authorization event.
- A3: pack participation is recorded per task (ADR 0005).
- A4: the task state machine is enforced.
- A5: `init`, the validator, and CI match the contract.
- A6: policy is executable or labelled human, the contract matches the CLI, and every audit
  finding is covered.

## Current action

The ledger is the source of truth. Run `node scripts/goal-check.mjs` before starting; read
`plan.md` for the next task, its serving criterion, and its gates. The next task is derived from
the ledger and the plan, never from this section.
