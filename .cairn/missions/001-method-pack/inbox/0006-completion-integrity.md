# Decision 0006 — completion integrity and the Mission #2 remediation plan

Status: approved by the human on 2026-10-31 with the amendments in this revision. The binding
record is the Mission #2 `mission_created` event
(`approval_source: ["0006", "0005"]`); this line is a pointer, not the record. Mission #1 stays
closed. This file records a post-close audit and the contract for Mission #2; it adds no
Mission #1 ledger event.

Scope: mission escalation. It closes Mission #1's post-close audit and defines Mission #2; it
is not a project-wide ADR.

Date: 2026-10-31. Audited commit: `700f68c`.

Audit inputs: an independent audit report, a local re-run of the deterministic gates, and a
fresh end-to-end probe in a temporary repository. The probe is the evidence for P0; the other
findings were confirmed against the source and the Mission #1 ledger.

Serves: the success definition in `README.md` — a fresh session can continue from the
repository alone, and a milestone audit confirms the work still serves the goal. This decision
does not re-open Mission #1. It records what Mission #2 must fix before its own completion can
mean anything.

## Granularity

One decision file, eight workstreams (D1–D8), eight tasks (T1–T8), six acceptance criteria
(A1–A6).

The defects share one root: completion is asserted by events, not bound to the tree and
evidence that justify it. Splitting the root cause into eight decision files would repeat the
same probe and the same argument. The workstreams split where the close condition is
independent:

1. completion binding (D1 → A1, T1);
2. acceptance and review binding (D2 → A2, T3);
3. task-level pack participation (D3, ADR 0005 → A3, T2);
4. task state machine (D4 → A4, T4);
5. mission creation, validator, and CI (D5 → A5, T5);
6. policy execution and authorization records (D6, D8 → A6, T6);
7. contract and status truth (D7 → A6, T7);
8. mission-end review and close (T8).

ADR 0005 is the canonical task-level pack decision in `docs/decisions/`. D3 references it and
adds no schema of its own. The earlier inbox decision `0005-packs-block.md` approved the
packet and review `packs` block; it did not add task-level participation.

## What is already sound

At `700f68c` the deterministic layer was green: 133 tests, `tsc --noEmit`, both mission
validations, Mission #1 `reconcile`, bilingual checks, method products, and the hash chain
(`mission` `6cc8961`, `policy` `c755611`, `plan` `a1aa5b2`, `protocol` `f9498f3`). The audit did
not find a failing test or a broken gate. It found that a green gate is not bound to the tree
that completes the task.

The suite grew after that audit: at `33ee177`, the HEAD before Mission #2, `node --test` runs
167 tests and the gates above still exit 0. The defect is structural, not a regression.

## P0 — a red tree can close green

Reproduction in a temporary repository with one task and one blocking gate that reads
`code.txt`:

1. `code.txt` is good; `cairn verify` exits 0.
2. `code.txt` is changed to bad and committed; the same gate on HEAD exits 1.
3. `cairn record T1 --status done` exits 0.
4. `cairn review` exits 0 with a pass verdict and no coverage, non-goals, or cold-start fields.
5. `cairn record --mission-done` exits 0.
6. `validate-mission`, `reconcile`, and `goal-check` all exit 0.
7. The ledger at HEAD is 200 bytes; the worktree ledger is 1123 bytes. `task_done` and
   `mission_done` exist only in the uncommitted worktree ledger.

Why the current code allows it:

- `verifyTask` runs gates in the worktree, writes evidence, and appends `gate_result` with the
  gate id, command, exit code, and evidence path. It records no HEAD and no tree.
- `record` checks that HEAD exists, that at least one commit exists since `base`, and that the
  latest result for each blocking gate is exit 0. It does not check that the gate result belongs
  to the current HEAD, that the worktree is clean, or that the completion event is committed.
- `mission_done` checks task order, acceptance-by-task, and a later passing review. It does not
  check that a task's gate was verified on the tree being completed, or that the completion
  events are in history.
