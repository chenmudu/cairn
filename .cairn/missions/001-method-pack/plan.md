---
schema: cairn/plan@0.1
mission: 001-method-pack
tasks:
  - id: T1
    title: Adopt the .cairn layout and migrate Mission #0
    deps: []
    risk: high
    status: done
    serves: [B1, B6]
    files:
      - src/paths.ts
      - src/cli.ts
      - scripts/goal-check.mjs
      - scripts/audit-session.mjs
      - scripts/validate-mission.mjs
      - test/paths.test.ts
      - test/cli.test.mjs
      - test/goal-check.test.mjs
      - test/audit-session.test.mjs
      - test/plan.test.mjs
      - test/packet.test.ts
      - test/ledger.test.mjs
      - test/validate-mission.test.mjs
      - test/helpers.mjs
      - docs/protocol.md
      - docs/protocol.zh.md
      - docs/self-hosting.md
      - docs/self-hosting.zh.md
      - docs/automation.md
      - docs/automation.zh.md
      - docs/i18n.md
      - README.md
      - README.zh-CN.md
      - AGENTS.md
      - package.json
      - .zcode/hooks/session-start.mjs
      - .zcode/skills/cairn-guard/SKILL.md
      - .cairn/config.json
      - .cairn/missions/000-bootstrap/
      - .cairn/missions/001-method-pack/
    interfaces:
      produces:
        - "resolveMission(value): string"
        - "cairn init <id>"
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: mission
        command: node
        args: ["scripts/validate-mission.mjs", ".cairn/missions/001-method-pack"]
        severity: block
      - id: legacy
        command: node
        args: ["scripts/validate-mission.mjs", ".cairn/missions/000-bootstrap"]
        severity: block
      - id: reconcile
        command: node
        args: ["src/cli.ts", "reconcile", "--mission", ".cairn/missions/000-bootstrap"]
        severity: block

  - id: T2
    title: Make every human-facing artifact bilingual
    deps: [T1]
    risk: medium
    status: done
    serves: [B2]
    files:
      - .cairn/missions/000-bootstrap/mission.zh.md
      - .cairn/missions/000-bootstrap/plan.zh.md
      - .cairn/missions/000-bootstrap/policy.zh.md
      - .cairn/missions/001-method-pack/mission.zh.md
      - .cairn/missions/001-method-pack/plan.zh.md
      - .cairn/missions/001-method-pack/policy.zh.md
      - docs/decisions/0001-name-cairn.zh.md
      - docs/decisions/0002-packs-and-runtime-boundary.zh.md
      - docs/decisions/0003-the-method-is-the-project.zh.md
      - templates/dispatch.zh.md
      - .zcode/skills/cairn-guard/SKILL.zh.md
      - docs/i18n.md
      - scripts/check-bilingual.mjs
      - test/bilingual.test.mjs
    gates:
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: bilingual
        command: node
        args: ["scripts/check-bilingual.mjs"]
        severity: block

  - id: T3
    title: Write the fusion playbook and reconcile the packs
    deps: [T2]
    risk: medium
    status: done
    serves: [B2, B3, B7]
    files:
      - method/README.md
      - method/README.zh.md
      - method/playbook.md
      - method/playbook.zh.md
      - scripts/check-method.mjs
      - test/method.test.mjs
      - docs/i18n.md
      - AGENTS.md
      - docs/decisions/0002-packs-and-runtime-boundary.md
      - docs/decisions/0002-packs-and-runtime-boundary.zh.md
      - docs/decisions/0004-absorb-the-coordination.md
      - docs/decisions/0004-absorb-the-coordination.zh.md
      - .zcode/skills/cairn-guard/SKILL.md
      - .zcode/skills/cairn-guard/SKILL.zh.md
      - .cairn/missions/001-method-pack/plan.zh.md
      - .cairn/missions/000-bootstrap/inbox/0001-plan-defects.zh.md
      - .cairn/missions/000-bootstrap/inbox/0003-mission-end-audit.zh.md
      - .cairn/missions/000-bootstrap/inbox/0004-mission-1-follow-ups.zh.md
      - scripts/check-bilingual.mjs
      - test/bilingual.test.mjs
    gates:
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: method
        command: node
        args: ["scripts/check-method.mjs", "--playbook"]
        severity: block

  - id: T4
    title: Add standards and templates
    deps: [T3]
    risk: medium
    status: done
    serves: [B3]
    files:
      - method/standards/docs.md
      - method/standards/docs.zh.md
      - method/standards/code.md
      - method/standards/code.zh.md
      - method/standards/workflow.md
      - method/standards/workflow.zh.md
      - method/templates/mission.md
      - method/templates/mission.zh.md
      - method/templates/task.md
      - method/templates/task.zh.md
      - method/templates/review.md
      - method/templates/review.zh.md
      - method/templates/adr.md
      - method/templates/adr.zh.md
      - method/templates/handoff.md
      - method/templates/handoff.zh.md
      - scripts/check-method.mjs
      - test/method.test.mjs
      - docs/i18n.md
    gates:
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: method
        command: node
        args: ["scripts/check-method.mjs"]
        severity: block

  - id: T5
    title: Write the one-tick operator guide
    deps: [T4]
    risk: medium
    status: done
    serves: [B4]
    files:
      - docs/workflow.md
      - docs/workflow.zh.md
      - scripts/check-workflow.mjs
      - test/workflow.test.mjs
      - README.md
      - README.zh-CN.md
      - docs/i18n.md
    gates:
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: workflow
        command: node
        args: ["scripts/check-workflow.mjs"]
        severity: block

  - id: T6
    title: Run a worked example tick
    deps: [T5]
    risk: medium
    status: done
    serves: [B4]
    files:
      - method/examples/0001-docs-tick/mission.md
      - method/examples/0001-docs-tick/plan.md
      - method/examples/0001-docs-tick/policy.md
      - method/examples/0001-docs-tick/ledger.jsonl
      - method/examples/0001-docs-tick/evidence/
      - method/examples/0001-docs-tick/product.md
      - method/examples/0001-docs-tick/README.md
      - method/examples/0001-docs-tick/README.zh.md
      - scripts/check-example.mjs
      - test/example.test.mjs
      - docs/i18n.md
    gates:
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: example
        command: node
        args: ["scripts/check-example.mjs"]
        severity: block

  - id: T7
    title: Close the runtime gaps that block the method
    deps: [T6]
    risk: medium
    status: active
    serves: [B1, B2, B3, B4, B6, B7]
    files:
      - src/review.ts
      - src/packs.ts
      - src/packet.ts
      - src/cli.ts
      - test/review.test.ts
      - test/packs.test.ts
      - test/cli.test.mjs
      - scripts/audit-session.mjs
      - test/audit-session.test.mjs
      - scripts/check-example.mjs
      - test/example.test.mjs
      - scripts/check-bilingual.mjs
      - test/bilingual.test.mjs
      - scripts/check-method.mjs
      - test/method.test.mjs
      - method/playbook.md
      - method/playbook.zh.md
      - method/README.md
      - method/README.zh.md
      - method/examples/0001-docs-tick/policy.md
      - method/examples/0001-docs-tick/product.zh.md
      - method/examples/0001-docs-tick/README.md
      - method/examples/0001-docs-tick/README.zh.md
      - method/examples/0001-docs-tick/ledger.jsonl
      - templates/dispatch.md
      - templates/dispatch.zh.md
      - docs/adapter.md
      - docs/adapter.zh.md
      - docs/workflow.md
      - docs/workflow.zh.md
      - docs/protocol.md
      - docs/protocol.zh.md
      - docs/self-hosting.md
      - docs/self-hosting.zh.md
      - docs/automation.md
      - docs/automation.zh.md
      - docs/i18n.md
      - .cairn/missions/001-method-pack/plan.md
      - .cairn/missions/001-method-pack/plan.zh.md
      - .cairn/missions/001-method-pack/inbox/
      - .cairn/missions/001-method-pack/ledger.jsonl
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: mission
        command: node
        args: ["scripts/validate-mission.mjs", ".cairn/missions/001-method-pack"]
        severity: block

  - id: T8
    title: Cold-start audit and mission close
    deps: [T7]
    risk: low
    status: todo
    serves: [B5, B7]
    files:
      - .cairn/missions/001-method-pack/ledger.jsonl
      - .cairn/missions/001-method-pack/inbox/
      - README.md
      - README.zh-CN.md
      - docs/i18n.md
    gates:
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: mission
        command: node
        args: ["scripts/validate-mission.mjs", ".cairn/missions/001-method-pack"]
        severity: block
      - id: method-products
        command: node
        args: ["scripts/check-method.mjs", "--products", "--strict"]
        severity: block
