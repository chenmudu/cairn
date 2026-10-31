#!/usr/bin/env node
/**
 * SessionStart hook: print the goal anchor from the repository as additional
 * context, so a fresh session starts aligned without the previous conversation.
 *
 * The hook is an adapter. The contract is scripts/goal-check.mjs, which any
 * harness can run without ZCode.
 */

import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function context() {
  const mission = process.env.CAIRN_MISSION_DIR;
  const args = ['scripts/goal-check.mjs', '--anchor', ...(mission ? [mission] : [])];
  try {
    const anchor = execFileSync(process.execPath, args, {
      cwd: repo,
      encoding: 'utf8',
      timeout: 10000,
    }).trim();
    return [
      anchor,
      '',
      'This anchor is generated from the repository. Do not ask the human to restate the goal.',
    ].join('\n');
  } catch (error) {
    const detail = error.stdout?.toString().trim() || error.message;
    return [
      'Cairn anchor unavailable; run node scripts/goal-check.mjs',
      detail,
      '',
      'Do not ask the human to restate the goal.',
    ].join('\n');
  }
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context(),
    },
  }) + '\n',
);
