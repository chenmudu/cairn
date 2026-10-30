# Decision 0006 — completion integrity and the Mission #2 remediation plan

Status: waiting for human approval. Mission #1 stays closed. This file records a post-close
audit and the plan for Mission #2; it makes no runtime change and adds no Mission #1 ledger
event.

Scope: mission escalation. It closes Mission #1's post-close audit and plans Mission #2; it is
not a project-wide ADR.

Date: 2026-10-31. Audited commit: `700f68c`.

Audit inputs: an independent audit report, a local re-run of the deterministic gates, and a
fresh end-to-end probe in a temporary repository. The probe is the evidence for P0; the other
findings were confirmed against the source and the Mission #1 ledger.

Serves: the success definition in `README.md` — a fresh session can continue from the
repository alone, and a milestone audit confirms the work still serves the goal. This decision
does not re-open Mission #1. It records what Mission #2 must fix before its own completion can
mean anything.

## Granularity

One decision file, seven workstreams (D1–D7), five GitHub issues.

The defects share one root: completion is asserted by events, not bound to the tree and
evidence that justify it. Splitting the root cause into seven decision files would repeat the
same probe and the same argument. The issues split where the close condition is independent:

1. completion binding (D1);
2. acceptance and review binding (D2);
3. task-level pack participation (D3, ADR 0005);
4. task state, mission creation, validator, and CI (D4–D5);
5. policy execution and contract truth (D6–D7).

ADR 0005 is the canonical task-level decision in `docs/decisions/`. D3 restates its decision
here so this mission archive is self-contained. The earlier inbox decision
`0005-packs-block.md` approved the packet and review `packs` block; it did not add task-level
participation.

## What is already sound

The deterministic layer is green at `700f68c`: 133 tests, `tsc --noEmit`, both mission
validations, Mission #1 `reconcile`, bilingual checks, method products, and the hash chain
(`mission` `6cc8961`, `policy` `c755611`, `plan` `a1aa5b2`, `protocol` `f9498f3`). The audit did
not find a failing test or a broken gate. It found that a green gate is not bound to the tree
that completes the task.

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

- `verify` requires a clean worktree outside `.cairn/`, so the content it verifies is already
  committed. It captures `head` and `tree` once and writes both into every `gate_result`. If the
  tracked content changes during the run, verify fails.
- `record` requires, for every blocking gate, a latest result with the current `head` and
  `tree`, exit 0. It also requires no worktree change outside `.cairn/` since verify. A
  mismatched or missing result refuses `task_done`.
- `record --mission-done` requires every prior `task_done` line to exist in the ledger blob at
  HEAD. The final `mission_done` is proven by the commit that contains it.
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
- Reviewer provenance is recorded: `reviewer`, `context: fresh | coordinator`, and the
  artifact (subagent id or transcript path). A coordinator-launched fresh subagent counts as
  fresh context but is not an independent signature; the human checkpoint remains the proof of
  independence.
- Mission #1's B5/B7 evidence would fail this rule. That is expected; the rule applies to
  missions that close after the amendment.
- Done when: replaying Mission #1's B5/B7 evidence under the new rule fails; a new mission's
  review passes with per-criterion artifacts; mission_done rejects a missing field.

### D3 — record pack participation per task (ADR 0005)

- Every `task_done` carries `packs` with two entries: superpowers and Impeccable.
- superpowers: `test-first` for code tasks, `verify-before-close` for docs or mixed tasks.
  `mode: use` names the skill and concrete evidence (test path with RED→GREEN, or the gate
  command); a missing pack is `mode: absent` with the floor as evidence.
- Impeccable: `design-check` when a UI surface exists; otherwise `design-review` with
  `mode: not-applicable` and a reason. It is recorded on every task, never omitted.
- `cairn record` refuses a `task_done` without a valid `packs` record. The record is inline in
  the ledger; a detailed task report under `evidence/<task>/packs.json` is optional.
- The requirement applies only to events after a human-approved protocol amendment. Mission
  #1's 8 `task_done` events are grandfathered by a note; no history is rewritten.
- Done when: every new `task_done` has two valid entries; `record` rejects a missing or invalid
  record; a code task shows `test-first` evidence and a docs task shows
  `verify-before-close`; a non-UI task shows Impeccable `not-applicable` with a reason.

### D4 — the task state machine is enforced

- `start` refuses when a dependency is not done or another task is active.
- `record` requires a `task_started` event for the task. The `gitParent` fallback is removed
  for new events; historical events stay valid.
- `cairn answer` is implemented: it records the human decision and resumes a parked task.
  `task_parked` keeps its meaning; it is no longer a dead end.
