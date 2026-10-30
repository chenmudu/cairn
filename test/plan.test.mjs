import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  buildPacket,
  coverage,
  loadMission,
  nextTask,
  serveErrors,
  statusReport,
} from '../src/plan.ts';
import { makeTempMission, taskDone } from './helpers.mjs';

const repo = resolve(import.meta.dirname, '..');
const mission = resolve(repo, 'missions', '000-bootstrap');

test('nextTask follows dependencies and the ledger', (t) => {
  const dir = makeTempMission(t);
  const doc = loadMission(dir);
  assert.equal(nextTask(doc.plan, []).id, 'T-001');
  assert.equal(nextTask(doc.plan, [taskDone('T-001')]).id, 'T-002');
  assert.equal(nextTask(doc.plan, [taskDone('T-001'), taskDone('T-002')]).id, 'T-003');
  assert.equal(
    nextTask(doc.plan, [taskDone('T-001'), taskDone('T-002'), taskDone('T-003')]),
    undefined,
  );
});

test('a task is not done because plan.md says so', (t) => {
  const dir = makeTempMission(t);
  const doc = loadMission(dir);
  const report = statusReport(dir);
  assert.deepEqual(
    report.tasks.map((task) => task.state),
    ['todo', 'todo', 'todo'],
  );
  assert.equal(report.next, 'T-001');
  assert.equal(nextTask(doc.plan, [taskDone('T-001')]).id, 'T-002');
});

test('the real mission covers every acceptance criterion', () => {
  const report = statusReport(mission);
  for (const [id, taskIds] of Object.entries(report.coverage)) {
    assert.ok(taskIds.length > 0, `${id} is uncovered`);
  }
  assert.deepEqual(report.uncovered, []);
  assert.equal(Object.keys(report.coverage).length, 8);
});

test('buildPacket carries the task, serves, gates, constraints, and base', () => {
  const packet = buildPacket(mission, 'T-002');
  assert.equal(packet.task.id, 'T-002');
  assert.deepEqual(packet.task.serves, ['A2', 'A6', 'A8']);
  assert.ok(packet.gates.some((gate) => gate.id === 'typecheck' && gate.severity === 'block'));
  assert.ok(packet.gates.some((gate) => gate.id === 'test' && gate.severity === 'block'));
  assert.match(packet.base, /^[0-9a-f]{40}$/);
  assert.ok(packet.constraints.length > 0);
  assert.ok(packet.ledger_tail.length > 0);
});

test('serveErrors is empty on the real mission', () => {
  const report = statusReport(mission);
  assert.deepEqual(serveErrors(report), []);
});

test('coverage maps each acceptance id to its serving tasks', (t) => {
  const dir = makeTempMission(t);
  const doc = loadMission(dir);
  const map = coverage(doc.plan, doc.mission);
  assert.deepEqual(map, { F1: ['T-001'], F2: ['T-002'], F3: ['T-003'] });
});
