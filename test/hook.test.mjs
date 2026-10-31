import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const repo = resolve(import.meta.dirname, '..');
const HOOK = '.zcode/hooks/session-start.mjs';

function configuredHook() {
  const config = JSON.parse(readFileSync(join(repo, '.zcode', 'config.json'), 'utf8'));
  assert.equal(config.hooks?.enabled, true, 'workspace hooks must be enabled');
  const groups = config.hooks?.events?.SessionStart;
  assert.ok(Array.isArray(groups) && groups.length > 0, 'SessionStart must be configured');
  const group = groups.find((candidate) =>
    (candidate.hooks ?? []).some((hook) => hook.args?.includes(HOOK)),
  );
  assert.ok(group, `SessionStart must point at ${HOOK}`);
  const entry = group.hooks.find((hook) => hook.args?.includes(HOOK));
  return { config, group, entry };
}

const task = (id, deps) => `  - id: ${id}
    title: Task ${id}
    deps: [${deps}]
    risk: low
    status: todo
    serves: [F1]
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

const doneEvent = (taskId) =>
  JSON.stringify({
    ts: '2026-10-31T00:00:00.000Z',
    event: 'task_done',
    mission: 'temp-mission',
    task: taskId,
    actor: 'test',
    data: {},
  });

/** A four-task mission; three task_done events with no review make the audit due. */
function makeMission(t, { done = 0 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-hook-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(
    join(dir, 'mission.md'),
    `---
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

Prove that the hook reads the mission.

## Non-goals

- No UI.
`,
  );
  writeFileSync(
    join(dir, 'policy.md'),
    `---
schema: cairn/policy@0.1
mission: temp-mission
budgets:
  max_attempts_per_task: 3
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
mission: temp-mission
tasks:
${task('T-001', '')}${task('T-002', 'T-001')}${task('T-003', 'T-002')}${task('T-004', 'T-003')}---

# Temp plan
`,
  );
  const events = ['T-001', 'T-002', 'T-003'].slice(0, done).map(doneEvent);
  writeFileSync(join(dir, 'ledger.jsonl'), events.length ? events.join('\n') + '\n' : '');
  return dir;
}

function runHook(missionDir) {
  const { entry } = configuredHook();
  const result = spawnSync(entry.command, entry.args, {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, CAIRN_MISSION_DIR: missionDir },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
}

test('the configured SessionStart hook matches startup and resume', () => {
  const { group, entry } = configuredHook();
  assert.equal(group.matcher, 'startup|resume');
  assert.equal(entry.type, 'process', 'use the portable process hook');
  assert.ok(entry.command === 'node' || entry.command === process.execPath, 'hook must invoke node');
  assert.ok(Array.isArray(entry.args), 'process hooks use an argument vector');
});

test('the hook injects the anchor and routing rule from a healthy mission', (t) => {
  const context = runHook(makeMission(t));
  assert.match(context, /Cairn goal anchor/);
  assert.match(context, /Current task: T-001/);
  assert.match(context, /Decision routing: ADR =/);
  assert.match(context, /Do not ask the human to restate the goal/);
  assert.doesNotMatch(context, /warning:/);
});

test('the hook keeps the anchor and adds the warning when the audit is due', (t) => {
  const context = runHook(makeMission(t, { done: 3 }));
  assert.match(context, /Cairn goal anchor/);
  assert.match(context, /warning: milestone audit due: 3 tasks completed since mission start/);
});

test('the hook names the manual command when the anchor is unavailable', (t) => {
  const missing = join(tmpdir(), `cairn-hook-missing-${process.pid}-${Date.now()}`);
  const context = runHook(missing);
  assert.match(context, /Cairn anchor unavailable; run node scripts\/goal-check\.mjs/);
  assert.doesNotMatch(context, /Intent:|Current task:/);
});