import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkEnforcement } from '../scripts/check-enforcement.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const enTable = (last) => `# Drift control

## Failure modes

| # | Failure | Early signal | Mechanism | Enforced by |
|---|---|---|---|---|
| 1 | one | signal | mechanism | \`human\` |
| 2 | two | signal | mechanism | ${last} |
`;

const zhTable = (last) => `# 漂移控制

## 失败模式

| # | 失败 | 早期信号 | 机制 | 执行点 |
|---|---|---|---|---|
| 1 | 一 | 信号 | 机制 | \`human\` |
| 2 | 二 | 信号 | 机制 | ${last} |
`;

function makeRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'cairn-enforcement-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'test'), { recursive: true });
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(root, 'docs', 'drift-control.md'), enTable('`scripts/check.mjs`'));
  writeFileSync(join(root, 'docs', 'drift-control.zh.md'), zhTable('`scripts/check.mjs`'));
  writeFileSync(join(root, 'scripts', 'check.mjs'), 'export {};\n');
  writeFileSync(join(root, 'test', 'check.test.mjs'), '// fixture\n');
  writeFileSync(
    join(root, '.github', 'workflows', 'gates.yml'),
    '      - run: node scripts/check.mjs\n',
  );
  return root;
}

function rewrite(root, { en, zh } = {}) {
  if (en) writeFileSync(join(root, 'docs', 'drift-control.md'), en);
  if (zh) writeFileSync(join(root, 'docs', 'drift-control.zh.md'), zh);
}

test('the repository satisfies its enforcement map', () => {
  const report = checkEnforcement(repo);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.equal(report.rows, 15);
});

test('accepts a runnable map and human/review rows', (t) => {
  const report = checkEnforcement(makeRoot(t));
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.equal(report.human, 1);
});

test('rejects a historical task id', (t) => {
  const root = makeRoot(t);
  rewrite(root, { en: enTable('`T-003`'), zh: zhTable('`T-003`') });
  const report = checkEnforcement(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /historical task id/);
});

test('rejects a missing path', (t) => {
  const root = makeRoot(t);
  rewrite(root, { en: enTable('`scripts/missing.mjs`'), zh: zhTable('`scripts/missing.mjs`') });
  const report = checkEnforcement(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /does not exist/);
});

test('rejects a script run by neither CI nor a test', (t) => {
  const root = makeRoot(t);
  writeFileSync(join(root, '.github', 'workflows', 'gates.yml'), '');
  const report = checkEnforcement(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /run by neither CI nor a test/);
});

test('rejects bare prose in the enforcement cell', (t) => {
  const root = makeRoot(t);
  rewrite(root, { en: enTable('AGENTS + review'), zh: zhTable('AGENTS + review') });
  const report = checkEnforcement(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /must be a backticked path or human\/review/);
});

test('rejects an empty enforcement cell', (t) => {
  const root = makeRoot(t);
  rewrite(root, { en: enTable(''), zh: zhTable('') });
  const report = checkEnforcement(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /empty enforcement cell/);
});

test('rejects a test path that node --test will not run', (t) => {
  const root = makeRoot(t);
  writeFileSync(join(root, 'test', 'check.mjs'), 'export {};\n');
  rewrite(root, { en: enTable('`test/check.mjs`'), zh: zhTable('`test/check.mjs`') });
  const report = checkEnforcement(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /not a node --test file/);
});

test('rejects a path outside scripts and test', (t) => {
  const root = makeRoot(t);
  writeFileSync(join(root, 'docs', 'readme.md'), '# readme\n');
  rewrite(root, { en: enTable('`docs/readme.md`'), zh: zhTable('`docs/readme.md`') });
  const report = checkEnforcement(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /must be under scripts\/ or test\//);
});

test('rejects a path that escapes the repository', (t) => {
  const root = makeRoot(t);
  rewrite(root, { en: enTable('`../outside.mjs`'), zh: zhTable('`../outside.mjs`') });
  const report = checkEnforcement(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /must be repo-relative|escapes the repository/);
});

test('rejects a Chinese table with different tokens', (t) => {
  const root = makeRoot(t);
  rewrite(root, { zh: zhTable('`human`') });
  const report = checkEnforcement(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /enforcement tokens differ/);
});

test('rejects a missing table', (t) => {
  const root = makeRoot(t);
  rewrite(root, { en: '# no table\n' });
  const report = checkEnforcement(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /missing the failure-mode table/);
});

test('rejects a missing Chinese companion', (t) => {
  const root = makeRoot(t);
  rmSync(join(root, 'docs', 'drift-control.zh.md'));
  const report = checkEnforcement(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /drift-control\.zh\.md: missing/);
});
