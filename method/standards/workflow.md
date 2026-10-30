# Workflow standard

- Source: Cairn protocol and the active mission contract; superpowers 7.0.1 for execution
  discipline; Impeccable 4.8.0+df3a4ab only when a UI surface exists.
- Pin: cairn/standards@0.1; superpowers 7.0.1; Impeccable skill 4.8.0 / engine 0.1.18 /
  source df3a4ab.

## One tick

1. `node scripts/goal-check.mjs` names the next task, its `serves` link, and its gates.
2. `cairn next` prints the packet: task, files, gates, constraints, base commit, and packs.
3. Do the work. Write the test first when the task changes behavior.
4. `cairn verify <task>` runs every blocking gate and writes evidence.
5. Commit the work, the evidence, and the `gate_result` events.
6. `cairn record <task> --status done` appends `task_done`.
7. `cairn reconcile` checks the ledger against git and the evidence.

A task is done only with all three: a commit, a blocking gate at exit 0, and `task_done`.

## Files and scope

- Write only the files the task declares. A write outside the list needs a ruling or a plan
  amendment; it is not a silent addition.
- A task that cannot name the acceptance criterion it advances does not start.
- One tick advances at most one task. Do not batch two tasks into one commit.

## Packs

- Each task report names the pack and pin it used, `not-applicable` with a reason, or
  `absent, floor used`.
- A pack report is an input. The gate and the ledger are the proof.
- A pack may keep adapter-local scratch. It is never a second source of truth; `cairn
  reconcile` compares it with the ledger, and the ledger wins.
- An absent pack is not a blocker when the fallback is executable. It is an escalation when
  the acceptance criterion explicitly requires that pack.

## Failure paths

- A failing blocking gate stops the tick. Record the command, the exit code, and the next
  action; do not record `task_done`.
- A blocking question is an escalation and parks the task. A decision made without a human is
  a ruling and is recorded.
- No push, publish, history rewrite, or destructive command without a human.
- If the audit check cannot run, record that failure and the substitute evidence. Never report
  an unrun check as passed.

## Impeccable

- This repository has no UI. The design-check row is `not-applicable`; the in-repo checklist
  is the fallback.
- When a UI surface exists, `detect` is the deterministic check and `critique` is
  human-in-loop. An empty `detect` result on markdown is not a pass.
