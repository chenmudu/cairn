import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/check-example.mjs', import.meta.url));
const PRODUCT = `# Example product

## Problem

A reader cannot see what one tick leaves behind.

## Audience

A new operator.

## Promise

A short, verifiable example with a ledger and evidence.

## Non-goals

No UI and no scheduler.

## Acceptance

The checker exits 0 and the ledger has a passing gate.
`;

const PACKS = [
  {
    capability: 'design-review',
    pack: 'impeccable',
    version: '4.8.0+df3a4ab',
    mode: 'not-applicable',
    reason: 'no UI surface',
    evidence: 'criteria-based review',
  },
  {
    capability: 'test-first',
    pack: 'superpowers',
    version: '7.0.1',
    mode: 'use',
    evidence: 'test/example.test.mjs',
  },
];

function writeExample(root, options = {}) {
  const dir = join(root, 'example');
  mkdirSync(join(dir, 'evidence/E1'), { recursive: true });
  writeFileSync(
    join(dir, 'mission.md'),
    '---\nschema: cairn/mission@0.1\nid: example\ntitle: Example\nstatus: active\ncreated: 2026-10-31\nowner: fixture\nacceptance:\n  - id: A1\n    check: the example checker exits 0\n---\n\n# Example\n\n## Intent\n\nShow one tick.\n\n## Non-goals\n\nNo UI.\n\n## Acceptance\n\n- A1: the checker exits 0.\n',
  );
  writeFileSync(
    join(dir, 'plan.md'),
    '---\nschema: cairn/plan@0.1\nmission: example\ntasks:\n  - id: E1\n    title: Write the product\n    deps: []\n    risk: low\n    status: done\n    serves: [A1]\n    files:\n      - product.md\n    gates:\n      - id: example\n        command: node\n        args: ["scripts/check-example.mjs", "--product", "example"]\n        severity: block\n---\n\n# Plan\n',
  );
  writeFileSync(
    join(dir, 'policy.md'),
    '---\nschema: cairn/policy@0.1\nmission: example\nbudgets:\n  max_attempts_per_task: 1\nallowed_commands:\n  - node\nforbidden_commands:\n  - git push\nstop_conditions:\n  - irreversible_or_destructive\n---\n\n# Policy\n\nNo push. One task per tick.\n',
  );
  writeFileSync(join(dir, 'product.md'), options.product ?? PRODUCT);
  writeFileSync(join(dir, 'README.md'), '# Example\n\nThis is a recorded docs tick.\n');
  if (options.zh !== false) {
    writeFileSync(
      join(dir, 'README.zh.md'),
      '<!-- translation of method/examples/0001-docs-tick/README.md at the T6 commit; the English file is authoritative -->\n\n# 样例\n',
    );
  }
  const packs = options.packs ?? PACKS;
  const gateExit = options.gateExit ?? 0;
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
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
  const base = git('rev-parse', 'HEAD').stdout.trim();

  if (options.evidence !== false) {
    writeFileSync(join(dir, 'evidence/E1/example.json'), '{"exit_code":0}\n');
    assert.equal(git('add', '.').status, 0);
    assert.equal(commit('work').status, 0);
  }
  const head = git('rev-parse', 'HEAD').stdout.trim();

  const events = [
    {
      ts: '2026-10-31T00:00:00.000Z',
      event: 'mission_created',
      actor: 'cairn',
      mission: 'example',
      data: { artifacts: {}, approved_by: 'human' },
    },
    {
      ts: '2026-10-31T00:00:01.000Z',
      event: 'gate_result',
      task: 'E1',
      actor: 'cairn',
      mission: 'example',
      data: {
        gate: 'example',
        command: 'node scripts/check-example.mjs --product example',
        exit_code: gateExit,
        evidence: 'evidence/E1/example.json',
      },
    },
    {
      ts: '2026-10-31T00:00:02.000Z',
      event: 'task_done',
      task: 'E1',
      actor: 'cairn',
      mission: 'example',
      data: {
        base,
        head,
        commits: [head],
        gates: [{ id: 'example', exit_code: gateExit, evidence: 'evidence/E1/example.json' }],
      },
    },
    {
      ts: '2026-10-31T00:00:03.000Z',
      event: 'review_result',
      actor: 'cairn',
      mission: 'example',
      data: {
        reviewer: 'fresh context',
        verdict: 'pass',
        packs,
      },
    },
  ];
  writeFileSync(join(dir, 'ledger.jsonl'), `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
  assert.equal(git('add', '.').status, 0);
  assert.equal(commit('ledger').status, 0);
  return dir;
}

function run(dir) {
  return spawnSync(process.execPath, [SCRIPT, '--example', dir], {
    encoding: 'utf8',
  });
}

function withExample(options, body) {
  const root = mkdtempSync(join(tmpdir(), 'cairn-example-'));
  try {
    return body(writeExample(root, options));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('accepts a complete recorded example', () => {
  withExample({}, (dir) => {
    const result = run(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /example: ok/);
  });
});

test('rejects a product without an acceptance section', () => {
  withExample({ product: PRODUCT.replace('## Acceptance\n', '## Result\n') }, (dir) => {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Acceptance/);
  });
});

test('rejects a not-applicable pack record without a reason', () => {
  const packs = PACKS.map((pack) => ({ ...pack }));
  delete packs[0].reason;
  withExample({ packs }, (dir) => {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /reason/);
  });
});

test('rejects a task_done whose gate did not pass', () => {
  withExample({ gateExit: 1 }, (dir) => {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /exit_code/);
  });
});

test('rejects a missing gate evidence file', () => {
  withExample({ evidence: false }, (dir) => {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /evidence/);
  });
});
