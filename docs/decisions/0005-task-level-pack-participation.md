# 0005 — Record pack participation per task

- Status: proposed. The human accepted this ADR through decision 0006 on 2026-10-31. The
  binding record is the Mission #2 `mission_created` event with
  `approval_source: ["0006", "0005"]`; this line is a pointer, not the record.
- Date: 2026-10-31
- Scope: project-wide ADR. Task-level pack participation applies to every mission, so this
  decision lives in `docs/decisions/`, not in a mission inbox.
- Follow-up: workstream D3 in
  [Decision 0006](../../.cairn/missions/001-method-pack/inbox/0006-completion-integrity.md);
  Mission #2 task T2 and acceptance A3.

## Context

Mission #1 closed with B7 marked covered. After the close, the owner observed that the
repository shows no per-task superpowers artifact and no linkage between superpowers and the
Cairn product. The investigation confirmed the gap:

- The ledger has 8 `task_done` events. None carries `packs`; every payload is
  `base / head / commits / gates`.
- The ledger has 3 `review_result` events. Only the final T8 review carries `packs`; the two
  milestone reviews predate the T7 amendment. The worked example has the same shape:
  `packs` in `review_result`, none in `task_done`.
- `src/cli.ts:220-231` hard-codes the `task_done` payload and never reads a task report.
- `docs/adapter.md` puts `packs` under `review` only. The adapter report has no execution-layer
  pack record, so a conforming report cannot express "superpowers executed this task".
- `cairn next` injects two pack entries into the packet, but the packet says "pack is context,
  not completion". Injection is advisory and is not echoed back.
- The session transcript shows 0 actual `Skill` tool calls in both the 528-message
  pre-compaction context and the 281-message current context. There is no `.superpowers/`
  directory. TDD and verification were done by hand, not by invoking the pack.
- Only T7 and T8 have `task_started` events. T1–T6 predate both `cairn start` and packet
  injection, so most tasks could not have received a pack instruction at all.

B7 says "task evidence records used, not-applicable, or absent". No task evidence does. The
mission closed on review-level evidence plus the example fixture, not on a task-level record.

## Decision

Pack participation is a task property, not a review-only property.

- A `task_done` must carry a `packs` record with two entries, one for superpowers and one for
  Impeccable. `cairn record` refuses to append `task_done` when the record is missing or
  invalid.
- The record has two entries for every task:
  - **superpowers** — `test-first` for code tasks and `verify-before-close` for docs or
    mixed tasks. `mode: use` names the skill and concrete evidence; a missing pack is
    `mode: absent` with the floor as evidence.
  - **Impeccable** — `design-check` when a UI surface exists; otherwise `design-review` with
    `mode: not-applicable` and a reason. It is recorded on every task, not omitted.
- The ledger record is the proof. `cairn next` states that the executor must return the pack
  record; `cairn record --packs <file>` validates it and writes it into `task_done`. A
  detailed task report under `evidence/<task>/packs.json` is optional.
- Every `evidence` value is a mission-relative path to a real file under the mission's
  `evidence/` directory and must pass `isEvidenceFile`. A prose claim is not evidence.
- The packet remains context; the ledger and evidence remain proof. This ADR adds the missing
  task-level record; it does not make a pack report a gate.

### Hard constraints

- **superpowers**: every mission has at least one `task_done` whose superpowers entry is
  `mode: use`, and that entry's `evidence` passes `isEvidenceFile`. For `test-first`, the
  evidence file records the test command with a RED result followed by a GREEN result.
- **Impeccable**: an all-`not-applicable` mission is allowed only when the mission declares no
  UI surface and the closing `review_result` records `ui_surface: none`. If any task declares a
  markup, style, or component file, at least one `task_done` carries `design-check` with
  `mode: use`.
- **absent**: requires both a `reason` and an `evidence` file naming the floor that ran.

## Why

- Injection without a required task field lets a task pass with zero pack participation. That
  is what happened in Mission #1.
- superpowers writes no durable repository artifact by design: `task-start` writes no ledger,
  and its progress journal is external scratch. If Cairn does not record participation, nothing
  remains to inspect.
- Review-level packs answer "was the review sound?". They do not answer "did the task use the
  pack?". The owner asked for the latter, on every task.
- A deterministic selection rule already exists in `withPacks` (code vs UI vs docs). The missing
  piece is recording and validation, not selection.
- A path that must pass `isEvidenceFile` is checkable by the runtime; a free-text claim is not.

## Consequences

- The change is backward compatible. The requirement applies to `task_done` events from T2
  onward, the task that implements this ADR and records it; the human approval is the Mission
  #2 `mission_created` event's `approval_source`. T1 is grandfathered by decision 0006,
  Mission #1's 8 events stay valid, and no history is rewritten.
- Each task gains a pack record whose evidence entries are real files. `cairn record` gains a
  blocking validation; a task without a pack record becomes incomplete, not silently clean.
- Impeccable `not-applicable` becomes visible per task with a reason, which is the correct
  outcome for a repository with no UI surface.
- This ADR does not implement the change. Implementation is Mission #2 T2; the protocol text
  catches up in T7, which owns `docs/protocol.md`.

## Alternatives

- **Keep review-only packs.** Rejected: the per-task linkage the owner asked for cannot be
  proven, and B7's own wording is not met.
- **Trust the model to invoke the skill and report it.** Rejected: implementer claims are not
  evidence, and the session shows zero invocations despite the packet naming the skill.
- **Vendor superpowers into the repository.** Rejected by ADR 0002 and ADR 0004: the pack stays
  external, and Cairn owns the seam.
- **Validate the record without requiring an evidence file.** Rejected: it would accept a prose
  claim as proof, which is the defect this ADR exists to close.
