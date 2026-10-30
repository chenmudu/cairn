import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/check-workflow.mjs', import.meta.url));

const GUIDE = `# One tick

## Roles

Owner, coordinator, executor, reviewer.

## The tick

\`\`\`sh
node scripts/goal-check.mjs
node src/cli.ts next
node src/cli.ts verify T5 --mission .cairn/missions/001-method-pack
node src/cli.ts record T5 --status done --mission .cairn/missions/001-method-pack
node src/cli.ts reconcile --mission .cairn/missions/001-method-pack
node scripts/check-method.mjs --packs
node scripts/audit-session.mjs
\`\`\`

## Human checkpoints

- Protocol amendment, destructive work, push, or a blocking question.

## Failure paths

- A failed gate stops the tick; a missing pack records the fallback.

## Packs

### Both packs

Use superpowers and Impeccable where they apply.

### Superpowers only

Use superpowers; Impeccable is not-applicable.

### Impeccable only

Use Impeccable only on a UI surface; the rest is floor.

### Neither pack

Use the floor everywhere; record absent, floor used.

## Done

Commit, blocking gate at exit 0, task_done.
`;

function fixture({ guide = GUIDE, zh = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cairn-workflow-'));
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs/workflow.md'), guide);
  if (zh) {
    writeFileSync(
      join(root, 'docs/workflow.zh.md'),
      '<!-- translation of docs/workflow.md at the T5 commit; the English file is authoritative -->\n\n# 一个 tick\n',
    );
  }
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [SCRIPT, '--root', root], {
    encoding: 'utf8',
  });
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test('accepts a complete operator guide', () => {
  const root = fixture();
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /workflow: ok/);
  } finally {
    cleanup(root);
  }
});

test('rejects a guide without human checkpoints', () => {
  const root = fixture({ guide: GUIDE.replace('## Human checkpoints', '## Checkpoints') });
  try {
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Human checkpoints/);
  } finally {
    cleanup(root);
  }
});

test('rejects a guide without the reconcile command', () => {
  const root = fixture({ guide: GUIDE.replace('node src/cli.ts reconcile --mission .cairn/missions/001-method-pack\n', '') });
  try {
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /reconcile/);
  } finally {
    cleanup(root);
  }
});

test('rejects a guide without the neither-pack branch', () => {
  const root = fixture({ guide: GUIDE.replace('### Neither pack', '### No pack') });
  try {
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Neither pack/);
  } finally {
    cleanup(root);
  }
});

test('rejects a guide without a Chinese companion', () => {
  const root = fixture({ zh: false });
  try {
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /companion/i);
  } finally {
    cleanup(root);
  }
});
