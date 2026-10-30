# <task-id> — <title>

- **Serves**: [<acceptance-id>]
- **Depends on**: <task ids or none>
- **Files**: <the declared paths>
- **Base**: <commit>

## Context

<Why this task exists and what the reader needs to know before changing anything.>

## Steps

1. <The smallest first step.>
2. <The next step.>

## Gates

| Gate | Command | Severity |
|---|---|---|
| <id> | `<command>` | block |

## Evidence

- `<evidence/<task>/<gate>.json>`

## Pack record

- Used: `<pack>:<skill>@<pin>` with `<evidence>`
- Or: `not-applicable: <reason>`
- Or: `absent, floor used`

## Out of scope

- <The nearest thing this task does not do.>
