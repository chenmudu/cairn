# 0001 — The name is Cairn

- Status: accepted
- Date: 2026-10-31

## Context

The project needs a name that encodes the thesis: progress lives in the repository, not in
the conversation, and a later agent can pick up the trail without the earlier agent's context.

## Decision

The project is **Cairn**. The CLI is `cairn`. A completed task leaves a commit, evidence, and a
ledger event — one more stone on the trail.

Tagline: **Leave a trail, not a transcript.**

## Alternatives considered

| Name | Why not |
|---|---|
| Baton | Implies handoff, not durable evidence. |
| Capstan | Implies slow heavy hauling, not a readable trail. |
| Keel | Implies stability, not progress. |
| Mission | Too generic; collides with the domain term. |

## Consequences

- `cairn` is the command name, the package name, and the repository name.
- The domain vocabulary stays separate: Mission, Task, Tick, Gate, Evidence, Ledger.
- Package and trademark availability are checked before a public release; if `cairn` is taken,
  the working name changes here first, not in code.