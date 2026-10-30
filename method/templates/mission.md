---
schema: cairn/mission@0.1
id: <mission-id>
title: <title>
status: active
created: <YYYY-MM-DD>
owner: <owner>
acceptance:
  - id: A1
    check: <a condition a command or reviewer can verify>
---

# <title>

## Intent

<What this mission delivers, and why the repository cannot already do it.>

## Non-goals

- <What this mission explicitly does not do.>

## Constraints

- <The rules that hold for every task.>

## Acceptance

- A1: <the outcome, not the activity.>

## Current action

The ledger is the source of truth. Run `node scripts/goal-check.mjs` before starting; the next
task comes from the ledger and the plan, never from this section.