- `validate-mission` accepts a `task_done` when `.some` blocking gate is exit 0, accepts
  `base`/`head` as non-empty strings, and does not recompute hashes. A bad ledger can pass.
- CI does not run `reconcile` and has no negative end-to-end test for this sequence.

This is P0 because every completion claim after it is unfalsifiable. Fix D1 before any other
Mission #2 task.

## The other findings

**F2 — acceptance evidence is task-level, not criterion-level.** `mission_done` builds a
criterion's evidence from every gate result of every task that `serves` it. B5 asks for a
fresh-context reviewer's `review_result`; its recorded evidence is
`evidence/T8/{test,mission,method-products}.json`, with no review artifact. B7 asks for task
evidence that records pack use, `not-applicable`, or `absent`; its evidence is the same T8 gate
results, and no `task_done` carries `packs`. A task link is not evidence for the criterion the
task claims to serve.

**F3 — task-level pack participation is absent.** The ledger has 8 `task_done` events; none
carries `packs`. The payload is hard-coded to `base / head / commits / gates`. Three
`review_result` events exist; only the final T8 review carries `packs`. Only T7 and T8 have
`task_started`; T1–T6 predate packet injection. The session transcript contains zero actual
`Skill` tool calls. Injection was advisory and nothing required the executor to return a
record. ADR 0005 is the decision; D3 is its implementation.

**F4 — the state machine is weaker than the contract.** `start` does not check dependencies or
another active task. `record` does not require `task_started`; it falls back to the parent of
HEAD. `task_parked` has no recovery path and `cairn answer` is listed but unimplemented. A task
can be recorded without being started, and a parked task can never resume.

**F5 — init, validator, and CI do not prove what they claim.** `init` creates a zero-byte
ledger, appends no `mission_created`, and validates clean. The validator checks only three
event shapes, uses `.some` for blocking gates, does not recompute target artifact hashes, and
does not validate `review_result` or `mission_done`. CI runs typecheck, tests, both mission
validators, bilingual, workflow, example, playbook, and method products; it does not run
`reconcile`, `goal-check`, `audit-session`, or a negative end-to-end probe.

**F6 — policy and contract text are descriptive, not executable.** Policy fields
(`budgets`, `allowed_commands`, `forbidden_commands`, `stop_conditions`) are read into the
packet and never enforced. Mission #1 forbids `git push`, yet pushes happened under a human
standing authorization that the policy does not record. The protocol says "a single writer
appends: `cairn record`" while `start`, `verify`, and `review` also append. It still contains
the T-002 ruling text. It lists `cairn answer` and `cairn export`, neither implemented.
`src/packet.ts` renders a dispatch brief that no CLI entry calls. `docs/i18n.md` says the
Mission #1 plan is current at the T3 amendment while `plan.zh.md` says T7. Status sources
disagree: the ledger says done, `plan.md` says T7 active and T8 todo, `mission.md` says active,
and `README.md` says complete.

## Decisions

### D1 — completion is bound to the verified tree

- The order is **work → commit the work → verify → record → commit the ledger only**. `verify`
  requires a clean worktree outside `.cairn/`, so the content it verifies is already committed.
  It captures `head` and `tree` once and writes both into every `gate_result`. If tracked
  content changes during the run, verify fails. The operator guide and the protocol record this
  order; the guide is updated in T1, the protocol text in T7.
- `record` requires, for every blocking gate, a latest result with the current `head` and
  `tree`, exit 0. It also requires no worktree change outside `.cairn/` since verify. A
  mismatched or missing result refuses `task_done`.
- `record --mission-done` requires the worktree ledger to equal the ledger blob at HEAD, so
  every prior `task_done` line is committed. The final `mission_done` is proven by the commit
  that contains it.
- `reconcile` fails when a completion event exists in the worktree ledger but not in the ledger
  at HEAD. CI runs `reconcile` on the pushed commit.
- Done when: the P0 probe fails at `record`; a clean tree passes; tests cover tree mismatch,
  dirty worktree, and an uncommitted `task_done`; CI runs the probe as a negative test.

