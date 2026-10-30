import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

export const SUPERPOWERS_PIN = '7.0.1';
export const IMPECCABLE_SKILL_PIN = '4.8.0';
export const IMPECCABLE_ENGINE_PIN = '0.1.18';
export const IMPECCABLE_PIN = '4.8.0+df3a4ab';

export type PackStatus = 'present' | 'absent' | 'mismatch' | 'not-invocable';

export interface SuperpowersReport {
  status: PackStatus;
  path: string | null;
  version: string | null;
  pin: string;
  invocable: boolean;
}

export interface ImpeccableReport {
  status: PackStatus;
  path: string | null;
  pin: string;
  skill_version: string | null;
  engine_version: string | null;
  engine: string | null;
  invocable: boolean;
}

export interface PackReport {
  schema: 'cairn/packs@0.1';
  packs: {
    superpowers: SuperpowersReport;
    impeccable: ImpeccableReport;
  };
}

export interface DetectOptions {
  home?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}

const SEMVER = /^\d+\.\d+\.\d+$/;

/**
 * Detection reads the filesystem only: no launcher, no network, no download.
 * A missing engine is reported as not-invocable so the caller uses the floor
 * instead of triggering a lazy install.
 */
export function detectPacks(options: DetectOptions = {}): PackReport {
  const home = options.home ?? homedir();
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  return {
    schema: 'cairn/packs@0.1',
    packs: {
      superpowers: detectSuperpowers(home, env),
      impeccable: detectImpeccable(home, env, platform),
    },
  };
}

function detectSuperpowers(home: string, env: NodeJS.ProcessEnv): SuperpowersReport {
  const override = text(env.CAIRN_SUPERPOWERS_DIR);
  const candidates = override
    ? [resolve(override)]
    : [
        join(home, '.zcode/cli/plugins/cache/superpowers-dev/superpowers'),
        join(home, '.claude/plugins/cache/superpowers-dev/superpowers'),
      ].flatMap(versionDirs);

  const path = candidates.find((candidate) => existsSync(join(candidate, 'skills')));
  if (!path) {
    return {
      status: 'absent',
      path: candidates[0] ?? null,
      version: null,
      pin: SUPERPOWERS_PIN,
      invocable: false,
    };
  }
  const version = readLineVersion(join(path, 'VERSION')) ?? versionName(path);
  const invocable = existsSync(join(path, 'skills'));
  return {
    status: invocable && version === SUPERPOWERS_PIN ? 'present' : 'mismatch',
    path,
    version,
    pin: SUPERPOWERS_PIN,
    invocable,
  };
}

function detectImpeccable(
  home: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): ImpeccableReport {
  const override = text(env.CAIRN_IMPECCABLE_DIR);
  const candidates = override
    ? [resolve(override)]
    : [
        join(home, '.zcode/skills/impeccable'),
        ...(text(env.CAIRN_IMPECCABLE_SRC)
          ? [join(resolve(env.CAIRN_IMPECCABLE_SRC as string), '.claude/skills/impeccable')]
          : []),
      ];
  const path = candidates.find((candidate) => existsSync(join(candidate, 'SKILL.md')));
  if (!path) {
    return {
      status: 'absent',
      path: candidates[0] ?? null,
      pin: IMPECCABLE_PIN,
      skill_version: null,
      engine_version: null,
      engine: null,
      invocable: false,
    };
  }

  const skillVersion = frontmatterVersion(join(path, 'SKILL.md'));
  const expectedEngine = readLineVersion(join(path, 'scripts/VERSION'));
  const binName = platform === 'win32' ? 'impeccable.exe' : 'impeccable';
  const engines = text(env.CAIRN_IMPECCABLE_BIN)
    ? [resolve(env.CAIRN_IMPECCABLE_BIN as string)]
    : [
        join(home, '.impeccable/bin', expectedEngine ?? '', binName),
        join(path, 'scripts', platform === 'win32' ? 'impeccable.cmd' : 'impeccable'),
      ];
  const engine = engines.find((candidate) => existsSync(candidate)) ?? null;
  const engineVersion = engine ? (versionName(engine) ?? expectedEngine) : expectedEngine;

  const present =
    skillVersion === IMPECCABLE_SKILL_PIN &&
    engine !== null &&
    engineVersion === IMPECCABLE_ENGINE_PIN;
  const status: PackStatus = !engine
    ? 'not-invocable'
    : present
      ? 'present'
      : 'mismatch';
  return {
    status,
    path,
    pin: IMPECCABLE_PIN,
    skill_version: skillVersion,
    engine_version: engineVersion,
    engine,
    invocable: engine !== null,
  };
}

function versionDirs(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && SEMVER.test(entry.name))
    .map((entry) => join(root, entry.name))
    .sort((a, b) => compareVersions(basename(b), basename(a)));
}

function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function versionName(path: string): string | null {
  const name = basename(path);
  if (SEMVER.test(name)) return name;
  const parent = basename(resolve(path, '..'));
  return SEMVER.test(parent) ? parent : null;
}

function readLineVersion(file: string): string | null {
  if (!existsSync(file)) return null;
  const line = readFileSync(file, 'utf8').trim().split(/\r?\n/)[0];
  return line ? line.trim() : null;
}

function frontmatterVersion(file: string): string | null {
  if (!existsSync(file)) return null;
  const block = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const line = block?.[1].match(/^version:\s*(.+)$/m);
  return line ? line[1].trim() : null;
}

function text(value: string | undefined): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
