# 0004 — Mission #1 follow-ups from the Mission #0 close

- Status: open (planning input, not a blocker)
- Raised: 2026-10-31
- Legacy: true
- Source: the passing end-of-mission review (`review_result`, 2026-10-30T20:52:40.670Z) and the
  failed first audit (`review_result`, 2026-10-30T20:43:08.058Z)

Mission #0 is closed. These are real gaps the close exposed, recorded so Mission #1 starts from
evidence rather than memory.

## Product gaps

1. **No sanctioned `review_result` writer.** The T-005 and mission-end reviews were appended
   directly under the human remediation ruling (`2026-10-30T20:52:40.667Z`). Every other write
   has a command; review does not. Add `cairn review` (task or mission, verdict, reviewer,
   findings) and make manual review appends unnecessary.
2. **No `task_started` writer.** T-005's `Done when` asks for `task_started`, and no command
   writes it. The ruling at `2026-10-30T20:47:47.530Z` accepts its absence for M0. Either write
   it in `cairn next`/`cairn verify`, or remove it from the contract; do not leave the mismatch
   to a ruling.
3. **Protocol invariant 3 needs a human amendment.** The protocol says the ledger and the code
   land in the same commit. In practice each `task_done` names the work commit and the event
   lands in the next commit. Amend the contract with old/new hashes and `approved_by: human`,
   or change the runtime to match the text.
4. **`.zcode` non-goal wording.** The plan forbids "a harness-specific adapter in M0", while the
   SessionStart hook and the project skill exist as optional glue (ruling
   `2026-10-30T20:13:52.390Z`). Mission #1 should state whether optional harness glue is in
   scope, instead of relying on a one-off waiver.
5. **`reconcile` gate name overstates its command.** T-005's `reconcile` gate runs the validator,
   not `cairn reconcile`. A4 is proven by `test/reconcile.test.ts` and the recorded
   pending/clean snapshots, not by that gate id. Rename the gate or replace its command the next
   time T-005's evidence is touched; do not silently repurpose it.

## Process hygiene

6. **`plan.md` statuses are historical.** T-002..T-008 still read `status: todo`; the ledger is
   the truth and `goal-check` derives from it. Mission #1 should decide whether plans freeze at
   close with a status note, or expose a derived view instead of hand-maintained statuses.
7. **Mission-end tests depend on ledger state.** Two tests assert the real mission's guard
   result, so they go red between the last `task_done` and the passing review. T-007 moved most
   checks to temp missions; the remaining real-mission assertions are intentional but mean a
   red suite can be a correct pre-close state. Say so in the test or narrow the assertion.
8. **Unattended loop.** Mission #0 proves one tick at a time under human pacing. The original
   goal also asks for long-horizon unattended execution. A `cairn tick`/scheduler design,
   budgets, and stop conditions are Mission #1 scope, not retrofitted here.
