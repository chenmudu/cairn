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
   and base commit. The packet's `packs` list is the record the task must return: two entries,
   one per pack, selected from the declared files.

   ```sh
   node src/cli.ts start <task>
   node src/cli.ts next
   ```

3. **Work.** Keep the diff inside the declared files. For behavior changes, write the test
   first and see it fail for the expected reason. If the task cannot name the acceptance
   criterion it advances, stop.

4. **Commit the work.** Commit the code, the tests, and the docs before verifying. `verify`
   refuses a worktree with changes outside `.cairn/`, because a gate result proves a tree.

5. **Verify.** Run every blocking gate and write evidence.

   ```sh
   node src/cli.ts verify <task> --mission .cairn/missions/<id>
   ```

   `verify` records the head and tree in every `gate_result` and fails if tracked content
   changes while the gates run.

6. **Record.** Append `task_done` only when the latest blocking-gate results name the current
   head and tree, the worktree is still clean outside `.cairn/`, and every evidence file is
   there. Pass the two-entry pack record returned by the task.

   ```sh
   node src/cli.ts record <task> --status done --packs <json> --mission .cairn/missions/<id>
   ```

   `record` recomputes the capability from the declared files, so a code task cannot report
   verify-before-close to escape test-first. A record with one entry, an unknown mode, a
   capability or skill that disagrees with the task, or evidence outside the mission is
   refused. After the first `task_done` in a mission carries packs, every later `task_done`
   must carry them too; omission is refused.

7. **Commit the ledger.** Commit the ledger, the evidence, and nothing else. `task_done` is a
   property of the repository, not of the conversation.

8. **Reconcile.** Check the ledger against git and the evidence. A completion event that is in
   the worktree ledger but not in the ledger at HEAD is drift.

   ```sh
   node src/cli.ts reconcile --mission .cairn/missions/<id>
   ```

9. **Audit before the claim.** Report drift signals; if the audit cannot run, record that and
   the substitute evidence.

   ```sh
   node scripts/audit-session.mjs
   ```

Pack availability is advisory and does not block the tick:

```sh
node scripts/check-method.mjs --packs
```

## Closing the mission

`record --mission-done` requires the worktree ledger to equal the ledger at HEAD, byte for
byte, because the close is a property of the repository too. The close is two commits:

1. commit `task_done`, the review, the authorization, and the evidence;
2. `node src/cli.ts record --mission-done --mission .cairn/missions/<id>`;
3. commit `mission_done`;
4. `node src/cli.ts reconcile --mission .cairn/missions/<id>` exits 0.

A `record --mission-done` that closes the worktree ledger but not HEAD is refused. Do not edit
the ledger to make it match; commit it.

### The review record

`cairn review` refuses a review that does not carry every field below, and `cairn record
--mission-done` re-checks the latest one:

| field | meaning |
| --- | --- |
| `reviewer`, `context` | who reviewed, and `fresh` or `coordinator` |
| `artifact` | the review file inside the mission; it must exist |
| `verdict`, `findings` | `pass` or `fail`, and what was found |
| `packs` | the two-entry pack record, same rule as `task_done` |
| `coverage` | one entry per acceptance id, no duplicates, no unknown ids |
| `non_goals` | one entry per non-goal the mission names |
| `cold_start` | `{ reviewer, artifact, verdict }`: a fresh session names the next task |
| `ui_surface` | `none` or `present` |

A coverage entry is:

```json
{ "criterion": "A2", "tasks": ["T3"],
  "evidence": [{ "gate": "test", "path": "evidence/T3/test.json" }],
  "verdict": "pass" }
```

`evidence` holds references, not prose. A reference with a `gate` must match an exit-0
`gate_result` for a task that serves the criterion; a reference without one only has to exist.
A task link alone is not evidence.

### Authorization

The reviewer proves the work; the human authorizes the close. After the last review, append
one event:

```json
{ "event": "authorization", "actor": "human",
  "data": { "scope": "mission_done", "approved_by": "human",
            "why": "why the human accepted the close", "date": "2026-10-31" } }
```

`scope` and `approved_by` are checked, `why` and `date` must be non-empty, and the event must
be later than the last `review_result`. `paths` may narrow the authorization to specific paths.
The shape is decision 0007; no second reason field exists.

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
- **The pack record is missing or refused.** `record` exits 2 and names the reason. Return the
  two entries with the evidence the refusal asks for; do not retry with a weaker capability or
  drop the record. After the first packs-bearing `task_done`, a task that cannot produce the
  record is a blocking question, not an omission.
- **A pack is `mismatch` or `not-invocable`.** Use the fallback and record the detected
  version. Do not invoke a launcher that would download an engine.
- **No runnable task.** Check the dependency chain, the ledger, and `goal-check`. A plan that
  cannot express the next step needs an amendment, not improvisation.
- **The ledger and git disagree.** `cairn reconcile` names the crash window. Do not edit the
  ledger; record a correction event or stop for a human.

## Packs

The floor is always executable. The pack is better when present and pinned. The seam is
Cairn's: detect, inject, record, reconcile.

### The pack record

Every task after the first packs-bearing `task_done` returns two entries, one for each pack:

```json
[
  {
    "capability": "test-first",
    "pack": "superpowers",
    "skill": "superpowers:test-driven-development",
    "version": "7.0.1",
    "mode": "use",
    "evidence": "evidence/T2/superpowers-use.txt"
  },
  {
    "capability": "design-review",
    "pack": "impeccable",
    "skill": "impeccable:design-review",
    "version": "4.8.0+df3a4ab",
    "mode": "not-applicable",
    "reason": "task files contain no markup or URL target",
    "evidence": "evidence/T2/impeccable-none.txt"
  }
]
```

- `mode` is `use`, `human-in-loop`, `not-applicable`, or `absent`.
- `capability` and `skill` follow the declared files: a code file means `test-first` /
  `superpowers:test-driven-development`, a UI file means `design-check` /
  `impeccable:design-check`, otherwise `verify-before-close` /
  `superpowers:verification-before-completion` and `design-review` /
  `impeccable:design-review`. `record` recomputes this rule and refuses a mismatch.
- `not-applicable` needs a `reason`. `absent` needs a `reason` and the floor's evidence.
- Every `evidence` value is a file inside the mission. A `use` entry's evidence must be a text
  file whose first line names the skill; test-first evidence must also contain a `RED` block
  and a `GREEN` block. A filename alone proves nothing.
- `invocable` from detection is a filesystem fact, not proof that a session could call the
  skill. Only the evidence of an actual invocation counts.

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
4. commit the work
5. `node src/cli.ts verify <task>`
6. `node src/cli.ts record <task> --status done`
7. commit the ledger and the evidence
8. `node src/cli.ts reconcile`
9. fresh-context review with the in-repo checklist

Every task report says `absent, floor used`. The gates still pass; that is the test of the
floor.

## Done

A task is done only when all three are true:

- a commit exists;
- every blocking gate exits 0 with evidence on the verified tree;
- `task_done` is in the ledger at HEAD.

A green gate proves the step, not the goal. At mission end, run the milestone audit, write the
verdict to a JSON file in the shape "The review record" names, record it, append the human
`authorization`, commit the ledger, and only then `cairn record --mission-done`. Commit
`mission_done` afterwards. See "Closing the mission".

```sh
node src/cli.ts review --file review.json --mission .cairn/missions/<id>
```

## Plan status is a hint

The `status` field in `plan.md` is a planning hint. The ledger's `task_done` events are the
truth. Do not infer completion from the plan; run `node scripts/goal-check.mjs` or `node
src/cli.ts status`.
