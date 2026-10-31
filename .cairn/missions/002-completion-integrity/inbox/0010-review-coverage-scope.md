# Decision 0010 — Coverage completeness belongs to the closing review

- Status: approved by the human on 2026-10-31 (milestone-audit instruction)
- Date: 2026-10-31
- Serves: A2
- Scope: mission-scoped (Mission #2)

## Context

D2 says a `review_result` carries `coverage` for every acceptance id
(`plan.md:463`, `0006-completion-integrity.md:150`). T3 implemented that as a `recordReview`
rule, so every review recorded before the last task is done is refused. The first milestone
audit hit it: with A4–A6 not advanced, the review could only cover A1–A3 and was rejected with
`coverage must name every acceptance criterion: missing A4, A5, A6`.

`AGENTS.md` requires a `review_result` every three completed tasks, so the rule as implemented
makes the audit cadence impossible: a mid-mission audit cannot cover criteria whose tasks have
not started.

## Decision

"Coverage for every acceptance id" constrains the review that `mission_done` validates, not
every review. A milestone review covers the criteria its audit actually reached and names the
ones still unproven in its findings.

In the runtime: `recordReview` still refuses an unknown or duplicate criterion and still checks
that the review artifact exists, but it no longer requires every criterion. `completeMission`
keeps the full requirement, so the closing review must name all six.

## Consequences

Milestone audits are recordable. The close guarantee is unchanged: `mission_done` re-validates
the latest review with `requireAll` on, so a review that skips a criterion still blocks the
close. The one thing no longer checked at record time is whether a criterion was omitted on
purpose; the audit report and the closing review carry that judgement.