import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const cli = resolve(repo, 'src', 'cli.ts');

const USE_EVIDENCE = `superpowers:test-driven-development
RED
1 failing: the record was not validated
GREEN
2 passing: the record is validated
`;

const IMPECCABLE_EVIDENCE = 'design review: the task files contain no UI surface\n';

const TASK = (id) => `  - id: ${id}
    title: Task ${id}
    deps: []
    risk: low
    status: todo
    serves: [A1]
    files:
      - src/code.ts
    gates:
      - id: gate
        command: node
        args: ["-e", "process.exit(0)"]
        severity: block
`;

/** A git repository whose mission lives under .cairn/missions/fixture. */
function makeMission(t, taskCount = 1) {
  const root = mkdtempSync(join(tmpdir(), 'cairn-packs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const mission = join(root, '.cairn', 'missions', 'fixture');
  mkdirSync(join(mission, 'evidence'), { recursive: true });
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'code.ts'), 'export const code = 1;\n');
  writeFileSync(
    join(mission, 'mission.md'),
    `---
schema: cairn/mission@0.1
id: fixture
title: Packs fixture
status: active
created: 2026-10-31
owner: fixture
acceptance:
  - id: A1
    check: the task record carries two pack entries
---
`,
  );
  writeFileSync(
    join(mission, 'policy.md'),
    `---
schema: cairn/policy@0.1
mission: fixture
budgets:
  max_attempts_per_task: 1
allowed_commands:
  - node
forbidden_commands: []
stop_conditions: []
---
`,
  );
  const tasks = Array.from({ length: taskCount }, (_, index) => TASK(`T${index + 1}`)).join('');
  writeFileSync(
    join(mission, 'plan.md'),
    `---
schema: cairn/plan@0.1
mission: fixture
tasks:
${tasks}---
`,
  );
  writeFileSync(join(mission, 'ledger.jsonl'), '');
  initRepo(root);
  return { root, mission };
}

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: 'utf8' });
}

function git(root, ...args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' });
}

