# 0003 — End-of-mission audit failed: decision needed

- Status: resolved — option A, then a fresh audit passed
- Raised: 2026-10-31
- Legacy: true
- Blocks: `mission_done` (no longer)
- Verdict: `fail` (`review_result` in `ledger.jsonl`, 2026-10-30T20:43:08.058Z);
  re-audit `pass` (`review_result`, 2026-10-30T20:52:40.670Z)

## What passed

A1, A2, A3, A4, A5, A6, and A8 are proven by gates, evidence, and commits. 58/58 tests pass;
`node scripts/validate-mission.mjs missions/000-bootstrap` exits 0; `cairn reconcile` is clean;
every `task_done` head exists and every evidence file exists. The technical runtime works.

## What failed

1. **T-005 completed without its `Done when`.** The plan requires `task_started`,
   `gate_result`, `review_result`, and `task_done` for T-005. The ledger has no `task_started`
   for any task, and T-005's `task_done` was recorded before a T-005 review. Its declared
   artifact, a passing milestone audit recorded as `review_result`, was not produced at T-005
   time.
2. **Milestone cadence was skipped.** An audit ran after T-002. After T-003, T-004, and T-005
   completed, no audit ran before T-007 was planned. This is drift-control failure mode 15, and
   it leaves A7 unproven for that checkpoint.
3. **No sanctioned writer for `mission_done`.** `cairn record` accepts only
   `<task> --status done`; no command appends `mission_done`, while manual appends are barred
   after `cairn verify` landed. Mission #0 cannot close without a command or a delegation.
4. **Documentation drift.** `docs/automation.md` says `goal-check` exits 1 when no task is
   runnable; with every task done it exits 0 and prints `Current task: none`. `plan.md` still
   marks T-002..T-007 `status: todo`; the ledger is authoritative, but a cold session that stops
   at `plan.md` can misread the state.
5. **Protocol invariant 3 is still textual drift.** The protocol says ledger and code land in
   the same commit; every `task_done` head names the work commit and the event lands in the next
   commit. Inbox 0001 item 3 documents the convention, but the protocol amendment needs a human.
6. **The `reconcile` gate name overstates its command.** T-005's gate runs the validator, not
   `cairn reconcile`; A4's proof rests on `test/reconcile.test.ts` and the recorded
   pending/clean snapshots.

## Options

### A. Remediate, then re-audit (recommended)

Add one task, `T-008`:

- `cairn record --mission-done` (or `cairn complete`) appends `mission_done` with the acceptance
  map, and refuses unless every acceptance criterion has evidence and no task is open.
- `goal-check` refuses to start a new task when three completed tasks have passed without a
  `review_result`, so cadence failure is caught by the guard, not by memory.
- Fix `docs/automation.md` exit semantics and add a plan note that statuses are advisory.

Then record a `review_result` for T-005 (cold start + audit), issue a ruling that accepts the
late T-005 evidence and the skipped mid-mission checkpoint as covered by the final audit, run a
fresh end-of-mission audit, and close with `mission_done`.

### B. Accept the deviation now

Record a ruling that accepts T-005's late evidence and the skipped checkpoint, delegate one
manual `mission_done` write, and close. No new task. The historical process gaps stay recorded
but unmitigated, and the missing writer remains a Mission #1 item.

### C. Park

Leave the mission open and wait for a human review. Nothing further changes.

## Recommendation

A. It turns the audit findings into product behavior (a real `mission_done` writer and an
enforced audit cadence) instead of exceptions, and it keeps the ledger honest about the late
T-005 evidence. It needs one explicit ruling because the historical checkpoint cannot be
re-audited retroactively.

## Resolution

Option A was chosen. T-008 added `cairn record --mission-done`, the cadence guard in
`goal-check`, and the documentation fixes; it passed its gates and was recorded. A fresh
reviewer then passed T-005 and the mission: A1–A6 and A8 are proven, A7's skipped mid-mission
checkpoint is accepted by ruling (`2026-10-30T20:45:39.492Z`) and is non-blocking, and inbox
items were non-blocking.

The two passing reviews were appended under the remediation ruling
(`2026-10-30T20:52:40.667Z`) because no `cairn review` writer exists. `cairn record
--mission-done` then appended `mission_done` at `2026-10-30T20:53:53.283Z` with the acceptance
evidence map. Final `node --test` (68/68), `goal-check`, `reconcile`, and the validator all exit
0.

The remaining findings — no `review_result` or `task_started` writer, protocol invariant 3, the
`.zcode` non-goal wording, the `reconcile` gate name, plan status freshness, and the unattended
loop — are recorded in `0004-mission-1-follow-ups.md`.
