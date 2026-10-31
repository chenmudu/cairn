import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { reconcileMission } from '../src/reconcile.ts';
import { verifyTask } from '../src/verify.ts';
import { makeTempRepo } from './helpers.mjs';

function initRepo(root) {
  spawnSync('git', ['init', '-q'], { cwd: root });
  spawnSync('git', ['add', '.'], { cwd: root });
  spawnSync(
    'git',
    ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.com', 'commit', '-qm', 'base'],
    { cwd: root },
  );
  return spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
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
  const { root, mission } = makeTempRepo(t);
  initRepo(root);
  verifyTask(mission, 'T-001');
  const report = reconcileMission(mission);
  assert.equal(report.ok, true, report.findings.join('\n'));
  assert.deepEqual(report.pending, ['T-001']);
});

test('reconcile reports a gate result whose evidence is gone', (t) => {
  const { root, mission } = makeTempRepo(t);
  initRepo(root);
  const result = verifyTask(mission, 'T-001');
  unlinkSync(join(mission, result.gates[0].evidence));
  const report = reconcileMission(mission);
  assert.equal(report.ok, false);
  assert.match(report.findings.join('\n'), /evidence missing/);
});

test('reconcile reports a task_done whose head is not a commit', (t) => {
  const { root, mission } = makeTempRepo(t);
  initRepo(root);
  const fake = 'f'.repeat(40);
  writeFileSync(join(mission, 'ledger.jsonl'), `${taskDone('T-001', fake, fake, 'evidence/T-001/gate.json')}\n`);
  const report = reconcileMission(mission);
  assert.equal(report.ok, false);
  assert.match(report.findings.join('\n'), /head .* is not a commit/);
});

test('reconcile reports one commit claimed by two tasks', (t) => {
  const { root, mission } = makeTempRepo(t);
  const head = initRepo(root);
  writeFileSync(
    join(mission, 'ledger.jsonl'),
    `${taskDone('T-001', head, head, 'evidence/T-001/gate.json')}\n${taskDone('T-002', head, head, 'evidence/T-002/gate.json')}\n`,
  );
  const report = reconcileMission(mission);
  assert.equal(report.ok, false);
  assert.match(report.findings.join('\n'), /claimed by T-001, T-002/);
});
