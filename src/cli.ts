#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { appendEvent, nextTimestamp } from './ledger.ts';
import {
  attemptCount,
  budgetValue,
  buildPacket,
  gitCount,
  gitHead,
  gitTree,
  latestStart,
  loadMission,
  nextTask,
  statusReport,
  taskState,
  worktreeChanges,
  type MissionDocuments,
  type StatusReport,
} from './plan.ts';
import { recordReview } from './review.ts';
import { withPacks } from './packet.ts';
import { packsActivated, validatePackRecords } from './packs.ts';
import { checkEvidence, checkTreeBinding, verifyTask } from './verify.ts';
import { checkGatePolicy } from './gates.ts';
import { reconcileMission } from './reconcile.ts';
import { completeMission } from './complete.ts';
import { initMission, resolveMission } from './paths.ts';

const USAGE = `usage:
  cairn init <id> [--title <title>]
  cairn status [--json] [--mission <dir>]
  cairn next [--mission <dir>]
  cairn start <task> [--mission <dir>]
  cairn answer <task> --text <text> [--mission <dir>]
  cairn verify <task> [--mission <dir>]
  cairn review --file <json> [--mission <dir>]
  cairn reconcile [--mission <dir>]
  cairn record <task> --status done [--packs <json>] [--mission <dir>]
  cairn record --amended --artifact <path> --why <text> [--approved-by cairn|human] [--mission <dir>]
  cairn record --authorized --paths <a,b> --why <text> --approved-by human [--mission <dir>]
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
    const owner = takeOption(rest, '--owner');
    const source = takeOption(rest, '--approval-source');
    const approvedBy = takeOption(rest, '--approved-by');
    const id = rest[0];
    if (!id || rest.length > 1) return usage('init needs <id>');
    if (approvedBy !== undefined && approvedBy !== 'cairn' && approvedBy !== 'human') {
      return usage('--approved-by must be cairn or human');
    }
    const approvalSource = source
      ?.split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');
    if (source !== undefined && (!approvalSource || approvalSource.length === 0)) {
      return usage('--approval-source must name at least one source');
    }
    try {
      const dir = initMission(id, {
        title,
        owner,
        approvalSource,
        approvedBy: approvedBy as 'cairn' | 'human' | undefined,
      });
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
      const doc = loadMission(missionDir);
      const task = doc.plan.tasks.find((candidate) => candidate.id === taskId);
      if (!task) return refuse(`unknown task ${taskId}`);
      const policyErrors = checkGatePolicy(
        task.gates ?? [],
        doc.policy,
        join(doc.missionDir, 'policy.md'),
      );
      if (policyErrors.length > 0) return refuse(policyErrors.join('; '));
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

  if (command === 'answer') {
    const taskId = rest[0];
    const text = takeOption(rest, '--text');
    if (!taskId || !text || rest.length > 1) return usage('answer needs <task> --text <text>');
    return answer(missionDir, taskId, text);
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
    if (rest.includes('--authorized')) {
      rest.splice(rest.indexOf('--authorized'), 1);
      const paths = takeOption(rest, '--paths');
      const why = takeOption(rest, '--why');
      const approvedBy = takeOption(rest, '--approved-by');
      if (!paths || rest.length > 0) {
        return usage(
          'record --authorized needs --paths <a,b> --why <text> --approved-by human',
        );
      }
      return authorize(missionDir, paths, why ?? '', approvedBy);
    }
    if (rest.includes('--amended')) {
      rest.splice(rest.indexOf('--amended'), 1);
      const artifact = takeOption(rest, '--artifact');
      const why = takeOption(rest, '--why');
      const approvedBy = takeOption(rest, '--approved-by') ?? 'cairn';
      if (!artifact || rest.length > 0) {
        return usage(
          'record --amended needs --artifact <path> --why <text> [--approved-by cairn|human]',
        );
      }
      return amendment(missionDir, artifact, why ?? '', approvedBy);
    }
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
  const attemptError = checkAttemptBudget(doc, taskId);
  if (attemptError) return refuse(attemptError);
  if (state === 'parked') return refuse(`${taskId} is parked; answer the escalation first`);
  if (state === 'active') return refuse(`${taskId} is already started`);

  const unmet = (task.deps ?? []).filter((dep) => {
    const dependency = doc.plan.tasks.find((candidate) => candidate.id === dep);
    return !dependency || taskState(dependency, doc.events) !== 'done';
  });
  if (unmet.length > 0) return refuse(`${taskId}: unmet dependency ${unmet.join(', ')}`);

  const active = doc.plan.tasks.find(
    (candidate) => candidate.id !== taskId && taskState(candidate, doc.events) === 'active',
  );
  if (active) return refuse(`${taskId}: ${active.id} is already active`);

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

/**
 * The human answers an escalation. The event is a `task_started`, which is what
 * makes the latest-of rule resume the task; the answer and the approval ride in
 * `data` so no new event type is needed.
 */
function answer(missionDir: string, taskId: string, text: string): number {
  const doc = loadMission(missionDir);
  const task = doc.plan.tasks.find((candidate) => candidate.id === taskId);
  if (!task) return refuse(`unknown task ${taskId}`);

  const state = taskState(task, doc.events);
  if (state !== 'parked') {
    return refuse(`${taskId} is ${state}; answer applies to a parked task`);
  }
  const attemptError = checkAttemptBudget(doc, taskId);
  if (attemptError) return refuse(attemptError);

  const base = gitHead(doc.missionDir);
  if (!base) return refuse('no git commit exists');

  const resumed = appendEvent(doc.missionDir, {
    ts: nextTimestamp(doc.events),
    event: 'task_started',
    mission: doc.mission.id,
    task: taskId,
    actor: 'human',
    data: { base, answer: text, approved_by: 'human' },
  });
  process.stdout.write(`${JSON.stringify(resumed, null, 2)}\n`);
  return 0;
}

/** The per-task attempt budget: `answer` also opens a new attempt. */
function checkAttemptBudget(doc: MissionDocuments, taskId: string): string | null {
  const max = budgetValue(doc.policy, 'max_attempts_per_task');
  if (max === null) return null;
  const attempts = attemptCount(taskId, doc.events);
  if (attempts < max) return null;
  return `${taskId}: budget_exhausted [auto]: ${attempts} starts reach max_attempts_per_task=${max} (${join(doc.missionDir, 'policy.md')})`;
}

/** The wall-time budget runs from the start that opened the current attempt. */
function checkWallTimeBudget(doc: MissionDocuments, taskId: string): string | null {
  const max = budgetValue(doc.policy, 'max_wall_time_per_tick_minutes');
  if (max === null) return null;
  const start = latestStart(taskId, doc.events);
  if (!start) return null;
  const elapsed = (Date.now() - Date.parse(start.ts)) / 60_000;
  if (!(elapsed > max)) return null;
  return `${taskId}: budget_exhausted [auto]: ${Math.round(elapsed)} minutes since the last start exceeds max_wall_time_per_tick_minutes=${max} (${join(doc.missionDir, 'policy.md')}); a human must extend the budget`;
}

/**
 * The human authorizes writes outside the plan. This grants scope, not
 * approval of content: paths, why, and `approved_by: human` are all required,
 * and the agent cannot write this event for itself.
 */
function authorize(missionDir: string, paths: string, why: string, approvedBy?: string): number {
  if (approvedBy !== 'human') return refuse('--approved-by must be human');
  if (why.trim() === '') return refuse('--why is required');
  const list = paths
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  if (list.length === 0) return refuse('--paths must name at least one path');

  const doc = loadMission(missionDir);
  const ts = nextTimestamp(doc.events);
  const event = appendEvent(doc.missionDir, {
    ts,
    event: 'authorization',
    mission: doc.mission.id,
    actor: 'human',
    data: {
      scope: 'writes',
      paths: list,
      approved_by: 'human',
      why,
      date: ts.slice(0, 10),
    },
  });
  process.stdout.write(`${JSON.stringify(event, null, 2)}\n`);
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
  if (state !== 'active') return refuse(`${taskId} has no task_started; run cairn start first`);

  const wallTimeError = checkWallTimeBudget(doc, taskId);
  if (wallTimeError) return refuse(wallTimeError);

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
  const base = typeof started?.data.base === 'string' ? started.data.base : null;
  if (!base) return refuse(`${taskId}: task_started has no base commit`);
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

const AMENDABLE = new Set(['mission.md', 'plan.md', 'policy.md', 'docs/protocol.md']);
const HUMAN_ONLY = new Set(['mission.md', 'policy.md', 'docs/protocol.md']);

/**
 * The runtime writer for `mission_amended`. The old hash comes from the frozen
 * chain, the new one from the file on disk; a target that cannot prove both is
 * refused, so no amendment is accepted on trust. `plan.md` is the executor's
 * workspace; the contract, the policy, and `docs/protocol.md` need a human.
 */
function amendment(
  missionDir: string,
  artifact: string,
  why: string,
  approvedBy: string,
): number {
  const doc = loadMission(missionDir);
  const agent = artifact.replace(/\\/g, '/');
  if (!AMENDABLE.has(agent)) return refuse(`unknown target artifact ${artifact}`);
  if (approvedBy !== 'cairn' && approvedBy !== 'human') {
    return refuse('--approved-by must be cairn or human');
  }
  if (why.trim() === '') return refuse('--why is required');
  if (HUMAN_ONLY.has(agent) && approvedBy !== 'human') {
    return refuse(`${agent} requires --approved-by human`);
  }

  const chain = new Map<string, string>();
  for (const event of doc.events) {
    if (event.event === 'mission_created') applyFrozen(chain, event.data?.artifacts);
    if (event.event === 'mission_amended') applyFrozen(chain, event.data?.new);
  }
  const old = chain.get(agent);
  if (!old) return refuse(`${agent} was never frozen; only a frozen target can be amended`);

  const file = agent === 'docs/protocol.md' ? resolve(repoRootOf(doc.missionDir), agent) : resolve(doc.missionDir, agent);
  if (!existsSync(file)) return refuse(`${agent}: artifact is missing`);
  const now = sha256File(file);

  const event = appendEvent(doc.missionDir, {
    ts: nextTimestamp(doc.events),
    event: 'mission_amended',
    mission: doc.mission.id,
    actor: approvedBy,
    data: {
      old: { [agent]: old },
      new: { [agent]: now },
      acceptance: doc.mission.acceptance.map((criterion) => criterion.id),
      why,
      approved_by: approvedBy,
    },
  });
  process.stdout.write(`${JSON.stringify(event, null, 2)}\n`);
  return 0;
}

function applyFrozen(chain: Map<string, string>, artifacts: unknown): void {
  if (artifacts === null || typeof artifacts !== 'object' || Array.isArray(artifacts)) return;
  for (const [key, value] of Object.entries(artifacts as Record<string, unknown>)) {
    if (typeof value === 'string') chain.set(key.replace(/\\/g, '/'), value);
  }
}

/** The repository root around `.cairn/missions/<id>` or legacy `missions/<id>`. */
function repoRootOf(missionDir: string): string {
  let current = resolve(missionDir);
  const id = basename(current);
  for (;;) {
    const parent = dirname(current);
    if (parent === current) break;
    if (
      existsSync(join(parent, '.cairn', 'missions', id)) ||
      (basename(parent) !== '.cairn' && existsSync(join(parent, 'missions', id)))
    ) {
      return parent;
    }
    current = parent;
  }
  return resolve(missionDir, '..', '..', '..');
}

function sha256File(file: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`;
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
