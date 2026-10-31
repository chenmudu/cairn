import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const cli = resolve(repo, 'src', 'cli.ts');

const CODE_GATE =
  "process.exit(require('fs').readFileSync('code.txt','utf8').trim()==='good'?0:1)";

/**
 * A one-task mission at `.cairn/missions/temp-mission` in a fresh repository.
 * Its blocking gate reads `code.txt` from the repository root.
 */
function makeMission(t) {
  const root = mkdtempSync(join(tmpdir(), 'cairn-p0-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, '.cairn', 'missions', 'temp-mission');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'mission.md'),
    `---
schema: cairn/mission@0.1
id: temp-mission
title: P0 probe
status: active
created: 2026-10-31
owner: fixture
acceptance:
  - id: A1
    check: the gate reads the current tree
---

# P0 probe

## Intent

Prove that a gate result is bound to the tree it ran on.
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
forbidden_commands: []
stop_conditions: []
---
`,
  );
  writeFileSync(
    join(dir, 'plan.md'),
    `---
schema: cairn/plan@0.1
mission: temp-mission
tasks:
  - id: T1
    title: Read code.txt
    deps: []
    risk: low
    status: todo
    serves: [A1]
    files: []
    gates:
      - id: code
        command: node
        args: ["-e", "${CODE_GATE}"]
        severity: block
---
`,
  );
  writeFileSync(join(root, 'code.txt'), 'good\n');
  writeFileSync(join(dir, 'ledger.jsonl'), '');
  return { root, mission: dir };
}

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: 'utf8' });
}

function git(dir, ...args) {
  return spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function commit(dir, message) {
  const add = git(dir, 'add', '-A');
  assert.equal(add.status, 0, add.stderr);
  const result = git(
    dir,
    '-c',
    'user.name=fixture',
    '-c',
    'user.email=fixture@example.com',
    'commit',
    '-qm',
    message,
  );
  assert.equal(result.status, 0, result.stderr);
}

function initRepo(dir) {
  const init = git(dir, 'init', '-q');
  assert.equal(init.status, 0, init.stderr);
  commit(dir, 'base');
  // A second commit, so the old runtime has a parent to measure the work from
  // instead of refusing the fixture before the bug is reached.
  const setup = git(
    dir,
    '-c',
    'user.name=fixture',
    '-c',
    'user.email=fixture@example.com',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    'setup',
  );
  assert.equal(setup.status, 0, setup.stderr);
}

function events(dir) {
  return readFileSync(join(dir, 'ledger.jsonl'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
}

const REVIEW = {
  reviewer: 'fresh-context fixture',
  verdict: 'pass',
  findings: ['the gate read the committed tree'],
  packs: [
    {
      capability: 'test-first',
      pack: 'superpowers',
      version: '7.0.1',
      mode: 'use',
      evidence: 'test/p0.test.mjs',
    },
    {
      capability: 'design-review',
      pack: 'impeccable',
      version: '4.8.0',
      mode: 'not-applicable',
      reason: 'no UI surface',
      evidence: 'README.md review',
    },
  ],
};

test('record refuses a gate result that belongs to a different tree', (t) => {
  const { root, mission } = makeMission(t);
  initRepo(root);

  const verify = run('verify', 'T1', '--mission', mission);
  assert.equal(verify.status, 0, verify.stderr);

  writeFileSync(join(root, 'code.txt'), 'bad\n');
  commit(root, 'break the code');

  const record = run('record', 'T1', '--status', 'done', '--mission', mission);
  assert.equal(record.status, 2, `record must refuse a stale gate result\n${record.stdout}`);
  assert.match(record.stderr, /refused:.*(head|tree|verified)/);
  assert.ok(!events(mission).some((event) => event.event === 'task_done'));
});

test('record refuses a dirty worktree outside the mission runtime paths', (t) => {
  const { root, mission } = makeMission(t);
  initRepo(root);

  const verify = run('verify', 'T1', '--mission', mission);
  assert.equal(verify.status, 0, verify.stderr);

  writeFileSync(join(root, 'scratch.txt'), 'not committed\n');

  const record = run('record', 'T1', '--status', 'done', '--mission', mission);
  assert.equal(record.status, 2, record.stdout);
  assert.match(record.stderr, /refused:.*worktree/);
  assert.ok(!events(mission).some((event) => event.event === 'task_done'));
});

test('reconcile reports a completion event that is not in the ledger at HEAD', (t) => {
  const { root, mission } = makeMission(t);
  initRepo(root);

  assert.equal(run('verify', 'T1', '--mission', mission).status, 0);
  assert.equal(run('record', 'T1', '--status', 'done', '--mission', mission).status, 0);

  const reconcile = run('reconcile', '--mission', mission);
  assert.equal(reconcile.status, 3, reconcile.stderr);
  assert.match(reconcile.stdout, /not in the ledger at HEAD/);
});

test('mission_done requires the ledger to be committed and closes after the ledger commit', (t) => {
  const { root, mission } = makeMission(t);
  initRepo(root);

  assert.equal(run('verify', 'T1', '--mission', mission).status, 0);
  assert.equal(run('record', 'T1', '--status', 'done', '--mission', mission).status, 0);

  const reviewFile = join(root, 'review.json');
  writeFileSync(reviewFile, JSON.stringify(REVIEW));
  assert.equal(run('review', '--file', reviewFile, '--mission', mission).status, 0);

  const refused = run('record', '--mission-done', '--mission', mission);
  assert.equal(refused.status, 2, refused.stdout);
  assert.match(refused.stderr, /refused:.*(uncommitted|HEAD|ledger)/);
  assert.ok(!events(mission).some((event) => event.event === 'mission_done'));

  commit(root, 'commit the task ledger');
  const closed = run('record', '--mission-done', '--mission', mission);
  assert.equal(closed.status, 0, closed.stderr);
  assert.ok(events(mission).some((event) => event.event === 'mission_done'));

  commit(root, 'commit mission_done');
  const reconcile = run('reconcile', '--mission', mission);
  assert.equal(reconcile.status, 0, reconcile.stdout);
});
