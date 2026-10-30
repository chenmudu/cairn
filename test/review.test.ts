import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { recordReview, validateReview } from '../src/review.ts';
import { makeTempMission } from './helpers.mjs';

test('accepts a reviewer, verdict, and findings; preserves extra fields', (t) => {
  const dir = makeTempMission(t);
  const event = recordReview(dir, {
    reviewer: 'fresh context',
    verdict: 'pass',
    findings: ['no drift'],
    coverage: { F1: 'T-001' },
  });
  assert.equal(event.event, 'review_result');
  assert.equal(event.actor, 'cairn');
  assert.equal(event.data.reviewer, 'fresh context');
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
      }),
    /unknown task/,
  );
  assert.equal(readFileSync(join(dir, 'ledger.jsonl'), 'utf8'), before);
});

test('refuses a review missing a reviewer or verdict', () => {
  assert.deepEqual(validateReview({ verdict: 'pass', findings: [] }), [
    'reviewer must be a non-empty string',
  ]);
  assert.deepEqual(validateReview({ reviewer: 'x', verdict: 'maybe', findings: [] }), [
    'verdict must be pass or fail',
  ]);
});

test('refuses findings that are not a list of strings', () => {
  assert.deepEqual(validateReview({ reviewer: 'x', verdict: 'pass', findings: [1] }), [
    'findings must be a list of non-empty strings',
  ]);
});
