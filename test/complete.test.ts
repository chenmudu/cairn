import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { completeMission } from '../src/complete.ts';
import { readLedger } from '../src/ledger.ts';

const repo = resolve(import.meta.dirname, '..');
const cli = resolve(repo, 'src', 'cli.ts');

const missionOne = `---
schema: cairn/mission@0.1
id: temp-mission
title: Temp mission
status: active
created: 2026-10-31
owner: fixture
acceptance:
  - id: F1
    check: first
---

# Temp

## Intent

Prove completion.

## Non-goals

- No UI.
`;

const missionTwo = missionOne.replace(
  '  - id: F1\n    check: first\n',
  '  - id: F1\n    check: first\n  - id: F2\n    check: second\n',
);

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

const planOf = (serves = '[F1]') => `---
schema: cairn/plan@0.1
mission: temp-mission
tasks:
  - id: T-001
    title: Task T-001
    deps: []
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
---

# Temp plan
`;

const event = (name, task, data, ts) =>
  JSON.stringify({
    ts,
    event: name,
    mission: 'temp-mission',
    ...(task ? { task } : {}),
    actor: 'test',
    data,
  });

const done = (ts, evidence = 'evidence/T-001/gate.json') =>
  event(
    'task_done',
    'T-001',
    { base: 'a'.repeat(40), head: 'b'.repeat(40), commits: ['b'.repeat(40)], gates: [{ id: 'gate', exit_code: 0, evidence }] },
    ts,
  );

const review = (verdict, ts) =>
  event('review_result', undefined, { reviewer: 'test', verdict, findings: [] }, ts);

function makeMission(t, { plan = planOf(), mission = missionOne, ledger = '', withEvidence = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-complete-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'mission.md'), mission);
  writeFileSync(join(dir, 'policy.md'), policy);
  writeFileSync(join(dir, 'plan.md'), plan);
  writeFileSync(join(dir, 'ledger.jsonl'), ledger);
  if (withEvidence) {
    mkdirSync(join(dir, 'evidence', 'T-001'), { recursive: true });
    writeFileSync(join(dir, 'evidence', 'T-001', 'gate.json'), '{}\n');
  }
  return dir;
}

const gate = (ts) =>
  event(
    'gate_result',
    'T-001',
    {
      gate: 'gate',
      command: 'node -e process.exit(0)',
      exit_code: 0,
      evidence: 'evidence/T-001/gate.json',
    },
    ts,
  );

const COMPLETE = `${gate('2026-10-31T00:00:00.000Z')}\n${done('2026-10-31T00:00:01.000Z')}\n${review('pass', '2026-10-31T00:00:02.000Z')}\n`;

test('closes a mission whose only task is done with evidence and a passing review', (t) => {
  const dir = makeMission(t, { ledger: COMPLETE });
  const report = completeMission(dir);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.deepEqual(report.acceptance, [
    { id: 'F1', tasks: ['T-001'], evidence: ['evidence/T-001/gate.json'] },
  ]);
});

test('refuses an open task', (t) => {
  const dir = makeMission(t, {});
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /T-001: not done/);
});

test('refuses an uncovered acceptance criterion', (t) => {
  const dir = makeMission(t, { mission: missionTwo, ledger: COMPLETE });
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /acceptance F2: uncovered/);
});

test('refuses missing evidence', (t) => {
  const dir = makeMission(t, { ledger: COMPLETE });
  unlinkSync(join(dir, 'evidence', 'T-001', 'gate.json'));
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /evidence missing/);
});

test('refuses a failing latest review', (t) => {
  const dir = makeMission(t, { ledger: `${done('2026-10-31T00:00:00.000Z')}\n${review('fail', '2026-10-31T00:00:01.000Z')}\n` });
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /latest review_result is fail/);
});

test('refuses a review that predates the last task_done', (t) => {
  const dir = makeMission(t, {
    ledger: `${review('pass', '2026-10-31T00:00:00.000Z')}\n${done('2026-10-31T00:00:01.000Z')}\n`,
  });
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /not after the last task_done/);
});

test('cairn record --mission-done appends mission_done and refuses a second time', (t) => {
  const dir = makeMission(t, { ledger: COMPLETE });
  const git = (...args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  assert.equal(git('init', '-q').status, 0);
  assert.equal(git('add', '.').status, 0);
  assert.equal(
    git(
      '-c',
      'user.name=fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '-qm',
      'base',
    ).status,
    0,
  );

  const first = run('record', '--mission-done', '--mission', dir);
  assert.equal(first.status, 0, first.stderr);
  const events = readLedger(dir);
  assert.equal(events.filter((item) => item.event === 'mission_done').length, 1);

  const second = run('record', '--mission-done', '--mission', dir);
  assert.equal(second.status, 2);
  assert.match(second.stderr, /refused:.*already done/);
});

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: 'utf8' });
}
