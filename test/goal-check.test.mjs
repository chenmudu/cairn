import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkGoal } from '../scripts/goal-check.mjs';

const repo = resolve(import.meta.dirname, '..');

const taskYaml = (id, { deps = '[]', serves = '[]' } = {}) => `  - id: ${id}
    title: Task ${id}
    deps: ${deps}
    risk: low
    status: todo
    serves: ${serves}
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

const planOf = (...tasks) => `---
schema: cairn/plan@0.1
mission: temp-mission
tasks:
${tasks.join('')}---

# Temp plan
`;

const missionOf = (acceptance) => `---
schema: cairn/mission@0.1
id: temp-mission
title: Temp mission
status: active
created: 2026-10-31
owner: fixture
acceptance:
${acceptance}---

# Temp

## Intent

Prove that the guard reads the repository.

## Non-goals

- No UI.
`;

const policy = `---
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
`;

const TWO = `  - id: F1
    check: first
  - id: F2
    check: second
`;

function makeMission(t, { mission = missionOf(TWO), plan = planOf(taskYaml('T-001')) } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-goal-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'mission.md'), mission);
  writeFileSync(join(dir, 'policy.md'), policy);
  writeFileSync(join(dir, 'plan.md'), plan);
  writeFileSync(join(dir, 'ledger.jsonl'), '');
  return dir;
}

test('accepts the repository mission and names a task with a serves link', () => {
  const report = checkGoal(join(repo, 'missions', '000-bootstrap'));
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.ok(report.currentTask, 'expected a next task');
  assert.ok(report.currentTask.serves.length > 0, 'next task must declare serves');
  assert.ok(report.currentTask.gates.length > 0, 'next task must declare gates');
  for (const [id, tasks] of Object.entries(report.coverage)) {
    assert.ok(tasks.length > 0, `acceptance ${id} must be covered`);
  }
});

test('rejects a task without a serves link', (t) => {
  const dir = makeMission(t, {
    plan: planOf(taskYaml('T-001', { serves: '[]' })),
  });
  const report = checkGoal(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /serves/);
});

test('rejects an acceptance criterion no task serves', (t) => {
  const dir = makeMission(t, {
    plan: planOf(taskYaml('T-001', { serves: '[F1]' })),
  });
  const report = checkGoal(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /F2.*uncovered|uncovered.*F2/);
});

test('rejects a serves id that is not in the mission', (t) => {
  const dir = makeMission(t, {
    plan: planOf(taskYaml('T-001', { serves: '[F1, F9]' })),
  });
  const report = checkGoal(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /F9/);
});

test('brief output carries the task, serves, and gate', () => {
  const out = execFileSync(
    process.execPath,
    ['scripts/goal-check.mjs', 'missions/000-bootstrap', '--brief'],
    { cwd: repo, encoding: 'utf8' },
  );
  assert.match(out, /Current task:/);
  assert.match(out, /Serves:/);
  assert.match(out, /Gates:/);
});

test('the SessionStart hook emits additionalContext', () => {
  const out = execFileSync(process.execPath, ['.zcode/hooks/session-start.mjs'], {
    cwd: repo,
    encoding: 'utf8',
  });
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(parsed.hookSpecificOutput.additionalContext, /Current task:/);
  assert.match(parsed.hookSpecificOutput.additionalContext, /Do not ask the human/);
});