- Done when: a direct `record` without `start` fails; an out-of-order `start` fails; a parked
  task can be answered and completed; the two historical tasks without `task_started` remain
  valid.

### D5 — init, validator, and CI match the contract

- `init` appends `mission_created` with the mission id, owner, approval source, and the sha256
  of the scaffold `mission.md`, `plan.md`, and `policy.md`. Later edits to a target artifact
  are `mission_amended` events with old and new hashes, as drift control already requires.
- `validate-mission` requires `mission_created`; validates every event shape; requires all
  blocking gates, not `.some`; checks that `base` and `head` resolve to commits; recomputes the
  target artifact hashes at HEAD and compares them with the latest amendment; validates
  `review_result` fields and `mission_done` coverage.
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
  `renderDispatch` path, until a consumer exists. Implement `cairn answer` per D4.
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

## Sequencing

1. D1 — completion binding. Nothing else can be trusted until a red tree cannot record done.
2. D2 — acceptance and review binding. A green completion still needs a semantic link.
3. D3 — task-level packs. Independent of D2; can run in parallel once D1 lands.
4. D4–D5 — state machine, init, validator, CI. These make the contract enforceable.
5. D6–D7 — policy and contract truth. These remove false claims and portability traps.

Each workstream becomes one Mission #2 task with a `serves` link and at least one blocking
gate. No task may weaken a gate; a protocol change needs `approved_by: human`.

## Compatibility and grandfathering

- Mission #0 and Mission #1's target artifacts and ledgers remain byte-identical. Their events
  stay valid; the new rules apply only after a human-approved protocol amendment.
- No history rewrite. No target artifact (`mission.md`, `policy.md`, `plan.md`,
  `docs/protocol.md`) changes without `mission_amended` and old/new hashes.
- The P0 probe uses a fresh temporary repository; it does not touch either historical ledger.
- The completion rule becomes stricter, not looser. A task that passed before may fail under
  the new rule; that is the point, and it is scoped to new events.

## Why CI did not catch P0

CI runs `pnpm typecheck`, `node --test`, both mission validators, `check-bilingual`,
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

ADR 0005 is the canonical task-level decision and is still `proposed`. The earlier
`0005-packs-block.md` approved the packet and review `packs` block; it did not make pack
participation a task property. D3 is the implementation of ADR 0005. The ADR's
backward-compatibility rule is preserved: new `task_done` events require packs; Mission #1 is
grandfathered by a note.

## Observation — the first routing-loop audit

The decision-routing guard landed in `5e9d3df`. Its first self-audit reported two writes
outside the plan: `docs/decision-routing.md` and its Chinese companion. The work was explicitly
authorized by the human, but Mission #1 is closed, no plan declares the files, and no runtime
command writes a `ruling` or `note`. The audit therefore cannot distinguish authorized
post-close work from drift.

This is an input to D4/D5, not a new workstream: a human-authorized write needs a runtime
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

**Blocker for Mission #2.** `cairn init` scaffolds `mission.md`, `plan.md`, `policy.md`, and
an empty `ledger.jsonl`; it appends no `mission_created`. Verified in a temp repository: `init`
exits 0, the ledger has 0 lines, and `check-targets` exits 1 with `no mission_created event`.
A mission created today has no frozen targets, so the chain D5 relies on starts empty. D5's
init writer is the fix. Until D5 lands, starting Mission #2 requires either D5 first or an
explicit human authorization for a manual freeze append — not a scaffold event invented to
look like one.

## Approval

- `approve 0006` — accept D1–D7 and the sequence.
- `adjust 0006 -- ...` — change a decision, a granularity boundary, or the order.
- `reject 0006` — keep Mission #1 closed and record why.

Until answered, Mission #2 does not start. This is an escalation, not a ruling.

## Issue map

| Issue | Workstreams | Close condition |
|---|---|---|
| [#1](https://github.com/chenmudu/cairn/issues/1) P0: bind completion to the verified tree | D1 | the P0 probe fails at `record`; clean task passes; CI runs the probe |
| [#2](https://github.com/chenmudu/cairn/issues/2) Bind acceptance and review evidence to criteria | D2 | per-criterion artifacts validate; Mission #1 B5/B7 replay fails |
| [#3](https://github.com/chenmudu/cairn/issues/3) Record pack participation per task (ADR 0005) | D3 | every new `task_done` has two valid pack entries |
| [#4](https://github.com/chenmudu/cairn/issues/4) Enforce task state, mission init, validator, and CI | D4–D5 | start/record/answer enforced; init/validator/reconcile/probe pass |
| [#5](https://github.com/chenmudu/cairn/issues/5) Make policy executable and the contract truthful | D6–D7 | policy enforced or labelled human; docs match the CLI; portability and audit covered |
