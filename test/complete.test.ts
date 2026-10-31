import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
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

const missionB5B7 = missionOne.replace(
  '  - id: F1\n    check: first\n',
  '  - id: B5\n    check: fresh-context reviewer names the next task\n  - id: B7\n    check: task evidence records pack participation\n',
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

const taskSpec = (id: string, deps: string, serves: string) => `  - id: ${id}
    title: Task ${id}
    deps: [${deps}]
    risk: low
    status: todo
    serves: [${serves}]
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

const planOf = (tasks = taskSpec('T-001', '', 'F1')) => `---
schema: cairn/plan@0.1
mission: temp-mission
tasks:
${tasks}---

# Temp plan
`;

const planB5B7 = planOf(
  `${taskSpec('T-001', '', 'B5')}${taskSpec('T-002', 'T-001', 'B7')}`,
);

const event = (name, task, data, ts) =>
  JSON.stringify({
    ts,
    event: name,
    mission: 'temp-mission',
    ...(task ? { task } : {}),
    actor: 'test',
    data,
  });

const REVIEW_PACKS = [
  {
    capability: 'test-first',
    pack: 'superpowers',
    version: '7.0.1',
    mode: 'use',
    evidence: 'test/complete.test.ts',
  },
  {
    capability: 'design-review',
    pack: 'impeccable',
    version: '4.8.0+df3a4ab',
    mode: 'not-applicable',
    reason: 'no UI surface',
    evidence: 'README.md criteria-based review',
  },
];

const coverageF1 = [
  {
    criterion: 'F1',
    tasks: ['T-001'],
    evidence: [{ gate: 'gate', path: 'evidence/T-001/gate.json' }],
    verdict: 'pass',
  },
];

const coverageB5B7 = [
  {
    criterion: 'B5',
    tasks: ['T-001'],
    evidence: [{ gate: 'gate', path: 'evidence/T-001/gate.json' }],
    verdict: 'pass',
  },
  {
    criterion: 'B7',
    tasks: ['T-002'],
    evidence: [{ gate: 'gate', path: 'evidence/T-002/gate.json' }],
    verdict: 'pass',
  },
];

const reviewData = (coverage = coverageF1, overrides: Record<string, unknown> = {}) => ({
  reviewer: 'test',
  context: 'fresh',
  artifact: 'evidence/review.json',
  verdict: 'pass',
  findings: ['no drift'],
  packs: REVIEW_PACKS,
  coverage,
  non_goals: [{ non_goal: 'No UI', verdict: 'pass', evidence: ['evidence/review.json'] }],
  cold_start: { reviewer: 'test', artifact: 'evidence/review.json', verdict: 'pass' },
  ui_surface: 'none',
  ...overrides,
});

const gateFor = (task: string, ts: string) =>
  event(
    'gate_result',
    task,
    {
      gate: 'gate',
      command: 'node -e process.exit(0)',
      exit_code: 0,
      evidence: `evidence/${task}/gate.json`,
    },
    ts,
  );

const doneFor = (task: string, ts: string) =>
  event(
    'task_done',
    task,
    {
      base: 'a'.repeat(40),
      head: 'b'.repeat(40),
      commits: ['b'.repeat(40)],
      gates: [{ id: 'gate', exit_code: 0, evidence: `evidence/${task}/gate.json` }],
    },
    ts,
  );

const reviewEvent = (ts: string, data = reviewData()) =>
  event('review_result', undefined, data, ts);

const authEvent = (ts: string, overrides: Record<string, unknown> = {}) =>
  event(
    'authorization',
    undefined,
    {
      scope: 'mission_done',
      approved_by: 'human',
      why: 'the human authorized the close',
      date: '2026-10-31',
      ...overrides,
    },
    ts,
  );

const COMPLETE = `${gateFor('T-001', '2026-10-31T00:00:00.000Z')}\n${doneFor(
  'T-001',
  '2026-10-31T00:00:01.000Z',
)}\n${reviewEvent('2026-10-31T00:00:02.000Z')}\n${authEvent('2026-10-31T00:00:03.000Z')}\n`;

function makeMission(
  t: any,
  { plan = planOf(), mission = missionOne, ledger = '', withEvidence = true } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-complete-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'mission.md'), mission);
  writeFileSync(join(dir, 'policy.md'), policy);
  writeFileSync(join(dir, 'plan.md'), plan);
  writeFileSync(join(dir, 'ledger.jsonl'), ledger);
  if (withEvidence) {
    for (const task of ['T-001', 'T-002']) {
      mkdirSync(join(dir, 'evidence', task), { recursive: true });
      writeFileSync(join(dir, 'evidence', task, 'gate.json'), '{}\n');
    }
    writeFileSync(join(dir, 'evidence', 'review.json'), '{}\n');
  }
  return dir;
}

function initGit(dir: string): void {
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
}

function commit(dir: string, message: string): void {
  const git = (...args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  assert.equal(git('add', '.').status, 0);
  assert.equal(
    git(
      '-c',
      'user.name=fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '-qm',
      message,
    ).status,
    0,
  );
}

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
  const dir = makeMission(t, {
    ledger: `${doneFor('T-001', '2026-10-31T00:00:00.000Z')}\n${reviewEvent(
      '2026-10-31T00:00:01.000Z',
      reviewData(coverageF1, { verdict: 'fail' }),
    )}\n${authEvent('2026-10-31T00:00:02.000Z')}\n`,
  });
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /latest review_result is fail/);
});

test('refuses a review that predates the last task_done', (t) => {
  const dir = makeMission(t, {
    ledger: `${reviewEvent('2026-10-31T00:00:00.000Z')}\n${doneFor(
      'T-001',
      '2026-10-31T00:00:01.000Z',
    )}\n${authEvent('2026-10-31T00:00:02.000Z')}\n`,
  });
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /not after the last task_done/);
});

test('refuses a review missing any field the close rule names', (t) => {
  for (const field of [
    'reviewer',
    'context',
    'artifact',
    'verdict',
    'findings',
    'packs',
    'coverage',
    'non_goals',
    'cold_start',
    'ui_surface',
  ]) {
    const data: Record<string, unknown> = reviewData();
    delete data[field];
    const dir = makeMission(t, {
      ledger: `${gateFor('T-001', '2026-10-31T00:00:00.000Z')}\n${doneFor(
        'T-001',
        '2026-10-31T00:00:01.000Z',
      )}\n${reviewEvent('2026-10-31T00:00:02.000Z', data)}\n${authEvent(
        '2026-10-31T00:00:03.000Z',
      )}\n`,
    });
    const report = completeMission(dir);
    assert.equal(report.ok, false, `${field} was accepted`);
    assert.ok(
      report.errors.some((error) => error.toLowerCase().includes(field)),
      `${field}: ${report.errors.join('; ')}`,
    );
  }
});

test('refuses a close review that does not cover every acceptance criterion', (t) => {
  const dir = makeMission(t, {
    mission: missionTwo,
    ledger: `${gateFor('T-001', '2026-10-31T00:00:00.000Z')}\n${doneFor(
      'T-001',
      '2026-10-31T00:00:01.000Z',
    )}\n${reviewEvent('2026-10-31T00:00:02.000Z')}\n${authEvent('2026-10-31T00:00:03.000Z')}\n`,
  });
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  assert.match(
    report.errors.join('\n'),
    /coverage must name every acceptance criterion: missing F2/,
  );
});

test('refuses a coverage artifact that does not exist', (t) => {
  const coverage = [
    {
      ...coverageF1[0],
      evidence: [{ path: 'evidence/missing.json' }],
    },
  ];
  const dir = makeMission(t, {
    ledger: `${gateFor('T-001', '2026-10-31T00:00:00.000Z')}\n${doneFor(
      'T-001',
      '2026-10-31T00:00:01.000Z',
    )}\n${reviewEvent('2026-10-31T00:00:02.000Z', reviewData(coverage))}\n${authEvent(
      '2026-10-31T00:00:03.000Z',
    )}\n`,
  });
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /coverage.*missing\.json/);
});

test('refuses a coverage gate reference without a passing gate result', (t) => {
  const coverage = [
    {
      ...coverageF1[0],
      evidence: [{ gate: 'other', path: 'evidence/T-001/gate.json' }],
    },
  ];
  const dir = makeMission(t, {
    ledger: `${gateFor('T-001', '2026-10-31T00:00:00.000Z')}\n${doneFor(
      'T-001',
      '2026-10-31T00:00:01.000Z',
    )}\n${reviewEvent('2026-10-31T00:00:02.000Z', reviewData(coverage))}\n${authEvent(
      '2026-10-31T00:00:03.000Z',
    )}\n`,
  });
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /coverage.*gate other/);
});

test('refuses mission_done without a human authorization after the last review', (t) => {
  const dir = makeMission(t, {
    ledger: `${gateFor('T-001', '2026-10-31T00:00:00.000Z')}\n${doneFor(
      'T-001',
      '2026-10-31T00:00:01.000Z',
    )}\n${reviewEvent('2026-10-31T00:00:02.000Z')}\n`,
  });
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /authorization/);
});

test('refuses an authorization that predates the latest review', (t) => {
  const dir = makeMission(t, {
    ledger: `${gateFor('T-001', '2026-10-31T00:00:00.000Z')}\n${doneFor(
      'T-001',
      '2026-10-31T00:00:01.000Z',
    )}\n${authEvent('2026-10-31T00:00:01.500Z')}\n${reviewEvent(
      '2026-10-31T00:00:02.000Z',
    )}\n`,
  });
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /authorization.*after the last review/);
});

test('refuses an authorization not approved by a human', (t) => {
  const dir = makeMission(t, {
    ledger: `${gateFor('T-001', '2026-10-31T00:00:00.000Z')}\n${doneFor(
      'T-001',
      '2026-10-31T00:00:01.000Z',
    )}\n${reviewEvent('2026-10-31T00:00:02.000Z')}\n${authEvent(
      '2026-10-31T00:00:03.000Z',
      { approved_by: 'cairn' },
    )}\n`,
  });
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /approved_by|approved by human/);
});

test('completeMission accepts the mission_done authorization the writer emits', (t) => {
  const dir = makeMission(t, {
    ledger: `${gateFor('T-001', '2026-10-31T00:00:00.000Z')}\n${doneFor(
      'T-001',
      '2026-10-31T00:00:01.000Z',
    )}\n${reviewEvent('2026-10-31T00:00:02.000Z')}\n`,
  });
  initGit(dir);

  const written = run(
    'record',
    '--authorized',
    '--scope',
    'mission_done',
    '--why',
    'the human authorized the close',
    '--approved-by',
    'human',
    '--date',
    '2026-11-01',
    '--mission',
    dir,
  );
  assert.equal(written.status, 0, written.stderr);
  const authorization = JSON.parse(written.stdout);
  assert.equal(authorization.data.scope, 'mission_done');
  assert.equal('paths' in authorization.data, false);

  const report = completeMission(dir);
  assert.equal(report.ok, true, report.errors.join('\n'));
});

test('replaying Mission #1 B5/B7 evidence fails under the new rule', (t) => {
  const oldReview = event(
    'review_result',
    undefined,
    {
      reviewer: 'Mission #1 fresh-context reviewer',
      verdict: 'pass',
      findings: ['cold start passed', 'pack mesh passed'],
      packs: REVIEW_PACKS,
    },
    '2026-10-31T00:00:04.000Z',
  );
  const dir = makeMission(t, {
    mission: missionB5B7,
    plan: planB5B7,
    ledger: `${gateFor('T-001', '2026-10-31T00:00:00.000Z')}\n${doneFor(
      'T-001',
      '2026-10-31T00:00:01.000Z',
    )}\n${gateFor('T-002', '2026-10-31T00:00:02.000Z')}\n${doneFor(
      'T-002',
      '2026-10-31T00:00:03.000Z',
    )}\n${oldReview}\n${authEvent('2026-10-31T00:00:05.000Z')}\n`,
  });
  const report = completeMission(dir);
  assert.equal(report.ok, false);
  const errors = report.errors.join('\n');
  for (const field of ['context', 'artifact', 'coverage', 'non_goals', 'cold_start', 'ui_surface']) {
    assert.match(errors, new RegExp(field), `missing ${field} was not refused`);
  }
});

test('cairn record --mission-done appends mission_done and refuses a second time', (t) => {
  const dir = makeMission(t, { ledger: COMPLETE });
  initGit(dir);

  const first = run('record', '--mission-done', '--mission', dir);
  assert.equal(first.status, 0, first.stderr);
  const events = readLedger(dir);
  assert.equal(events.filter((item) => item.event === 'mission_done').length, 1);

  const second = run('record', '--mission-done', '--mission', dir);
  assert.equal(second.status, 2);
  assert.match(second.stderr, /refused:.*already done/);
});

test('record --mission-done compares the raw ledger blob, not parsed JSON', (t) => {
  const dir = makeMission(t, { ledger: COMPLETE });
  initGit(dir);
  const file = join(dir, 'ledger.jsonl');
  const reformatted = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line !== '')
    .map((line) => `${line} `)
    .join('\n');
  writeFileSync(file, `${reformatted}\n`);

  const refused = run('record', '--mission-done', '--mission', dir);
  assert.equal(refused.status, 2, refused.stdout);
  assert.match(refused.stderr, /refused:.*ledger/);
  assert.ok(!readLedger(dir).some((event) => event.event === 'mission_done'));

  commit(dir, 'reformat the ledger without changing its events');
  const closed = run('record', '--mission-done', '--mission', dir);
  assert.equal(closed.status, 0, closed.stderr);
  assert.ok(readLedger(dir).some((event) => event.event === 'mission_done'));
});

function run(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: 'utf8' });
}
