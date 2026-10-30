---
schema: cairn/plan@0.1
mission: 001-method-pack
tasks:
  - id: T1
    title: Adopt the .cairn layout and migrate Mission #0
    deps: []
    risk: high
    status: todo
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
    status: todo
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
    title: Write the fusion playbook
    deps: [T2]
    risk: medium
    status: todo
    serves: [B3]
    files:
      - method/README.md
      - method/README.zh.md
      - method/playbook.md
      - method/playbook.zh.md
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
        args: ["scripts/check-method.mjs", "--playbook"]
        severity: block

  - id: T4
    title: Add standards and templates
    deps: [T3]
    risk: medium
    status: todo
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
    status: todo
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
    status: todo
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
    status: todo
    serves: [B1, B6]
    files:
      - src/review.ts
      - src/cli.ts
      - test/review.test.ts
      - docs/protocol.md
      - docs/protocol.zh.md
      - docs/self-hosting.md
      - docs/self-hosting.zh.md
      - docs/automation.md
      - docs/automation.zh.md
      - docs/i18n.md
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
    serves: [B5]
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
- **T3** writes the phase map: frame, plan, execute, review, close, and unattended setup. Every
  row names a superpowers practice, an Impeccable standard, and a Cairn artifact or gate.
- **T4** makes the playbook usable: standards for docs, code, and workflows, plus templates for
  missions, tasks, reviews, ADRs, and handoffs.
- **T5** writes the operator guide: roles, commands, human checkpoints, and failure paths.
- **T6** runs the guide on a real, small tick and records the ledger and evidence. The example
  is the proof that the guide is executable.
- **T7** adds `cairn review` and records the `task_started` decision. Protocol invariant 3 stays
  a separate human decision; it is not silently rewritten here.
- **T8** is the cold-start review and `mission_done`. A fresh session must explain the method
  from the repository alone before the mission closes.

## Known deps

The protocol amendment in T1 and the invariant 3 decision in T7 both require
`approved_by: human`. The plan does not treat the agent's own approval as sufficient.
