import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { buildPacket, type Packet } from '../src/plan.ts';
import { renderDispatch } from '../src/packet.ts';

const mission = resolve(import.meta.dirname, '..', '.cairn', 'missions', '000-bootstrap');

const packet: Packet = {
  mission: { id: 'm1', title: 'Mission one' },
  task: {
    id: 'T-001',
    title: 'Do the thing',
    files: ['src/a.ts'],
    interfaces: { produces: ['run(): void'] },
    serves: ['A1'],
  },
  policy: {
    budgets: { max_attempts_per_task: 3 },
    allowed_commands: ['node', 'git'],
    forbidden_commands: ['git push'],
    stop_conditions: ['irreversible_or_destructive'],
  },
  constraints: ['No network.'],
  gates: [{ id: 'test', command: 'node', args: ['--test'], severity: 'block' }],
  ledger_tail: [
    {
      ts: '2026-10-31T00:00:00.000Z',
      event: 'task_done',
      mission: 'm1',
      task: 'T-000',
      actor: 'cairn',
      data: {},
    },
  ],
  base: 'a'.repeat(40),
};

test('renderDispatch turns a packet into a complete dispatch brief', () => {
  const text = renderDispatch(packet);
  assert.match(text, /T-001/);
  assert.match(text, /Do the thing/);
  assert.match(text, /Mission one/);
  assert.match(text, /A1/);
  assert.match(text, /src\/a\.ts/);
  assert.match(text, /node --test/);
  assert.match(text, /No network\./);
  assert.ok(text.includes(packet.base));
  assert.match(text, /DONE_WITH_CONCERNS/);
  assert.match(text, /Never append to `ledger\.jsonl`/);
  assert.doesNotMatch(text, /\{\{[a-z_]+\}\}/);
});

test('the real T-004 packet carries its gates, files, and acceptance link', () => {
  const real = buildPacket(mission, 'T-004');
  const text = renderDispatch(real);
  assert.match(text, /T-004/);
  assert.match(text, /A3/);
  assert.match(text, /pnpm typecheck/);
  assert.match(text, /test\/packet\.test\.ts/);
  assert.ok(text.includes(real.base));
  assert.doesNotMatch(text, /\{\{[a-z_]+\}\}/);
});
