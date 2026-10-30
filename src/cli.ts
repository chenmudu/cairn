#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { appendEvent, nextTimestamp } from './ledger.ts';
import {
  buildPacket,
  gitCount,
  gitHead,
  gitParent,
  loadMission,
  nextTask,
  statusReport,
  taskState,
  type StatusReport,
} from './plan.ts';
import { checkEvidence, verifyTask } from './verify.ts';
import { reconcileMission } from './reconcile.ts';
import { completeMission } from './complete.ts';
import { initMission, resolveMission } from './paths.ts';

const USAGE = `usage:
  cairn init <id> [--title <title>]
  cairn status [--json] [--mission <dir>]
  cairn next [--mission <dir>]
  cairn verify <task> [--mission <dir>]
  cairn reconcile [--mission <dir>]
  cairn record <task> --status done [--mission <dir>]
  cairn record --mission-done [--mission <dir>]
`;

function main(argv: string[]): number {
  let args = argv.slice(2);
  const missionOption = takeOption(args, '--mission');
  const json = args.includes('--json');
  args = args.filter((arg) => arg !== '--json');

  const [command, ...rest] = args;

  if (command === 'init') {
    const title = takeOption(rest, '--title');
    const id = rest[0];
    if (!id || rest.length > 1) return usage('init needs <id>');
    try {
      const dir = initMission(id, { title });
      process.stdout.write(`created ${dir}\n`);
      return 0;
    } catch (error) {
      return refuse(error instanceof Error ? error.message : String(error));
    }
  }

  const missionDir = resolveMission(missionOption);

  if (command === 'status') {
    if (rest.length > 0) return usage(`unexpected argument ${rest[0]}`);
    const report = statusReport(missionDir);
    process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : `${formatStatus(report)}\n`);
    return 0;
  }

  if (command === 'next') {
    if (rest.length > 0) return usage(`unexpected argument ${rest[0]}`);
    const doc = loadMission(missionDir);
    const task = nextTask(doc.plan, doc.events);
    if (!task) {
      const incomplete = doc.plan.tasks.some(
        (candidate) => taskState(candidate, doc.events) !== 'done',
      );
      process.stderr.write(incomplete ? 'blocked: no runnable task\n' : 'none: every task is done\n');
      return incomplete ? 3 : 2;
    }
    process.stdout.write(`${JSON.stringify(buildPacket(missionDir, task.id), null, 2)}\n`);
    return 0;
  }

  if (command === 'verify') {
    const taskId = rest[0];
    if (!taskId || rest.length > 1) return usage('verify needs <task>');
    try {
      const result = verifyTask(missionDir, taskId);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.passed ? 0 : 2;
    } catch (error) {
      return refuse(error instanceof Error ? error.message : String(error));
    }
  }

  if (command === 'reconcile') {
    if (rest.length > 0) return usage(`unexpected argument ${rest[0]}`);
    const report = reconcileMission(missionDir);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.ok ? 0 : 3;
  }

  if (command === 'record') {
    if (rest.includes('--mission-done')) {
      if (rest.length !== 1) return usage('record --mission-done takes no task');
      return recordMission(missionDir);
    }
    const taskId = rest[0];
    const status = takeOption(rest, '--status');
    if (!taskId || status !== 'done' || rest.length > 1) {
      return usage('record needs <task> --status done');
    }
    return record(missionDir, taskId);
  }

  return usage(command ? `unknown command ${command}` : 'missing command');
}

function record(missionDir: string, taskId: string): number {
  const doc = loadMission(missionDir);
  const task = doc.plan.tasks.find((candidate) => candidate.id === taskId);
  if (!task) return refuse(`unknown task ${taskId}`);

  const state = taskState(task, doc.events);
  if (state === 'done') return refuse(`${taskId} is already done`);
  if (state === 'parked') return refuse(`${taskId} is parked; answer the escalation first`);

  if (!Array.isArray(task.serves) || task.serves.length === 0) {
    return refuse(`${taskId}: no serves link`);
  }
  const known = new Set(doc.mission.acceptance.map((criterion) => criterion.id));
  const unknown = task.serves.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    return refuse(`${taskId}: serves unknown acceptance ${unknown.join(', ')}`);
  }

  const errors = checkEvidence(doc.missionDir, task, doc.events);
  if (errors.length > 0) return refuse(errors[0]);

  const head = gitHead(doc.missionDir);
  if (!head) return refuse('no git commit exists');
  const started = doc.events
    .filter((event) => event.event === 'task_started' && event.task === taskId)
    .at(-1);
  const base =
    typeof started?.data.base === 'string' ? started.data.base : gitParent(doc.missionDir, head);
  if (!base) return refuse('no base commit recorded');
  if (gitCount(doc.missionDir, base, head) <= 0) {
    return refuse(`no commit between ${base} and ${head}`);
  }

  const gates = task.gates
    .filter((gate) => gate.severity === 'block')
    .map((gate) => {
      const latest = doc.events
        .filter(
          (event) =>
            event.event === 'gate_result' &&
            event.task === taskId &&
            event.data.gate === gate.id,
        )
        .at(-1);
      return {
        id: gate.id,
        exit_code: 0,
        evidence: typeof latest?.data.evidence === 'string' ? latest.data.evidence : '',
      };
    });

  const completed = appendEvent(doc.missionDir, {
    ts: nextTimestamp(doc.events),
    event: 'task_done',
    task: taskId,
    actor: 'cairn',
    data: {
      base,
      head,
      commits: [head],
      gates,
    },
  });
  process.stdout.write(`${JSON.stringify(completed, null, 2)}\n`);
  return 0;
}

function recordMission(missionDir: string): number {
  const report = completeMission(missionDir);
  if (!report.ok) return refuse(report.errors[0]);
  const doc = loadMission(missionDir);
  const completed = appendEvent(doc.missionDir, {
    ts: nextTimestamp(doc.events),
    event: 'mission_done',
    actor: 'cairn',
    mission: doc.mission.id,
    data: { acceptance: report.acceptance },
  });
  process.stdout.write(`${JSON.stringify(completed, null, 2)}\n`);
  return 0;
}

function formatStatus(report: StatusReport): string {
  const lines = [`mission: ${report.mission.id} — ${report.mission.title}`, 'tasks:'];
  for (const task of report.tasks) {
    lines.push(`  ${task.id}  ${task.state.padEnd(6)}  ${task.title}`);
  }
  lines.push('coverage:');
  for (const [id, taskIds] of Object.entries(report.coverage)) {
    lines.push(`  ${id}: ${taskIds.length > 0 ? taskIds.join(', ') : 'UNCOVERED'}`);
  }
  lines.push(`uncovered: ${report.uncovered.length > 0 ? report.uncovered.join(', ') : 'none'}`);
  lines.push(`next: ${report.next ?? 'none'}`);
  return lines.join('\n');
}

function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

function refuse(message: string): number {
  process.stderr.write(`refused: ${message}\n`);
  return 2;
}

function usage(message?: string): number {
  if (message) process.stderr.write(`${message}\n`);
  process.stderr.write(USAGE);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = main(process.argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`error: ${message}\n`);
    process.exitCode = 1;
  }
}
