import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { appendEvent } from './ledger.ts';

export interface CairnConfig {
  layout_version?: number;
  active_mission?: string;
  [key: string]: unknown;
}

const CONFIG_PATH = join('.cairn', 'config.json');
const MISSION_ID = /^[a-z0-9][a-z0-9-]*$/;

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

/** Read `.cairn/config.json`; a malformed file fails loud instead of guessing. */
export function readConfig(root = process.cwd()): CairnConfig | null {
  const file = join(root, CONFIG_PATH);
  if (!existsSync(file)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${file}: must be a JSON object`);
  }
  return value as CairnConfig;
}

/**
 * Candidate directories for a mission reference. A bare id prefers the new
 * `.cairn/missions` layout; a legacy `missions/<id>` path also tries the
 * migrated location first, so old commands keep working after the move.
 */
export function missionCandidates(value: string, root = process.cwd()): string[] {
  const looksLikePath = value.includes('/') || value.includes('\\') || isAbsolute(value);
  if (looksLikePath) {
    const direct = resolve(root, value);
    const normalized = value.replace(/\\/g, '/');
    if (normalized.startsWith('missions/')) {
      return [join(root, '.cairn', normalized), direct];
    }
    return [direct];
  }
  return [join(root, '.cairn', 'missions', value), join(root, 'missions', value)];
}

/**
 * Resolve a mission directory. With no argument, the active mission comes from
 * `.cairn/config.json`; without a config, a legacy bootstrap mission still
 * resolves. A missing configured mission is an error, not a silent fallback.
 */
export function resolveMission(value?: string, root = process.cwd()): string {
  if (typeof value === 'string' && value.trim() !== '') {
    const candidates = missionCandidates(value, root);
    return candidates.find(isDirectory) ?? candidates[0];
  }

  const config = readConfig(root);
  if (typeof config?.active_mission === 'string' && config.active_mission !== '') {
    const found = missionCandidates(config.active_mission, root).find(isDirectory);
    if (!found) throw new Error(`active mission not found: ${config.active_mission}`);
    return found;
  }

  const fallback = [
    join(root, '.cairn', 'missions', '000-bootstrap'),
    join(root, 'missions', '000-bootstrap'),
  ].find(isDirectory);
  return fallback ?? join(root, '.cairn', 'missions', '000-bootstrap');
}

function yamlScalar(value: string): string {
  return /^[A-Za-z0-9][A-Za-z0-9 .,'()/_-]*$/.test(value) ? value : JSON.stringify(value);
}

function missionScaffold(id: string, title: string, owner: string): string {
  return `---
schema: cairn/mission@0.1
id: ${id}
title: ${yamlScalar(title)}
status: draft
created: ${new Date().toISOString().slice(0, 10)}
owner: ${yamlScalar(owner)}
acceptance:
  - id: A1
    check: replace with a deterministic check
---

# ${title}

## Intent

Replace this with the outcome this mission must produce.

## Non-goals

- Replace with what this mission must not touch.

## Acceptance

- A1: replace with evidence a reviewer can check.

## Current action

Edit this contract, then start T-001. The scaffold gate fails on purpose until the task is real.
`;
}

function planScaffold(id: string): string {
  return `---
schema: cairn/plan@0.1
mission: ${id}
tasks:
  - id: T-001
    title: Replace the placeholder task
    deps: []
    risk: low
    status: todo
    serves: [A1]
    files: []
    gates:
      - id: placeholder
        command: node
        args: ["-e", "process.exit(1)"]
        severity: block
---

# Plan

Replace the placeholder task and its gate. The gate fails until the task is real.
`;
}

function policyScaffold(id: string): string {
  return `---
schema: cairn/policy@0.1
mission: ${id}
budgets:
  max_attempts_per_task: 3
  max_fix_rounds: 2
  max_wall_time_per_tick_minutes: 120
  max_tokens_per_tick: null
  max_completed_tasks_between_audits: 3
allowed_commands:
  - node
  - pnpm
  - git
  - tsc
forbidden_commands:
  - npm publish
  - git push
  - git reset --hard
  - rm -rf
stop_conditions:
  - irreversible_or_destructive
  - security_sensitive
  - write_outside_repo
  - plan_unrecoverable
  - budget_exhausted
  - goal_drift_suspected
  - acceptance_unreachable
  - gate_weakened_without_amendment
merge_policy: no_push_without_human
---

# Policy

Replace the budgets and stop conditions that do not fit this mission.
`;
}

/**
 * Scaffold `.cairn/missions/<id>/` and make it the active mission. The
 * placeholder gate fails on purpose, so a scaffold cannot be recorded as done
 * before the contract is edited. `init` is the writer of `mission_created`: it
 * freezes the scaffold hashes, so the validator and `check-targets` have a
 * chain from the first tick. `approved_by` defaults to `cairn`; a caller must
 * pass `human` explicitly, and `init` never claims it on its own.
 */
export function initMission(
  id: string,
  options: {
    root?: string;
    title?: string;
    owner?: string;
    approvalSource?: string[];
    approvedBy?: 'cairn' | 'human';
  } = {},
): string {
  if (!MISSION_ID.test(id)) throw new Error(`invalid mission id: ${id}`);
  const root = options.root ?? process.cwd();
  const dir = join(root, '.cairn', 'missions', id);
  if (existsSync(dir)) throw new Error(`${dir}: already exists`);

  const owner = (options.owner ?? 'replace-me').trim();
  const approvedBy = options.approvedBy ?? 'cairn';
  const approvalSource = options.approvalSource ?? ['none'];
  if (approvedBy !== 'cairn' && approvedBy !== 'human') {
    throw new Error(`approved_by must be cairn or human, not ${approvedBy}`);
  }
  if (approvalSource.length === 0 || approvalSource.some((source) => source.trim() === '')) {
    throw new Error('approval_source must name at least one non-empty source');
  }

  mkdirSync(dir, { recursive: true });
  const title = (options.title ?? id).replace(/\s+/g, ' ').trim();
  writeFileSync(join(dir, 'mission.md'), missionScaffold(id, title, owner));
  writeFileSync(join(dir, 'plan.md'), planScaffold(id));
  writeFileSync(join(dir, 'policy.md'), policyScaffold(id));
  writeFileSync(join(dir, 'ledger.jsonl'), '');

  const artifacts: Record<string, string> = {};
  for (const name of ['mission.md', 'plan.md', 'policy.md']) {
    artifacts[name] = sha256(join(dir, name));
  }
  const protocol = join(root, 'docs', 'protocol.md');
  if (existsSync(protocol)) artifacts['docs/protocol.md'] = sha256(protocol);

  appendEvent(dir, {
    ts: new Date().toISOString(),
    event: 'mission_created',
    mission: id,
    actor: 'cairn',
    data: {
      owner,
      approved_by: approvedBy,
      approval_source: approvalSource,
      artifacts,
    },
  });

  const config = readConfig(root) ?? {};
  config.layout_version ??= 1;
  config.active_mission = id;
  mkdirSync(join(root, '.cairn'), { recursive: true });
  writeFileSync(join(root, CONFIG_PATH), `${JSON.stringify(config, null, 2)}\n`);
  return dir;
}

function sha256(file: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`;
}