### D2 — acceptance and review evidence name the criterion

- `review_result` requires `coverage` for every acceptance id, each entry naming the criterion,
  the tasks, the evidence (gate id plus evidence path, or a review artifact), and a verdict.
  `mission_done` validates that each referenced artifact exists and that a referenced gate
  result is exit 0. A task's `serves` link alone is not evidence.
- `review_result` requires `non_goals` (each non-goal, verdict, evidence) and `cold_start`
  (reviewer, artifact, verdict). `mission_done` rejects a review missing either.
- Reviewer provenance is evidence: `reviewer`, `context: fresh | coordinator`, and the artifact
  (subagent id or transcript path). A coordinator-launched fresh subagent counts as fresh
  context but is not an independent signature; the human checkpoint remains the proof of
  independence. The review artifact is evidence for the criterion it covers.
- `mission_done` requires a human authorization event with `scope: mission_done`,
  `approved_by: human`, and a reason, recorded after the last review. The reviewer proves the
  work; the human authorizes the close.
- Mission #1's B5/B7 evidence would fail this rule. That is expected; the rule applies to
  missions that close after the amendment.
- Done when: replaying Mission #1's B5/B7 evidence under the new rule fails; a new mission's
  review passes with per-criterion artifacts; `mission_done` rejects a missing field or a
  missing authorization event.

### D3 — record pack participation per task (ADR 0005)

- ADR 0005 is the canonical decision for task-level pack participation. D3 adds no schema and
  no rule of its own; it is the implementation of that ADR.
- Mission #2 T2 implements it; A3 is the acceptance criterion. The selection rule, the record
  shape, the evidence-file requirement, and the three hard constraints live in ADR 0005.
- The grandfather rule is stated once, under Compatibility.

### D4 — the task state machine is enforced

- `start` refuses when a dependency is not done or another task is active.
- `record` requires a `task_started` event for the task. The `gitParent` fallback is removed
  for new events; historical events stay valid.
- `cairn answer` is implemented: it records the human decision and resumes a parked task.
  `task_parked` keeps its meaning; it is no longer a dead end.
- Done when: a direct `record` without `start` fails; an out-of-order `start` fails; a parked
  task can be answered and completed; the historical tasks without `task_started` remain
  valid.

### D5 — init, validator, and CI match the contract

- `init` is the writer of `mission_created`: it appends the mission id, owner, approval source,
  and the sha256 of the scaffold `mission.md`, `plan.md`, and `policy.md`, plus
  `docs/protocol.md` when the repository has one. Later edits to a target artifact are
  `mission_amended` events with old and new hashes; T5 also adds the runtime writer for that
  event, so no target changes by hand after T5.
- `validate-mission` requires `mission_created`; validates every event shape; requires all
  blocking gates, not `.some`; checks that `base` and `head` resolve to commits; recomputes the
  target artifact hashes for the active mission at HEAD and compares them with the latest
  amendment; validates `review_result` fields and `mission_done` coverage. New-shape checks
  apply to missions whose `mission_created` carries `approval_source`; closed historical
  missions keep the old shapes, exactly as `check-targets` already scopes itself to the active
  mission.
- CI adds `reconcile` and the P0 negative probe. The probe lives in the test suite, not only
  in the workflow, so a local `node --test` catches it.
- Done when: `init` produces a non-empty ledger with `mission_created`; a tampered hash, a
  non-existent commit, a partial blocking-gate set, and an uncommitted completion event each
  fail; CI runs both checks.

### D6 — policy is executable or labelled human

- `allowed_commands` and `forbidden_commands` are checked against gate commands before they
  run. A forbidden command refuses the tick; an allowed command outside the list refuses with
  the policy path.
- `stop_conditions` are split into `auto` and `human`. `write_outside_repo`,
  `budget_exhausted`, `gate_weakened_without_amendment`, and `irreversible_or_destructive` are
  detectable; `goal_drift_suspected` and `acceptance_unreachable` remain human checkpoints.
  The policy labels each one; the runtime does not pretend to automate a judgment.
