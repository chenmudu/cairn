import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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

const ONE = `  - id: F1
    check: first
`;

const doneEvent = (task, ts) =>
  JSON.stringify({
    ts,
    event: 'task_done',
    mission: 'temp-mission',
    task,
    actor: 'test',
    data: {
      base: 'a'.repeat(40),
      head: 'b'.repeat(40),
      commits: ['b'.repeat(40)],
      gates: [{ id: 'gate', exit_code: 0, evidence: 'evidence/x.json' }],
    },
  });

const reviewEvent = (ts, verdict = 'pass') =>
  JSON.stringify({
    ts,
    event: 'review_result',
    mission: 'temp-mission',
    actor: 'test',
    data: { reviewer: 'test', verdict, findings: [] },
  });

function makeMission(t, { mission = missionOf(TWO), plan = planOf(taskYaml('T-001')), ledger = '' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-goal-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'mission.md'), mission);
  writeFileSync(join(dir, 'policy.md'), policy);
  writeFileSync(join(dir, 'plan.md'), plan);
  writeFileSync(join(dir, 'ledger.jsonl'), ledger);
  return dir;
}

test('accepts the repository mission and covers every acceptance criterion', () => {
  const report = checkGoal(join(repo, '.cairn', 'missions', '000-bootstrap'));
  assert.equal(report.ok, true, report.errors.join('\n'));
  for (const [id, tasks] of Object.entries(report.coverage)) {
    assert.ok(tasks.length > 0, `acceptance ${id} must be covered`);
  }
});

test('names a runnable task with its serves link and gates', (t) => {
  const dir = makeMission(t, {
    mission: missionOf(`  - id: F1
    check: first
`),
    plan: planOf(taskYaml('T-001', { serves: '[F1]' })),
  });
  const report = checkGoal(dir);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.equal(report.currentTask.id, 'T-001');
  assert.deepEqual(report.currentTask.serves, ['F1']);
  assert.ok(report.currentTask.gates.length > 0, 'next task must declare gates');
});

test('rejects a new task when three tasks completed since the last review', (t) => {
  const dir = makeMission(t, {
    mission: missionOf(ONE),
    plan: planOf(
      taskYaml('T-001', { serves: '[F1]' }),
      taskYaml('T-002', { deps: '[T-001]', serves: '[F1]' }),
      taskYaml('T-003', { deps: '[T-002]', serves: '[F1]' }),
      taskYaml('T-004', { deps: '[T-003]', serves: '[F1]' }),
    ),
    ledger: [
      doneEvent('T-001', '2026-10-31T00:00:00.000Z'),
      doneEvent('T-002', '2026-10-31T00:00:01.000Z'),
      doneEvent('T-003', '2026-10-31T00:00:02.000Z'),
    ].join('\n') + '\n',
  });
  const report = checkGoal(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /milestone audit due/);
});

test('a review_result resets the audit cadence', (t) => {
  const dir = makeMission(t, {
    mission: missionOf(ONE),
    plan: planOf(
      taskYaml('T-001', { serves: '[F1]' }),
      taskYaml('T-002', { deps: '[T-001]', serves: '[F1]' }),
      taskYaml('T-003', { deps: '[T-002]', serves: '[F1]' }),
      taskYaml('T-004', { deps: '[T-003]', serves: '[F1]' }),
    ),
    ledger: [
      doneEvent('T-001', '2026-10-31T00:00:00.000Z'),
      doneEvent('T-002', '2026-10-31T00:00:01.000Z'),
      reviewEvent('2026-10-31T00:00:02.000Z'),
      doneEvent('T-003', '2026-10-31T00:00:03.000Z'),
    ].join('\n') + '\n',
  });
  const report = checkGoal(dir);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.equal(report.currentTask.id, 'T-004');
});

