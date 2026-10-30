# The method

Cairn is a git-native mission runtime whose completion is a repository property: a commit, a
blocking gate at exit 0, and a `task_done` event. The method is the part that decides what to
do and how to judge it; Cairn is its first artifact and may be replaced.

The method has three layers:

1. **Floor** — the in-repo version that always runs: the mission contract, the plan, the
   ledger, the gates, the review checklist, and the dispatch packet.
2. **Pack** — a better implementation, consumed by reference and pinned: superpowers for
   process discipline, Impeccable for design standards and UI checks.
3. **Seam** — Cairn's coordination layer: detection, injection, recording, and reconciliation.
   A pack report is an input; gate evidence is proof.

`playbook.md` maps every phase to all three. The JSON block is the machine contract; the table
is the same map for people.

## Run the checks

From the repository root:

```sh
node scripts/check-method.mjs --playbook
node scripts/check-method.mjs --packs
node scripts/check-method.mjs --products
node scripts/check-method.mjs --products --strict
```

- `--playbook` validates the matrix: every phase, every floor, every fallback, every pin, and
  no `TBD` or `TODO`.
- `--packs` detects both packs and reports `present`, `absent`, `mismatch`, or
  `not-invocable`. It is advisory and never blocks a gate. It does not download an engine.
- `--products` resolves each `exists` row's floor product and each fallback. A `planned:T#`
  row is reported as pending.
- `--strict` fails on a pending row. T8 runs it before `mission_done`; every playbook row is
  now `exists`.

## Run with zero packs

Every row has a floor and a fallback, so the loop still runs:

1. Read `README.md` and the active mission.
2. Run `node scripts/goal-check.mjs`; it names the next task and its gates.
3. Do the tick: write the test first, make the change, run the gates.
4. Write evidence, record `task_done` with `cairn record`, commit.
5. Review with a fresh context and the checklist below.

A task that used no pack writes `absent, floor used` in its report. It does not pretend the
pack ran.

## Run with one pack

- **superpowers only**: use `test-driven-development` for execution,
  `requesting-code-review` for review, and `verification-before-completion` before the claim.
  Impeccable rows stay `not-applicable` for docs and code.
- **Impeccable only**: use the detector and critique only when a UI surface exists. For docs
  and code, the in-repo checklist applies and the reason is recorded. Execution uses the floor.

## Run with both

The playbook's `packs` rows are the instruction. The adapter receives the skill or command,
the pin, the mode, and the fallback. It returns a report naming what it used. The coordinator
records the result; the ledger remains the only completion truth.

Detection roots, in order:

- superpowers: `CAIRN_SUPERPOWERS_DIR`, then the ZCode plugin cache.
- Impeccable: `CAIRN_IMPECCABLE_DIR`, then `~/.zcode/skills/impeccable`, then
  `$CAIRN_IMPECCABLE_SRC/.claude/skills/impeccable`.
- Impeccable engine: `CAIRN_IMPECCABLE_BIN`, then
  `~/.impeccable/bin/<version>/impeccable.exe` or the skill's launcher.

An environment override that points at a missing path means `absent`; detection does not fall
through to a real install. The absent run exists so the floor is tested, not assumed.

## Checklist

This is the floor for docs and code. It is deliberately shorter than Impeccable; the pack
adds UI-specific checks when a UI surface exists.

- **Docs**: the reader can act on it; commands are runnable as written; the English canonical
  file and its Chinese companion agree; a new human-facing file has a companion.
- **Code**: the test fails before the change and passes after; the change is the smallest one
  that satisfies the task; no unrelated refactor; the gate is the proof, not the commit
  message.
- **Workflow**: the tick names one task, its `serves` link, its gates, and its evidence; a
  failure records the command and the exit code; a missing pack records `absent, floor used`.
- **UI (only when a surface exists)**: Impeccable `detect` on markup or a URL; `critique` with
  two isolated assessments; `audit` on the five dimensions. An empty `detect` result on
  markdown is `not-applicable`, not clean.

## What this is not

- No UI, database, or hosted service.
- No unattended scheduler. The `unattended` row prepares a tick; Mission #2 runs the loop.
- No vendoring of either pack. The repositories stay external; the pins are in the playbook.
- No second ledger. A pack may keep adapter-local scratch; `cairn reconcile` compares it, and
  the Cairn ledger wins.
