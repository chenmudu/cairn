# Decision 0012 — Make T9 the harness-claims task before T7

- Status: approved by human
- Date: 2026-11-01
- Serves: A6
- Scope: mission-scoped (Mission #2)

## Context

Milestone audit 2 confirmed T4–T6 and left the A6 contract clause open for T7. A separate
review of the harness found that the SessionStart hook and the status surfaces can disagree
with the runtime: the hook drops the goal anchor when `goal-check` fails, the hook tests depend
on the real repository's audit state, and AGENTS.md and the docs describe the harness as it was
intended rather than as it runs. T7 owns the protocol and status truth; the harness claims must
match the runtime before T7 lands, or T7 would certify surfaces that still lie. The human
approved T9 and its placement before T7 on 2026-11-01 (this decision).

## Decision

Add T9 "Make the harness claims match the runtime" between T6 and T7. T9 depends on T6.
T7's dependencies become [T6, T9], so a parked T9 cannot let T7 run first. T9 serves A6.

## Non-goal check — "No new runtime feature outside D1–D8"

T9 does not add a runtime feature. The evidence

- `scripts/goal-check.mjs` is a read-only status projection: it contains no write calls and
  imports only `readMission`, `routingLines`, and `resolveMission`. `--anchor` projects the same
  report that `--brief` already computes and adds a warning line. It writes no ledger event,
  defines no new event type, and adds no `src/` module.
- `.zcode/hooks/session-start.mjs` is an adapter, not the runtime. Its own header states that
  the contract is `scripts/goal-check.mjs`, which any harness can run without ZCode. T9 fixes
  its failure path so it stops dropping the anchor; it does not add a capability.
- T9's file list contains zero files under `src/`. The runtime is untouched.

The work serves A6 ("every mechanizable audit finding has a negative test"); the anchor drop on
failure and the stale harness claims are exactly such findings. The human approved T9 and its
placement before T7 on 2026-11-01 (this decision).

Boundary: a new `src/` module, a new ledger-writing command, a new event type, or a scheduler
would be a runtime feature and would require a `mission.md` non-goal amendment with
`approved_by: human` before starting. T9 stays inside the existing non-goal.