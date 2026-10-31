import { appendEvent, nextTimestamp, type LedgerEvent } from './ledger.ts';
import { loadMission } from './plan.ts';
import { isEvidenceFile } from './verify.ts';

export type Verdict = 'pass' | 'fail';
export type PackMode = 'use' | 'human-in-loop' | 'not-applicable' | 'absent';
export type ReviewContext = 'fresh' | 'coordinator';
export type UiSurface = 'none' | 'present';

const PACKS = new Set(['superpowers', 'impeccable']);
const MODES = new Set<PackMode>(['use', 'human-in-loop', 'not-applicable', 'absent']);

export interface ReviewEvidence {
  gate?: string;
  path: string;
}

export interface ReviewCoverage {
  criterion: string;
  tasks: string[];
  evidence: ReviewEvidence[];
  verdict: Verdict;
}

export interface ReviewNonGoal {
  non_goal: string;
  verdict: Verdict;
  evidence: string[];
}

export interface ReviewColdStart {
  reviewer: string;
  artifact: string;
  verdict: Verdict;
}

export interface ReviewInput {
  reviewer: string;
  context: ReviewContext;
  artifact: string;
  verdict: Verdict;
  findings: string[];
  packs: ReviewPack[];
  coverage: ReviewCoverage[];
  non_goals: ReviewNonGoal[];
  cold_start: ReviewColdStart;
  ui_surface: UiSurface;
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

export interface ReviewOptions {
  missionDir?: string;
  acceptance?: string[];
  requireAll?: boolean;
}

/**
 * The review record is a report, not a gate. It preserves any extra fields the
 * reviewer supplies and judges every field the close rule names. A review that
 * only says "pass" is not evidence for a criterion.
 */
export function validateReview(input: unknown, options: ReviewOptions = {}): string[] {
  if (!isRecord(input)) return ['review must be a JSON object'];
  const errors: string[] = [];

  if (!nonEmpty(input.reviewer)) errors.push('reviewer must be a non-empty string');
  if (input.context !== 'fresh' && input.context !== 'coordinator') {
    errors.push('context must be fresh or coordinator');
  }
  if (!nonEmpty(input.artifact)) {
    errors.push('artifact must be a non-empty string');
  } else if (options.missionDir && !isEvidenceFile(options.missionDir, input.artifact)) {
    errors.push(`artifact is not a file in the mission: ${input.artifact}`);
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

  if (!Array.isArray(input.coverage)) {
    errors.push('coverage must be a list of entries');
  } else {
    input.coverage.forEach((entry, index) => {
      errors.push(...coverageErrors(entry, `coverage[${index}]`));
    });
    if (options.acceptance) {
      errors.push(
        ...coverageCompleteness(input.coverage, options.acceptance, options.requireAll !== false),
      );
    }
  }

  if (!Array.isArray(input.non_goals) || input.non_goals.length === 0) {
    errors.push('non_goals must be a non-empty list of entries');
  } else {
    input.non_goals.forEach((entry, index) => {
      errors.push(...nonGoalErrors(entry, `non_goals[${index}]`));
    });
  }

  if (!isRecord(input.cold_start)) {
    errors.push('cold_start must be an object');
  } else {
    errors.push(...coldStartErrors(input.cold_start, options.missionDir));
  }

  if (input.ui_surface !== 'none' && input.ui_surface !== 'present') {
    errors.push('ui_surface must be none or present');
  }
  if (input.task !== undefined && (typeof input.task !== 'string' || input.task === '')) {
    errors.push('task must be a non-empty string when present');
  }
  return errors;
}

function coverageErrors(value: unknown, where: string): string[] {
  if (!isRecord(value)) return [`${where}: must be an object`];
  const errors: string[] = [];
  if (!nonEmpty(value.criterion)) {
    errors.push(`${where}.criterion must be a non-empty string`);
  }
  if (
    !Array.isArray(value.tasks) ||
    value.tasks.length === 0 ||
    value.tasks.some((task) => !nonEmpty(task))
  ) {
    errors.push(`${where}.tasks must be a non-empty list of strings`);
  }
  if (!Array.isArray(value.evidence)) {
    errors.push(`${where}.evidence must be a list of { gate?, path } references`);
  } else {
    value.evidence.forEach((ref, index) => {
      if (!isRecord(ref)) {
        errors.push(`${where}.evidence[${index}] must be an object`);
        return;
      }
      if (!nonEmpty(ref.path)) {
        errors.push(`${where}.evidence[${index}].path must be a non-empty string`);
      }
      if (ref.gate !== undefined && !nonEmpty(ref.gate)) {
        errors.push(`${where}.evidence[${index}].gate must be a non-empty string when present`);
      }
    });
  }
  if (value.verdict !== 'pass' && value.verdict !== 'fail') {
    errors.push(`${where}.verdict must be pass or fail`);
  }
  return errors;
}

/**
 * A criterion the mission does not have, or one named twice, is always wrong.
 * Naming every criterion is only required of the closing review: an interim
 * review can only cover what the work has advanced so far.
 */
function coverageCompleteness(
  entries: unknown[],
  acceptance: string[],
  requireAll: boolean,
): string[] {
  const errors: string[] = [];
  const known = new Set(acceptance);
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!isRecord(entry) || !nonEmpty(entry.criterion)) continue;
    const criterion = entry.criterion as string;
    if (!known.has(criterion)) errors.push(`coverage names unknown acceptance ${criterion}`);
    if (seen.has(criterion)) errors.push(`coverage names ${criterion} more than once`);
    seen.add(criterion);
  }
  if (requireAll) {
    const missing = acceptance.filter((id) => !seen.has(id));
    if (missing.length > 0) {
      errors.push(`coverage must name every acceptance criterion: missing ${missing.join(', ')}`);
    }
  }
  return errors;
}

function nonGoalErrors(value: unknown, where: string): string[] {
  if (!isRecord(value)) return [`${where}: must be an object`];
  const errors: string[] = [];
  if (!nonEmpty(value.non_goal)) {
    errors.push(`${where}.non_goal must be a non-empty string`);
  }
  if (value.verdict !== 'pass' && value.verdict !== 'fail') {
    errors.push(`${where}.verdict must be pass or fail`);
  }
  if (
    !Array.isArray(value.evidence) ||
    value.evidence.length === 0 ||
    value.evidence.some((path) => !nonEmpty(path))
  ) {
    errors.push(`${where}.evidence must be a non-empty list of strings`);
  }
  return errors;
}

function coldStartErrors(value: Record<string, unknown>, missionDir?: string): string[] {
  const errors: string[] = [];
  if (!nonEmpty(value.reviewer)) {
    errors.push('cold_start.reviewer must be a non-empty string');
  }
  if (!nonEmpty(value.artifact)) {
    errors.push('cold_start.artifact must be a non-empty string');
  } else if (missionDir && !isEvidenceFile(missionDir, value.artifact)) {
    errors.push(`cold_start.artifact is not a file in the mission: ${value.artifact}`);
  }
  if (value.verdict !== 'pass' && value.verdict !== 'fail') {
    errors.push('cold_start.verdict must be pass or fail');
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
  const doc = loadMission(missionDir);
  const errors = validateReview(input, {
    missionDir: doc.missionDir,
    acceptance: doc.mission.acceptance.map((criterion) => criterion.id),
    requireAll: false,
  });
  if (errors.length > 0) throw new Error(errors.join('\n'));
  const review = input as ReviewInput;

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

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
