# Drift control

Long-horizon work fails in two ways: it stops, or it keeps going in the wrong direction.
Stopping is cheap to detect — the ledger stops growing. Drifting is expensive, because every
step looks compliant. This document lists the failures we expect, the signal that catches each
one, and the mechanism that stops it. A mechanism with no enforcement point is a wish, so every
row names where it is enforced.

## Enforcement and injection

A rule needs two different things, and they are not interchangeable:

- **Enforcement** decides pass or fail: a script, a test, CI, or a `human`/`review`
  checkpoint. Only enforcement makes a rule binding.
- **Injection** puts the rule in the agent's context at the right time: a hook, a skill
  procedure, or `AGENTS.md`. Injection makes the rule known; it does not make it happen.

A rule with injection and no enforcement is a suggestion. A rule with enforcement and no
injection is an ambush. Every failure mode below names its enforcement; `docs/automation.md`
describes the injection wiring.

### Enforcement points

| Point | What it is | Can enforce? |
|---|---|---|
| Script / test / CI | A deterministic command that exits non-zero on violation. | yes |
| Human | A checkpoint with authority to stop or change the goal. | yes |
| Review | A fresh-context `review_result` at a milestone. | yes, by judgment |
| Gate | A deterministic command declared in `plan.md`; it invokes a script or test. | yes |
| Ledger | Append-only events; the state source, not a check by itself. | no |
| Policy | Budgets and stop conditions; a rule source, not an executor. | no, until D6 |

### Injection points

| Point | What it does | Can enforce? |
|---|---|---|
| Hook | Injects a short anchor at session start, prompt submit, or stop. | no |
| Skill | Gives the agent a procedure at the decision point. | no |
| `AGENTS.md` | Always-on workspace instruction; the fallback pointer. | no |
| Canonical document | Holds the rule once; scripts and hooks read it. | no |

## Failure modes

The **Enforced by** cell is machine-checked. It contains only a comma-separated list of
backticked repo-relative paths to a script or test, or `human` / `review`. A script must be run
by CI or a test; a test runs under `node --test`. No task ids, no prose.
`scripts/check-enforcement.mjs` enforces this grammar in both language tables.

| # | Failure | Early signal | Mechanism | Enforced by |
|---|---|---|---|---|
| 1 | Goal silently redefined | a target hash changes with no amendment | target freeze + `mission_amended`; the hash chain is recomputed | `scripts/check-targets.mjs` |
| 2 | Task unrelated to the goal | a task with no `serves` | acceptance traceability | `scripts/validate-mission.mjs`, `scripts/goal-check.mjs` |
| 3 | Plan grows scope | tasks not traceable to acceptance | amendment must cite acceptance | `review` |
| 4 | Gate cannot fail | a gate that never exits non-zero | a fixture that must be rejected | `test/validate-mission.test.mjs` |
| 5 | Gate weakened | severity or command lowered by amendment | amendment cites the criterion it still proves; old evidence kept | `review` |
| 6 | Implementer self-certifies | `task_done` written by the implementer | controller calls verify/record; adapters return reports | `test/cli.test.mjs` |
| 7 | Ledger and code diverge | commit without event, event without commit | `reconcile` | `test/reconcile.test.ts` |
| 8 | Crash between verify and record | stale evidence, no event, or a duplicate commit | ledger is state; `reconcile` | `test/reconcile.test.ts` |
| 9 | New session misreads state | frontmatter and ledger disagree | derive state from the ledger | `scripts/goal-check.mjs`, `test/plan.test.mjs` |
| 10 | Decisions lost with the context | reasoning exists only in a conversation | rulings, notes, and inbox files | `scripts/check-decisions.mjs`, `human` |
| 11 | Scope creep inside a tick | unplanned files in the diff | one task per tick; declared files | `scripts/audit-session.mjs`, `review` |
| 12 | Budget burn | 3 attempts, 2 fix rounds, 2 hours | park, do not improvise; D6 executes or labels the budget | `human` |
| 13 | Toolchain or platform failure | gate cannot run; path or line-ending mismatch | fixed allowlist; `.gitattributes`; fail loud | `human` |
| 14 | Pack or harness lock-in | a skill brings its own ledger or state | adapter boundary; one ledger; `check-method --packs` reports presence only | `review` |
| 15 | Review fatigue | milestone audit skipped | fixed cadence; human checkpoint | `scripts/goal-check.mjs` |

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

`cairn record --amended --artifact <path>` is the writer. It takes the old hash from the frozen
chain and the new hash from the file, and appends the event. No silent edit.

## What this cannot guarantee

- It cannot detect a goal that was wrong from the start. That is the human checkpoint.
- It cannot replace human judgment at a milestone; it only makes skipping visible.
- It cannot make a gate prove something the gate does not measure.
