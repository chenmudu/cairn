import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const REVIEW = (overrides: Record<string, unknown> = {}) => ({
  reviewer: 'fresh context',
  context: 'fresh',
  artifact: 'evidence/review.json',
  verdict: 'pass',
  findings: ['no drift'],
  packs: PACKS,
  coverage: [
    {
      criterion: 'F1',
      tasks: ['T-001'],
      evidence: [{ gate: 'gate', path: 'evidence/T-001/gate.json' }],
      verdict: 'pass',
    },
    { criterion: 'F2', tasks: ['T-002'], evidence: [{ path: 'evidence/review.json' }], verdict: 'pass' },
    { criterion: 'F3', tasks: ['T-003'], evidence: [{ path: 'evidence/review.json' }], verdict: 'pass' },
  ],
  non_goals: [{ non_goal: 'No UI', verdict: 'pass', evidence: ['evidence/review.json'] }],
  cold_start: {
    reviewer: 'fresh context',
    artifact: 'evidence/review.json',
    verdict: 'pass',
  },
  ui_surface: 'none',
  ...overrides,
});

function writeArtifact(dir: string): void {
  mkdirSync(join(dir, 'evidence'), { recursive: true });
  writeFileSync(join(dir, 'evidence', 'review.json'), '{}\n');
}

test('accepts a complete review and preserves extra fields', (t) => {
  const dir = makeTempMission(t);
  writeArtifact(dir);
  const event = recordReview(dir, {
    ...REVIEW({ extra: 'kept' }),
    reviewer: 'fresh context',
  });
  assert.equal(event.event, 'review_result');
  assert.equal(event.actor, 'cairn');
  assert.equal(event.data.reviewer, 'fresh context');
  assert.equal(event.data.context, 'fresh');
  assert.equal(event.data.ui_surface, 'none');
  assert.deepEqual(event.data.packs, PACKS);
  assert.equal(event.data.extra, 'kept');

  const lines = readFileSync(join(dir, 'ledger.jsonl'), 'utf8').trim().split('\n');
  assert.equal(JSON.parse(lines[0]).event, 'review_result');
});

test('records a review against a known task', (t) => {
  const dir = makeTempMission(t);
  writeArtifact(dir);
  const event = recordReview(dir, { ...REVIEW(), task: 'T-001', verdict: 'fail' });
  assert.equal(event.task, 'T-001');
  assert.equal(event.data.verdict, 'fail');
});

test('refuses an unknown task and writes nothing', (t) => {
  const dir = makeTempMission(t);
  writeArtifact(dir);
  const before = readFileSync(join(dir, 'ledger.jsonl'), 'utf8');
  assert.throws(
    () => recordReview(dir, { ...REVIEW(), task: 'T-999' }),
    /unknown task/,
  );
  assert.equal(readFileSync(join(dir, 'ledger.jsonl'), 'utf8'), before);
});

test('refuses a review missing a reviewer or verdict', () => {
  assert.deepEqual(validateReview(REVIEW({ reviewer: undefined })), [
    'reviewer must be a non-empty string',
  ]);
  assert.deepEqual(validateReview(REVIEW({ verdict: 'maybe' })), [
    'verdict must be pass or fail',
  ]);
});

test('refuses findings that are not a list of strings', () => {
  assert.deepEqual(validateReview(REVIEW({ findings: [1] })), [
    'findings must be a list of non-empty strings',
  ]);
});

test('refuses a review without pack records', () => {
  assert.deepEqual(validateReview(REVIEW({ packs: undefined })), [
    'packs must be a non-empty list',
  ]);
});

test('refuses a not-applicable pack without a reason', () => {
  const packs = [{ ...PACKS[1], reason: '' }];
  assert.deepEqual(validateReview(REVIEW({ packs })), [
    'packs[0]: not-applicable requires a reason',
  ]);
});

test('refuses an unknown pack name or mode', () => {
  const packs = [{ ...PACKS[0], pack: 'other', mode: 'used' }];
  assert.deepEqual(validateReview(REVIEW({ packs })), [
    'packs[0]: pack must be superpowers or impeccable',
    'packs[0]: mode must be use, human-in-loop, not-applicable, or absent',
  ]);
});

test('accepts an absent pack with the floor as evidence', () => {
  const packs = [{ ...PACKS[0], mode: 'absent', evidence: 'gate: node --test' }];
  assert.deepEqual(validateReview(REVIEW({ packs })), []);
});

test('refuses every missing review field the close rule names', () => {
  for (const field of [
    'reviewer',
    'context',
    'artifact',
    'verdict',
    'findings',
    'packs',
    'coverage',
    'non_goals',
    'cold_start',
    'ui_surface',
  ]) {
    const value: Record<string, unknown> = REVIEW();
    delete value[field];
    const errors = validateReview(value);
    assert.ok(
      errors.some((error) => error.toLowerCase().includes(field)),
      `${field} was not refused: ${errors.join('; ')}`,
    );
  }
});

test('refuses an invalid context or ui_surface', () => {
  assert.deepEqual(validateReview(REVIEW({ context: 'remote' })), [
    'context must be fresh or coordinator',
  ]);
  assert.deepEqual(validateReview(REVIEW({ ui_surface: 'maybe' })), [
    'ui_surface must be none or present',
  ]);
});

test('refuses coverage that is not a list of entries', () => {
  assert.deepEqual(validateReview(REVIEW({ coverage: { F1: 'T-001' } })), [
    'coverage must be a list of entries',
  ]);
});

test('refuses coverage evidence that is not a list of references', () => {
  const coverage = [{ criterion: 'F1', tasks: ['T-001'], evidence: ['raw'], verdict: 'pass' }];
  assert.deepEqual(validateReview(REVIEW({ coverage })), [
    'coverage[0].evidence[0] must be an object',
  ]);
});

test('requires coverage for every acceptance id and no duplicates', (t) => {
  const dir = makeTempMission(t);
  writeArtifact(dir);
  const partial = REVIEW().coverage.slice(0, 2);
  assert.throws(
    () => recordReview(dir, { ...REVIEW(), coverage: partial }),
    /coverage must name every acceptance criterion: missing F3/,
  );
  const duplicate = [
    ...REVIEW().coverage,
    { criterion: 'F1', tasks: ['T-001'], evidence: [{ path: 'evidence/review.json' }], verdict: 'pass' },
  ];
  assert.throws(
    () => recordReview(dir, { ...REVIEW(), coverage: duplicate }),
    /coverage names F1 more than once/,
  );
  const unknown = [
    ...REVIEW().coverage,
    { criterion: 'F9', tasks: ['T-001'], evidence: [{ path: 'evidence/review.json' }], verdict: 'pass' },
  ];
  assert.throws(
    () => recordReview(dir, { ...REVIEW(), coverage: unknown }),
    /coverage names unknown acceptance F9/,
  );
});

test('refuses a review whose artifact is not an evidence file', (t) => {
  const dir = makeTempMission(t);
  writeArtifact(dir);
  assert.throws(
    () => recordReview(dir, { ...REVIEW(), artifact: 'evidence/missing.json' }),
    /artifact is not a file in the mission/,
  );
});
