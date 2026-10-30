# Dispatch packet — <task-id>

- **Task**: <title>
- **Serves**: [<acceptance-id>]
- **Base**: <commit>
- **Files**: <declared paths>
- **Gates**: <gate ids and commands>

## Packs

For each capability this task uses:

- **Capability**: <name>
- **Pack**: <superpowers or Impeccable, with pin>
- **Mode**: <use, human-in-loop, or not-applicable>
- **Instruction**: <the exact skill or command>
- **Fallback**: <the executable floor>

If the pack is absent, the instruction is `absent, floor used`.

## Constraints

- One tick advances one task.
- The adapter report never writes `ledger.jsonl`.
- A pack report is input; the gate and the ledger are proof.
- No push, publish, history rewrite, or destructive command.

## Report back

- Commits and the files changed.
- Gate results with exit codes and evidence paths.
- Pack used and pin, `not-applicable` with a reason, or `absent, floor used`.
- Any deviation, ruling, or escalation.
