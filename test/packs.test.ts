import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectPacks } from '../src/packs.ts';

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