---

# Plan — Mission #1

The frontmatter is the machine contract: every task has an acceptance link, declared files,
and at least one blocking gate. The tasks are ordered so the foundation lands before the
method pack, and the method pack lands before the worked example.

## Task notes

- **T1** is the only task allowed to move Mission #0. It updates the protocol layout with a
  human-approved amendment, adds path resolution and `cairn init`, migrates the directory, and
  proves the old mission still validates and reconciles.
- **T2** turns bilingual from a promise into a check. It covers the mission contracts,
  decisions, guard skill, and dispatch template.
- **T3** starts with the three-way reconciliation, then writes the phase map: frame, plan,
  execute, review, close, and unattended setup. Every row names a superpowers practice, an
  Impeccable standard, a Cairn artifact or gate, and the fallback. It applies one superpowers
  practice to its own work and closes the inbox bilingual gap the checker missed.
- **T4** makes the playbook usable: standards for docs, code, and workflows, plus templates for
  missions, tasks, reviews, ADRs, and handoffs.
- **T5** writes the operator guide: roles, commands, human checkpoints, and failure paths.
- **T6** runs the guide on a real, small tick and records the ledger and evidence. The example
  is the proof that the guide is executable.
- **T7** adds `cairn review` and records the `task_started` decision. It also adds pack
  detection and packet injection, including the protocol amendment for the `packs` block, and
  fixes `audit-session`'s whole-file read so it can audit a long transcript. Invariant 3 was a
  separate human decision; 0005 approved it, and this tick records the protocol amendment.
