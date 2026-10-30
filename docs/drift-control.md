# Drift control

Long-horizon work fails in two ways: it stops, or it keeps going in the wrong direction.
Stopping is cheap to detect — the ledger stops growing. Drifting is expensive, because every
step looks compliant. This document lists the failures we expect, the signal that catches each
one, and the mechanism that stops it. A mechanism with no enforcement point is a wish, so every
row names where it is enforced.

## Enforcement points

| Point | What it is |
|---|---|
| Gate | A deterministic command declared in `plan.md`. |
| Validator | `scripts/validate-mission.mjs`, run by the gate. |
| Ledger | Append-only events; the only truth. |
| Review | A fresh-context reviewer at a milestone. |
| Human | Checkpoint at a milestone; the only authority that can change the goal. |
| Policy | Budgets, command allowlist, stop conditions. |

## Failure modes

| # | Failure | Early signal | Mechanism | Enforced by |
|---|---|---|---|---|
| 1 | Goal silently redefined | a target hash changes with no amendment | target freeze + `mission_amended` | validator + audit |
| 2 | Task unrelated to the goal | a task with no `serves` | acceptance traceability | validator (`T-002`) |
| 3 | Plan grows scope | tasks not traceable to acceptance | amendment must cite acceptance | audit + human |
| 4 | Gate cannot fail | a gate that never exits non-zero | a fixture that must be rejected | `T-003` |
| 5 | Gate weakened | severity or command lowered by amendment | amendment cites the criterion it still proves; old evidence kept | audit |
| 6 | Implementer self-certifies | `task_done` written by the implementer | controller calls verify/record; adapters return reports | protocol + `T-002` |
| 7 | Ledger and code diverge | commit without event, event without commit | `reconcile` | `T-002`, `T-005` |
| 8 | Crash between verify and record | stale evidence, no event, or a duplicate commit | ledger is state; `reconcile` | `T-002`, `T-005` |
| 9 | New session misreads state | frontmatter and ledger disagree | derive state from the ledger | `T-002` |
| 10 | Decisions lost with the context | reasoning exists only in a conversation | rulings, notes, and inbox files | protocol |
| 11 | Scope creep inside a tick | unplanned files in the diff | one task per tick; declared files | AGENTS + review |
| 12 | Budget burn | 3 attempts, 2 fix rounds, 2 hours | park, do not improvise | policy |
| 13 | Toolchain or platform failure | gate cannot run; path or line-ending mismatch | fixed allowlist; `.gitattributes`; fail loud | policy + repo |
| 14 | Pack or harness lock-in | a skill brings its own ledger or state | adapter boundary; one ledger | decision 0002 |
| 15 | Review fatigue | milestone audit skipped | fixed cadence; human checkpoint | policy |

## Milestone audit

Run before the next task after every three completed tasks, and at mission end. Record the
result as a `review_result`; a `fail` parks the mission.

1. **Coverage.** Which acceptance criteria did the completed work advance? Which are still
   unproven? Cite the task and its evidence.
2. **Non-goals.** Did any task touch a non-goal? Cite the task and the ruling that allowed it.
3. **Cold start.** A fresh session, given only the repository, names the next task, its gate,
   and why it serves the mission. A wrong answer is drift, even if every gate is green.

## Amendment

Changing `mission.md`, `policy.md`, `plan.md`, or `docs/protocol.md` requires a
`mission_amended` event:

- `old` and `new`: path → sha256 for every changed artifact;
- `acceptance`: the criterion the change serves;
- `why`: the reason;
- `approved_by`: `human` for a goal, non-goal, acceptance, or protocol change; `cairn` for a
  plan change inside the existing acceptance envelope.

Until `T-002` implements the event, the amendment is a `ruling` carrying the same fields. No
silent edit.

## What this cannot guarantee

- It cannot detect a goal that was wrong from the start. That is the human checkpoint.
- It cannot replace human judgment at a milestone; it only makes skipping visible.
- It cannot make a gate prove something the gate does not measure.
