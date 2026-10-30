import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { makeTempMission } from './helpers.mjs';

const repo = resolve(import.meta.dirname, '..');
const cli = resolve(repo, 'src', 'cli.ts');

const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: 'utf8' });

test('status --json reports the stable state and every coverage link', () => {
  const result = run('status', '--json');
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.tasks.find((task) => task.id === 'T-001').state, 'done');
  assert.equal(report.tasks.find((task) => task.id === 'T-006').state, 'done');
  assert.deepEqual(report.uncovered, []);
  assert.ok(typeof report.next === 'string' || report.next === null);
});

test('next prints a packet for the task status reports', () => {
  const status = run('status', '--json');
  assert.equal(status.status, 0, status.stderr);
  const report = JSON.parse(status.stdout);

  const result = run('next');
  if (report.next === null) {
    assert.equal(result.status, 2);
    return;
  }
  assert.equal(result.status, 0, result.stderr);
  const packet = JSON.parse(result.stdout);
  assert.equal(packet.task.id, report.next);
  assert.ok(packet.task.serves.length > 0);
  assert.ok(packet.gates.length > 0);
  assert.match(packet.base, /^[0-9a-f]{40}$/);
});

test('record refuses a task with no gate evidence and does not write', (t) => {
  const dir = makeTempMission(t);
  const before = readFileSync(join(dir, 'ledger.jsonl'), 'utf8');
  const result = run('record', 'T-001', '--status', 'done', '--mission', dir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /refused:.*(no blocking gate|evidence)/);
  assert.equal(readFileSync(join(dir, 'ledger.jsonl'), 'utf8'), before);
});

test('record refuses an unknown task', (t) => {
  const dir = makeTempMission(t);
  const result = run('record', 'T-999', '--status', 'done', '--mission', dir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown task/);
});

test('usage exits 2', () => {
  const result = run('bogus');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage/);
});