- **T8** is the cold-start review and `mission_done`. A fresh session must explain the method
  from the repository alone, verify the pack mesh, and pass with both packs absent before the
  mission closes.

## Pack adoption

The order is superpowers first, Impeccable second; either order is acceptable, but each step
lands in a task with evidence, not in a batch at the end.

- **T3** reconciles the three artifacts and uses one superpowers practice for its own work; it
  records the pack and pin, or `absent, floor used`.
- **T4** distills Impeccable's transferable standards into the in-repo floor; the UI-specific
  detector and live mode stay external.
- **T6** runs the worked example with the adopted packs where they apply.
- **T7** detects both packs and injects the relevant capability into the dispatch packet; the
  `packs` block is a protocol amendment.
- **T8** verifies the mesh from a cold start, including both packs absent.

## Task specs

These are binding. A task that cannot meet them returns `NEEDS_CONTEXT`; it does not
improvise a softer interpretation.

### T3 — reconciliation and playbook

Inputs: `docs/decisions/0002-packs-and-runtime-boundary.md` and
`docs/decisions/0004-absorb-the-coordination.md`; superpowers 7.0.1 from
`CAIRN_SUPERPOWERS_DIR` or the harness plugin cache; Impeccable skill 4.8.0 and engine
0.1.18 from `CAIRN_IMPECCABLE_DIR` (default `~/.zcode/skills/impeccable`), then
`$CAIRN_IMPECCABLE_SRC/.claude/skills/impeccable`; source commit `df3a4abe7`.

Outputs:

- `method/playbook.md` contains a fenced `cairn/playbook@0.1` JSON block and a rendered table.
  Every row has `phase`, `floor`, `superpowers` (`skill`, `pin`, `mode`, `fallback`),
  `impeccable` (`command` or `standard`, `pin`, `applicability`, `fallback`), `seam`, and
  `status`.
- `mode` and `applicability` are `use`, `human-in-loop`, or `not-applicable`; a
  `not-applicable` row carries a `reason`.
- `status` is `exists` or `planned:T#`. No `TBD`, `TODO`, or empty cell.
- The rows cover `frame`, `plan`, `execute`, `review`, `close`, `state`, `design-check`,
  `handoff`, and `unattended`.
- `method/README.md` explains how to run with both packs, one pack, and neither.
- `scripts/check-method.mjs` implements `--playbook` (structure, pins, status, no empty
  cells), `--packs` (advisory detection), and `--products` (resolve every `exists` row;
  report `planned:T#` as pending; `--strict` fails on pending). `--packs` reports the installed
  Impeccable as `present` (skill 4.8.0, engine 0.1.18, 62 rules) and superpowers as present or
  absent; it never downloads an engine.
- `test/method.test.mjs` covers a valid matrix, a missing floor, an empty fallback, a
  `not-applicable` without reason, and a pending row under `--strict`.
