import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { appendEvent, nextTimestamp, type LedgerEvent } from './ledger.ts';
import { displayCommand, runGate, type GateResult } from './gates.ts';
import { git, loadMission, taskState, type Gate, type Task } from './plan.ts';

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
  gates: GateOutcome[];
}

/**
 * Run every gate a task declares, newest result last. Each result becomes an
 * evidence file and a `gate_result` event. Only a failing blocking gate fails
 * the run; advisory gates are recorded but never decide.
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

  return {
    task: taskId,
    passed: gates.every((gate) => gate.severity !== 'block' || gate.exit_code === 0),
    gates,
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
    const path = resolve(missionDir, evidence);
    if (!isInside(missionDir, path) || !existsSync(path) || !statSync(path).isFile()) {
      errors.push(`${task.id}: evidence missing: ${evidence}`);
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
