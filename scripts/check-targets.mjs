#!/usr/bin/env node
/**
 * check-targets.mjs — verify the target artifacts against the ledger hash chain.
 *
 * `mission_created` freezes `mission.md`, `policy.md`, `plan.md`, and
 * `docs/protocol.md` by sha256. Each `mission_amended` event carries the old and
 * new hashes. This check rebuilds the latest expected hash for every target and
 * compares it to the file on disk.
 *
 * Ledger keys appear in two forms: repo-relative (`docs/protocol.md`,
 * `.cairn/missions/<id>/...`) and mission-relative (`mission.md`, `plan.md`).
 * Both are normalized to a repo-relative path before the chain is applied.
 *
 * Usage: node scripts/check-targets.mjs [mission-dir] [--root <dir>]
 * Exit:  0 valid, 1 violation, 2 usage.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readMission } from './validate-mission.mjs';
import { resolveMission } from '../src/paths.ts';

const TARGETS = ['mission.md', 'policy.md', 'plan.md'];

function read(file) {
  return readFileSync(file);
}

function hash(file) {
  return `sha256:${createHash('sha256').update(read(file)).digest('hex')}`;
}

function normalizeKey(key, missionRel, errors) {
  if (typeof key !== 'string' || key.trim() === '') {
    errors.push('ledger artifact key must be a non-empty path');
    return null;
  }
  const value = key.replace(/\\/g, '/');
  if (isAbsolute(value) || value.split('/').includes('..')) {
    errors.push(`ledger artifact key "${key}" must be repo-relative`);
    return null;
  }
  if (value.includes('/')) return value;
  return `${missionRel}/${value}`;
}

function applyArtifacts(map, artifacts, where, missionRel, errors) {
  for (const [key, value] of Object.entries(artifacts ?? {})) {
    const path = normalizeKey(key, missionRel, errors);
    if (!path) continue;
    if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) {
      errors.push(`${where}: ${key} must be sha256:<64 hex>`);
      continue;
    }
    map.set(path, value);
  }
}

function checkOld(map, oldArtifacts, where, missionRel, errors) {
  for (const [key, value] of Object.entries(oldArtifacts ?? {})) {
    const path = normalizeKey(key, missionRel, errors);
    if (!path) continue;
    if (!map.has(path)) {
      errors.push(`${where}: old hash names ${path}, which was never frozen`);
      continue;
    }
    if (map.get(path) !== value) {
      errors.push(`${where}: old hash for ${path} does not match the chain`);
    }
  }
}

/** Pure check: returns every target-hash violation for a mission under root. */
export function checkTargets(root, missionDir) {
  const errors = [];
  const repo = resolve(root);
  const mission = resolve(missionDir);
  const missionRel = relative(repo, mission).split('\\').join('/');
  if (missionRel === '' || missionRel.startsWith('..') || isAbsolute(missionRel)) {
    return { ok: false, errors: [`${missionDir}: mission is outside ${root}`], checked: 0 };
  }

  const loaded = readMission(mission);
  if (!loaded.mission) {
    return { ok: false, errors: [`${missionRel}: no mission contract`], checked: 0 };
  }
  const created = loaded.events.find((event) => event.event === 'mission_created');
  if (!created) {
    return { ok: false, errors: [`${missionRel}: no mission_created event`], checked: 0 };
  }

  const expected = new Map();
  applyArtifacts(expected, created.data?.artifacts, 'mission_created', missionRel, errors);
  for (const event of loaded.events) {
    if (event.event !== 'mission_amended') continue;
    const where = `mission_amended ${event.ts ?? ''}`.trim();
    checkOld(expected, event.data?.old, where, missionRel, errors);
    applyArtifacts(expected, event.data?.new, where, missionRel, errors);
  }

  for (const name of TARGETS) {
    const path = `${missionRel}/${name}`;
    if (!expected.has(path)) errors.push(`${missionRel}: ${name} was never frozen`);
  }
  if (!expected.has('docs/protocol.md')) errors.push('docs/protocol.md was never frozen');

  let checked = 0;
  for (const [path, want] of expected) {
    const file = resolve(repo, path);
    const rel = relative(repo, file);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      errors.push(`${path}: artifact escapes the repository`);
      continue;
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      errors.push(`${path}: artifact is missing`);
      continue;
    }
    checked += 1;
    const got = hash(file);
    if (got !== want) {
      errors.push(`${path}: hash ${got} does not match the ledger ${want}`);
    }
  }

  return { ok: errors.length === 0, errors, checked };
}

function valueAfter(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value) throw new Error(`${name} needs a directory`);
  return value;
}

function main(argv) {
  const args = argv.slice(2);
  let root;
  let mission;
  try {
    root = valueAfter(args, '--root') ?? process.cwd();
    const option = args.indexOf('--root');
    if (option !== -1) args.splice(option, 2);
    if (args.length > 1) {
      process.stderr.write('usage: node scripts/check-targets.mjs [mission-dir] [--root <dir>]\n');
      return 2;
    }
    mission = resolveMission(args[0] ?? undefined, root);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  const report = checkTargets(root, mission);
  if (report.ok) {
    process.stdout.write(`targets: ok (${report.checked} artifacts)\n`);
    return 0;
  }
  for (const error of report.errors) process.stderr.write(`${error}\n`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv);
}
