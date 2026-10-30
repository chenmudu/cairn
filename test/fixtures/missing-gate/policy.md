---
schema: cairn/policy@0.1
mission: missing-gate
budgets:
  max_attempts_per_task: 1
allowed_commands:
  - node
forbidden_commands:
  - git push
stop_conditions:
  - irreversible_or_destructive
merge_policy: no_push_without_human
---
