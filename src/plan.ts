import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readMission } from '../scripts/validate-mission.mjs';
import type { LedgerEvent } from './ledger.ts';

export interface AcceptanceCriterion {
  id: string;
  check: string;
}

export interface Mission {
  id: string;
  title: string;
  acceptance: AcceptanceCriterion[];
  [key: string]: unknown;
}

export interface Gate {
  id: string;
  command: string;
  args: string[];
  severity: 'block' | 'advisory';
  cwd?: string;
  timeout_ms?: number;
  scope?: string;
}

export interface Task {
  id: string;
  title: string;
  deps?: string[];
  status?: string;
  serves?: string[];
  files?: string[];
  interfaces?: unknown;
  gates: Gate[];
}

export interface Plan {
  mission: string;
  tasks: Task[];
}

export interface Policy {
  budgets?: Record<string, unknown>;
  allowed_commands?: string[];
  forbidden_commands?: string[];
  stop_conditions?: string[];
}

export type TaskState = 'todo' | 'active' | 'parked' | 'done';

export interface MissionDocuments {
  missionDir: string;
  mission: Mission;
  policy: Policy;
  plan: Plan;
  events: LedgerEvent[];
}

export interface Packet {
  mission: { id: string; title: string };
  task: { id: string; title: string; files: string[]; interfaces: unknown; serves: string[] };
  policy: {
    budgets: Record<string, unknown>;
    allowed_commands: string[];
    forbidden_commands: string[];
    stop_conditions: string[];
  };
  constraints: string[];
  gates: Gate[];
  ledger_tail: LedgerEvent[];
  base: string;
}

export interface TaskStatus {
  id: string;
  title: string;
  state: TaskState;
  serves: string[];
}

export interface StatusReport {
  mission: { id: string; title: string };
  tasks: TaskStatus[];
  coverage: Record<string, string[]>;
  uncovered: string[];
  next: string | null;
  acceptance: string[];
}

export function loadMission(missionDir: string): MissionDocuments {
  const raw = readMission(missionDir) as {
    missionDir: string;
    mission: Mission | null;
    policy: Policy | null;
    plan: Plan | null;
    events: LedgerEvent[];
    errors: string[];
  };
  if (raw.errors.length > 0) throw new Error(raw.errors.join('\n'));
  if (!raw.mission || !raw.plan) throw new Error(`${missionDir}: missing mission.md or plan.md`);
  if (!Array.isArray(raw.plan.tasks)) throw new Error('plan.md: "tasks" must be a list');
  return {
    missionDir: raw.missionDir,
    mission: raw.mission,
    policy: raw.policy ?? {},
    plan: raw.plan,
    events: raw.events,
  };
}

/**
 * `task_done` is terminal. Otherwise the latest of `task_started` and
 * `task_parked` wins, so answering an escalation resumes the task instead of
 * leaving it parked for good. A historical `task_done` with no `task_started`
 * is still done.
 */
export function taskState(task: Task, events: LedgerEvent[]): TaskState {
  let state: TaskState = 'todo';
  for (const event of events) {
    if (event.task !== task.id) continue;
    if (event.event === 'task_done') return 'done';
    if (event.event === 'task_started') state = 'active';
    else if (event.event === 'task_parked') state = 'parked';
  }
  return state;
}

export function nextTask(plan: Plan, events: LedgerEvent[]): Task | undefined {
  const done = new Set(
    plan.tasks.filter((task) => taskState(task, events) === 'done').map((task) => task.id),
  );
  return plan.tasks.find((task) => {
    const state = taskState(task, events);
    if (state === 'done' || state === 'parked') return false;
    return (task.deps ?? []).every((dep) => done.has(dep));
  });
}

export function coverage(plan: Plan, mission: Mission): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const criterion of mission.acceptance) map[criterion.id] = [];
  for (const task of plan.tasks) {
    for (const id of task.serves ?? []) {
      if (map[id]) map[id].push(task.id);
    }
  }
  return map;
}

export function serveErrors(report: StatusReport): string[] {
  const errors: string[] = [];
  const known = new Set(report.acceptance);
  for (const task of report.tasks) {
    if (task.serves.length === 0) errors.push(`${task.id}: missing serves`);
    for (const id of task.serves) {
      if (!known.has(id)) errors.push(`${task.id}: unknown acceptance ${id}`);
    }
  }
  for (const [id, taskIds] of Object.entries(report.coverage)) {
    if (taskIds.length === 0) errors.push(`acceptance ${id}: uncovered`);
  }
  return errors;
}