- `scripts/check-bilingual.mjs` scans `.cairn/missions/*/inbox/*.md`; the three Mission #0
  inbox companions exist.
- The first superpowers use is `test-driven-development` for `check-method`; the JSON block's
  top-level `packs_used` records `superpowers:test-driven-development@7.0.1` with the test
  path as evidence.

Encode these source facts, not a summary from memory: SP `task-start` writes no ledger;
`progress.md` records completion lines only; its workspace is git-ignored. Impeccable
`detect` on markdown returns `[]` and is `not-applicable`; `critique` asks the user;
`audit` is web-only. The installed skill is `~/.zcode/skills/impeccable`; its
`scripts/VERSION` is `0.1.18`; the engine at `~/.impeccable/bin/0.1.18/impeccable.exe` reports
`0.1.18+engine`; `--list-rules` ends with `62 rules`.

Done when: `node scripts/check-method.mjs --playbook` exits 0; `node --test` exits 0;
`node scripts/check-bilingual.mjs` exits 0.

### T4 — standards and templates

- Standards for docs, code, and workflow; templates for mission, task, review, ADR, and
  handoff; every pair bilingual.
- The Impeccable contribution is criteria-based, not the detector: cite
  `reference/{critique,audit,polish,harden}.md` from the installed skill at 4.8.0 (source
  `df3a4ab`) and mark UI-only dimensions `not-applicable` for docs and code.
- `check-method --standards` verifies each pair exists and each standard names its
  source and pin.

### T5 — operator guide

- Roles, one-tick steps, human checkpoints, and failure paths; separate branches for both
  packs, one pack, and neither.
- Every command in the guide is runnable as written; `check-workflow` asserts the sections
  and command strings.

### T6 — worked example

- A real small tick with ledger, evidence, and a `packs` record. If Impeccable is
  `not-applicable`, the example records `present, not-applicable` with the reason and the
  criteria-based review; it does not claim a detector run.
- `check-example` verifies the ledger, evidence, and pack records.

### T7 — runtime gaps

- `src/packs.ts` detects both packs: environment overrides first, then known roots; statuses
  `present`, `absent`, `mismatch`, `not-invocable`; versions and pins. Known Impeccable roots:
  `CAIRN_IMPECCABLE_DIR`, `~/.zcode/skills/impeccable`, then
  `$CAIRN_IMPECCABLE_SRC/.claude/skills/impeccable`; engine: `CAIRN_IMPECCABLE_BIN`,
  `~/.impeccable/bin/<version>/impeccable.exe`. Known superpowers roots:
  `CAIRN_SUPERPOWERS_DIR`, then the harness plugin cache. `present` requires a readable
  version; `mismatch` is a version other than the pin; `not-invocable` is a path without a
  runnable engine or skill. Never invoke the skill launcher when the engine is missing and
  never download.
- Packet `packs` block: `{capability, pack, version, mode, instruction, fallback}`.
- Report `packs` field: `{capability, pack, version, mode, evidence}`; `not-applicable`
  requires a reason.
- The packet/report schema change is a protocol amendment with `approved_by: human`.
- `cairn review` and a `task_started` writer; `audit-session` streams the transcript and
  fails on an over-limit line instead of crashing.
- The T6 milestone audit found the worked example was not protocol-valid, `product.md` had no
  Chinese companion, and two pack detectors existed. T7 repairs those findings and extends
  `check-bilingual` to `method/`; the example must pass `validate-mission` and `reconcile`.
- TDD; tests cover present, absent, mismatch, and not-invocable.

### T8 — cold start and product comparison

- `node scripts/check-method.mjs --products --strict` exits 0: every floor file or gate
  exists; every pack reference resolves at its pin or is `not-applicable` with a reason;
  every fallback is executable; no row is still `planned`.
- Run once with both packs present (installed Impeccable skill, harness superpowers cache) and
  once with `CAIRN_SUPERPOWERS_DIR`, `CAIRN_IMPECCABLE_DIR`, and `CAIRN_IMPECCABLE_BIN`
  pointing at nonexistent paths; both runs pass. The absent run must not invoke a launcher or
  download.
- A fresh reviewer names the goal, layout, next task, and one-tick flow.

## Known deps

The protocol amendment in T1 and the invariant 3 decision in T7 both require
`approved_by: human`. The plan does not treat the agent's own approval as sufficient.
