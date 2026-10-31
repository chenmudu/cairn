import { coverage, loadMission, taskState, type MissionDocuments } from './plan.ts';
import { validateMissionPacks } from './packs.ts';
import { checkEvidence, isEvidenceFile } from './verify.ts';
import { validateReview } from './review.ts';
import type { LedgerEvent } from './ledger.ts';

export interface AcceptanceEvidence {
  id: string;
  tasks: string[];
  evidence: string[];
}

export interface CompleteReport {
  ok: boolean;
  errors: string[];
  acceptance: AcceptanceEvidence[];
}

/**
 * What `mission_done` needs: every task done, every criterion covered by a done
 * task, every blocking gate backed by evidence, a passing review newer than the
 * last task, per-criterion review evidence, and a human authorization after
 * that review. The report is pure; the CLI appends the event.
 */
export function completeMission(missionDir: string): CompleteReport {
  const doc = loadMission(missionDir);
  const errors: string[] = [];

  if (doc.events.some((event) => event.event === 'mission_done')) {
    errors.push('mission is already done');
  }
  if (doc.plan.tasks.length === 0) errors.push('plan has no tasks');

  for (const task of doc.plan.tasks) {
    if (taskState(task, doc.events) !== 'done') errors.push(`${task.id}: not done`);
  }

  const map = coverage(doc.plan, doc.mission);
  for (const [id, taskIds] of Object.entries(map)) {
    if (taskIds.length === 0) errors.push(`acceptance ${id}: uncovered`);
  }

  const done = new Set(
    doc.events
      .filter((event) => event.event === 'task_done' && typeof event.task === 'string')
      .map((event) => event.task),
  );
  for (const task of doc.plan.tasks) {
    if (!done.has(task.id)) continue;
    for (const error of checkEvidence(missionDir, task, doc.events)) errors.push(error);
  }

  const lastTask = doc.events.filter((event) => event.event === 'task_done').at(-1);
  const lastReview = doc.events.filter((event) => event.event === 'review_result').at(-1);
  if (!lastReview) {
    errors.push('no review_result recorded');
  } else {
    if (lastReview.data.verdict !== 'pass') {
      errors.push(`latest review_result is ${String(lastReview.data.verdict)}`);
    }
    if (lastTask && Date.parse(lastReview.ts) <= Date.parse(lastTask.ts)) {
      errors.push('latest review_result is not after the last task_done');
    }
    errors.push(
      ...validateReview(lastReview.data, {
        missionDir,
        acceptance: doc.mission.acceptance.map((criterion) => criterion.id),
      }),
    );
    errors.push(...checkReviewEvidence(missionDir, doc, lastReview));
    errors.push(...checkAuthorization(doc.events, lastReview));
  }

  errors.push(...validateMissionPacks(missionDir, doc.plan, doc.events, lastReview));

  const acceptance = doc.mission.acceptance.map((criterion) => {
    const tasks = (map[criterion.id] ?? []).filter((id) => done.has(id));
    const evidence = doc.events
      .filter(
        (event) =>
          event.event === 'task_done' &&
          typeof event.task === 'string' &&
          tasks.includes(event.task),
      )
      .flatMap((event) => (Array.isArray(event.data.gates) ? event.data.gates : []))
      .map((gate) =>
        gate !== null && typeof gate === 'object' && typeof gate.evidence === 'string'
          ? gate.evidence
          : '',
      )
      .filter((path) => path !== '');
    return { id: criterion.id, tasks, evidence };
  });

  return { ok: errors.length === 0, errors, acceptance };
}

/**
 * Every artifact a review names must exist and every gate reference must point
 * at an exit-0 result for a task that serves the criterion. A task link alone
 * is not evidence.
 */
