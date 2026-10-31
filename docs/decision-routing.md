---
schema: cairn/decision-routing@0.1
adr:
  path: docs/decisions
  sections: [Context, Decision, Consequences]
mission:
  path: .cairn/missions/<id>/inbox
  fields: [Status, Date]
promotion: "explicit move; update the index; never keep two canonical copies"
---

# Decision routing

One decision, one home. Scope decides the home; the path is the check.

- **ADR** — a numbered, project-wide decision in `docs/decisions/`. It outlives a mission and
  answers "why is the project shaped this way?" It requires Context, Decision, and Consequences
  sections.
- **Mission escalation** — a decision that closes or blocks one mission's acceptance criterion
  and needs a human answer. It lives in `.cairn/missions/<id>/inbox/`. It requires Status, Date,
  and Serves (or Blocks). It parks the task until answered.
- **Policy document** — a living rule enforced in place (`docs/i18n.md`,
  `docs/drift-control.md`, this file). It states the current rule and is amended in place; it is
  not a decision record. A choice made once, with alternatives and consequences, is an ADR.
- **Promotion** — a mission decision becomes an ADR only by an explicit move to
  `docs/decisions/`, an index update, and a note. Never copy it; never keep two canonical
  copies.
- **Legacy** — a decision that predates this rule may carry `Legacy: true`. The checker still
  enforces its path and Chinese companion; it does not retroactively add fields to history.

The SessionStart hook is configured for `startup|resume` and runs
`node scripts/goal-check.mjs --anchor`, which carries this rule from the frontmatter.
`scripts/check-decisions.mjs` enforces it. The `cairn-guard` skill runs the check at the
decision point. Change this file, not a copy: the frontmatter is the machine contract.

The workspace hook is `pending_trust` until
`~/.zcode/security/workspace-hook-trust-v1.json` holds it; before that, run
`node scripts/goal-check.mjs --anchor` by hand. After trusting the workspace and opening a new
session, `Cairn goal anchor` in the context is the evidence that injection happened. A script
that passes its tests is not proof that the harness ran it.

## Why this is a separate rule

Mission #1 closed with the same decision split across a hook string, a docs page, an inbox
index, and scope lines. A fresh session could read all of them and still not know which home a
new decision needed. The fix is not another paragraph; it is one source, one check, and one
injection point.
