import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkBilingual } from '../scripts/check-bilingual.mjs';

const repo = resolve(import.meta.dirname, '..');

function makeRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'cairn-bilingual-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, path, content = 'text\n') {
  const file = join(root, path);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
  return file;
}

test('reports a mission contract without a Chinese companion', (t) => {
  const root = makeRoot(t);
  write(root, 'README.md');
  write(root, 'README.zh-CN.md', '<!-- translation of README.md -->\n');
  write(root, '.cairn/missions/001/mission.md');
  write(root, '.cairn/missions/001/plan.md');
  write(root, '.cairn/missions/001/policy.md');

  const report = checkBilingual(root);
  assert.equal(report.ok, false);
  assert.deepEqual(report.missing.sort(), [
    '.cairn/missions/001/mission.md',
    '.cairn/missions/001/plan.md',
    '.cairn/missions/001/policy.md',
  ]);
});

test('accepts a complete pair set and ignores docs/i18n.md', (t) => {
  const root = makeRoot(t);
  write(root, 'README.md');
  write(root, 'README.zh-CN.md', '<!-- translation of README.md -->\n');
  write(root, 'docs/i18n.md');
  write(root, 'docs/a.md');
  write(root, 'docs/a.zh.md', '<!-- translation of docs/a.md -->\n');
  write(root, 'templates/t.md');
  write(root, 'templates/t.zh.md', '<!-- translation of templates/t.md -->\n');
  write(root, '.cairn/missions/001/mission.md');
  write(root, '.cairn/missions/001/mission.zh.md', '<!-- translation of mission.md -->\n');
  write(root, '.cairn/missions/001/plan.md');
  write(root, '.cairn/missions/001/plan.zh.md', '<!-- translation of plan.md -->\n');
  write(root, '.cairn/missions/001/policy.md');
  write(root, '.cairn/missions/001/policy.zh.md', '<!-- translation of policy.md -->\n');
  write(root, '.cairn/missions/001/inbox/0001.md');
  write(root, '.cairn/missions/001/inbox/0001.zh.md', '<!-- translation of 0001.md -->\n');
  write(root, '.zcode/skills/demo/SKILL.md');
  write(root, '.zcode/skills/demo/SKILL.zh.md', '<!-- translation of SKILL.md -->\n');

  assert.equal(checkBilingual(root).ok, true);
});

test('reports an inbox decision without a Chinese companion', (t) => {
  const root = makeRoot(t);
  write(root, 'README.md');
  write(root, 'README.zh-CN.md', '<!-- translation of README.md -->\n');
  write(root, '.cairn/missions/001/mission.md');
  write(root, '.cairn/missions/001/mission.zh.md', '<!-- translation of mission.md -->\n');
  write(root, '.cairn/missions/001/plan.md');
  write(root, '.cairn/missions/001/plan.zh.md', '<!-- translation of plan.md -->\n');
  write(root, '.cairn/missions/001/policy.md');
  write(root, '.cairn/missions/001/policy.zh.md', '<!-- translation of policy.md -->\n');
  write(root, '.cairn/missions/001/inbox/0001.md');

  const report = checkBilingual(root);
  assert.equal(report.ok, false);
  assert.deepEqual(report.missing, ['.cairn/missions/001/inbox/0001.md']);
});

test('rejects a companion without a translation header', (t) => {
  const root = makeRoot(t);
  write(root, 'README.md');
  write(root, 'README.zh-CN.md', '# no header\n');

  const report = checkBilingual(root);
  assert.equal(report.ok, false);
  assert.deepEqual(report.missingHeader, ['README.zh-CN.md']);
});

test('checks method documentation, including nested README companions', (t) => {
  const root = makeRoot(t);
  write(root, 'README.md');
  write(root, 'README.zh-CN.md', '<!-- translation of README.md -->\n');
  write(root, 'method/README.md');
  write(root, 'method/README.zh.md', '<!-- translation of method/README.md -->\n');
  write(root, 'method/example/product.md');

  const report = checkBilingual(root);
  assert.equal(report.ok, false);
  assert.deepEqual(report.missing, ['method/example/product.md']);
});

test('the repository itself is fully paired', () => {
  const report = checkBilingual(repo);
  assert.equal(report.ok, true, `${report.missing.join(', ')} ${report.missingHeader.join(', ')}`);
});