- `budgets` are enforced for attempts, fix rounds, wall time, and audits between reviews. The
  token budget stays null until measured.
- Human exceptions are recorded as `approved_exceptions` with command, scope, approver, date,
  and reason. The standing `main` push authorization belongs there; Mission #1's policy did not
  record it, which is why the policy and the practice disagreed.
- Done when: an out-of-list gate is refused; a `write_outside_repo` attempt parks; a push
  requires the recorded exception; the policy and the packet agree on what is advisory.

### D7 — the contract and the status sources tell the truth

- Protocol: replace the single-writer sentence with the actual ownership map (`start`,
  `verify`, `record`, `review`, `answer`, `init` each own their event types). Remove the stale
  T-002 text. Remove `cairn export` from the command list, and delete the unused
  `renderDispatch` path, until a consumer exists. Implement `cairn answer` per D4. Document the
  D1 order and the task-level `packs` record recorded by D3.
- Status: the ledger is the only status. `mission.md.status` is the initial declaration;
  `plan.md` task `status` is a deprecated hint. `goal-check` already derives from the ledger.
  New plans omit `status`; existing values stay as history and are not edited.
- Bilingual: fix the known plan/i18n mismatch. `check-bilingual` verifies that the source path
  in each header exists and that a named commit is reachable; content freshness remains a
  human milestone check, not a claim the checker makes.
- Portability: add `engines.node` for the type-stripping floor (Node ≥ 22.18) and test the
  supported versions in CI. Document the Windows gate shell behavior and cover it with a test;
  do not leave `.cmd` resolution to an implicit fallback.
- Audit: `audit-session` takes an explicit transcript path or records the chosen session id and
  path in its report. At mission end, the report is written under `evidence/audit/` and
  referenced by the review. It remains a diagnostic, not a gate.
- Done when: `docs/protocol.md` matches the CLI; every status surface names the ledger as the
  source; `check-bilingual` checks what it claims; CI proves the Node floor; a mission has a
  recorded audit artifact.

### D8 — human-authorized writes are recorded, not inferred

- `cairn record --authorized --paths <a,b> --why <text> --approved-by human` appends an
  `authorization` event with `paths`, `approved_by`, `why`, and `date`. Authorization is
  mission-scoped; the event lives in the active mission's ledger.
- `audit-session` treats a write inside an authorized path as authorized, not drift. A write
  outside every authorization and outside the plan is still drift.
- The event is a record of a human approval, not a gate. It does not make an unauthorized write
  legitimate; it makes an authorized one visible.
- Done when: an authorized write is not reported as drift; an authorization with no matching
  write is reported and does not hide other writes; a write outside the paths is still drift.

## Mission #2 contract

Id: `002-completion-integrity`. Title: `Completion integrity`. Owner: `chenmudu`.

### Acceptance

- **A1** — completion is bound to the verified tree. Check: the P0 probe fails at `record`; a
  clean tree passes; tests cover a tree mismatch, a dirty worktree, and an uncommitted
  `task_done`; CI runs the probe.
- **A2** — acceptance and review evidence name the criterion, the reviewer is evidence, and
  `mission_done` requires a human authorization event. Check: per-criterion coverage with
  artifacts validates; a review missing `non_goals`, `cold_start`, reviewer provenance, or
  `ui_surface` is refused; a `mission_done` without the human authorization event is refused;
  replaying Mission #1's B5/B7 evidence under the rule fails.
- **A3** — pack participation is recorded per task (ADR 0005). Check: every new `task_done`
  carries two valid entries; `record` refuses a missing or invalid record; at least one
  superpowers `mode: use` has evidence passing `isEvidenceFile` with RED then GREEN; Impeccable
  is all-`not-applicable` only when the mission has no UI surface and the closing review
  records `ui_surface: none`; `absent` carries a reason and floor evidence.
