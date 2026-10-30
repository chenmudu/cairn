# Adapter contract — turning a packet into work

An adapter executes one task. Cairn decides whether the task is done. That split is why the
ledger can be trusted: an adapter can be a model, a subagent, or a shell script, and none of
them can mark its own work complete.

## Input

`cairn next` prints a dispatch packet and nothing else on stdout:

```json
{
  "mission": { "id": "000-bootstrap", "title": "Build Cairn with Cairn" },
  "task": { "id": "T-001", "title": "...", "files": [], "interfaces": {}, "serves": ["A1"] },
  "policy": {
    "budgets": {},
    "allowed_commands": [],
    "forbidden_commands": [],
    "stop_conditions": []
  },
  "constraints": ["..."],
  "gates": [{ "id": "typecheck", "command": "pnpm", "args": ["typecheck"] }],
  "ledger_tail": ["...last 5 events..."],
  "base": "abc1234"
}
```

`renderDispatch(packet)` in `src/packet.ts` turns the same packet into a markdown brief using
`templates/dispatch.md`. The packet is the contract; the brief is a convenience for a model.
The template owns the prose and the report schema; the packet owns the facts. A placeholder the
renderer does not know fails loudly instead of shipping a half-filled brief.

## Flow

1. The controller runs `cairn next` and keeps the packet's `base`.
2. The adapter works from `base`, touches only the declared files, and may run gates for
   feedback.
3. The adapter returns a report. It does not write `ledger.jsonl` and does not write
   `task_done`.
4. The controller runs `cairn verify <task>`: every declared gate runs, evidence is written,
   and `gate_result` events are appended.
5. The controller runs `cairn record <task> --status done`: it checks the commit, every blocking
   gate, and the evidence files, then appends `task_done`.

If `verify` fails, the task is not done. The adapter may fix and return another report; the
policy's attempt budget bounds the loop.

## Report

```json
{
  "status": "DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED",
  "commits": ["<sha>"],
  "gates": [{ "id": "...", "exit_code": 0, "evidence": "..." }],
  "review": { "verdict": "pass | fail", "findings": [] },
  "rulings": [{ "decision": "...", "why": "...", "cost_if_wrong": "..." }],
  "escalations": [{ "question": "...", "options": [], "default": "..." }]
}
```

- `status`: `DONE` when the work is ready for verification; `DONE_WITH_CONCERNS` when a review
  concern is recorded but the gates pass; `NEEDS_CONTEXT` when the packet lacks information;
  `BLOCKED` when a stop condition or an external dependency stops the branch.
- `commits`: the SHAs the adapter created; empty if it did not commit.
- `gates`: optional local runs. The controller's `cairn verify` is the authority.
- `review`: a fresh review verdict when the harness can run one.
- `rulings`: decisions made without a human, each with why and `cost_if_wrong`.
- `escalations`: questions for a human, with options and a default. Only the asking branch
  waits.

## Rules

- One active task. Parallelism happens across worktrees, never inside one.
- Only the declared files. A file outside the list is scope creep; amend the plan first.
- No plan edits, no ledger edits, no history rewrite, no push.
- Stop conditions win over completion: irreversible or destructive work, security-sensitive
  work, a write outside the repository, an unrecoverable plan, an exhausted budget, suspected
  goal drift, unreachable acceptance, or a weakened gate.
- A gate is a fixed argv. No shell interpolation; values go in `args`. The exit code is the
  verdict.
- The adapter may use any process pack (for example superpowers) or quality standard (for
  example Impeccable). Cairn does not import them; it records what they produced.

## Harnesses

ZCode is the first harness: dispatch a subagent with the rendered brief, then have the
controller run `cairn verify` and `cairn record`. The `.zcode` hook only injects the goal anchor
on session start; it is glue, not part of the contract. Any harness that can run a command and
return JSON works.

## Failure modes

- The adapter says done but `verify` fails: the exit code wins; fix and re-verify.
- The adapter writes the ledger: that is a contract violation. Reject the report and reconcile.
- A crash between `verify` and `record`: the `gate_result` events and evidence exist, but
  `task_done` does not. `cairn status` still shows the task open, and re-running `record` is
  safe because it refuses duplicates.
