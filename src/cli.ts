#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
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

const DEFAULT_MISSION = 'missions/000-bootstrap';
const USAGE = `usage:
  cairn status [--json] [--mission <dir>]
  cairn next [--mission <dir>]
  cairn record <task> --status done [--mission <dir>]
`;

function main(argv: string[]): number {
  let args = argv.slice(2);
  const missionDir = takeOption(args, '--mission') ?? DEFAULT_MISSION;
  const json = args.includes('--json');
  args = args.filter((arg) => arg !== '--json');

  const [command, ...rest] = args;
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

  if (command === 'record') {
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

  const blocking = new Set(
    task.gates.filter((gate) => gate.severity === 'block').map((gate) => gate.id),
  );
  const results = doc.events.filter(
    (event) => event.event === 'gate_result' && event.task === taskId,
  );
  const passed = results.filter(
    (event) => blocking.has(String(event.data.gate)) && event.data.exit_code === 0,
  );
  if (passed.length === 0) {
    return refuse(`${taskId}: no blocking gate at exit 0 recorded`);
  }
  for (const event of passed) {
    const evidence = event.data.evidence;
    if (typeof evidence !== 'string' || evidence === '') {
      return refuse(`${taskId}: gate ${String(event.data.gate)} has no evidence path`);
    }
    const path = resolve(doc.missionDir, evidence);
    if (!isInside(doc.missionDir, path) || !existsSync(path) || !statSync(path).isFile()) {
      return refuse(`${taskId}: evidence missing: ${evidence}`);
    }
  }

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

  const completed = appendEvent(doc.missionDir, {
    ts: nextTimestamp(doc.events),
    event: 'task_done',
    task: taskId,
    actor: 'cairn',
    data: {
      base,
      head,
      commits: [head],
      gates: passed.map((event) => ({
        id: event.data.gate,
        exit_code: 0,
        evidence: event.data.evidence,
      })),
    },
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

function isInside(root: string, target: string): boolean {
  const normalize = (value: string) => (process.platform === 'win32' ? value.toLowerCase() : value);
  const parent = normalize(resolve(root));
  const child = normalize(resolve(target));
  return child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);
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
