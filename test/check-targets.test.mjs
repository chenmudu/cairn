import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkTargets } from '../scripts/check-targets.mjs';
import { makeTempMission } from './helpers.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function digest(file) {
  return `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`;
}

function makeRepo(t) {
  const root = mkdtempSync(join(tmpdir(), 'cairn-targets-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const fixture = makeTempMission(t);
  const missionDir = join(root, '.cairn', 'missions', '001-test');
  mkdirSync(missionDir, { recursive: true });
  cpSync(fixture, missionDir, { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'protocol.md'), '# protocol\n');

  const artifacts = {};
  for (const name of ['mission.md', 'policy.md', 'plan.md']) {
    artifacts[`.cairn/missions/001-test/${name}`] = digest(join(missionDir, name));
  }
  artifacts['docs/protocol.md'] = digest(join(root, 'docs', 'protocol.md'));
  writeLedger(missionDir, {
    ts: '2026-10-31T00:00:00.000Z',
    event: 'mission_created',
    mission: 'temp-mission',
    actor: 'test',
    data: { artifacts },
  });
  return { root, missionDir, artifacts };
}

function writeLedger(missionDir, event) {
  writeFileSync(join(missionDir, 'ledger.jsonl'), `${JSON.stringify(event)}\n`);
}

function appendLedger(missionDir, event) {
  const file = join(missionDir, 'ledger.jsonl');
  writeFileSync(file, `${readFileSync(file, 'utf8')}${JSON.stringify(event)}\n`);
}

test('the active mission satisfies its target hash chain', () => {
  const mission = join(repo, '.cairn', 'missions', '001-method-pack');
  const report = checkTargets(repo, mission);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.equal(report.checked, 4);
});

test('accepts a complete hash chain with mission-relative keys', (t) => {
  const { root, missionDir } = makeRepo(t);
  const report = checkTargets(root, missionDir);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.equal(report.checked, 4);
});

test('rejects a target file changed after the freeze', (t) => {
  const { root, missionDir } = makeRepo(t);
  writeFileSync(join(missionDir, 'mission.md'), readFileSync(join(missionDir, 'mission.md'), 'utf8') + '\nedited\n');
  const report = checkTargets(root, missionDir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /does not match the ledger/);
});

test('rejects a target that was never frozen', (t) => {
  const { root, missionDir, artifacts } = makeRepo(t);
  delete artifacts['docs/protocol.md'];
  writeLedger(missionDir, {
    ts: '2026-10-31T00:00:00.000Z',
    event: 'mission_created',
    mission: 'temp-mission',
    actor: 'test',
    data: { artifacts },
  });
  const report = checkTargets(root, missionDir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /docs\/protocol\.md was never frozen/);
});

test('rejects a missing target file', (t) => {
  const { root, missionDir } = makeRepo(t);
  rmSync(join(missionDir, 'policy.md'));
  const report = checkTargets(root, missionDir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /policy\.md: artifact is missing/);
});

test('rejects an amendment whose old hash does not match the chain', (t) => {
  const { root, missionDir } = makeRepo(t);
  appendLedger(missionDir, {
    ts: '2026-10-31T00:01:00.000Z',
    event: 'mission_amended',
    mission: 'temp-mission',
    actor: 'test',
    data: {
      old: { 'plan.md': 'sha256:0000000000000000000000000000000000000000000000000000000000000000' },
      new: { 'plan.md': digest(join(missionDir, 'plan.md')) },
    },
  });
  const report = checkTargets(root, missionDir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /does not match the chain/);
});

test('accepts a valid amendment and checks the new file', (t) => {
  const { root, missionDir } = makeRepo(t);
  const before = digest(join(missionDir, 'plan.md'));
  writeFileSync(join(missionDir, 'plan.md'), readFileSync(join(missionDir, 'plan.md'), 'utf8') + '\n# amended\n');
  const after = digest(join(missionDir, 'plan.md'));
  appendLedger(missionDir, {
    ts: '2026-10-31T00:01:00.000Z',
    event: 'mission_amended',
    mission: 'temp-mission',
    actor: 'test',
    data: { old: { 'plan.md': before }, new: { 'plan.md': after } },
  });
  const report = checkTargets(root, missionDir);
  assert.equal(report.ok, true, report.errors.join('\n'));
});

test('rejects an artifact key that escapes the repository', (t) => {
  const { root, missionDir, artifacts } = makeRepo(t);
  artifacts['../escape.md'] = digest(join(missionDir, 'mission.md'));
  writeLedger(missionDir, {
    ts: '2026-10-31T00:00:00.000Z',
    event: 'mission_created',
    mission: 'temp-mission',
    actor: 'test',
    data: { artifacts },
  });
  const report = checkTargets(root, missionDir);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /must be repo-relative/);
});
