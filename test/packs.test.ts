import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectPacks, type PackReport } from '../src/packs.ts';
import { withPacks } from '../src/packet.ts';
import type { Packet } from '../src/plan.ts';

function workspace() {
  return mkdtempSync(join(tmpdir(), 'cairn-packs-'));
}

function superpowers(root: string, version = '7.0.1'): string {
  const dir = join(root, 'superpowers', version);
  mkdirSync(join(dir, 'skills'), { recursive: true });
  return dir;
}

function impeccable(root: string, options: { skill?: string; engine?: string } = {}): string {
  const dir = join(root, 'impeccable');
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\nversion: ${options.skill ?? '4.8.0'}\n---\n`);
  writeFileSync(join(dir, 'scripts/VERSION'), `${options.engine ?? '0.1.18'}\n`);
  return dir;
}

function engine(root: string, version = '0.1.18'): string {
  const dir = join(root, '.impeccable', 'bin', version);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, process.platform === 'win32' ? 'impeccable.exe' : 'impeccable');
  writeFileSync(file, '');
  return file;
}

test('reports both packs present with their versions and pins', () => {
  const root = workspace();
  try {
    const sp = superpowers(root);
    const imp = impeccable(root);
    const bin = engine(root);
    const report = detectPacks({
      home: root,
      platform: 'win32',
      env: {
        CAIRN_SUPERPOWERS_DIR: sp,
        CAIRN_IMPECCABLE_DIR: imp,
        CAIRN_IMPECCABLE_BIN: bin,
      },
    });
    assert.equal(report.packs.superpowers.status, 'present');
    assert.equal(report.packs.superpowers.version, '7.0.1');
    assert.equal(report.packs.impeccable.status, 'present');
    assert.equal(report.packs.impeccable.skill_version, '4.8.0');
    assert.equal(report.packs.impeccable.engine_version, '0.1.18');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reports both packs absent when the overrides point nowhere', () => {
  const root = workspace();
  try {
    const report = detectPacks({
      home: root,
      env: {
        CAIRN_SUPERPOWERS_DIR: join(root, 'missing/sp'),
        CAIRN_IMPECCABLE_DIR: join(root, 'missing/imp'),
        CAIRN_IMPECCABLE_BIN: join(root, 'missing/engine'),
      },
    });
    assert.equal(report.packs.superpowers.status, 'absent');
    assert.equal(report.packs.impeccable.status, 'absent');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reports a version mismatch instead of present', () => {
  const root = workspace();
  try {
    const sp = superpowers(root, '6.0.0');
    const imp = impeccable(root, { skill: '4.0.0', engine: '0.1.17' });
    const bin = engine(root, '0.1.17');
    const report = detectPacks({
      home: root,
      env: {
        CAIRN_SUPERPOWERS_DIR: sp,
        CAIRN_IMPECCABLE_DIR: imp,
        CAIRN_IMPECCABLE_BIN: bin,
      },
    });
    assert.equal(report.packs.superpowers.status, 'mismatch');
    assert.equal(report.packs.impeccable.status, 'mismatch');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reports a skill with no engine as not-invocable', () => {
  const root = workspace();
  try {
    const imp = impeccable(root);
    const report = detectPacks({
      home: root,
      env: {
        CAIRN_IMPECCABLE_DIR: imp,
        CAIRN_IMPECCABLE_BIN: join(root, 'missing/engine'),
        CAIRN_SUPERPOWERS_DIR: join(root, 'missing/sp'),
      },
    });
    assert.equal(report.packs.impeccable.status, 'not-invocable');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('invocable is a filesystem fact, so a packet marks use without proving a session call', () => {
  const root = workspace();
  try {
    const sp = superpowers(root);
    const report = detectPacks({
      home: root,
      platform: 'win32',
      env: {
        CAIRN_SUPERPOWERS_DIR: sp,
        CAIRN_IMPECCABLE_DIR: join(root, 'missing/imp'),
        CAIRN_IMPECCABLE_BIN: join(root, 'missing/engine'),
      },
    });
    // The directory exists, so detection reports present and invocable. The
    // CLI adapter can still list no plugin skills while the desktop session
    // resolves them; only a recorded session call proves invocability.
    assert.equal(report.packs.superpowers.status, 'present');
    assert.equal(report.packs.superpowers.invocable, true);
    const byPack = packs(withPacks(packet(['src/a.ts']), report));
    assert.equal(byPack.superpowers.mode, 'use');
    // The packet is an instruction, not a proof. `record` refuses a `use` entry
    // whose evidence does not name the skill, so the flag alone cannot be the
    // evidence.
    assert.match(byPack.superpowers.instruction, /test-driven-development/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function packet(files: string[]): Packet {
  return {
    mission: { id: 'm1', title: 'Mission' },
    task: { id: 'T1', title: 'Task', files, interfaces: {}, serves: ['A1'] },
    policy: {
      budgets: {},
      allowed_commands: ['node'],
      forbidden_commands: ['git push'],
      stop_conditions: [],
    },
    constraints: [],
    gates: [{ id: 'test', command: 'node', args: ['--test'], severity: 'block' }],
    ledger_tail: [],
    base: 'a'.repeat(40),
  };
}

const PRESENT: PackReport = {
  schema: 'cairn/packs@0.1',
  packs: {
    superpowers: {
      status: 'present',
      path: '/sp',
      version: '7.0.1',
      pin: '7.0.1',
      invocable: true,
    },
    impeccable: {
      status: 'present',
      path: '/imp',
      pin: '4.8.0',
      skill_version: '4.8.0',
      engine_version: '0.1.18',
      engine: '/imp/engine',
      invocable: true,
    },
  },
};

const ABSENT: PackReport = {
  schema: 'cairn/packs@0.1',
  packs: {
    superpowers: {
      status: 'absent',
      path: null,
      version: null,
      pin: '7.0.1',
      invocable: false,
    },
    impeccable: {
      status: 'absent',
      path: null,
      pin: '4.8.0',
      skill_version: null,
      engine_version: null,
      engine: null,
      invocable: false,
    },
  },
};

function packs(result: ReturnType<typeof withPacks>) {
  return Object.fromEntries(result.packs.map((entry) => [entry.pack, entry]));
}

test('injects test-first and a not-applicable design review for code files', () => {
  const result = withPacks(packet(['src/a.ts', 'test/a.test.ts']), PRESENT);
  assert.equal(result.packs.length, 2);
  const byPack = packs(result);
  assert.equal(byPack.superpowers.capability, 'test-first');
  assert.equal(byPack.superpowers.mode, 'use');
  assert.equal(byPack.superpowers.instruction, 'superpowers:test-driven-development');
  assert.equal(byPack.impeccable.mode, 'not-applicable');
  assert.match(byPack.impeccable.reason ?? '', /markup|URL/);
});

test('injects design-check for a UI file', () => {
  const result = withPacks(packet(['src/App.tsx']), PRESENT);
  const byPack = packs(result);
  assert.equal(byPack.superpowers.capability, 'test-first');
  assert.equal(byPack.impeccable.capability, 'design-check');
  assert.equal(byPack.impeccable.mode, 'use');
  assert.match(byPack.impeccable.instruction, /detect/);
});

test('injects verify-before-close and a not-applicable design review for docs', () => {
  const result = withPacks(packet(['docs/workflow.md']), PRESENT);
  const byPack = packs(result);
  assert.equal(byPack.superpowers.capability, 'verify-before-close');
  assert.equal(byPack.superpowers.mode, 'use');
  assert.equal(byPack.impeccable.capability, 'design-review');
  assert.equal(byPack.impeccable.mode, 'not-applicable');
});

test('marks both entries absent and keeps the fallback when no pack is installed', () => {
  const result = withPacks(packet(['src/a.ts']), ABSENT);
  for (const entry of result.packs) {
    assert.equal(entry.mode, 'absent');
    assert.ok(entry.fallback.text.length > 0);
    assert.ok(entry.version.length > 0);
  }
});