export function statusReport(missionDir: string): StatusReport {
  const doc = loadMission(missionDir);
  const map = coverage(doc.plan, doc.mission);
  const tasks = doc.plan.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    state: taskState(task, doc.events),
    serves: task.serves ?? [],
  }));
  const uncovered = Object.keys(map).filter((id) => map[id].length === 0);
  return {
    mission: { id: doc.mission.id, title: doc.mission.title },
    tasks,
    coverage: map,
    uncovered,
    next: nextTask(doc.plan, doc.events)?.id ?? null,
    acceptance: doc.mission.acceptance.map((criterion) => criterion.id),
  };
}

export function buildPacket(missionDir: string, taskId: string): Packet {
  const doc = loadMission(missionDir);
  const task = doc.plan.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error(`unknown task ${taskId}`);
  if (!Array.isArray(task.gates)) throw new Error(`task ${taskId}: "gates" must be a list`);

  const base = git(doc.missionDir, ['rev-parse', 'HEAD']);
  if (!base) throw new Error('no git commit exists');

  return {
    mission: { id: doc.mission.id, title: doc.mission.title },
    task: {
      id: task.id,
      title: task.title,
      files: task.files ?? [],
      interfaces: task.interfaces ?? {},
      serves: task.serves ?? [],
    },
    policy: {
      budgets: doc.policy.budgets ?? {},
      allowed_commands: doc.policy.allowed_commands ?? [],
      forbidden_commands: doc.policy.forbidden_commands ?? [],
      stop_conditions: doc.policy.stop_conditions ?? [],
    },
    constraints: bullets(section(missionBody(doc.missionDir), 'Constraints')),
    gates: task.gates,
    ledger_tail: doc.events.slice(-5),
    base,
  };
}

export function git(missionDir: string, args: string[]): string | null {
  const result = spawnSync('git', args, { cwd: missionDir, encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

export function gitHead(missionDir: string): string | null {
  return git(missionDir, ['rev-parse', 'HEAD']);
}

export function gitCount(missionDir: string, base: string, head: string): number {
  const count = git(missionDir, ['rev-list', '--count', `${base}..${head}`]);
  return count === null ? 0 : Number(count);
}

export function gitTree(missionDir: string, head: string): string | null {
  return git(missionDir, ['rev-parse', `${head}^{tree}`]);
}

/**
 * Worktree paths a tick may legitimately leave dirty: only the runtime's own
 * state under `.cairn/`. Everything else, including the mission contract files
 * and untracked files anywhere else, must be committed before `verify`.
 */
export function worktreeChanges(missionDir: string): string[] {
  const root = git(missionDir, ['rev-parse', '--show-toplevel']);
  if (!root) return [];
  // `git status --porcelain` entries start with the two status columns; the
  // first column is a space for an unstaged change, so this output must not be
  // trimmed before slicing the path.
  const result = spawnSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) return [];
  const changes: string[] = [];
  const parts = result.stdout.split('\0');
  for (let index = 0; index < parts.length; index += 1) {
    const entry = parts[index];
    if (entry === '') continue;
    const status = entry.slice(0, 2);
    const path = entry.slice(3);
    // A rename or copy lists the source path in the next field.
    if (status.includes('R') || status.includes('C')) index += 1;
    if (!isRuntimePath(path)) changes.push(path);
  }
  return changes;
}

/** The committed ledger at HEAD, or null when no ledger is committed there. */
export function ledgerAtHead(missionDir: string): LedgerEvent[] | null {
  const root = git(missionDir, ['rev-parse', '--show-toplevel']);
  if (!root) return null;
  const rel = relative(root, missionDir).split(sep).join('/');
  const path = rel === '' ? 'ledger.jsonl' : `${rel}/ledger.jsonl`;
  const text = git(missionDir, ['show', `HEAD:${path}`]);
  if (text === null) return null;
  if (text.trim() === '') return [];
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as LedgerEvent);
}

function isRuntimePath(path: string): boolean {
  const value = path.split('\\').join('/');
  return value === '.cairn' || value.startsWith('.cairn/');
}

function missionBody(missionDir: string): string {
  const text = readFileSync(join(missionDir, 'mission.md'), 'utf8').replace(/^\uFEFF/, '');
  const match = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(text);
  return match ? text.slice(match[0].length) : text;
}

function section(body: string, title: string): string {
  const heading = new RegExp(`^##\\s+${title}\\s*$`, 'm').exec(body);
  if (!heading) return '';
  const rest = body.slice(heading.index + heading[0].length);
  const next = /^##\s+/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function bullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((line) => /^\s*-\s+/.test(line))
    .map((line) => line.replace(/^\s*-\s+/, '').trim());
}
