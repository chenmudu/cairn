import { coverage, loadMission, taskState } from './plan.ts';
import { validateMissionPacks } from './packs.ts';
import { checkEvidence } from './verify.ts';

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
 * task, every blocking gate backed by evidence, and a passing review newer than
 * the last task. The report is pure; the CLI appends the event.
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
