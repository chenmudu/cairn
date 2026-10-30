---
name: cairn-guard
description: Use at the start and end of every task in the Cairn repository. Runs the goal check and the session drift audit, and refuses completion claims without gate evidence.
---

# Cairn guard

This repository makes completion a property of the repository, not the conversation. The
guard exists so the agent does not need the human to restate the goal.

## Before any implementation

1. Run `node scripts/goal-check.mjs`.
2. Say in one sentence: the current task, its `serves` link, and the acceptance check.
3. If the task is not in `plan.md`, has no `serves`, or the check fails, stop and amend the
   plan first. Do not start work that the plan cannot express.

## Before writing a decision

1. Run `node scripts/check-decisions.mjs`.
2. State the scope and path: a project-wide ADR goes to `docs/decisions/`; a mission escalation
   goes to `.cairn/missions/<id>/inbox/`.
3. Write the decision, then run the check again. A wrong path, a missing field, or a missing
   Chinese companion is a failure.

## Before changing a rule's enforcement

1. Run `node scripts/check-enforcement.mjs`.
2. Decide the enforcement: a script/test/CI check, or `human`/`review`. If it cannot be
   mechanized, label it; do not invent a check.
3. Update `docs/drift-control.md` and its Chinese companion, then run the check again.

## Before claiming completion

1. Run every `severity: block` gate in the task. Paste the commands and exit codes.
2. Run `node scripts/audit-session.mjs`. Report the drift signals: alignment corrections,
   claims without a gate, writes outside the plan, and confirmation requests.
3. Completion requires all three: a commit, a blocking gate at exit 0, and a `task_done`
   event. A green gate proves this step, not the mission.

## Rules

- Never ask the human to re-confirm the goal or positioning. Read `README.md`, the active
  `.cairn/missions/<id>/mission.md`, and the ledger.
- A human decision is an escalation; a decision made without one is a ruling. Record it.
- If a write falls outside the task's declared files, record a ruling or amend the plan.
- Before claiming a pack is absent, present, or working, check its actual path and version.
  Record the path, version, and command result. The skill list and memory are not proof.
- Empty or `not-applicable` output is not a pass. Record the reason and the fallback.
- If a required check cannot run, record the failure and the substitute evidence. Never report
  an unrun check as passed; fix the guard when the guard is what failed.
- Keep the layers separate: this `SKILL.md` is the SOP, reference material lives in `docs/`,
  executable checks in `scripts/` (shared) or the skill's `scripts/` (private). Do not paste a
  script or a long document into the SOP.
- The session start hook prints the same anchor from the repository. Treat it as a reminder,
  not as a substitute for running the check.
