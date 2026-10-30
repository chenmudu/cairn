# Dispatch — {{task_id}}: {{task_title}}

You are an adapter. Execute exactly one task, then return a report. You do not write the
ledger and you do not mark the task done; the controller runs the gates and records completion.

## Mission

{{mission_id}} — {{mission_title}}

This task serves: {{serves}}

Base commit: `{{base}}`. Start there and do not rewrite history.

## Task

**{{task_id}} — {{task_title}}**

Files you may touch:

{{files}}

Interfaces:

{{interfaces}}

## Constraints

{{constraints}}

## Policy

- Allowed commands: {{allowed_commands}}
- Forbidden commands: {{forbidden_commands}}
- Budgets: {{budgets}}
- Stop conditions: {{stop_conditions}}

## Gates

The controller runs these with `cairn verify` after you return. Run them earlier for feedback;
a gate without recorded evidence does not count.

{{gates}}

## Packs

The packet chose these capabilities from the declared files. A pack is context, not completion;
record what you used, what did not apply, or what was absent with its floor.

{{packs}}

## Recent ledger

{{ledger_tail}}

## Report

Return one JSON object:

```json
{
  "status": "DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED",
  "commits": ["<sha>"],
  "gates": [{ "id": "...", "exit_code": 0, "evidence": "..." }],
  "review": {
    "verdict": "pass | fail",
    "findings": [],
    "packs": [
      { "capability": "...", "pack": "superpowers", "version": "...", "mode": "use | human-in-loop | not-applicable | absent", "reason": "...", "evidence": "..." }
    ]
  },
  "rulings": [{ "decision": "...", "why": "...", "cost_if_wrong": "..." }],
  "escalations": [{ "question": "...", "options": [], "default": "..." }]
}
```

Rules:

- One active task. Do not edit files outside the list above.
- Never append to `ledger.jsonl`; never write `task_done`.
- If the task cannot express the work, return `NEEDS_CONTEXT`; do not amend the plan yourself.
- If a stop condition triggers, return `BLOCKED` and name it.
