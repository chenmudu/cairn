import { spawnSync } from 'node:child_process';
import type { LedgerEvent } from './ledger.ts';
import { ledgerAtHead, loadMission, taskState } from './plan.ts';
import { checkEvidence, isEvidenceFile } from './verify.ts';

export interface ReconcileReport {
  ok: boolean;
  findings: string[];
  pending: string[];
}

/**
 * Compare the ledger, git, and evidence. A pending record (gates passed, no
 * task_done) is a state the runtime explains, not drift. Missing commits,
 * missing evidence, and one commit claimed twice are drift.
 */
export function reconcileMission(missionDir: string): ReconcileReport {
  const doc = loadMission(missionDir);
  const findings: string[] = [];
  const pending: string[] = [];
  const claims = new Map<string, string[]>();

  for (const event of doc.events) {
    if (event.event === 'gate_result') {
      if (!isEvidenceFile(missionDir, event.data.evidence)) {
        findings.push(
          `${label(event)}: gate ${String(event.data.gate)} evidence missing: ${String(event.data.evidence)}`,
        );
      }
      continue;
    }
    if (event.event !== 'task_done') continue;

    const { base, head, commits, gates } = event.data;
    const headOk = typeof head === 'string' && commitExists(missionDir, head);
    if (!headOk) {
      findings.push(`${label(event)}: head ${String(head)} is not a commit`);
    } else {
      claims.set(head, [...(claims.get(head) ?? []), label(event)]);
    }

    if (typeof base !== 'string' || !commitExists(missionDir, base)) {
      findings.push(`${label(event)}: base ${String(base)} is not a commit`);
    } else if (headOk && !isAncestor(missionDir, base, head)) {
      findings.push(`${label(event)}: base ${base} is not an ancestor of ${head}`);
    }

    if (!Array.isArray(commits)) {
      findings.push(`${label(event)}: commits is not a list`);
    } else {
      for (const commit of commits) {
        if (typeof commit !== 'string' || !commitExists(missionDir, commit)) {
          findings.push(`${label(event)}: commit ${String(commit)} is not a commit`);
        }
      }
    }

    if (!Array.isArray(gates)) {
      findings.push(`${label(event)}: gates is not a list`);
    } else {
      for (const gate of gates) {
        const evidence = isRecord(gate) ? gate.evidence : undefined;
        if (!isEvidenceFile(missionDir, evidence)) {
          findings.push(`${label(event)}: task_done evidence missing: ${String(evidence)}`);
        }
      }
    }
  }

  for (const [commit, tasks] of claims) {
    if (tasks.length > 1) findings.push(`commit ${commit} is claimed by ${tasks.join(', ')}`);
  }

  // Completion is a property of the repository: a completion event that only
  // exists in the worktree ledger has not been committed and cannot count.
  const committed = new Set((ledgerAtHead(missionDir) ?? []).map((event) => JSON.stringify(event)));
  for (const event of doc.events) {
    if (event.event !== 'task_done' && event.event !== 'mission_done') continue;
    if (committed.has(JSON.stringify(event))) continue;
    const where = typeof event.task === 'string' ? `${event.task} ${event.event}` : `mission ${event.event}`;
    findings.push(`${where} is not in the ledger at HEAD`);
  }

  for (const task of doc.plan.tasks) {
    const state = taskState(task, doc.events);
    if (state === 'done' || state === 'parked') continue;
    if (checkEvidence(missionDir, task, doc.events).length === 0) pending.push(task.id);
  }

  return { ok: findings.length === 0, findings, pending };
}

function label(event: LedgerEvent): string {
  return typeof event.task === 'string' ? event.task : '(no task)';
}

function commitExists(missionDir: string, commit: string): boolean {
  return spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: missionDir }).status === 0;
}

function isAncestor(missionDir: string, base: string, head: string): boolean {
  return spawnSync('git', ['merge-base', '--is-ancestor', base, head], { cwd: missionDir }).status === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
