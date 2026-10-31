import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { appendEvent, nextTimestamp, type LedgerEvent } from './ledger.ts';
import { displayCommand, runGate, type GateResult } from './gates.ts';
import {
  git,
  gitHead,
  gitTree,
  loadMission,
  taskState,
  worktreeChanges,
  type Gate,
  type Task,
} from './plan.ts';

export interface GateOutcome extends GateResult {
  id: string;
  severity: Gate['severity'];
  command: string;
  cwd: string;
  evidence: string;
}

export interface VerifyResult {
  task: string;
  passed: boolean;
  head: string | null;
  tree: string | null;
  gates: GateOutcome[];
  drift?: string;
}

/**
 * Run every gate a task declares, newest result last. Each result becomes an
 * evidence file and a `gate_result` event naming the head and tree it ran on.
 * Only a failing blocking gate fails the run; advisory gates are recorded but
 * never decide. A tracked change during the run is reported as drift.
 */
export function verifyTask(missionDir: string, taskId: string): VerifyResult {
  const doc = loadMission(missionDir);
  const task = doc.plan.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new Error(`unknown task ${taskId}`);

  const state = taskState(task, doc.events);
  if (state === 'done') throw new Error(`${taskId} is already done`);
  if (state === 'parked') throw new Error(`${taskId} is parked; answer the escalation first`);
  if (!Array.isArray(task.gates) || task.gates.length === 0) {
    throw new Error(`${taskId}: no gates`);
  }
  for (const gate of task.gates) evidenceName(gate.id);

  const head = gitHead(doc.missionDir);
  const tree = head === null ? null : gitTree(doc.missionDir, head);
  if (head !== null && tree === null) throw new Error(`cannot read the tree of ${head}`);
  const dirty = worktreeChanges(doc.missionDir);
  if (dirty.length > 0) {
    throw new Error(`worktree has changes outside .cairn: ${dirty.join(', ')}`);
  }

  const root = git(doc.missionDir, ['rev-parse', '--show-toplevel']) ?? process.cwd();
  mkdirSync(join(doc.missionDir, 'evidence', taskId), { recursive: true });

  const events = [...doc.events];
  const gates: GateOutcome[] = [];
  for (const gate of task.gates) {
    const cwd = resolve(root, gate.cwd ?? '.');
    const run = runGate(gate, { cwd: root });
    const evidence = `evidence/${taskId}/${gate.id}.json`;
    writeFileSync(
      join(doc.missionDir, evidence),
      `${JSON.stringify({ gate, cwd, ...run }, null, 2)}\n`,
    );
    const event = appendEvent(doc.missionDir, {
      ts: nextTimestamp(events),
      event: 'gate_result',
      task: taskId,
      actor: 'cairn',
      mission: doc.mission.id,
      data: {
        gate: gate.id,
        command: displayCommand(gate),
        exit_code: run.exit_code,
        evidence,
        ...(head !== null && tree !== null ? { head, tree } : {}),
      },
    });
    events.push(event);
    gates.push({
      ...run,
      id: gate.id,
      severity: gate.severity,
      command: displayCommand(gate),
      cwd,
      evidence,
    });
  }

  const afterHead = gitHead(doc.missionDir);
  const afterTree = afterHead === null ? null : gitTree(doc.missionDir, afterHead);
  const afterDirty = worktreeChanges(doc.missionDir);
  const drift =
    afterHead !== head || afterTree !== tree || afterDirty.length > 0
      ? 'the tracked content changed while the gates ran'
      : undefined;

  return {
    task: taskId,
    passed:
      gates.every((gate) => gate.severity !== 'block' || gate.exit_code === 0) &&
      drift === undefined,
    head,
    tree,
    gates,
    ...(drift ? { drift } : {}),
  };
}

/**
 * What `record` must see before it may append `task_done`: the latest run of
 * every blocking gate exits 0 and its evidence file is still there.
 */
export function checkEvidence(
  missionDir: string,
  task: Task,
  events: LedgerEvent[],
): string[] {
  const errors: string[] = [];
  const blocking = task.gates.filter((gate) => gate.severity === 'block');
  if (blocking.length === 0) errors.push(`${task.id}: no blocking gate`);

  for (const gate of blocking) {
    const results = events.filter(
      (event) =>
        event.event === 'gate_result' &&
        event.task === task.id &&
        event.data.gate === gate.id,
    );
    const latest = results.at(-1);
    if (!latest) {
      errors.push(`${task.id}: blocking gate ${gate.id} has no result`);
      continue;
    }
    if (latest.data.exit_code !== 0) {
      errors.push(`${task.id}: blocking gate ${gate.id} did not exit 0`);
      continue;
    }
    const evidence = latest.data.evidence;
    if (typeof evidence !== 'string' || evidence === '') {
      errors.push(`${task.id}: gate ${gate.id} has no evidence path`);
      continue;
    }
    if (!isEvidenceFile(missionDir, evidence)) {
      errors.push(`${task.id}: evidence missing: ${evidence}`);
    }
  }

  return errors;
}

/** A recorded evidence path must stay inside the mission and name a real file. */
export function isEvidenceFile(missionDir: string, value: unknown): boolean {
  if (typeof value !== 'string' || value === '') return false;
  const path = resolve(missionDir, value);
  return isInside(missionDir, path) && existsSync(path) && statSync(path).isFile();
}

/**
 * A gate result proves a tree, not just a command. `record` refuses a result
 * whose head or tree is not the tree it is about to stamp.
 */
export function checkTreeBinding(
  task: Task,
  events: LedgerEvent[],
  binding: { head: string; tree: string },
): string[] {
  const errors: string[] = [];
  for (const gate of task.gates.filter((candidate) => candidate.severity === 'block')) {
    const latest = events
      .filter(
        (event) =>
          event.event === 'gate_result' &&
          event.task === task.id &&
          event.data.gate === gate.id,
      )
      .at(-1);
    if (!latest) continue; // checkEvidence already reported the missing result
    if (latest.data.head !== binding.head || latest.data.tree !== binding.tree) {
      errors.push(`${task.id}: blocking gate ${gate.id} was verified on a different tree`);
    }
  }
  return errors;
}

function evidenceName(id: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) {
    throw new Error(`gate id ${JSON.stringify(id)} cannot be used as an evidence file name`);
  }
  return id;
}

function isInside(root: string, target: string): boolean {
  const normalize = (value: string) => (process.platform === 'win32' ? value.toLowerCase() : value);
  const parent = normalize(resolve(root));
  const child = normalize(resolve(target));
  return child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);
}