- **A4** — the task state machine is enforced. Check: `record` without `start` fails; an
  out-of-order `start` fails; a parked task can be answered and completed; historical tasks
  without `task_started` stay valid.
- **A5** — `init`, the validator, and CI match the contract. Check: `init` appends
  `mission_created`; a tampered hash, a non-existent commit, a partial blocking-gate set, and
  an uncommitted completion event each fail; CI runs `reconcile` and the probe.
- **A6** — policy is executable or labelled human, the contract matches the CLI, and every
  audit finding is covered. Check: an out-of-list gate is refused; a push requires a recorded
  exception; `docs/protocol.md` matches the CLI; `cairn record --authorized` writes an
  `authorization` event and `audit-session` accepts covered paths; every mechanizable audit
  finding becomes a negative test and every non-mechanizable one is labelled `human` or
  `review`.

### Tasks

- **T1 — bind completion to the verified tree (D1, serves A1).** The P0 probe first, then
  `verify` head/tree binding, `record` tree and clean-worktree checks, `mission_done` committed
  ledger, `reconcile` uncommitted-completion detection, the operator order, and CI.
- **T2 — record pack participation per task (D3, ADR 0005, serves A3).** The record, the
  validation, the evidence-file rule, the three hard constraints, and a real RED→GREEN test.
  T1 is grandfathered; T2 is the first `task_done` with packs.
- **T3 — bind acceptance and review evidence, authorize the close (D2, serves A2).**
  Per-criterion coverage, non-goals, cold start, reviewer provenance, `ui_surface`, and the
  human authorization event for `mission_done`.
- **T4 — enforce the task state machine (D4, serves A4).** Dependency and single-active-task
  checks, `task_started` required, and `cairn answer` with a recovery path.
- **T5 — make init, the validator, and CI match the contract (D5, serves A5).** The
  `mission_created` writer, the `mission_amended` writer, the stricter validator, and CI.
- **T6 — make policy executable and record authorizations (D6, D8, serves A6).** Gate-command
  policy, budgets and stop conditions, `approved_exceptions`, the `authorization` writer, and
  `audit-session` coverage.
- **T7 — make the contract and status sources tell the truth (D7, serves A6).** Protocol text,
  CLI truth, bilingual claim, Node floor, Windows gate shell, and audit artifact path.
- **T8 — mission-end review and close (serves A2, covers A1–A6).** A fresh-context review with
  per-criterion evidence, the cold-start check, the audit artifact, and the human authorization
  event before `mission_done`.

### Non-goals

- No rewrite of Mission #0's or Mission #1's ledgers, evidence, or target artifacts. They stay
  byte-identical and valid; the new rules apply only to new events.
- No vendoring or merging of the superpowers or Impeccable repositories. They stay external.
- No UI surface, design system, or hosted service. Impeccable participation is criteria-based;
  `not-applicable` is expected and must be recorded.
- No unattended scheduler or multi-tick loop. Completion integrity comes first; the loop is a
  later mission.
- No new runtime feature outside D1–D8.
- No reopening GitHub issues #1–#5. They are closed as superseded by this decision; reopen one
  only if this decision is rejected.
- No protocol change without `approved_by: human`.

### Order

T1 D1 → T2 D3 → T3 D2 → T4 D4 → T5 D5 → T6 D6 + D8 → T7 D7 → T8 review.

Each task has a `serves` link and at least one blocking gate. No task may weaken a gate. The
milestone audit runs every three completed tasks and at mission end, before the next task.

## Sequencing

1. D1 — completion binding. Nothing else can be trusted until a red tree cannot record done.
2. D3 — task-level packs. It follows D1 because every later task must carry a pack record.
3. D2 — acceptance and review binding. A green completion still needs a semantic link.
4. D4–D5 — state machine, init, validator, CI. These make the contract enforceable.
5. D6 + D8 — policy and authorization records. A human-authorized write becomes visible.
6. D7 — contract and status truth. The text catches up with the behavior.

## Compatibility and grandfathering

