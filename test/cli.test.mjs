import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { makeTempMission, makeTempRepo } from './helpers.mjs';

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
  const config = JSON.parse(readFileSync(join(repo, '.cairn', 'config.json'), 'utf8'));
  const result = run('status', '--json');
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mission.id, config.active_mission);
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

test('the init scaffold gate fails, so the scaffold cannot be recorded done', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'cairn-scaffold-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const init = spawnSync(process.execPath, [cli, 'init', 'demo', '--title', 'Demo mission'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(init.status, 0, init.stderr);

  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
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
  const start = spawnSync(process.execPath, [cli, 'start', 'T-001'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(start.status, 0, start.stderr);

  const verify = spawnSync(process.execPath, [cli, 'verify', 'T-001'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(verify.status, 2, verify.stderr);
  const packet = JSON.parse(verify.stdout);
  assert.equal(packet.passed, false);
  assert.equal(packet.gates[0].id, 'placeholder');
  assert.equal(packet.gates[0].exit_code, 1);

  const record = spawnSync(process.execPath, [cli, 'record', 'T-001', '--status', 'done'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(record.status, 2);
  assert.match(record.stderr, /blocking gate placeholder did not exit 0/);
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
  assert.equal(packet.packs.length, 2);
  assert.ok(packet.packs.every((pack) => typeof pack.mode === 'string'));
});

test('record refuses a task with no gate evidence and does not write', (t) => {
  const dir = makeTempMission(t);
  appendFileSync(
    join(dir, 'ledger.jsonl'),
    `${JSON.stringify({
      ts: '2026-10-31T00:00:00.000Z',
      event: 'task_started',
      mission: 'temp-mission',
      task: 'T-001',
      actor: 'cairn',
      data: { base: 'a'.repeat(40) },
    })}\n`,
  );
  const before = readFileSync(join(dir, 'ledger.jsonl'), 'utf8');
  const result = run('record', 'T-001', '--status', 'done', '--mission', dir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /refused:.*(gate|evidence)/);
  assert.equal(readFileSync(join(dir, 'ledger.jsonl'), 'utf8'), before);
});

test('record refuses a task that was never started and writes nothing', (t) => {
  const dir = makeTempMission(t);
  const before = readFileSync(join(dir, 'ledger.jsonl'), 'utf8');
  const result = run('record', 'T-001', '--status', 'done', '--mission', dir);
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /refused:.*task_started/);
  assert.equal(readFileSync(join(dir, 'ledger.jsonl'), 'utf8'), before);
});

test('verify and record complete a task with no manual ledger write', (t) => {
  const { root, mission } = makeTempRepo(t);
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
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

  const start = run('start', 'T-001', '--mission', mission);
  assert.equal(start.status, 0, start.stderr);

  writeFileSync(join(root, 'work.txt'), 'work\n');
  assert.equal(git('add', '.').status, 0);
  assert.equal(commit('work').status, 0);

  const verify = run('verify', 'T-001', '--mission', mission);
  assert.equal(verify.status, 0, verify.stderr);
  const report = JSON.parse(verify.stdout);
  assert.equal(report.passed, true);
  assert.match(report.head, /^[0-9a-f]{40}$/);
  assert.match(report.tree, /^[0-9a-f]{40}$/);

  const record = run('record', 'T-001', '--status', 'done', '--mission', mission);
  assert.equal(record.status, 0, record.stderr);
  const events = readFileSync(join(mission, 'ledger.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const done = events.find((event) => event.event === 'task_done' && event.task === 'T-001');
  assert.ok(done);
  assert.equal(done.data.head, report.head);
  assert.equal(done.data.tree, report.tree);
  assert.ok(existsSync(join(mission, report.gates[0].evidence)));
});

test('record refuses an unknown task', (t) => {
  const dir = makeTempMission(t);
  const result = run('record', 'T-999', '--status', 'done', '--mission', dir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown task/);
});

test('start records task_started with the base commit and refuses a second start', (t) => {
  const dir = makeTempMission(t);
  // Three attempts, so the second start is refused by the state machine, not
  // by the attempt budget that T6 adds.
  writeFileSync(
    join(dir, 'policy.md'),
    `---
schema: cairn/policy@0.1
mission: temp-mission
budgets:
  max_attempts_per_task: 3
allowed_commands:
  - node
---
`,
  );
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
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

  const started = run('start', 'T-001', '--mission', dir);
  assert.equal(started.status, 0, started.stderr);
  const event = JSON.parse(started.stdout);
  assert.equal(event.event, 'task_started');
  assert.match(event.data.base, /^[0-9a-f]{40}$/);

  const again = run('start', 'T-001', '--mission', dir);
  assert.equal(again.status, 2);
  assert.match(again.stderr, /already started/);
});

test('start refuses an unmet dependency and names it', (t) => {
  const { root, mission } = makeTempRepo(t);
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
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

  const result = run('start', 'T-002', '--mission', mission);
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /refused:.*T-001/);
  assert.ok(!readFileSync(join(mission, 'ledger.jsonl'), 'utf8').includes('task_started'));
});

test('start refuses a second active task and names it', (t) => {
  const { root, mission } = makeTempRepo(t);
  writeFileSync(
    join(mission, 'plan.md'),
    `---
schema: cairn/plan@0.1
mission: temp-mission
tasks:
  - id: T-001
    title: First
    deps: []
    risk: low
    status: todo
    serves: [F1]
    files: []
    gates:
      - id: gate
        command: node
        args: ["-e", "process.exit(0)"]
        severity: block
  - id: T-002
    title: Second
    deps: []
    risk: low
    status: todo
    serves: [F2]
    files: []
    gates:
      - id: gate
        command: node
        args: ["-e", "process.exit(0)"]
        severity: block
---

# Temp plan
`,
  );
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
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

  assert.equal(run('start', 'T-001', '--mission', mission).status, 0);
  const second = run('start', 'T-002', '--mission', mission);
  assert.equal(second.status, 2, second.stdout);
  assert.match(second.stderr, /refused:.*T-001/);
});

test('a parked task can be answered and then completed', (t) => {
  const { root, mission } = makeTempRepo(t);
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
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

  appendFileSync(
    join(mission, 'ledger.jsonl'),
    `${JSON.stringify({
      ts: '2026-10-31T00:00:00.000Z',
      event: 'task_parked',
      mission: 'temp-mission',
      task: 'T-001',
      actor: 'cairn',
      data: { reason: 'needs a human decision' },
    })}\n`,
  );

  const record = run('record', 'T-001', '--status', 'done', '--mission', mission);
  assert.equal(record.status, 2, record.stdout);
  assert.match(record.stderr, /parked/);

  const answer = run('answer', 'T-001', '--text', 'go ahead', '--mission', mission);
  assert.equal(answer.status, 0, answer.stderr);
  const event = JSON.parse(answer.stdout);
  assert.equal(event.event, 'task_started');
  assert.equal(event.data.answer, 'go ahead');
  assert.equal(event.data.approved_by, 'human');
  assert.match(event.data.base, /^[0-9a-f]{40}$/);

  writeFileSync(join(root, 'work.txt'), 'work\n');
  assert.equal(git('add', '.').status, 0);
  assert.equal(commit('work').status, 0);

  assert.equal(run('verify', 'T-001', '--mission', mission).status, 0);
  const done = run('record', 'T-001', '--status', 'done', '--mission', mission);
  assert.equal(done.status, 0, done.stderr);
  assert.match(readFileSync(join(mission, 'ledger.jsonl'), 'utf8'), /"task":"T-001"/);
});

test('answer refuses a task that is not parked', (t) => {
  const dir = makeTempMission(t);
  const result = run('answer', 'T-001', '--text', 'go ahead', '--mission', dir);
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /refused:.*(parked|state)/);
});

test('review writes a review_result from a JSON file', (t) => {
  const dir = makeTempMission(t);
  mkdirSync(join(dir, 'evidence'), { recursive: true });
  writeFileSync(join(dir, 'evidence', 'review.json'), '{}\n');
  const file = join(dir, 'review.json');
  writeFileSync(
    file,
    JSON.stringify({
      reviewer: 'fresh context',
      context: 'fresh',
      artifact: 'evidence/review.json',
      verdict: 'pass',
      findings: ['ok'],
      packs: [
        {
          capability: 'test-first',
          pack: 'superpowers',
          version: '7.0.1',
          mode: 'use',
          evidence: 'test/cli.test.mjs',
        },
        {
          capability: 'design-review',
          pack: 'impeccable',
          version: '4.8.0+df3a4ab',
          mode: 'not-applicable',
          reason: 'no UI surface',
          evidence: 'README.md review',
        },
      ],
      coverage: [
        {
          criterion: 'F1',
          tasks: ['T-001'],
          evidence: [{ path: 'evidence/review.json' }],
          verdict: 'pass',
        },
        {
          criterion: 'F2',
          tasks: ['T-002'],
          evidence: [{ path: 'evidence/review.json' }],
          verdict: 'pass',
        },
        {
          criterion: 'F3',
          tasks: ['T-003'],
          evidence: [{ path: 'evidence/review.json' }],
          verdict: 'pass',
        },
      ],
      non_goals: [
        { non_goal: 'No UI', verdict: 'pass', evidence: ['evidence/review.json'] },
      ],
      cold_start: {
        reviewer: 'fresh context',
        artifact: 'evidence/review.json',
        verdict: 'pass',
      },
      ui_surface: 'none',
    }),
  );
  const result = run('review', '--file', file, '--mission', dir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).event, 'review_result');

  const events = readFileSync(join(dir, 'ledger.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(events.at(-1).data.reviewer, 'fresh context');
});

test('review refuses an invalid verdict and writes nothing', (t) => {
  const dir = makeTempMission(t);
  const file = join(dir, 'review.json');
  writeFileSync(file, JSON.stringify({ reviewer: 'x', verdict: 'maybe', findings: [] }));
  const before = readFileSync(join(dir, 'ledger.jsonl'), 'utf8');
  const result = run('review', '--file', file, '--mission', dir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /verdict must be pass or fail/);
  assert.equal(readFileSync(join(dir, 'ledger.jsonl'), 'utf8'), before);
});

test('usage exits 2', () => {
  const result = run('bogus');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage/);
});

const runIn = (root, ...args) =>
  spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });

const ledgerOf = (mission) =>
  readFileSync(join(mission, 'ledger.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line));

test('init writes mission_created and the new mission validates', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'cairn-init-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const init = runIn(
    root,
    'init',
    'demo',
    '--title',
    'Demo mission',
    '--owner',
    'fixture',
    '--approval-source',
    '0006,0005',
    '--approved-by',
    'cairn',
  );
  assert.equal(init.status, 0, init.stderr);

  const mission = join(root, '.cairn', 'missions', 'demo');
  const events = ledgerOf(mission);
  assert.equal(events.length, 1);
  const created = events[0];
  assert.equal(created.event, 'mission_created');
  assert.equal(created.mission, 'demo');
  assert.equal(created.data.approved_by, 'cairn');
  assert.deepEqual(created.data.approval_source, ['0006', '0005']);
  assert.equal(created.data.owner, 'fixture');
  for (const name of ['mission.md', 'plan.md', 'policy.md']) {
    assert.match(created.data.artifacts[name], /^sha256:[0-9a-f]{64}$/);
  }
  assert.match(readFileSync(join(mission, 'mission.md'), 'utf8'), /owner: fixture/);

  const validate = spawnSync(
    process.execPath,
    [resolve(repo, 'scripts', 'validate-mission.mjs'), mission],
    { encoding: 'utf8' },
  );
  assert.equal(validate.status, 0, validate.stderr);
});

test('init defaults to cairn and never claims a human approval', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'cairn-init-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(runIn(root, 'init', 'demo').status, 0);

  const [created] = ledgerOf(join(root, '.cairn', 'missions', 'demo'));
  assert.equal(created.data.approved_by, 'cairn');
  assert.deepEqual(created.data.approval_source, ['none']);
  assert.equal(created.data.owner, 'replace-me');
});

test('record --amended writes old and new hashes and enforces the approver', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'cairn-amend-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.equal(runIn(root, 'init', 'demo', '--owner', 'fixture').status, 0);
  const mission = join(root, '.cairn', 'missions', 'demo');

  appendFileSync(join(mission, 'plan.md'), '\n# plan amendment\n');
  const amended = runIn(
    root,
    'record',
    '--amended',
    '--artifact',
    'plan.md',
    '--why',
    'the plan gained a task',
    '--approved-by',
    'cairn',
  );
  assert.equal(amended.status, 0, amended.stderr);
  const event = JSON.parse(amended.stdout);
  assert.equal(event.event, 'mission_amended');
  assert.match(event.data.old['plan.md'], /^sha256:[0-9a-f]{64}$/);
  assert.match(event.data.new['plan.md'], /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(event.data.old['plan.md'], event.data.new['plan.md']);
  assert.deepEqual(event.data.acceptance, ['A1']);
  assert.equal(event.data.approved_by, 'cairn');

  appendFileSync(join(mission, 'mission.md'), '\n<!-- edit -->\n');
  const refused = runIn(
    root,
    'record',
    '--amended',
    '--artifact',
    'mission.md',
    '--why',
    'tighten the acceptance',
    '--approved-by',
    'cairn',
  );
  assert.equal(refused.status, 2, refused.stdout);
  assert.match(refused.stderr, /human/);

  const human = runIn(
    root,
    'record',
    '--amended',
    '--artifact',
    'mission.md',
    '--why',
    'tighten the acceptance',
    '--approved-by',
    'human',
  );
  assert.equal(human.status, 0, human.stderr);
  assert.equal(JSON.parse(human.stdout).data.approved_by, 'human');
});

const gatePlan = (command, args) => `---
schema: cairn/plan@0.1
mission: temp-mission
tasks:
  - id: T-001
    title: Gate probe
    deps: []
    risk: low
    status: todo
    serves: [F1]
    files:
      - README.md
    gates:
      - id: probe
        command: ${command}
        args: [${args.map((arg) => JSON.stringify(arg)).join(', ')}]
        severity: block
---
`;

const startEvent = (ts) =>
  JSON.stringify({
    ts,
    event: 'task_started',
    mission: 'temp-mission',
    task: 'T-001',
    actor: 'test',
    data: { base: 'deadbee' },
  }) + '\n';

test('verify refuses an out-of-list gate command and names the policy', (t) => {
  const mission = makeTempMission(t);
  writeFileSync(join(mission, 'plan.md'), gatePlan('npx', ['eslint']));
  const result = run('verify', 'T-001', '--mission', mission);
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /probe/);
  assert.match(result.stderr, /npx/);
  assert.match(result.stderr, /policy\.md/);
});

