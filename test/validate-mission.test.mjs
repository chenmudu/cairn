import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { validateMission } from '../scripts/validate-mission.mjs';

const repo = resolve(import.meta.dirname, '..');

const taskYaml = (id, { deps = '[]', status = 'todo', gates = 'block' } = {}) => {
  const gate =
    gates === 'none'
      ? '    gates: []'
      : gates === 'advisory'
        ? `    gates:
      - id: gate
        command: node
        args: ["-e", "process.exit(0)"]
        severity: advisory`
        : `    gates:
      - id: gate
        command: node
        args: ["-e", "process.exit(0)"]
        severity: block`;
  return `  - id: ${id}
    title: Task ${id}
    deps: ${deps}
    risk: low
    status: ${status}
    files:
      - README.md
    interfaces:
      produces:
        - "run(): void"
${gate}
`;
};

const planOf = (...tasks) => `---
schema: cairn/plan@0.1
mission: temp-mission
tasks:
${tasks.join('')}---

# Temp plan
`;

const VALID = {
  'mission.md': `---
schema: cairn/mission@0.1
id: temp-mission
title: Temp mission
status: active
created: 2026-10-31
owner: fixture
acceptance:
  - id: F1
    check: the validator accepts this mission
---

# Temp
`,
  'policy.md': `---
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
`,
  'plan.md': planOf(taskYaml('T-001')),
  'ledger.jsonl': '',
};

function makeMission(t, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-validate-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [name, content] of Object.entries({ ...VALID, ...overrides })) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

const eventLine = (event, task, data) =>
  JSON.stringify({
    ts: '2026-10-31T00:00:00.000Z',
    event,
    mission: 'temp-mission',
    ...(task ? { task } : {}),
    actor: 'human',
    data,
  }) + '\n';

test('accepts the repository mission', () => {
  const result = validateMission(join(repo, 'missions', '000-bootstrap'));
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.deepEqual(result.errors, []);
});

test('accepts a minimal valid mission', (t) => {
  const result = validateMission(makeMission(t));
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('rejects the fixture whose task has no gate', () => {
  const result = validateMission(join(repo, 'test', 'fixtures', 'missing-gate'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /no severity: block gate/);
});

test('rejects duplicate task ids', (t) => {
  const dir = makeMission(t, { 'plan.md': planOf(taskYaml('T-001'), taskYaml('T-001')) });
  assert.match(validateMission(dir).errors.join('\n'), /duplicate task id/);
});

test('rejects an unresolvable dependency', (t) => {
  const dir = makeMission(t, { 'plan.md': planOf(taskYaml('T-001', { deps: '[T-999]' })) });
  assert.match(validateMission(dir).errors.join('\n'), /unknown task "T-999"/);
});

test('rejects a task whose gates are advisory only', (t) => {
  const dir = makeMission(t, { 'plan.md': planOf(taskYaml('T-001', { gates: 'advisory' })) });
  assert.match(validateMission(dir).errors.join('\n'), /no severity: block gate/);
});

test('rejects an unknown ledger event', (t) => {
  const bogus = JSON.stringify({
    ts: '2026-10-31T00:00:00.000Z',
    event: 'bogus',
    mission: 'temp-mission',
    actor: 'human',
    data: {},
  });
  const dir = makeMission(t, { 'ledger.jsonl': bogus + '\n' });
  assert.match(validateMission(dir).errors.join('\n'), /unknown event "bogus"/);
});

test('rejects a task_done without a passing blocking gate', (t) => {
  const dir = makeMission(t, {
    'plan.md': planOf(taskYaml('T-001', { gates: 'advisory' })),
    'ledger.jsonl': eventLine('task_done', 'T-001', {
      base: 'aaaaaaa',
      head: 'bbbbbbb',
      commits: ['bbbbbbb'],
      gates: [{ id: 'gate', exit_code: 0 }],
    }),
  });
  assert.match(validateMission(dir).errors.join('\n'), /no severity: block gate at exit 0/);
});

test('rejects a gate_result whose evidence file is missing', (t) => {
  const dir = makeMission(t, {
    'ledger.jsonl': eventLine('gate_result', 'T-001', {
      gate: 'gate',
      command: 'node -e process.exit(0)',
      exit_code: 0,
      evidence: 'evidence/T-001/gate.json',
    }),
  });
  assert.match(validateMission(dir).errors.join('\n'), /evidence file does not exist/);
});

test('accepts a gate_result whose evidence file exists', (t) => {
  const dir = makeMission(t, {
    'ledger.jsonl': eventLine('gate_result', 'T-001', {
      gate: 'gate',
      command: 'node -e process.exit(0)',
      exit_code: 0,
      evidence: 'evidence/T-001/gate.json',
    }),
  });
  mkdirSync(join(dir, 'evidence', 'T-001'), { recursive: true });
  writeFileSync(join(dir, 'evidence', 'T-001', 'gate.json'), '{}\n');
  const result = validateMission(dir);
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('rejects an evidence path that escapes the mission directory', (t) => {
  const dir = makeMission(t, {
    'ledger.jsonl': eventLine('gate_result', 'T-001', {
      gate: 'gate',
      command: 'node -e process.exit(0)',
      exit_code: 0,
      evidence: '../../escape.json',
    }),
  });
  assert.match(validateMission(dir).errors.join('\n'), /escapes the mission directory/);
});

test('rejects YAML it does not understand instead of guessing', (t) => {
  const broken = VALID['plan.md'].replace('    title: Task T-001', '    title: |');
  const dir = makeMission(t, { 'plan.md': broken });
  assert.match(validateMission(dir).errors.join('\n'), /block scalars are not supported/);
});
