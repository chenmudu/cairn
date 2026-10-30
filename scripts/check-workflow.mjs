#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SECTIONS = [
  '## Roles',
  '## The tick',
  '## Human checkpoints',
  '## Failure paths',
  '## Packs',
  '## Done',
];
const BRANCHES = [
  '### Both packs',
  '### Superpowers only',
  '### Impeccable only',
  '### Neither pack',
];
const COMMANDS = [
  'node scripts/goal-check.mjs',
  'node src/cli.ts next',
  'node src/cli.ts verify',
  'node src/cli.ts record',
  'node src/cli.ts reconcile',
  'node scripts/check-method.mjs --packs',
  'node scripts/audit-session.mjs',
];

function parseRoot(argv) {
  const index = argv.indexOf('--root');
  if (index === -1) return ROOT;
  const value = argv[index + 1];
  if (!value) throw new Error('--root needs a directory');
  return resolve(value);
}

function check(root) {
  const errors = [];
  const file = join(root, 'docs/workflow.md');
  if (!existsSync(file)) return [`${file}: missing`];
  const text = readFileSync(file, 'utf8');
  for (const section of SECTIONS) {
    if (!text.includes(section)) errors.push(`missing section ${section}`);
  }
  for (const branch of BRANCHES) {
    if (!text.includes(branch)) errors.push(`missing branch ${branch}`);
  }
  for (const command of COMMANDS) {
    if (!text.includes(command)) errors.push(`missing command ${command}`);
  }
  const zh = join(root, 'docs/workflow.zh.md');
  if (!existsSync(zh)) {
    errors.push(`${zh}: missing Chinese companion`);
  } else {
    const first = readFileSync(zh, 'utf8').split(/\r?\n/, 1)[0] ?? '';
    if (!first.includes('translation of docs/workflow.md')) {
      errors.push(`${zh}: missing a translation header`);
    }
  }
  return errors;
}

let root;
try {
  root = parseRoot(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

if (process.exitCode !== 1) {
  const errors = check(root);
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`workflow: ${error}`));
    process.exitCode = 1;
  } else {
    console.log('workflow: ok');
  }
}
