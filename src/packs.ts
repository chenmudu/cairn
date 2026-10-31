import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import type { LedgerEvent } from './ledger.ts';
import type { Plan, Task } from './plan.ts';
import { isEvidenceFile } from './verify.ts';

export const SUPERPOWERS_PIN = '7.0.1';
export const IMPECCABLE_SKILL_PIN = '4.8.0';
export const IMPECCABLE_ENGINE_PIN = '0.1.18';
export const IMPECCABLE_PIN = '4.8.0+df3a4ab';

export type PackStatus = 'present' | 'absent' | 'mismatch' | 'not-invocable';

export type PackMode = 'use' | 'human-in-loop' | 'not-applicable' | 'absent';

export const PACK_NAMES = ['superpowers', 'impeccable'] as const;
export type PackName = (typeof PACK_NAMES)[number];

const MODES = new Set<PackMode>(['use', 'human-in-loop', 'not-applicable', 'absent']);
const CODE_FILE = /\.(ts|tsx|js|mjs|cjs|jsx|py|rs|go|java|rb|sh)$/i;
const UI_FILE = /\.(html?|css|scss|sass|less|tsx|jsx|vue|svelte|astro|svg)$/i;

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
 * instead of triggering a lazy install. `invocable` is a filesystem fact, not a
 * session fact: the CLI adapter may list no plugin skills while the desktop
 * session resolves them. Only a recorded session call proves invocability.
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

export interface ExpectedPack {
  capability: string;
  skill: string;
}

/**
 * The deterministic selection rule, shared by `cairn next` and `cairn record`:
 * a code file means test-first, a UI file means design-check. A record that
 * disagrees with this rule is refused, so a code task cannot report
 * verify-before-close to escape test-first.
 */
export function expectedPacks(files: string[]): Record<PackName, ExpectedPack> {
  const code = files.some((file) => CODE_FILE.test(file));
  const ui = files.some((file) => UI_FILE.test(file));
  return {
    superpowers: code
      ? { capability: 'test-first', skill: 'superpowers:test-driven-development' }
      : {
          capability: 'verify-before-close',
          skill: 'superpowers:verification-before-completion',
        },
    impeccable: ui
      ? { capability: 'design-check', skill: 'impeccable:design-check' }
      : { capability: 'design-review', skill: 'impeccable:design-review' },
  };
}

export function hasUiSurface(files: string[]): boolean {
  return files.some((file) => UI_FILE.test(file));
}

/**
 * The packs requirement is monotonic: the first `task_done` that carries the
 * key opens it, and every later `task_done` must carry it. The ledger decides,
 * never a task id.
 */
export function packsActivated(events: LedgerEvent[]): boolean {
  return events.some(
    (event) => event.event === 'task_done' && isRecord(event.data) && 'packs' in event.data,
  );
}

/**
 * Validate one task's two-entry pack record against the task's declared files.
 * Every evidence value must be a mission-relative file; a `use` entry must be a
 * text file whose first line names its skill, and test-first evidence must show
 * a RED block and a GREEN block.
 */
export function validatePackRecords(
  missionDir: string,
  task: Task,
  value: unknown,
): string[] {
  const where = `${task.id}: packs`;
  if (!Array.isArray(value)) return [`${where} must be a list of two entries`];
  if (value.length !== 2) {
    return [`${where} must have exactly two entries, one per pack`];
  }
  const expected = expectedPacks(task.files ?? []);
  const errors: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    errors.push(...entryErrors(missionDir, entry, `${where}[${index}]`, expected));
    if (isRecord(entry) && typeof entry.pack === 'string') {
      if (seen.has(entry.pack)) errors.push(`${where}: duplicate pack ${entry.pack}`);
      seen.add(entry.pack);
    }
  });
  for (const pack of PACK_NAMES) {
    if (!seen.has(pack)) errors.push(`${where}: needs a ${pack} entry`);
  }
  return errors;
}

/**
 * Mission-level constraints, active once any `task_done` carries packs: at
 * least one superpowers `use`, and Impeccable either sees a UI surface and uses
 * design-check, or is all-not-applicable with `ui_surface: none` in the closing
 * review.
 */
