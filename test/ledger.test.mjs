import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { appendEvent, nextTimestamp, readLedger } from '../src/ledger.ts';

const repo = resolve(import.meta.dirname, '..');

function tempLedger(t, text = '') {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-ledger-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'ledger.jsonl'), text);
  return dir;
}

test('reads the real ledger', () => {
  const events = readLedger(join(repo, '.cairn', 'missions', '000-bootstrap'));
  assert.ok(events.length > 0);
  assert.ok(events.some((event) => event.event === 'task_done'));
});

test('appends one line per event and fsyncs', (t) => {
  const dir = tempLedger(t);
  const first = appendEvent(dir, {
    ts: '2026-10-31T00:00:00.000Z',
    event: 'note',
    mission: 'temp-mission',
    actor: 'test',
    data: { text: 'first' },
  });
  const second = appendEvent(dir, {
    ts: '2026-10-31T00:00:01.000Z',
    event: 'note',
    mission: 'temp-mission',
    actor: 'test',
    data: { text: 'second' },
  });

  const lines = readFileSync(join(dir, 'ledger.jsonl'), 'utf8').trim().split(/\r?\n/);
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]), first);
  assert.deepEqual(JSON.parse(lines[1]), second);
});

test('rejects a non-monotonic timestamp', (t) => {
  const dir = tempLedger(t);
  appendEvent(dir, {
    ts: '2026-10-31T00:00:01.000Z',
    event: 'note',
    mission: 'temp-mission',
    actor: 'test',
    data: {},
  });
  assert.throws(
    () =>
      appendEvent(dir, {
        ts: '2026-10-31T00:00:01.000Z',
        event: 'note',
        mission: 'temp-mission',
        actor: 'test',
        data: {},
      }),
    /non-monotonic/,
  );
});

test('accepts mission_amended with old and new hashes', (t) => {
  const dir = tempLedger(t);
  const event = appendEvent(dir, {
    ts: '2026-10-31T00:00:00.000Z',
    event: 'mission_amended',
    mission: 'temp-mission',
    actor: 'cairn',
    data: {
      old: { 'plan.md': `sha256:${'a'.repeat(64)}` },
      new: { 'plan.md': `sha256:${'b'.repeat(64)}` },
      acceptance: ['A1'],
      why: 'test the event',
      approved_by: 'cairn',
    },
  });
  assert.equal(event.event, 'mission_amended');
  assert.equal(readLedger(dir)[0].data.approved_by, 'cairn');
});

test('nextTimestamp is strictly after the last event', () => {
  const ts = nextTimestamp([
    {
      ts: '2099-01-01T00:00:00.000Z',
      event: 'note',
      mission: 'm',
      actor: 'test',
      data: {},
    },
  ]);
  assert.ok(Date.parse(ts) > Date.parse('2099-01-01T00:00:00.000Z'));
});
