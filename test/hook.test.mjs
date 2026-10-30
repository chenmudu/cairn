import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

test('the configured SessionStart hook injects the mission anchor and routing rule', () => {
  const { group, entry } = configuredHook();
  assert.equal(entry.type, 'process', 'use the portable process hook');
  assert.ok(entry.command === 'node' || entry.command === process.execPath, 'hook must invoke node');
  assert.ok(Array.isArray(entry.args), 'process hooks use an argument vector');
  assert.match(group.matcher ?? '', /startup/);
  assert.match(group.matcher ?? '', /clear/);
  assert.match(group.matcher ?? '', /compact/);

  const result = spawnSync(entry.command, entry.args, { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  const context = output.hookSpecificOutput.additionalContext;
  assert.match(context, /Cairn goal anchor/);
  assert.match(context, /Decision routing: ADR =/);
  assert.match(context, /Do not ask the human to restate the goal/);
});