- Mission #0 and Mission #1's target artifacts and ledgers remain byte-identical. Their events
  stay valid; the new rules apply only to new events. New-shape validation is gated by
  `mission_created.approval_source`, so a closed mission is never re-judged by a rule it
  predates.
- No history rewrite. No target artifact (`mission.md`, `policy.md`, `plan.md`,
  `docs/protocol.md`) changes without `mission_amended` and old/new hashes.
- T1 predates D3, so its `task_done` has no `packs`; this is the single grandfather case in
  Mission #2. From T2 onward every `task_done` carries packs.
- Mission #1's 8 `task_done` events remain valid and are grandfathered by this note.
- The P0 probe uses a fresh temporary repository; it does not touch either historical ledger.
- The completion rule becomes stricter, not looser. A task that passed before may fail under
  the new rule; that is the point, and it is scoped to new events.

## Why CI did not catch P0

CI ran `pnpm typecheck`, `node --test`, both mission validators, `check-bilingual`,
`check-workflow`, `check-example`, `check-method --playbook`, and
`check-method --products --strict`. That proves the deterministic layer has not regressed. It
does not prove completion:

- CI checks the committed artifacts. P0 lives in the gap between the committed ledger and the
  uncommitted worktree ledger; a checkout cannot see that gap.
- `validate-mission` is weaker than the contract: it checks three event shapes, uses `.some`
  for blocking gates, and does not bind a gate result to a tree or a commit.
- The test suite has no end-to-end negative case for "bad tree committed, gate red, record
  succeeds". The probe was manual; it is not in CI.
- `reconcile` is not in CI, and in the probe it also accepted the uncommitted ledger.

The fix is D1 plus D5: bind the gate result to the tree, put the probe in `node --test`, run
`reconcile` in CI, and make the validator check what the contract says. CI remains a regression
net, not a completion oracle. The local guards (`record` refusing uncommitted prior events,
`mission_done` refusing uncommitted task events) are what stop the bad state before it is
pushed; the pushed commit is the final proof.

## Relationship to 0005

ADR 0005 is the canonical task-level decision. The human accepted it on 2026-10-31; the
`mission_created` event of Mission #2 records the approval through `approval_source`. Its
Status line stays `proposed` as a pointer to that event; editing it would make the document,
not the ledger, the record. D3 is its implementation. The ADR's backward-compatibility rule is
preserved: new `task_done` events require packs; Mission #1 is grandfathered by a note.

## Observation — the first routing-loop audit

The decision-routing guard landed in `5e9d3df`. Its first self-audit reported two writes
outside the plan: `docs/decision-routing.md` and its Chinese companion. The work was explicitly
authorized by the human, but Mission #1 is closed, no plan declares the files, and no runtime
command writes a `ruling` or `note`. The audit therefore cannot distinguish authorized
post-close work from drift.

This is an input to D4/D5/D8, not a new workstream: a human-authorized write needs a runtime
record, or the audit needs a declared authorization source. Until then, a post-close guard
change will keep producing this verdict. The two files remain, because the rule they define is
the fix the human asked for; deleting them would remove the check rather than the finding.

### The enforcement-map audit

The enforcement foundation landed in `aa6490d`. `audit-session` reported `drift`: six writes
outside the plan (`docs/drift-control.md` and its companion, `scripts/check-enforcement.mjs`,
`test/check-enforcement.test.mjs`, `.github/workflows/gates.yml`, `test/hook.test.mjs`), one
alignment correction, and one confirmation request. The writes were authorized by the human
("如果没有我们就去执行"); the plan gap is the same D4/D5 issue. The alignment correction is real:
the first plan did not state the harness constraints — one workspace `AGENTS.md`, a `Stop` hook
can continue three times, and a skill splits into SOP, references, and scripts — until the
human named them. Those constraints are now in `docs/automation.md` and
`docs/drift-control.md`, so the next session reads them instead of rediscovering them. The
confirmation request was the scope gate the repository requires, not drift.

### The target-check audit

