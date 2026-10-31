import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Gate, Policy } from './plan.ts';

const DEFAULT_TIMEOUT_MS = 600_000;
const DEFAULT_TAIL = 16_384;
const MAX_BUFFER = 16 * 1024 * 1024;

export interface GateResult {
  exit_code: number;
  output: string;
  duration_ms: number;
  timed_out: boolean;
}

export interface RunGateOptions {
  cwd?: string;
}

/**
 * Run one gate as a fixed argv. The exit code is the verdict; the output tail is
 * evidence. `gate.cwd` is resolved against the workspace root, not the process cwd.
 */
export function runGate(gate: Gate, options: RunGateOptions = {}): GateResult {
  const cwd = resolve(options.cwd ?? process.cwd(), gate.cwd ?? '.');
  const timeout = gate.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const started = Date.now();

  let result = spawnSync(gate.command, gate.args ?? [], {
    cwd,
    encoding: 'utf8',
    timeout,
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  });

  // On Windows, package-manager shims such as pnpm are .cmd wrappers that
  // spawnSync cannot execute directly. The argv is plan-controlled, not input.
  const code = (result.error as NodeJS.ErrnoException | undefined)?.code;
  if (process.platform === 'win32' && code && ['ENOENT', 'EINVAL'].includes(code)) {
    result = spawnSync([gate.command, ...(gate.args ?? [])].join(' '), {
      cwd,
      shell: true,
      encoding: 'utf8',
      timeout,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
    });
  }

  const timed_out =
    (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT' ||
    result.signal === 'SIGTERM';
  const exit_code = result.status ?? (timed_out ? 124 : 127);
  const output = [result.stdout, result.stderr, result.error?.message]
    .filter((part) => typeof part === 'string' && part !== '')
    .join('\n');

  return {
    exit_code,
    output: tail(output.trim(), DEFAULT_TAIL),
    duration_ms: Date.now() - started,
    timed_out,
  };
}

export function displayCommand(gate: Gate): string {
  return [gate.command, ...(gate.args ?? [])].join(' ');
}

export function normalizeCommand(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}

/**
 * The forbidden rule for a command, or null. An `approved_exceptions` entry is
 * an exact command match: it allows `git push origin main` and still refuses
 * `git push origin dev` or `git push --force origin main`.
 */
export function forbiddenMatch(
  command: string,
  policy: Pick<Policy, 'forbidden_commands' | 'approved_exceptions'>,
): string | null {
  const normalized = normalizeCommand(command);
  for (const exception of policy.approved_exceptions ?? []) {
    if (typeof exception?.command === 'string' && normalizeCommand(exception.command) === normalized) {
      return null;
    }
  }
  for (const entry of policy.forbidden_commands ?? []) {
    if (typeof entry !== 'string' || entry.trim() === '') continue;
    const forbidden = normalizeCommand(entry);
    if (normalized === forbidden || normalized.startsWith(`${forbidden} `)) return entry;
  }
  return null;
}

/**
 * Check every gate against the policy before any command runs. Order: the
 * first token must be allowed; a recorded exception allows the exact command;
 * a forbidden entry refuses it; anything else is allowed.
 */
export function checkGatePolicy(
  gates: Gate[],
  policy: Policy,
  policyPath: string,
): string[] {
  const allowed = policy.allowed_commands;
  const errors: string[] = [];
  for (const gate of gates ?? []) {
    if (Array.isArray(allowed) && !allowed.includes(gate.command)) {
      errors.push(
        `gate ${gate.id}: command "${gate.command}" is not in allowed_commands (${policyPath})`,
      );
      continue;
    }
    const forbidden = forbiddenMatch(displayCommand(gate), policy);
    if (forbidden) {
      errors.push(
        `gate ${gate.id}: command "${displayCommand(gate)}" matches forbidden "${forbidden}" (${policyPath})`,
      );
    }
  }
  return errors;
}

function tail(text: string, limit: number): string {
  return text.length <= limit ? text : text.slice(text.length - limit);
}
