import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { makeTempMission } from './helpers.mjs';

const repo = resolve(import.meta.dirname, '..');
const cli = resolve(repo, 'src', 'cli.ts');

const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: 'utf8' });
const M0 = '.cairn/missions/000-bootstrap';

test('status --json reports Mission #0 and every coverage link', () => {
  const result = run('status', '--json', '--mission', M0);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.tasks.find((task) => task.id === 'T-001').state, 'done');
  assert.equal(report.tasks.find((task) => task.id === 'T-006').state, 'done');
  assert.deepEqual(report.uncovered, []);
  assert.ok(typeof report.next === 'string' || report.next === null);
});

test('the default mission is the active mission from .cairn/config.json', () => {
  const result = run('status', '--json');
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mission.id, '001-method-pack');
});

test('a bare mission id and a legacy missions/<id> path resolve', () => {
  const bare = run('status', '--json', '--mission', '001-method-pack');
  assert.equal(bare.status, 0, bare.stderr);
  assert.equal(JSON.parse(bare.stdout).mission.id, '001-method-pack');

  const legacy = run('status', '--json', '--mission', 'missions/000-bootstrap');
  assert.equal(legacy.status, 0, legacy.stderr);
  assert.equal(JSON.parse(legacy.stdout).mission.id, '000-bootstrap');
});

test('init scaffolds a mission in an empty repository', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'cairn-init-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [cli, 'init', 'demo', '--title', 'Demo mission'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const dir = join(root, '.cairn', 'missions', 'demo');
  for (const name of ['mission.md', 'plan.md', 'policy.md', 'ledger.jsonl']) {
    assert.ok(existsSync(join(dir, name)), `${name} must exist`);
  }
  assert.match(readFileSync(join(dir, 'mission.md'), 'utf8'), /title: Demo mission/);

  const status = spawnSync(process.execPath, [cli, 'status', '--json'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(status.status, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).mission.id, 'demo');
});

test('next prints a packet for the task status reports', () => {
  const status = run('status', '--json', '--mission', M0);
  assert.equal(status.status, 0, status.stderr);
  const report = JSON.parse(status.stdout);

  const result = run('next', '--mission', M0);
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
  assert.match(result.stderr, /refused:.*(gate|evidence)/);
  assert.equal(readFileSync(join(dir, 'ledger.jsonl'), 'utf8'), before);
});

test('verify and record complete a task with no manual ledger write', (t) => {
  const dir = makeTempMission(t);
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  const commit = (message) =>
    git(
      '-c',
      'user.name=fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '-qm',
      message,
    );
  assert.equal(git('init', '-q').status, 0);
  assert.equal(git('add', '.').status, 0);
  assert.equal(commit('base').status, 0);

  const verify = run('verify', 'T-001', '--mission', dir);
  assert.equal(verify.status, 0, verify.stderr);
  const report = JSON.parse(verify.stdout);
  assert.equal(report.passed, true);
  assert.equal(git('add', '.').status, 0);
  assert.equal(commit('work').status, 0);

  const record = run('record', 'T-001', '--status', 'done', '--mission', dir);
  assert.equal(record.status, 0, record.stderr);
  const events = readFileSync(join(dir, 'ledger.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.ok(events.some((event) => event.event === 'task_done' && event.task === 'T-001'));
  assert.ok(existsSync(join(dir, report.gates[0].evidence)));
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