test('a complete mission needs a passing review after the last task', (t) => {
  const plan = planOf(taskYaml('T-001', { serves: '[F1]' }));
  const failing = makeMission(t, {
    mission: missionOf(ONE),
    plan,
    ledger: `${doneEvent('T-001', '2026-10-31T00:00:00.000Z')}\n${reviewEvent('2026-10-31T00:00:01.000Z', 'fail')}\n`,
  });
  assert.match(checkGoal(failing).errors.join('\n'), /mission-end audit due/);

  const passing = makeMission(t, {
    mission: missionOf(ONE),
    plan,
    ledger: `${doneEvent('T-001', '2026-10-31T00:00:00.000Z')}\n${reviewEvent('2026-10-31T00:00:01.000Z')}\n`,
  });
  const report = checkGoal(passing);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.equal(report.complete, true);
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

test('brief output carries the task, serves, and gate', (t) => {
  const dir = makeMission(t, {
    mission: missionOf(`  - id: F1
    check: first
`),
    plan: planOf(taskYaml('T-001', { serves: '[F1]' })),
  });
  const out = execFileSync(process.execPath, ['scripts/goal-check.mjs', dir, '--brief'], {
    cwd: repo,
    encoding: 'utf8',
  });
  assert.match(out, /Current task: T-001/);
  assert.match(out, /Serves: F1/);
  assert.match(out, /Gates: gate/);
  assert.match(out, /Decision routing: ADR =/);
  assert.match(out, /mission-scoped decisions go to the mission inbox/);
});

test('--anchor emits the anchor and no warning on a healthy mission', (t) => {
  const dir = makeMission(t, {
    mission: missionOf(`  - id: F1
    check: first
`),
    plan: planOf(taskYaml('T-001', { serves: '[F1]' })),
  });
  const out = execFileSync(process.execPath, ['scripts/goal-check.mjs', dir, '--anchor'], {
    cwd: repo,
    encoding: 'utf8',
  });
  assert.match(out, /Cairn goal anchor — temp-mission Temp mission/);
  assert.match(out, /Intent: Prove that the guard reads the repository\./);
  assert.match(out, /Current task: T-001/);
  assert.match(out, /Serves: F1 \(first\)/);
  assert.match(out, /Gates: gate: node -e/);
  assert.match(out, /Decision routing: ADR =/);
  assert.doesNotMatch(out, /^warning:/m);
});

test('--anchor exits 0 with a warning when the milestone audit is due', (t) => {
  const dir = makeMission(t, {
    mission: missionOf(ONE),
    plan: planOf(
      taskYaml('T-001', { serves: '[F1]' }),
      taskYaml('T-002', { deps: '[T-001]', serves: '[F1]' }),
      taskYaml('T-003', { deps: '[T-002]', serves: '[F1]' }),
      taskYaml('T-004', { deps: '[T-003]', serves: '[F1]' }),
    ),
    ledger: [
      doneEvent('T-001', '2026-10-31T00:00:00.000Z'),
      doneEvent('T-002', '2026-10-31T00:00:01.000Z'),
      doneEvent('T-003', '2026-10-31T00:00:02.000Z'),
    ].join('\n') + '\n',
  });
  const result = spawnSync(process.execPath, ['scripts/goal-check.mjs', dir, '--anchor'], {
    cwd: repo,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Cairn goal anchor — temp-mission Temp mission/);
  assert.match(result.stdout, /Current task: T-004/);
  assert.match(result.stdout, /Decision routing: ADR =/);
  assert.match(result.stdout, /^warning: milestone audit due: 3 tasks completed since mission start$/m);
});

test('--anchor exits 2 with a named error when the mission is unreadable', () => {
  const missing = join(tmpdir(), `cairn-missing-${process.pid}-${Date.now()}`);
  const result = spawnSync(process.execPath, ['scripts/goal-check.mjs', missing, '--anchor'], {
    cwd: repo,
    encoding: 'utf8',
  });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /Cairn goal anchor unavailable:/);
  assert.match(result.stdout, /not a directory/);
});

test('the default mode still exits 1 when the audit is due', (t) => {
  const dir = makeMission(t, {
    mission: missionOf(ONE),
    plan: planOf(
      taskYaml('T-001', { serves: '[F1]' }),
      taskYaml('T-002', { deps: '[T-001]', serves: '[F1]' }),
      taskYaml('T-003', { deps: '[T-002]', serves: '[F1]' }),
      taskYaml('T-004', { deps: '[T-003]', serves: '[F1]' }),
    ),
    ledger: [
      doneEvent('T-001', '2026-10-31T00:00:00.000Z'),
      doneEvent('T-002', '2026-10-31T00:00:01.000Z'),
      doneEvent('T-003', '2026-10-31T00:00:02.000Z'),
    ].join('\n') + '\n',
  });
  const result = spawnSync(process.execPath, ['scripts/goal-check.mjs', dir], {
    cwd: repo,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^goal: FAILED$/m);
});

test('the SessionStart hook emits additionalContext from a fixture mission', (t) => {
  const dir = makeMission(t, {
    mission: missionOf(`  - id: F1
    check: first
`),
    plan: planOf(taskYaml('T-001', { serves: '[F1]' })),
  });
  const out = execFileSync(process.execPath, ['.zcode/hooks/session-start.mjs'], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, CAIRN_MISSION_DIR: dir },
  });
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(parsed.hookSpecificOutput.additionalContext, /Cairn goal anchor/);
  assert.match(parsed.hookSpecificOutput.additionalContext, /Current task: T-001/);
  assert.match(parsed.hookSpecificOutput.additionalContext, /Decision routing:/);
  assert.match(parsed.hookSpecificOutput.additionalContext, /Do not ask the human/);
});
