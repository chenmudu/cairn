# Cairn — Agent Instructions

## Read first

1. `README.md` — the positioning and what success means. Read this before the protocol.
2. `docs/protocol.md` — the contract.
3. `.cairn/missions/<id>/mission.md` — the active goal, non-goals, and acceptance. `<id>` is
   `active_mission` in `.cairn/config.json`; `node scripts/goal-check.mjs` names it.
4. `.cairn/missions/<id>/plan.md` — the current task and its gate.
5. `.cairn/missions/<id>/inbox/` — decisions waiting for a human. Mission #0 is archived under
   `.cairn/missions/000-bootstrap/`.

## Self-observation

- Before starting a task: `node scripts/goal-check.mjs`. It prints the mission intent, the next
  task, its `serves` link, the gates, and the coverage map. Exit 1 means stop and fix the plan.
- Before claiming done: run the gates, then `node scripts/audit-session.mjs`. It reads the
  actual transcript and reports alignment corrections, completion claims with no gate, writes
  outside the plan, and confirmation requests.
- The project skill `.zcode/skills/cairn-guard/` encodes the same checks. The SessionStart hook
  is configured for `startup|resume` and runs `goal-check --anchor`, which always prints the
  anchor and appends a warning when the check fails. The hook only runs after the workspace hook
  is trusted; until then run the command by hand. See `docs/automation.md`.
- Do not ask the human to restate the goal or positioning. Read `README.md`, the active
  `.cairn/missions/<id>/mission.md`, and the ledger. If the guard is wrong, fix the guard.
- Documentation is bilingual: English is canonical for machine-checked contracts; Chinese
  companions are listed in `docs/i18n.md` and never override the canonical file.

## Evidence discipline

- Every factual claim about the repository, a pack, a tool, or a run cites a file, command
  output, or commit. If it is not verified, write `unverified`; do not fill the gap with a
  plausible answer.
- Before declaring a pack or tool absent, present, or working, check the actual path and run
  its version or smoke command. Record the path, version, and result. A skill listing, a
  README, or a previous session is not proof.
- An empty or `not-applicable` tool result is not a pass. Record the reason and use the
  declared fallback.
- If a required check cannot run, record the failure and the substitute evidence. Never report
  an unrun check as passed. When the guard itself is wrong, fix the guard.

## Work rules

- One tick advances at most one task.
- A task is done only when a commit exists, a blocking gate exits 0, and `task_done` is in the
  ledger.
- A task must declare `serves: [<acceptance-id>]`. If it cannot name the acceptance criterion
  it advances, do not start it.
- Only runtime commands write `ledger.jsonl`. `cairn record` owns task and mission events;
  `cairn review` owns `review_result` events; `cairn start` and `cairn answer` own
  `task_started`. The Mission #1 `mission_created` bootstrap is a recorded ruling, not a
  standing exception.
- Implementer claims are not evidence. Run the gate.
- A green gate proves the step, not the goal. Report against `README.md`, not only exit codes.
- Every decision made without a human is a ruling; every blocking question is an escalation.
- Decision records: project-wide ADRs live in `docs/decisions/`; mission decisions live in
  `.cairn/missions/<id>/inbox/`. Run `node scripts/check-decisions.mjs` before and after
  writing one. The SessionStart hook injects the same routing rule.
- Rule enforcement: a rule lives once in a canonical doc. Every failure mode in
  `docs/drift-control.md` names a runnable check or `human`/`review`; run
  `node scripts/check-enforcement.mjs` before and after changing one. Injection
  (hook/skill/AGENTS) makes a rule known; only the check makes it binding.
- If the plan cannot express the work, amend the plan first, and record the amendment.
- Target artifacts (`mission.md`, `policy.md`, `plan.md`, `docs/protocol.md`) change only by
  amendment with old and new hashes. Run `node scripts/check-targets.mjs` after the amendment.
  See `docs/drift-control.md`.
- No push, publish, history rewrite, or destructive command without a human, except routine
  pushes of `main` to `origin` after each commit (human-authorized 2026-10-31). Never force
  push, rewrite history, or push another branch without a human.

## Milestone audit

Every three completed tasks and at mission end, before starting the next task:

1. Coverage: which acceptance criteria did the completed work advance? Which remain unproven?
2. Non-goals: did any task touch a non-goal? Cite the task and the ruling.
3. Cold start: a fresh session with only the repository names the next task, its gate, and why
   it serves the mission. A wrong answer is drift.

Record the result as `review_result`; a fail parks the mission.

## Bootstrap exception (expired)

Mission #0's bootstrap exception ended when `cairn verify` landed. `cairn init` writes
`mission_created`, and since T5 the validator enforces the new-shape chain for missions created
that way. Mission #2's `mission_created` was a human-authorized manual freeze, the last one; new
missions use `cairn init`, and events come from runtime commands. No standing manual append is
allowed.

## Current step

Run `node scripts/goal-check.mjs` before starting. It resolves the active mission from
`.cairn/config.json`, derives the next task from the ledger and the plan, and does not go
stale. Read `.cairn/missions/<id>/inbox/` before starting.