test('verify refuses a forbidden gate command', (t) => {
  const mission = makeTempMission(t);
  writeFileSync(
    join(mission, 'policy.md'),
    `---
schema: cairn/policy@0.1
mission: temp-mission
allowed_commands:
  - node
  - git
forbidden_commands:
  - git push
---
`,
  );
  writeFileSync(join(mission, 'plan.md'), gatePlan('git', ['push', 'origin', 'dev']));
  const result = run('verify', 'T-001', '--mission', mission);
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /forbidden/);
  assert.match(result.stderr, /git push/);
  assert.match(result.stderr, /policy\.md/);
});

test('start refuses a task at max_attempts_per_task', (t) => {
  const mission = makeTempMission(t);
  writeFileSync(join(mission, 'ledger.jsonl'), startEvent('2026-10-31T00:00:00.000Z'));
  const result = run('start', 'T-001', '--mission', mission);
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /budget_exhausted/);
  assert.match(result.stderr, /policy\.md/);
});

test('record refuses a tick over max_wall_time_per_tick_minutes', (t) => {
  const mission = makeTempMission(t);
  writeFileSync(
    join(mission, 'policy.md'),
    `---
schema: cairn/policy@0.1
mission: temp-mission
budgets:
  max_attempts_per_task: 3
  max_wall_time_per_tick_minutes: 1
stop_conditions:
  - budget_exhausted
stop_condition_labels:
  auto:
    - budget_exhausted
---
`,
  );
  writeFileSync(
    join(mission, 'ledger.jsonl'),
    startEvent(new Date(Date.now() - 5 * 60_000).toISOString()),
  );
  const result = run('record', 'T-001', '--status', 'done', '--mission', mission);
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /budget_exhausted/);
  assert.match(result.stderr, /human/);
});

