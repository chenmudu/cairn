import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Gate } from './plan.ts';

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

function tail(text: string, limit: number): string {
  return text.length <= limit ? text : text.slice(text.length - limit);
}
