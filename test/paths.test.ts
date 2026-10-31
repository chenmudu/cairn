import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initMission, readConfig, resolveMission } from '../src/paths.ts';

function makeRoot(t: { after: (fn: () => void) => void }): string {
  const root = mkdtempSync(join(tmpdir(), 'cairn-paths-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function seed(root: string, relative: string): string {
  const dir = join(root, relative);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'mission.md'), 'seed\n');
  return dir;
}

test('a bare id resolves under .cairn/missions first', (t) => {
  const root = makeRoot(t);
  const dir = seed(root, '.cairn/missions/001-method-pack');
  assert.equal(resolveMission('001-method-pack', root), dir);
});

test('a legacy missions/<id> directory still resolves', (t) => {
  const root = makeRoot(t);
  const dir = seed(root, 'missions/legacy');
  assert.equal(resolveMission('legacy', root), dir);
});

test('an old missions/<path> prefers the migrated .cairn path', (t) => {
  const root = makeRoot(t);
  seed(root, 'missions/000-bootstrap');
  const migrated = seed(root, '.cairn/missions/000-bootstrap');
  assert.equal(resolveMission('missions/000-bootstrap', root), migrated);
});

test('the active mission comes from .cairn/config.json', (t) => {
  const root = makeRoot(t);
  const dir = seed(root, '.cairn/missions/002-active');
  mkdirSync(join(root, '.cairn'), { recursive: true });
  writeFileSync(
    join(root, '.cairn', 'config.json'),
    JSON.stringify({ layout_version: 1, active_mission: '002-active' }),
  );
  assert.equal(resolveMission(undefined, root), dir);
  assert.equal(readConfig(root)?.active_mission, '002-active');
});

test('without config, a legacy bootstrap mission is the fallback', (t) => {
  const root = makeRoot(t);
  const dir = seed(root, 'missions/000-bootstrap');
  assert.equal(resolveMission(undefined, root), dir);
});

test('an explicit path wins even when it is outside the repository', (t) => {
  const root = makeRoot(t);
  const dir = seed(root, 'custom/place');
  assert.equal(resolveMission(join(root, 'custom', 'place'), root), dir);
});

test('initMission scaffolds .cairn/missions/<id> and makes it active', (t) => {
  const root = makeRoot(t);
  const dir = initMission('003-new-mission', { root, title: 'New mission' });
  assert.equal(dir, join(root, '.cairn', 'missions', '003-new-mission'));
  for (const name of ['mission.md', 'plan.md', 'policy.md', 'ledger.jsonl']) {
    assert.ok(existsSync(join(dir, name)), `${name} must exist`);
  }
  assert.match(readFileSync(join(dir, 'mission.md'), 'utf8'), /title: New mission/);
  const events = readFileSync(join(dir, 'ledger.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'mission_created');
  assert.equal(events[0].data.owner, 'replace-me');
  assert.equal(events[0].data.approved_by, 'cairn');
  assert.equal(readConfig(root)?.active_mission, '003-new-mission');
  assert.equal(resolveMission(undefined, root), dir);
});

test('initMission refuses to overwrite an existing mission', (t) => {
  const root = makeRoot(t);
  initMission('003-new-mission', { root });
  assert.throws(() => initMission('003-new-mission', { root }), /already exists/);
});

test('initMission rejects an unsafe mission id', (t) => {
  const root = makeRoot(t);
  assert.throws(() => initMission('../escape', { root }), /invalid mission id/);
});