`scripts/check-targets.mjs` landed in `84ed257` with eight tests in
`test/check-targets.test.mjs`. All gates exit 0 (167 tests) and CI runs the check as its own
step. It exists because the enforcement-map audit found row 1 claiming target freeze with no
script that hashed anything: the validator never recomputed the chain.

- The check rebuilds the expected hash for the four targets from `mission_created` plus every
  `mission_amended`, then hashes the working tree. Ledger keys appear in two forms — a bare
  name (`plan.md`) and a repo-relative path (`.cairn/missions/<id>/plan.md`); both are
  normalized before comparison. The mixed form is what made a naive comparison report false
  diffs.
- It is scoped to the active mission. Mission #0's hashes describe the tree it closed on;
  `docs/protocol.md` changed during Mission #1, so rechecking Mission #0 against today's tree
  reports a mismatch by design. Closed missions are not rechecked.
- Audit verdict for this change: `drift`, one unplanned write — `docs/drift-control.zh.md`.
  The English file and the rest landed in `aa6490d`; the companion header update came after.
  It is the same D4/D5 gap: post-close work authorized by the human has no plan that declares
  it and no runtime command that records the authorization. Zero alignment corrections, zero
  claims without a gate, zero confirmation requests.

### The bootstrap blocker and its resolution

`cairn init` scaffolds `mission.md`, `plan.md`, `policy.md`, and an empty `ledger.jsonl`; it
appends no `mission_created`. Verified in a temp repository: `init` exits 0, the ledger has 0
lines, and `check-targets` exits 1 with `no mission_created event`. A mission created today has
no frozen targets, so the chain D5 relies on starts empty.

The blocker is resolved, for one mission only, by a human-authorized manual `mission_created`
freeze for Mission #2. The human explicitly authorized this single append on 2026-10-31. It is
the last bootstrap exception:

- the event is written once, with `actor: human`, `approved_by: human`,
  `approval_source: ["0006", "0005"]`, and the sha256 of `mission.md`, `plan.md`, `policy.md`,
  and `docs/protocol.md`;
- after that append, every event is written by a runtime command;
- T5 adds the `init` writer, and from T5 onward no mission is created by hand.

If the freeze is rejected, Mission #2 does not start until D5 lands; that path is slower and
would make this decision's order impossible.

## Approval

The human approved this revision on 2026-10-31 and accepted ADR 0005. The binding record is the
Mission #2 `mission_created` event with `approval_source: ["0006", "0005"]`; this file is the
plan, the ledger is the approval. The options below are kept for history:

- `approve 0006` — accept D1–D8 and the sequence.
- `adjust 0006 -- ...` — change a decision, a granularity boundary, or the order.
- `reject 0006` — keep Mission #1 closed and record why.

## Issue map

All five issues were closed on 2026-10-31 as superseded by this decision. They are not
reopened; a rejection of this decision is the only reason to reopen one.

| Issue | Workstreams | Close condition | Status |
|---|---|---|---|
| [#1](https://github.com/chenmudu/cairn/issues/1) P0: bind completion to the verified tree | D1 | the P0 probe fails at `record`; clean task passes; CI runs the probe | closed, superseded |
| [#2](https://github.com/chenmudu/cairn/issues/2) Bind acceptance and review evidence to criteria | D2 | per-criterion artifacts validate; Mission #1 B5/B7 replay fails | closed, superseded |
| [#3](https://github.com/chenmudu/cairn/issues/3) Record pack participation per task (ADR 0005) | D3 | every new `task_done` has two valid pack entries | closed, superseded |
| [#4](https://github.com/chenmudu/cairn/issues/4) Enforce task state, mission init, validator, and CI | D4–D5 | start/record/answer enforced; init/validator/reconcile/probe pass | closed, superseded |
| [#5](https://github.com/chenmudu/cairn/issues/5) Make policy executable and the contract truthful | D6–D8 | policy enforced or labelled human; docs match the CLI; authorization recorded; audit findings covered | closed, superseded |
