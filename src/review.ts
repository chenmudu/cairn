import { appendEvent, nextTimestamp, type LedgerEvent } from './ledger.ts';
import { loadMission } from './plan.ts';

export type Verdict = 'pass' | 'fail';

export interface ReviewInput {
  reviewer: string;
  verdict: Verdict;
  findings: string[];
  task?: string;
  [key: string]: unknown;
}

/**
 * The review record is a report, not a gate. It preserves any extra fields the
 * reviewer supplies (coverage, cold start, pack records) and only judges the
 * three fields the protocol already names.
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
  if (input.task !== undefined && (typeof input.task !== 'string' || input.task === '')) {
    errors.push('task must be a non-empty string when present');
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