test('record --authorized writes an authorization event', (t) => {
  const mission = makeTempMission(t);
  const result = run(
    'record',
    '--authorized',
    '--paths',
    'docs/guide.md,src/new.ts',
    '--why',
    'the human widened the write set',
    '--approved-by',
    'human',
    '--mission',
    mission,
  );
  assert.equal(result.status, 0, result.stderr);
  const event = JSON.parse(result.stdout);
  assert.equal(event.event, 'authorization');
  assert.equal(event.actor, 'human');
  assert.equal(event.data.scope, 'writes');
  assert.deepEqual(event.data.paths, ['docs/guide.md', 'src/new.ts']);
  assert.equal(event.data.approved_by, 'human');
  assert.equal(event.data.why, 'the human widened the write set');
  assert.match(event.data.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('record --authorized refuses a non-human approval and missing fields', (t) => {
  const mission = makeTempMission(t);
  const cairn = run(
    'record',
    '--authorized',
    '--paths',
    'docs/guide.md',
    '--why',
    'agent tried to authorize itself',
    '--approved-by',
    'cairn',
    '--mission',
    mission,
  );
  assert.equal(cairn.status, 2, cairn.stdout);
  assert.match(cairn.stderr, /human/);

  const noPaths = run(
    'record',
    '--authorized',
    '--why',
    'no paths',
    '--approved-by',
    'human',
    '--mission',
    mission,
  );
  assert.equal(noPaths.status, 2, noPaths.stdout);

  const noWhy = run(
    'record',
    '--authorized',
    '--paths',
    'docs/guide.md',
    '--approved-by',
    'human',
    '--mission',
    mission,
  );
  assert.equal(noWhy.status, 2, noWhy.stdout);
});
