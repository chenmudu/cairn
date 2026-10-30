import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recordReview, validateReview } from '../src/review.ts';
import { makeTempMission } from './helpers.mjs';

const PACKS = [
  {
    capability: 'test-first',
    pack: 'superpowers',
    version: '7.0.1',
    mode: 'use',
    evidence: 'test/review.test.ts',
  },
  {
    capability: 'design-review',
    pack: 'impeccable',
    version: '4.8.0+df3a4ab',
    mode: 'not-applicable',
    reason: 'no markup or URL',
    evidence: 'README.md criteria-based review',
  },
];

test('accepts a reviewer, verdict, findings, and packs; preserves extra fields', (t) => {
  const dir = makeTempMission(t);
  const event = recordReview(dir, {
    reviewer: 'fresh context',
    verdict: 'pass',
    findings: ['no drift'],
    packs: PACKS,
    coverage: { F1: 'T-001' },
  });
  assert.equal(event.event, 'review_result');
  assert.equal(event.actor, 'cairn');
  assert.equal(event.data.reviewer, 'fresh context');
  assert.deepEqual(event.data.packs, PACKS);
  assert.deepEqual(event.data.coverage, { F1: 'T-001' });

  const lines = readFileSync(join(dir, 'ledger.jsonl'), 'utf8').trim().split('\n');
  assert.equal(JSON.parse(lines[0]).event, 'review_result');
});

test('records a review against a known task', (t) => {
  const dir = makeTempMission(t);
  const event = recordReview(dir, {
    task: 'T-001',
    reviewer: 'fresh context',
    verdict: 'fail',
    findings: ['gate missing'],
    packs: PACKS,
  });
  assert.equal(event.task, 'T-001');
});

test('refuses an unknown task and writes nothing', (t) => {
  const dir = makeTempMission(t);
  const before = readFileSync(join(dir, 'ledger.jsonl'), 'utf8');
  assert.throws(
    () =>
      recordReview(dir, {
        task: 'T-999',
        reviewer: 'fresh context',
        verdict: 'pass',
        findings: [],
        packs: PACKS,
      }),
    /unknown task/,
  );
  assert.equal(readFileSync(join(dir, 'ledger.jsonl'), 'utf8'), before);
});

test('refuses a review missing a reviewer or verdict', () => {
  assert.deepEqual(validateReview({ verdict: 'pass', findings: [], packs: PACKS }), [
    'reviewer must be a non-empty string',
  ]);
  assert.deepEqual(validateReview({ reviewer: 'x', verdict: 'maybe', findings: [], packs: PACKS }), [
    'verdict must be pass or fail',
  ]);
});

test('refuses findings that are not a list of strings', () => {
  assert.deepEqual(validateReview({ reviewer: 'x', verdict: 'pass', findings: [1], packs: PACKS }), [
    'findings must be a list of non-empty strings',
  ]);
});

test('refuses a review without pack records', () => {
  assert.deepEqual(validateReview({ reviewer: 'x', verdict: 'pass', findings: [] }), [
    'packs must be a non-empty list',
  ]);
});

test('refuses a not-applicable pack without a reason', () => {
  const packs = [{ ...PACKS[1], reason: '' }];
  assert.deepEqual(
    validateReview({ reviewer: 'x', verdict: 'pass', findings: [], packs }),
    ['packs[0]: not-applicable requires a reason'],
  );
});

test('refuses an unknown pack name or mode', () => {
  const packs = [{ ...PACKS[0], pack: 'other', mode: 'used' }];
  assert.deepEqual(
    validateReview({ reviewer: 'x', verdict: 'pass', findings: [], packs }),
    ['packs[0]: pack must be superpowers or impeccable', 'packs[0]: mode must be use, human-in-loop, not-applicable, or absent'],
  );
});

test('accepts an absent pack with the floor as evidence', () => {
  const packs = [{ ...PACKS[0], mode: 'absent', evidence: 'gate: node --test' }];
  assert.deepEqual(validateReview({ reviewer: 'x', verdict: 'pass', findings: [], packs }), []);
});