function commit(root, message) {
  const add = git(root, 'add', '-A');
  assert.equal(add.status, 0, add.stderr);
  const result = git(
    root,
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

function initRepo(root) {
  assert.equal(git(root, 'init', '-q').status, 0);
  commit(root, 'base');
  const setup = git(
    root,
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

function events(mission) {
  return readFileSync(join(mission, 'ledger.jsonl'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
}

function writeEvidence(mission, taskId, texts = {}) {
  const dir = join(mission, 'evidence', taskId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'superpowers.txt'), texts.superpowers ?? USE_EVIDENCE);
  writeFileSync(join(dir, 'impeccable.txt'), texts.impeccable ?? IMPECCABLE_EVIDENCE);
}

/** The two-entry record a code task returns. Overrides replace single fields. */
function packsFor(taskId, overrides = {}) {
  return [
    {
      capability: 'test-first',
      pack: 'superpowers',
      skill: 'superpowers:test-driven-development',
      version: '7.0.1',
      mode: 'use',
      evidence: `evidence/${taskId}/superpowers.txt`,
      ...(overrides.superpowers ?? {}),
    },
    {
      capability: 'design-review',
      pack: 'impeccable',
      skill: 'impeccable:design-review',
      version: '4.8.0+df3a4ab',
      mode: 'not-applicable',
      reason: 'task files contain no markup or URL target',
      evidence: `evidence/${taskId}/impeccable.txt`,
      ...(overrides.impeccable ?? {}),
    },
  ];
}

function writePacks(mission, taskId, value) {
  const file = join(mission, `packs-${taskId}.json`);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function record(mission, taskId, ...extra) {
  return run('record', taskId, '--status', 'done', '--mission', mission, ...extra);
}

function verify(mission, taskId) {
  return run('verify', taskId, '--mission', mission);
}

test('the first task_done may omit packs, and later omissions are refused', (t) => {
  const { mission } = makeMission(t, 3);
  writeEvidence(mission, 'T1');
  writeEvidence(mission, 'T2');

  assert.equal(verify(mission, 'T1').status, 0);
  assert.equal(record(mission, 'T1').status, 0, 'T1 is the grandfather boundary');

  assert.equal(verify(mission, 'T2').status, 0);
  const withPacks = record(mission, 'T2', '--packs', writePacks(mission, 'T2', packsFor('T2')));
  assert.equal(withPacks.status, 0, withPacks.stderr);

  assert.equal(verify(mission, 'T3').status, 0);
  const missing = record(mission, 'T3');
  assert.equal(missing.status, 2, 'a task after the first packs record cannot omit it');
  assert.match(missing.stderr, /packs/);
  assert.ok(!events(mission).some((event) => event.event === 'task_done' && event.task === 'T3'));
});

test('record refuses a record with one entry instead of two', (t) => {
  const { mission } = makeMission(t);
  writeEvidence(mission, 'T1');
  assert.equal(verify(mission, 'T1').status, 0);
  const result = record(mission, 'T1', '--packs', writePacks(mission, 'T1', [packsFor('T1')[0]]));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /two entries/);
});

test('record refuses an unknown mode', (t) => {
  const { mission } = makeMission(t);
  writeEvidence(mission, 'T1');
  assert.equal(verify(mission, 'T1').status, 0);
  const file = writePacks(mission, 'T1', packsFor('T1', { superpowers: { mode: 'used' } }));
  const result = record(mission, 'T1', '--packs', file);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /mode/);
});

test('record refuses not-applicable without a reason', (t) => {
  const { mission } = makeMission(t);
  writeEvidence(mission, 'T1');
  assert.equal(verify(mission, 'T1').status, 0);
  const file = writePacks(mission, 'T1', packsFor('T1', { impeccable: { reason: undefined } }));
  const result = record(mission, 'T1', '--packs', file);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /reason/);
});

test('record refuses absent without a floor evidence file', (t) => {
  const { mission } = makeMission(t);
  writeEvidence(mission, 'T1');
  assert.equal(verify(mission, 'T1').status, 0);
  const file = writePacks(
    mission,
    'T1',
    packsFor('T1', {
      superpowers: {
        mode: 'absent',
        reason: 'superpowers is not installed',
        evidence: 'evidence/T1/floor-missing.txt',
      },
    }),
  );
  const result = record(mission, 'T1', '--packs', file);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /evidence/);
});

test('record refuses evidence outside the mission directory', (t) => {
  const { root, mission } = makeMission(t);
  writeEvidence(mission, 'T1');
  writeFileSync(join(root, '.cairn', 'outside.txt'), 'not mission evidence\n');
  assert.equal(verify(mission, 'T1').status, 0);
  const file = writePacks(
    mission,
    'T1',
    packsFor('T1', { superpowers: { evidence: '../outside.txt' } }),
  );
  const result = record(mission, 'T1', '--packs', file);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /evidence/);
});

test('record recomputes capability and refuses a code task that evades test-first', (t) => {
  const { mission } = makeMission(t);
  writeEvidence(mission, 'T1');
  assert.equal(verify(mission, 'T1').status, 0);
  const capability = record(
    mission,
    'T1',
    '--packs',
    writePacks(mission, 'T1', packsFor('T1', { superpowers: { capability: 'verify-before-close' } })),
  );
  assert.equal(capability.status, 2);
  assert.match(capability.stderr, /capability/);

  const skill = record(
    mission,
    'T1',
    '--packs',
    writePacks(
      mission,
      'T1',
      packsFor('T1', { superpowers: { skill: 'superpowers:verification-before-completion' } }),
    ),
  );
  assert.equal(skill.status, 2);
  assert.match(skill.stderr, /skill/);
});

test('a use record must name the skill on the first line and show RED and GREEN', (t) => {
  const { mission } = makeMission(t);
  writeEvidence(mission, 'T1', { superpowers: 'test-driven-development\nRED\nGREEN\n' });
  assert.equal(verify(mission, 'T1').status, 0);
  const unnamed = record(mission, 'T1', '--packs', writePacks(mission, 'T1', packsFor('T1')));
  assert.equal(unnamed.status, 2);
  assert.match(unnamed.stderr, /first line/);

  writeEvidence(mission, 'T1', {
    superpowers: 'superpowers:test-driven-development\nGREEN\nall pass\n',
  });
  const noRed = record(mission, 'T1', '--packs', writePacks(mission, 'T1', packsFor('T1')));
  assert.equal(noRed.status, 2);
  assert.match(noRed.stderr, /RED block/);

  writeEvidence(mission, 'T1', {
    superpowers: 'superpowers:test-driven-development\nRED\none failure\n',
  });
  const noGreen = record(mission, 'T1', '--packs', writePacks(mission, 'T1', packsFor('T1')));
  assert.equal(noGreen.status, 2);
  assert.match(noGreen.stderr, /GREEN block/);
});

test('record writes a valid two-entry record into task_done', (t) => {
  const { mission } = makeMission(t);
  writeEvidence(mission, 'T1');
  assert.equal(verify(mission, 'T1').status, 0);
  const value = packsFor('T1');
  const result = record(mission, 'T1', '--packs', writePacks(mission, 'T1', value));
  assert.equal(result.status, 0, result.stderr);
  const done = events(mission).find((event) => event.event === 'task_done' && event.task === 'T1');
  assert.ok(done);
  assert.deepEqual(done.data.packs, value);
});