export function validateMissionPacks(
  missionDir: string,
  plan: Plan,
  events: LedgerEvent[],
  review: LedgerEvent | undefined,
): string[] {
  const done = events.filter(
    (event) => event.event === 'task_done' && isRecord(event.data) && 'packs' in event.data,
  );
  if (done.length === 0) return [];

  const errors: string[] = [];
  for (const event of done) {
    const task = plan.tasks.find((candidate) => candidate.id === event.task);
    if (!task) {
      errors.push(`mission packs: task_done ${String(event.task)} names no task in plan.md`);
      continue;
    }
    errors.push(...validatePackRecords(missionDir, task, event.data.packs));
  }

  if (!done.some((event) => packEntry(event, 'superpowers')?.mode === 'use')) {
    errors.push('mission packs: no superpowers mode: use');
  }

  const files = plan.tasks.flatMap((task) => task.files ?? []);
  if (hasUiSurface(files)) {
    const used = done.some((event) => {
      const entry = packEntry(event, 'impeccable');
      return entry?.mode === 'use' && entry.capability === 'design-check';
    });
    if (!used) {
      errors.push('mission packs: a declared UI file requires an impeccable design-check mode: use');
    }
  } else {
    const allNotApplicable = done.every(
      (event) => packEntry(event, 'impeccable')?.mode === 'not-applicable',
    );
    if (allNotApplicable && review?.data.ui_surface !== 'none') {
      errors.push(
        'mission packs: an all-not-applicable Impeccable record requires the closing review to record ui_surface: none',
      );
    }
  }

  return errors;
}

function entryErrors(
  missionDir: string,
  value: unknown,
  where: string,
  expected: Record<PackName, ExpectedPack>,
): string[] {
  if (!isRecord(value)) return [`${where}: must be an object`];
  const errors: string[] = [];
  for (const field of ['capability', 'pack', 'skill', 'version', 'mode', 'evidence']) {
    if (typeof value[field] !== 'string' || value[field].trim() === '') {
      errors.push(`${where}: missing ${field}`);
    }
  }
  if (typeof value.pack === 'string' && !PACK_NAMES.includes(value.pack as PackName)) {
    errors.push(`${where}: pack must be superpowers or impeccable`);
  }
  if (typeof value.mode !== 'string' || !MODES.has(value.mode as PackMode)) {
    errors.push(`${where}: mode must be use, human-in-loop, not-applicable, or absent`);
  }

  const expectation =
    typeof value.pack === 'string' && PACK_NAMES.includes(value.pack as PackName)
      ? expected[value.pack as PackName]
      : undefined;
  if (expectation && value.capability !== expectation.capability) {
    errors.push(`${where}: capability must be ${expectation.capability} for this task`);
  }
  if (expectation && value.skill !== expectation.skill) {
    errors.push(`${where}: skill must be ${expectation.skill} for this task`);
  }

  if (value.mode === 'not-applicable' && !nonEmpty(value.reason)) {
    errors.push(`${where}: not-applicable requires a reason`);
  }
  if (value.mode === 'absent' && !nonEmpty(value.reason)) {
    errors.push(`${where}: absent requires a reason`);
  }
  if (typeof value.evidence === 'string' && !isEvidenceFile(missionDir, value.evidence)) {
    errors.push(`${where}: evidence is not a file in the mission: ${value.evidence}`);
  }
  if (value.mode === 'use') {
    errors.push(...useEvidenceErrors(missionDir, value, where, expectation));
  }
  return errors;
}

function useEvidenceErrors(
  missionDir: string,
  value: Record<string, unknown>,
  where: string,
  expectation: ExpectedPack | undefined,
): string[] {
  if (typeof value.evidence !== 'string' || !isEvidenceFile(missionDir, value.evidence)) return [];
  const text = readFileSync(resolve(missionDir, value.evidence), 'utf8');
  if (text.includes('\u0000')) return [`${where}: use evidence must be a text file`];

  const errors: string[] = [];
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  if (typeof value.skill === 'string' && !firstLine.includes(value.skill)) {
    errors.push(`${where}: use evidence first line must name ${value.skill}`);
  }
  if (expectation?.capability === 'test-first') {
    if (!/^\s*RED\b/m.test(text)) {
      errors.push(`${where}: test-first evidence must contain a RED block`);
    }
    if (!/^\s*GREEN\b/m.test(text)) {
      errors.push(`${where}: test-first evidence must contain a GREEN block`);
    }
  }
  return errors;
}

function packEntry(event: LedgerEvent, pack: PackName): Record<string, unknown> | undefined {
  const packs = event.data.packs;
  if (!Array.isArray(packs)) return undefined;
  return packs.find(
    (entry): entry is Record<string, unknown> =>
      isRecord(entry) && entry.pack === pack,
  );
}

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
