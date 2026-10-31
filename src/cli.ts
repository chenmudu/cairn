#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { appendEvent, nextTimestamp } from './ledger.ts';
import {
  buildPacket,
  gitCount,
  gitHead,
  gitParent,
  gitTree,
  loadMission,
  nextTask,
  statusReport,
  taskState,
  worktreeChanges,
  type StatusReport,
} from './plan.ts';
import { recordReview } from './review.ts';
import { withPacks } from './packet.ts';
import { packsActivated, validatePackRecords } from './packs.ts';
import { checkEvidence, checkTreeBinding, verifyTask } from './verify.ts';
import { reconcileMission } from './reconcile.ts';
import { completeMission } from './complete.ts';
import { initMission, resolveMission } from './paths.ts';

const USAGE = `usage:
  cairn init <id> [--title <title>]
  cairn status [--json] [--mission <dir>]
  cairn next [--mission <dir>]
  cairn start <task> [--mission <dir>]
  cairn verify <task> [--mission <dir>]
  cairn review --file <json> [--mission <dir>]
  cairn reconcile [--mission <dir>]
  cairn record <task> --status done [--packs <json>] [--mission <dir>]
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
    process.stdout.write(`${JSON.stringify(withPacks(buildPacket(missionDir, task.id)), null, 2)}\n`);
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

  if (command === 'start') {
    const taskId = rest[0];
    if (!taskId || rest.length > 1) return usage('start needs <task>');
    return start(missionDir, taskId);
  }

  if (command === 'review') {
    const file = takeOption(rest, '--file');
    if (!file || rest.length > 0) return usage('review needs --file <json>');
    return review(missionDir, file);
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
    const packsFile = takeOption(rest, '--packs');
    if (!taskId || status !== 'done' || rest.length > 1) {
      return usage('record needs <task> --status done');
    }
    return record(missionDir, taskId, packsFile);
  }

  return usage(command ? `unknown command ${command}` : 'missing command');
}

function start(missionDir: string, taskId: string): number {
  const doc = loadMission(missionDir);
  const task = doc.plan.tasks.find((candidate) => candidate.id === taskId);
  if (!task) return refuse(`unknown task ${taskId}`);

  const state = taskState(task, doc.events);
  if (state === 'done') return refuse(`${taskId} is already done`);
  if (state === 'parked') return refuse(`${taskId} is parked; answer the escalation first`);
  if (state === 'active') return refuse(`${taskId} is already started`);

  const base = gitHead(doc.missionDir);
  if (!base) return refuse('no git commit exists');

  const started = appendEvent(doc.missionDir, {
    ts: nextTimestamp(doc.events),
    event: 'task_started',
    mission: doc.mission.id,
    task: taskId,
    actor: 'cairn',
    data: { base },
  });
  process.stdout.write(`${JSON.stringify(started, null, 2)}\n`);
  return 0;
}

function review(missionDir: string, file: string): number {
  let input: unknown;
  try {
    input = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return refuse(error instanceof Error ? error.message : String(error));
  }
  try {
    const event = recordReview(missionDir, input);
    process.stdout.write(`${JSON.stringify(event, null, 2)}\n`);
    return 0;
  } catch (error) {
    return refuse(error instanceof Error ? error.message : String(error));
  }
}

function record(missionDir: string, taskId: string, packsFile?: string): number {
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

  let packs: unknown;
  if (packsFile !== undefined) {
    try {
      packs = readPacksFile(packsFile);
    } catch (error) {
      return refuse(error instanceof Error ? error.message : String(error));
    }
    const invalid = validatePackRecords(doc.missionDir, task, packs);
    if (invalid.length > 0) return refuse(invalid[0]);
  } else if (packsActivated(doc.events)) {
    return refuse(`${taskId}: packs record required; pass --packs <json>`);
  }

  const errors = checkEvidence(doc.missionDir, task, doc.events);
  if (errors.length > 0) return refuse(errors[0]);

  const head = gitHead(doc.missionDir);
  if (!head) return refuse('no git commit exists');
  const tree = gitTree(doc.missionDir, head);
  if (!tree) return refuse(`cannot read the tree of ${head}`);

  const stale = checkTreeBinding(task, doc.events, { head, tree });
  if (stale.length > 0) return refuse(stale[0]);

  const changes = worktreeChanges(doc.missionDir);
  if (changes.length > 0) {
    return refuse(`worktree has changes outside .cairn: ${changes.join(', ')}`);
  }

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
      tree,
      commits: [head],
      gates,
      ...(packs === undefined ? {} : { packs }),
    },
  });
  process.stdout.write(`${JSON.stringify(completed, null, 2)}\n`);
  return 0;
}

/**
 * The ledger bytes at HEAD, not a re-serialization of the parsed events. A
 * whitespace-only edit still means the committed ledger is not the one being
 * closed.
 */
function committedLedgerBlob(missionDir: string): string | null {
  const root = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: missionDir,
    encoding: 'utf8',
  });
  if (root.status !== 0) return null;
  const rel = relative(root.stdout.trim(), missionDir).split(sep).join('/');
  const path = rel === '' ? 'ledger.jsonl' : `${rel}/ledger.jsonl`;
  const blob = spawnSync('git', ['cat-file', 'blob', `HEAD:${path}`], {
    cwd: missionDir,
    encoding: 'utf8',
  });
  return blob.status === 0 ? blob.stdout : null;
}

function recordMission(missionDir: string): number {
  const report = completeMission(missionDir);
  if (!report.ok) return refuse(report.errors[0]);
  const doc = loadMission(missionDir);

  const committed = committedLedgerBlob(doc.missionDir);
  if (committed === null) return refuse('the ledger is not committed at HEAD');
  if (committed !== readFileSync(join(doc.missionDir, 'ledger.jsonl'), 'utf8')) {
    return refuse('the ledger has changes that are not committed at HEAD');
  }

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

function readPacksFile(file: string): unknown {
  const value = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new Error('packs file must contain a JSON list');
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
