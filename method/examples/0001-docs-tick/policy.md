---
schema: cairn/policy@0.1
mission: 0001-docs-tick
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

# Policy — One tick, one trail

- **Budget**: one task, one tick, one commit.
- **Stops**: a failing gate, a missing evidence file, or a pack record without a reason.
- **Writes**: only the files E1 declares. The ledger is written by the runtime, never by an
  adapter.
- **Human checkpoints**: none; this is a closed example with no live side effects.
- **Pack rule**: a pack report is input; the gate and the ledger are proof. An absent pack uses
  the floor and records `absent, floor used`.
