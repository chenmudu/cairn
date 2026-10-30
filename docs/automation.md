# Automation — the goal guard and the session audit

Two commands make the method observable. They are zero-dependency Node ESM and run from the
repository root. Neither writes the ledger.

## Before a task: `goal-check`

```bash
node scripts/goal-check.mjs                 # readable report
node scripts/goal-check.mjs --brief         # the SessionStart anchor
node scripts/goal-check.mjs --json          # machine-readable
```

It reads `mission.md`, `plan.md`, and `ledger.jsonl`, then prints:

- the mission intent and non-goals;
- the next task, derived from the ledger (`task_done`) and the plan's dependencies;
- the acceptance criterion the task serves, with its check;
- the task's gates;
- the acceptance coverage map (`A# → task ids`);
- the decision routing rule from `docs/decision-routing.md`: an ADR is a numbered, project-wide
  decision in `docs/decisions/`; a mission escalation closes or blocks one mission acceptance
  and needs a human answer, so it lives in `.cairn/missions/<id>/inbox/`.
  `scripts/check-decisions.mjs` enforces the rule.

Exit 1 means stop: the next task has no `serves` link, a `serves` id is unknown, an acceptance
criterion is uncovered, no task is runnable, or a milestone audit is due. A task without an
acceptance link is not work; it is drift that has not been named yet.

The guard also enforces the audit cadence. Three completed tasks since the last `review_result`,
or a complete mission without a passing review after the last `task_done`, makes it exit 1 and
names the checkpoint. A complete mission with that review exits 0 and prints
`Current task: none`; `cairn record --mission-done` is then the only write left.

## After a task: `audit-session`

```bash
node scripts/audit-session.mjs              # newest ZCode transcript
node scripts/audit-session.mjs <file>       # a specific model-io JSONL
node scripts/audit-session.mjs --strict     # exit 1 on a drift verdict
node scripts/audit-session.mjs --out report.md
```

It reads the latest request in a ZCode `model-io-*.jsonl` transcript and reports four signals.
It does not read the largest request: after a compaction the older snapshot is larger, and
auditing it would miss the work that followed. A compaction summary anchors the work that
follows when no later user turn exists; a summary followed by a later user turn is skipped so
replayed history is not judged twice. Writes under the mission's `evidence/` are runtime output
and are not drift.

| Signal | What it means |
|---|---|
| Alignment corrections | The human had to restate the goal, positioning, or project scope. The guard should have made this unnecessary. |
| Claims without a gate | A completion claim in a turn that ran no gate. The claim is not evidence. |
| Writes outside the plan | A `Write`/`Edit` to a path no task declares. Drift unless a ruling or amendment records it. |
| Confirmation requests | The agent pushed a decision back to the human. Some are legitimate; the count is a trend, not a verdict. |

The verdict is `drift` when a claim or an unplanned write exists, `attention` when only
alignment or confirmation signals exist, and `clean` otherwise. The audit is diagnostic; only
`--strict` turns `drift` into exit 1. Transcripts contain the whole conversation: keep them
out of the repository.

`--mission <dir>` supplies the plan's declared files and the ledger, so the audit can tell a
planned write from an unplanned one. The default is the active mission from
`.cairn/config.json` (`.cairn/missions/001-method-pack` in this repository).

## Rules, checks, and injection

Four different jobs; they are not interchangeable:

| Layer | Job | Can enforce? | Where it lives |
|---|---|---|---|
| Canonical rule | Say what is true, once. | no | `docs/*.md` |
| Script / test / CI | Decide pass or fail. | yes | `scripts/`, `test/`, `.github/workflows/gates.yml` |
| Hook | Inject a short anchor at session start, prompt submit, or stop. | no | `.zcode/hooks/`, `.zcode/config.json` |
| Skill | Give the procedure at the decision point. | no | `.zcode/skills/<name>/SKILL.md` |
| `AGENTS.md` | Always-on fallback pointer. | no | `AGENTS.md` |
| Human / review | Judge what cannot be mechanized. | yes, by authority | `review_result`, inbox escalation |

Injection makes a rule known; only a script, a test, CI, or a human/review checkpoint makes it
binding. A rule with injection and no enforcement is a suggestion; a rule with enforcement and
no injection is an ambush. `docs/drift-control.md` is the enforcement map; this file is the
injection map.

ZCode loads the user `AGENTS.md` first, then one workspace `AGENTS.md`. It does not merge
multiple workspace instruction files, so the workspace file is a router: rules live in
`docs/`, and `AGENTS.md` points to them. Hooks support seven events; this repository uses
`SessionStart` for the anchor and reserves `Stop` for a bounded tail reminder. A `Stop` hook can
request continuation up to three times, so it is not a gate.

A skill is a directory. `SKILL.md` is the SOP; reference material belongs in `docs/` or the
skill's `references/`; executable checks belong in `scripts/` when shared, or the skill's
`scripts/` when private. The SOP names the check; it does not paste the script or the document.

## Wiring

- **Skill** — `.zcode/skills/cairn-guard/SKILL.md` tells the agent to run the guard before work,
  the decision check before and after writing a decision, the enforcement check before and
  after changing a rule's enforcement, and the audit before claiming done.
- **Hook** — `.zcode/config.json` runs `.zcode/hooks/session-start.mjs` on `startup`, `clear`,
  and `compact`. The hook prints `goal-check --brief` as `additionalContext`; the brief reads
  the routing rule from `docs/decision-routing.md`, so a fresh session starts with the anchor
  from the repository. Workspace hooks may require trust in ZCode; the scripts work without the
  hook in any harness.
- **Script** — `scripts/check-decisions.mjs` validates both decision homes and rejects stray
  numbered decisions. `scripts/check-enforcement.mjs` validates the failure-mode map's
  machine grammar and the Chinese token parity. Both are CI steps and read their rule source;
  neither keeps a second copy.
- **Agents** — `AGENTS.md` points to the same checks and stays a router. The hook is an
  adapter, not the contract.

Disable the hook by removing the `SessionStart` entry from `.zcode/config.json`; the commands
remain available.

## Limits

The audit is a heuristic over text. It can miss a claim phrased unusually and can flag a
legitimate confirmation. It cannot tell whether the goal itself is right, and it cannot prove
that a gate measures what matters. Those remain the human checkpoint and the milestone audit.
