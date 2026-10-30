import { appendEvent, nextTimestamp, type LedgerEvent } from './ledger.ts';
import { loadMission } from './plan.ts';

export type Verdict = 'pass' | 'fail';
export type PackMode = 'use' | 'human-in-loop' | 'not-applicable' | 'absent';

const PACKS = new Set(['superpowers', 'impeccable']);
const MODES = new Set<PackMode>(['use', 'human-in-loop', 'not-applicable', 'absent']);

export interface ReviewInput {
  reviewer: string;
  verdict: Verdict;
  findings: string[];
  packs: ReviewPack[];
  task?: string;
  [key: string]: unknown;
}

export interface ReviewPack {
  capability: string;
  pack: string;
  version: string;
  mode: PackMode;
  evidence: string;
  reason?: string;
}

/**
 * The review record is a report, not a gate. It preserves any extra fields the
 * reviewer supplies (coverage, cold start) and judges the fields the protocol
 * names. A pack report is required so "we forgot" is not a valid state.
 */
export function validateReview(input: unknown): string[] {
  if (!isRecord(input)) return ['review must be a JSON object'];
  const errors: string[] = [];
  if (typeof input.reviewer !== 'string' || input.reviewer.trim() === '') {
    errors.push('reviewer must be a non-empty string');
  }
  if (input.verdict !== 'pass' && input.verdict !== 'fail') {
    errors.push('verdict must be pass or fail');
  }
  if (
    !Array.isArray(input.findings) ||
    input.findings.some((finding) => typeof finding !== 'string' || finding.trim() === '')
  ) {
    errors.push('findings must be a list of non-empty strings');
  }
  if (!Array.isArray(input.packs) || input.packs.length === 0) {
    errors.push('packs must be a non-empty list');
  } else {
    input.packs.forEach((pack, index) => {
      errors.push(...packErrors(pack, `packs[${index}]`));
    });
  }
  if (input.task !== undefined && (typeof input.task !== 'string' || input.task === '')) {
    errors.push('task must be a non-empty string when present');
  }
  return errors;
}

function packErrors(value: unknown, where: string): string[] {
  if (!isRecord(value)) return [`${where}: must be an object`];
  const errors: string[] = [];
  for (const field of ['capability', 'pack', 'version', 'evidence']) {
    if (typeof value[field] !== 'string' || value[field].trim() === '') {
      errors.push(`${where}: missing ${field}`);
    }
  }
  if (typeof value.pack === 'string' && !PACKS.has(value.pack)) {
    errors.push(`${where}: pack must be superpowers or impeccable`);
  }
  if (typeof value.mode !== 'string' || !MODES.has(value.mode as PackMode)) {
    errors.push(`${where}: mode must be use, human-in-loop, not-applicable, or absent`);
  }
  if (
    value.mode === 'not-applicable' &&
    (typeof value.reason !== 'string' || value.reason.trim() === '')
  ) {
    errors.push(`${where}: not-applicable requires a reason`);
  }
  return errors;
}

export function recordReview(missionDir: string, input: unknown): LedgerEvent {
  const errors = validateReview(input);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  const review = input as ReviewInput;
  const doc = loadMission(missionDir);

  if (review.task !== undefined && !doc.plan.tasks.some((task) => task.id === review.task)) {
    throw new Error(`unknown task ${review.task}`);
  }

  const { task, ...data } = review;
  return appendEvent(doc.missionDir, {
    ts: nextTimestamp(doc.events),
    event: 'review_result',
    mission: doc.mission.id,
    task,
    actor: 'cairn',
    data,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
