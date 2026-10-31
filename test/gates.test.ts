import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkGatePolicy, runGate } from '../src/gates.ts';
import { checkEvidence, verifyTask } from '../src/verify.ts';
import { readLedger } from '../src/ledger.ts';
import { loadMission, type Gate } from '../src/plan.ts';

const repo = resolve(import.meta.dirname, '..');

const gateYaml = (id: string, severity: string, code: number) => `      - id: ${id}
        command: node
        args: ["-e", "process.exit(${code})"]
        severity: ${severity}
`;

function makeMission(t, gates: string) {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-gates-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(
    join(dir, 'mission.md'),
    `---
schema: cairn/mission@0.1
id: gates-fixture
title: Gates fixture
status: active
created: 2026-10-31
owner: fixture
acceptance:
  - id: F1
    check: gates run
---

# Gates

## Intent

Prove the gate runner.

## Non-goals

- No UI.

## Constraints

- No network.
`,
  );
  writeFileSync(
    join(dir, 'policy.md'),
    `---
schema: cairn/policy@0.1
mission: gates-fixture
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
  );
  writeFileSync(
    join(dir, 'plan.md'),
    `---
schema: cairn/plan@0.1
mission: gates-fixture
tasks:
  - id: T-001
    title: Gate fixture
    deps: []
    risk: low
    status: todo
    serves: [F1]
    files:
      - README.md
    interfaces:
      produces:
        - "run(): void"
    gates:
${gates}---
`,
  );
  writeFileSync(join(dir, 'ledger.jsonl'), '');
  return dir;
}

test('runGate records a passing exit code and its output', () => {
  const gate: Gate = {
    id: 'ok',
    command: 'node',
    args: ['-e', 'console.log("hello")'],
    severity: 'block',
  };
  const result = runGate(gate, { cwd: repo });
  assert.equal(result.exit_code, 0);
  assert.equal(result.timed_out, false);
  assert.match(result.output, /hello/);
});

test('runGate records a failing exit code and stderr', () => {
  const gate: Gate = {
    id: 'bad',
    command: 'node',
    args: ['-e', 'console.error("boom"); process.exit(3)'],
    severity: 'block',
  };
  const result = runGate(gate, { cwd: repo });
  assert.equal(result.exit_code, 3);
  assert.match(result.output, /boom/);
});

test('runGate runs in the requested cwd', () => {
  const gate: Gate = {
    id: 'pwd',
    command: 'node',
    args: ['-e', 'console.log(process.cwd())'],
    severity: 'block',
  };
  const result = runGate(gate, { cwd: repo });
  assert.equal(result.output.trim(), repo);
});

test('verifyTask runs every gate, writes evidence, and passes when blocks pass', (t) => {
  const dir = makeMission(t, gateYaml('fast', 'block', 0) + gateYaml('slow', 'advisory', 1));
  const result = verifyTask(dir, 'T-001');
  assert.equal(result.passed, true);
  assert.deepEqual(
    result.gates.map((gate) => [gate.id, gate.exit_code]),
    [
      ['fast', 0],
      ['slow', 1],
    ],
  );

  const events = readLedger(dir).filter((event) => event.event === 'gate_result');
  assert.equal(events.length, 2);
  assert.deepEqual(
    events.map((event) => event.data.gate),
    ['fast', 'slow'],
  );
  for (const gate of result.gates) {
    assert.ok(existsSync(join(dir, gate.evidence)), `${gate.evidence} exists`);
    assert.match(gate.evidence, /^evidence\/T-001\/.+\.json$/);
  }
});

test('verifyTask fails when a blocking gate fails', (t) => {
  const dir = makeMission(t, gateYaml('fast', 'block', 2));
  const result = verifyTask(dir, 'T-001');
  assert.equal(result.passed, false);
  assert.equal(result.gates[0].exit_code, 2);
  const events = readLedger(dir).filter((event) => event.event === 'gate_result');
  assert.equal(events[0].data.exit_code, 2);
});

test('checkEvidence requires every blocking gate, not just one', (t) => {
  const dir = makeMission(t, gateYaml('fast', 'block', 0) + gateYaml('slow', 'block', 1));
  verifyTask(dir, 'T-001');
  const doc = loadMission(dir);
  const errors = checkEvidence(dir, doc.plan.tasks[0], doc.events);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /slow/);
});

test('checkEvidence rejects a gate whose evidence file is gone', (t) => {
  const dir = makeMission(t, gateYaml('fast', 'block', 0));
  const result = verifyTask(dir, 'T-001');
  unlinkSync(join(dir, result.gates[0].evidence));
  const doc = loadMission(dir);
  assert.match(checkEvidence(dir, doc.plan.tasks[0], doc.events).join('\n'), /evidence missing/);
});

test('verifyTask refuses an unknown task', (t) => {
  const dir = makeMission(t, gateYaml('fast', 'block', 0));
  assert.throws(() => verifyTask(dir, 'T-999'), /unknown task/);
});

test('--expect-invalid passes on the missing-gate fixture and fails on a valid mission', () => {
  const invalid = spawnSync(
    process.execPath,
    ['scripts/validate-mission.mjs', '--expect-invalid', 'test/fixtures/missing-gate'],
    { cwd: repo, encoding: 'utf8' },
  );
  assert.equal(invalid.status, 0, invalid.stderr);
  assert.match(invalid.stdout, /invalid as expected/);

  const valid = spawnSync(
    process.execPath,
    ['scripts/validate-mission.mjs', '--expect-invalid', '.cairn/missions/000-bootstrap'],
    { cwd: repo, encoding: 'utf8' },
  );
  assert.equal(valid.status, 1, valid.stderr);
  assert.match(valid.stderr, /unexpected valid/);
});

const POLICY = {
  allowed_commands: ['node', 'git'],
  forbidden_commands: ['git push', 'rm -rf'],
  approved_exceptions: [{ command: 'git push origin main' }],
};

const gateOf = (id: string, command: string, args: string[] = []): Gate => ({
  id,
  command,
  args,
  severity: 'block',
});

test('checkGatePolicy refuses a command outside allowed_commands and names the policy path', () => {
  const errors = checkGatePolicy(
    [gateOf('lint', 'npx', ['eslint'])],
    POLICY,
    '.cairn/missions/002/policy.md',
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /lint/);
  assert.match(errors[0], /npx/);
  assert.match(errors[0], /policy\.md/);
});

test('checkGatePolicy refuses a forbidden command', () => {
  const errors = checkGatePolicy([gateOf('push', 'git', ['push', 'origin', 'dev'])], POLICY, 'policy.md');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /forbidden/);
  assert.match(errors[0], /git push/);
});

test('checkGatePolicy allows the recorded push exception and nothing wider', () => {
  assert.deepEqual(
    checkGatePolicy([gateOf('push', 'git', ['push', 'origin', 'main'])], POLICY, 'policy.md'),
    [],
  );
  assert.match(
    checkGatePolicy([gateOf('push', 'git', ['push', 'origin', 'dev'])], POLICY, 'policy.md')[0],
    /forbidden/,
  );
  assert.match(
    checkGatePolicy(
      [gateOf('push', 'git', ['push', '--force', 'origin', 'main'])],
      POLICY,
      'policy.md',
    )[0],
    /forbidden/,
  );
});

test('checkGatePolicy checks every gate, not the first', () => {
  const errors = checkGatePolicy(
    [gateOf('ok', 'node', ['-e', '0']), gateOf('bad', 'npx')],
    POLICY,
    'policy.md',
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /bad/);
});

test(
  'runGate resolves a Windows .cmd shim through the shell',
  { skip: process.platform !== 'win32' },
  (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'cairn-cmd-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    writeFileSync(join(dir, 'cairn-shim.cmd'), '@echo off\r\necho shim-ran\r\nexit /b 0\r\n');

    const result = runGate(gateOf('shim', 'cairn-shim'), { cwd: dir });
    assert.equal(result.exit_code, 0, result.output);
    assert.match(result.output, /shim-ran/);
  },
);
