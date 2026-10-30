import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const task = (id, deps, serves) => `  - id: ${id}
    title: Task ${id}
    deps: [${deps}]
    risk: low
    status: todo
    serves: [${serves}]
    files:
      - README.md
    interfaces:
      produces:
        - "run(): void"
    gates:
      - id: gate
        command: node
        args: ["-e", "process.exit(0)"]
        severity: block
`;

/** A self-contained mission whose state does not depend on the real ledger. */
export function makeTempMission(t) {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-t002-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(
    join(dir, 'mission.md'),
    `---
schema: cairn/mission@0.1
id: temp-mission
title: Temp mission
status: active
created: 2026-10-31
owner: fixture
acceptance:
  - id: F1
    check: first
  - id: F2
    check: second
  - id: F3
    check: third
---

# Temp

## Intent

Prove the plan reader.

## Non-goals

- No UI.

## Constraints

- No network.
`,
  );
  writeFileSync(
    join(dir, 'policy.md'),
    `---
schema: cairn/policy@0.1
mission: temp-mission
budgets:
  max_attempts_per_task: 1
allowed_commands:
  - node
forbidden_commands:
  - git push
stop_conditions:
  - irreversible_or_destructive
merge_policy: no_push_without_human
---
`,
  );
  writeFileSync(
    join(dir, 'plan.md'),
    `---
schema: cairn/plan@0.1
mission: temp-mission
tasks:
${task('T-001', '', 'F1')}${task('T-002', 'T-001', 'F2')}${task('T-003', 'T-002', 'F3')}---

# Temp plan
`,
  );
  writeFileSync(join(dir, 'ledger.jsonl'), '');
  return dir;
}

export function taskDone(id) {
  return {
    ts: '2026-10-31T00:00:00.000Z',
    event: 'task_done',
    mission: 'temp-mission',
    task: id,
    actor: 'test',
    data: {},
  };
}