function checkReviewEvidence(
  missionDir: string,
  doc: MissionDocuments,
  review: LedgerEvent,
): string[] {
  const errors: string[] = [];
  const data = isRecord(review.data) ? review.data : {};
  const done = new Set(
    doc.events
      .filter((event) => event.event === 'task_done' && typeof event.task === 'string')
      .map((event) => event.task),
  );

  const coverageEntries = Array.isArray(data.coverage) ? data.coverage : [];
  for (const entry of coverageEntries) {
    if (!isRecord(entry)) continue;
    const criterion = typeof entry.criterion === 'string' ? entry.criterion : '(unnamed)';
    const tasks = Array.isArray(entry.tasks)
      ? entry.tasks.filter((task): task is string => typeof task === 'string')
      : [];

    for (const taskId of tasks) {
      const task = doc.plan.tasks.find((candidate) => candidate.id === taskId);
      if (!task) {
        errors.push(`coverage ${criterion}: task ${taskId} is not in plan.md`);
      } else if (!done.has(taskId)) {
        errors.push(`coverage ${criterion}: task ${taskId} is not done`);
      } else if (!Array.isArray(task.serves) || !task.serves.includes(criterion)) {
        errors.push(`coverage ${criterion}: task ${taskId} does not serve it`);
      }
    }

    if (entry.verdict !== 'pass') {
      errors.push(`coverage ${criterion}: verdict is ${String(entry.verdict)}, not pass`);
    }

    const refs = Array.isArray(entry.evidence) ? entry.evidence : [];
    if (refs.length === 0) errors.push(`coverage ${criterion}: no evidence`);
    for (const ref of refs) {
      if (!isRecord(ref) || typeof ref.path !== 'string') continue;
      if (!isEvidenceFile(missionDir, ref.path)) {
        errors.push(`coverage ${criterion}: artifact missing: ${ref.path}`);
        continue;
      }
      if (typeof ref.gate === 'string') {
        const passing = doc.events.some(
          (event) =>
            event.event === 'gate_result' &&
            typeof event.task === 'string' &&
            tasks.includes(event.task) &&
            isRecord(event.data) &&
            event.data.gate === ref.gate &&
            event.data.evidence === ref.path &&
            event.data.exit_code === 0,
        );
        if (!passing) {
          errors.push(
            `coverage ${criterion}: gate ${ref.gate} has no exit 0 result for ${ref.path}`,
          );
        }
      }
    }
  }

  const nonGoals = Array.isArray(data.non_goals) ? data.non_goals : [];
  for (const entry of nonGoals) {
    if (!isRecord(entry)) continue;
    const name = typeof entry.non_goal === 'string' ? entry.non_goal : '(unnamed)';
    if (entry.verdict !== 'pass') {
      errors.push(`non_goals ${name}: verdict is ${String(entry.verdict)}, not pass`);
    }
    const refs = Array.isArray(entry.evidence) ? entry.evidence : [];
    if (refs.length === 0) errors.push(`non_goals ${name}: no evidence`);
    for (const path of refs) {
      if (typeof path !== 'string' || !isEvidenceFile(missionDir, path)) {
        errors.push(`non_goals ${name}: artifact missing: ${String(path)}`);
      }
    }
  }

  if (isRecord(data.cold_start)) {
    if (data.cold_start.verdict !== 'pass') {
      errors.push(`cold_start: verdict is ${String(data.cold_start.verdict)}, not pass`);
    }
    if (
      typeof data.cold_start.artifact !== 'string' ||
      !isEvidenceFile(missionDir, data.cold_start.artifact)
    ) {
      errors.push(`cold_start: artifact missing: ${String(data.cold_start.artifact)}`);
    }
  }

  if (typeof data.artifact !== 'string' || !isEvidenceFile(missionDir, data.artifact)) {
    errors.push(`review artifact missing: ${String(data.artifact)}`);
  }

  return errors;
}

/**
 * The reviewer proves the work; the human authorizes the close. The event is
 * the union of D2 and D8 in decision 0007, and it must follow the last review.
 */
function checkAuthorization(events: LedgerEvent[], lastReview: LedgerEvent): string[] {
  const missionAuths = events.filter(
    (event) =>
      event.event === 'authorization' &&
      isRecord(event.data) &&
      event.data.scope === 'mission_done',
  );
  if (missionAuths.length === 0) {
    return ['mission_done requires a human authorization event with scope mission_done after the last review'];
  }

  const errors: string[] = [];
  for (const auth of missionAuths) {
    if (auth.data.approved_by !== 'human') {
      errors.push('authorization approved_by must be human');
    }
    if (!nonEmpty(auth.data.why)) {
      errors.push('authorization requires a non-empty why');
    }
    if (!nonEmpty(auth.data.date)) {
      errors.push('authorization requires a non-empty date');
    }
    if (
      auth.data.paths !== undefined &&
      (!Array.isArray(auth.data.paths) ||
        auth.data.paths.some((path) => !nonEmpty(path)))
    ) {
      errors.push('authorization.paths must be a list of non-empty strings');
    }
  }
  const afterReview = missionAuths.some(
    (auth) => Date.parse(auth.ts) > Date.parse(lastReview.ts),
  );
  if (!afterReview) {
    errors.push(
      'mission_done requires a human authorization event with scope mission_done after the last review',
    );
  }
  return errors;
}

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
