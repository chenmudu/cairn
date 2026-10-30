# One tick

This is the operator guide. It assumes the repository is the source of truth: a mission, a
plan, a ledger, and evidence. A tick advances one task and leaves a commit, a blocking gate at
exit 0, and a `task_done` event.

## Roles

- **Owner**: sets the mission, non-goals, and acceptance; answers escalations. The owner does
  not need to restate the goal in every session.
- **Coordinator**: runs `goal-check`, `next`, `verify`, `record`, and `reconcile`; owns the
  ledger and the packet.
- **Executor**: does the task inside the declared files and returns a report with evidence.
- **Reviewer**: uses a fresh context and the review checklist; does not trust the executor's
  claim.

One person or agent can hold several roles, but the reviewer must not be the executor for the
same change.

## Preconditions

- `.cairn/config.json` names the active mission.
- `node scripts/goal-check.mjs` exits 0. Exit 1 means stop: the plan, the ledger, or the audit
  cadence needs fixing first.
- Read `.cairn/missions/<id>/inbox/` for decisions waiting for a human.

## The tick

1. **Anchor.** Print the mission, the next task, its `serves` link, and its gates.

   ```sh
   node scripts/goal-check.mjs
   ```

2. **Start and packet.** Record the base, then read the task, files, gates, constraints, packs,
   and base commit.

   ```sh
   node src/cli.ts start <task>
   node src/cli.ts next
   ```

3. **Work.** Keep the diff inside the declared files. For behavior changes, write the test
   first and see it fail for the expected reason. If the task cannot name the acceptance
   criterion it advances, stop.

4. **Verify.** Run every blocking gate and write evidence.

   ```sh
   node src/cli.ts verify <task> --mission .cairn/missions/<id>
   ```

5. **Commit.** Commit the work, the evidence, and the `gate_result` events. Do not push.

6. **Record.** Append `task_done` only after the commit and the gates.

   ```sh
   node src/cli.ts record <task> --status done --mission .cairn/missions/<id>
   ```

7. **Reconcile.** Check the ledger against git and the evidence.

   ```sh
   node src/cli.ts reconcile --mission .cairn/missions/<id>
   ```

8. **Audit before the claim.** Report drift signals; if the audit cannot run, record that and
   the substitute evidence.

   ```sh
   node scripts/audit-session.mjs
   ```

Pack availability is advisory and does not block the tick:

```sh
node scripts/check-method.mjs --packs
```

## Human checkpoints

Stop and ask the owner before:

- a protocol change, a new mission, or an amendment to `mission.md`, `policy.md`, `plan.md`,
  or `docs/protocol.md`;
- a push, publish, history rewrite, or destructive command;
- expanding the task's declared scope;
- a blocking question the repository cannot answer;
- accepting a missing pack when the acceptance criterion explicitly requires that pack's
  capability.

A blocking question is an escalation and parks the task. A decision made without a human is a
ruling: record it in the ledger, continue, and name the cost if it is wrong.

## Failure paths

- **A blocking gate fails.** Stop. Record the command, the exit code, and the next action. Do
  not record `task_done`.
- **Evidence is missing.** Treat the gate as failed. Re-run it; do not hand-write evidence.
- **`audit-session` fails or cannot read the transcript.** Record the failure and the
  substitute evidence (gates, validate, reconcile, fresh-context review). Never report the
  audit as passed.
- **A pack is absent.** Use the executable fallback and record `absent, floor used`. This is
  not a blocker unless the acceptance criterion requires the pack.
- **A pack is `mismatch` or `not-invocable`.** Use the fallback and record the detected
  version. Do not invoke a launcher that would download an engine.
- **No runnable task.** Check the dependency chain, the ledger, and `goal-check`. A plan that
  cannot express the next step needs an amendment, not improvisation.
- **The ledger and git disagree.** `cairn reconcile` names the crash window. Do not edit the
  ledger; record a correction event or stop for a human.

## Packs

The floor is always executable. The pack is better when present and pinned. The seam is
Cairn's: detect, inject, record, reconcile.

### Both packs

- superpowers supplies process discipline: `brainstorming` for framing,
  `writing-plans` for an optional plan, `test-driven-development` for execution,
  `requesting-code-review` for review, and `verification-before-completion` before a claim.
- Impeccable supplies design standards. Run `detect` only on markup or a URL; `critique` is
  human-in-loop; `audit` is web/native-only. For docs and code, use the criteria and mark the
  UI-only dimensions `not-applicable` with a reason.
- Record the pack, pin, and evidence in the task report.

### Superpowers only

Use superpowers for framing, TDD, review, and pre-claim verification. Impeccable rows stay
`not-applicable` for docs and code. The in-repo standards are the design floor.

### Impeccable only

Use the detector and critique only when a UI surface exists. The process floor is Cairn's:
`goal-check`, `next`, `verify`, `record`, `reconcile`. Record `absent, floor used` for
superpowers.

### Neither pack

Use the floor everywhere:

1. `node scripts/goal-check.mjs`
2. `node src/cli.ts next`
3. write the test first, then the change
4. `node src/cli.ts verify <task>`
5. commit, `node src/cli.ts record <task> --status done`
6. `node src/cli.ts reconcile`
7. fresh-context review with the in-repo checklist

Every task report says `absent, floor used`. The gates still pass; that is the test of the
floor.

## Done

A task is done only when all three are true:

- a commit exists;
- every blocking gate exits 0 with evidence;
- `task_done` is in the ledger.

A green gate proves the step, not the goal. At mission end, run the milestone audit, write the
verdict to a JSON file with `reviewer`, `verdict`, `findings`, and `packs`, record it, and only
then `cairn record --mission-done`.

```sh
node src/cli.ts review --file review.json --mission .cairn/missions/<id>
```

## Plan status is a hint

The `status` field in `plan.md` is a planning hint. The ledger's `task_done` events are the
truth. Do not infer completion from the plan; run `node scripts/goal-check.mjs` or `node
src/cli.ts status`.
