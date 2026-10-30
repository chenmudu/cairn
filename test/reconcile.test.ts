import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { reconcileMission } from '../src/reconcile.ts';
import { verifyTask } from '../src/verify.ts';
import { makeTempMission } from './helpers.mjs';

function initRepo(dir) {
  spawnSync('git', ['init', '-q'], { cwd: dir });
  spawnSync('git', ['add', '.'], { cwd: dir });
  spawnSync(
    'git',
    ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'base'],
    { cwd: dir },
  );
  return spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
}

function taskDone(task, base, head, evidence) {
  return JSON.stringify({
    ts: '2026-10-31T00:00:00.000Z',
    event: 'task_done',
    mission: 'temp-mission',
    task,
    actor: 'test',
    data: {
      base,
      head,
      commits: [head],
      gates: [{ id: 'gate', exit_code: 0, evidence }],
    },
  });
}

test('reconcile explains the crash window after verify and before record', (t) => {
  const dir = makeTempMission(t);
  initRepo(dir);
  verifyTask(dir, 'T-001');
  const report = reconcileMission(dir);
  assert.equal(report.ok, true, report.findings.join('\n'));
  assert.deepEqual(report.pending, ['T-001']);
});

test('reconcile reports a gate result whose evidence is gone', (t) => {
  const dir = makeTempMission(t);
  initRepo(dir);
  const result = verifyTask(dir, 'T-001');
  unlinkSync(join(dir, result.gates[0].evidence));
  const report = reconcileMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.findings.join('\n'), /evidence missing/);
});

test('reconcile reports a task_done whose head is not a commit', (t) => {
  const dir = makeTempMission(t);
  initRepo(dir);
  const fake = 'f'.repeat(40);
  writeFileSync(join(dir, 'ledger.jsonl'), `${taskDone('T-001', fake, fake, 'evidence/T-001/gate.json')}\n`);
  const report = reconcileMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.findings.join('\n'), /head .* is not a commit/);
});

test('reconcile reports one commit claimed by two tasks', (t) => {
  const dir = makeTempMission(t);
  const head = initRepo(dir);
  writeFileSync(
    join(dir, 'ledger.jsonl'),
    `${taskDone('T-001', head, head, 'evidence/T-001/gate.json')}\n${taskDone('T-002', head, head, 'evidence/T-002/gate.json')}\n`,
  );
  const report = reconcileMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.findings.join('\n'), /claimed by T-001, T-002/);
});
