#!/usr/bin/env node
/**
 * check-decisions.mjs — enforce docs/decision-routing.md.
 *
 * One decision, one home:
 *   - project-wide ADRs live in docs/decisions/ and carry Context, Decision, Consequences;
 *   - mission escalations live in .cairn/missions/<id>/inbox/ and carry Status, Date, Serves
 *     (or Blocks).
 *
 * The routing document's frontmatter is the only machine-readable source. The
 * SessionStart hook and the goal brief read the same file. A decision in the
 * wrong directory, missing a required field, or missing its Chinese companion
 * is a failure, not a style issue.
 *
 * Usage: node scripts/check-decisions.mjs [root]
 * Exit:  0 valid, 1 violation, 2 usage.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseFrontmatter, readMission } from './validate-mission.mjs';

const SCHEMA = 'cairn/decision-routing@0.1';
const DECISION_NAME = /^\d{4}-[a-z0-9-]+\.md$/;
const DECISION_HEADING = /^#\s+(?:Decision\s+)?\d{4}\s+[—–-]\s+/m;
const COMPANION_HEADER = /^<!--\s*translation of\s+/;
const REQUIRED_ADR_SECTIONS = ['Context', 'Decision', 'Consequences'];

function isMapping(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function read(file) {
  return readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function relativePath(root, file) {
  return relative(root, file).split('\\').join('/');
}

function field(text, name) {
  const match = new RegExp(`^(?:-\\s*)?${name}\\s*:\\s*(.+)$`, 'm').exec(text);
  return match ? match[1].trim() : null;
}

function hasSection(text, name) {
  return new RegExp(`^##\\s+${name}\\s*$`, 'm').test(text);
}

function checkScope(scope, expected, file, errors) {
  if (!scope) return;
  const ok = expected === 'adr'
    ? /project-wide|\badr\b/i.test(scope)
    : /mission|escalation/i.test(scope);
  if (!ok) {
    const label = expected === 'adr' ? 'project-wide (ADR)' : 'mission-scoped';
    errors.push(`${file}: Scope says "${scope}" but the path is ${label}`);
  }
}

function checkCompanion(root, file, errors) {
  const companion = file.replace(/\.md$/, '.zh.md');
  if (!existsSync(companion)) {
    errors.push(`${relativePath(root, file)}: missing Chinese companion`);
    return;
  }
  const first = read(companion).split(/\r?\n/, 1)[0] ?? '';
  if (!COMPANION_HEADER.test(first)) {
    errors.push(`${relativePath(root, companion)}: missing translation header`);
  }
}

/** Read and validate the single routing source. */
export function readRouting(root = process.cwd()) {
  const file = join(root, 'docs', 'decision-routing.md');
  if (!existsSync(file) || !statSync(file).isFile()) {
    throw new Error('missing docs/decision-routing.md');
  }
  const data = parseFrontmatter(read(file));
  if (!isMapping(data)) throw new Error('docs/decision-routing.md: frontmatter must be a mapping');
  if (data.schema !== SCHEMA) {
    throw new Error(`docs/decision-routing.md: schema must be ${SCHEMA}`);
  }

  const adr = data.adr;
  const mission = data.mission;
  if (!isMapping(adr)) throw new Error('docs/decision-routing.md: adr must be a mapping');
  if (typeof adr.path !== 'string' || adr.path.trim() === '') {
    throw new Error('docs/decision-routing.md: adr.path is required');
  }
  if (!Array.isArray(adr.sections) || !REQUIRED_ADR_SECTIONS.every((name) => adr.sections.includes(name))) {
    throw new Error(`docs/decision-routing.md: adr.sections must include ${REQUIRED_ADR_SECTIONS.join(', ')}`);
  }
  if (!isMapping(mission)) throw new Error('docs/decision-routing.md: mission must be a mapping');
  if (typeof mission.path !== 'string' || !mission.path.includes('<id>')) {
    throw new Error('docs/decision-routing.md: mission.path must contain <id>');
  }
  if (!Array.isArray(mission.fields) || !mission.fields.includes('Status') || !mission.fields.includes('Date')) {
    throw new Error('docs/decision-routing.md: mission.fields must include Status and Date');
  }
  if (typeof data.promotion !== 'string' || data.promotion.trim() === '') {
    throw new Error('docs/decision-routing.md: promotion is required');
  }

  return {
    adrPath: adr.path,
    adrSections: adr.sections,
    missionPath: mission.path,
    missionFields: mission.fields,
    promotion: data.promotion,
  };
}

/** The two lines the SessionStart hook and the goal brief inject. */
export function routingLines(root = process.cwd()) {
  const routing = readRouting(root);
  return [
    `Decision routing: ADR = project-wide decision in ${routing.adrPath}/; mission escalation = decision that closes or blocks one mission acceptance and needs a human answer, in ${routing.missionPath}/.`,
    'Rule: mission-scoped decisions go to the mission inbox; promote to an ADR only when it outlives the mission.',
  ];
}

function checkAdrDir(root, routing, errors, checked) {
  const dir = join(root, routing.adrPath);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    errors.push(`missing ADR directory: ${routing.adrPath}`);
    return;
  }
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md') || name.endsWith('.zh.md') || name === 'README.md') continue;
    const file = join(dir, name);
    if (!statSync(file).isFile()) continue;
    const rel = relativePath(root, file);
    checked.push(rel);
    if (!DECISION_NAME.test(name)) {
      errors.push(`${rel}: ADR filename must be NNNN-slug.md`);
    }
    const text = read(file);
    if (!field(text, 'Status')) errors.push(`${rel}: missing Status`);
    if (!field(text, 'Date')) errors.push(`${rel}: missing Date`);
    for (const section of routing.adrSections) {
      if (!hasSection(text, section)) errors.push(`${rel}: missing ## ${section}`);
    }
    checkScope(field(text, 'Scope'), 'adr', rel, errors);
    checkCompanion(root, file, errors);
  }
}

function checkMissionInbox(root, routing, errors, checked) {
  const [prefix, suffix] = routing.missionPath.split('<id>');
  const missionsDir = join(root, prefix);
  const inboxName = suffix.replace(/^[/\\]+/, '');
  if (!existsSync(missionsDir) || !statSync(missionsDir).isDirectory()) return;

  for (const missionId of readdirSync(missionsDir)) {
    const missionDir = join(missionsDir, missionId);
    if (!statSync(missionDir).isDirectory()) continue;
    const inbox = join(missionDir, inboxName);
    if (!existsSync(inbox) || !statSync(inbox).isDirectory()) continue;

    let acceptance = new Set();
    if (existsSync(join(missionDir, 'mission.md'))) {
      const loaded = readMission(missionDir);
      acceptance = new Set(
        (Array.isArray(loaded.mission?.acceptance) ? loaded.mission.acceptance : [])
          .filter(isMapping)
          .map((item) => item.id),
      );
    }

    for (const name of readdirSync(inbox)) {
      if (!name.endsWith('.md') || name.endsWith('.zh.md') || name === 'index.md') continue;
      const file = join(inbox, name);
      if (!statSync(file).isFile()) continue;
      const rel = relativePath(root, file);
      checked.push(rel);
      if (!DECISION_NAME.test(name)) {
        errors.push(`${rel}: inbox filename must be NNNN-slug.md`);
      }
      const text = read(file);
      const legacy = field(text, 'Legacy') === 'true';
      if (!legacy) {
        for (const required of routing.missionFields) {
          if (!field(text, required)) errors.push(`${rel}: missing ${required}`);
        }
        const link = field(text, 'Serves') ?? field(text, 'Blocks');
        if (!link) errors.push(`${rel}: missing Serves or Blocks`);
        if (link && acceptance.size > 0) {
          const ids = link.split(';')[0].match(/\b([A-Za-z]\d+)\b/g) ?? [];
          for (const id of ids) {
            if (!acceptance.has(id)) {
              errors.push(`${rel}: Serves names unknown acceptance ${id}`);
            }
          }
        }
      }
      checkScope(field(text, 'Scope'), 'mission', rel, errors);
      checkCompanion(root, file, errors);
    }
  }
}

function walkMarkdown(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'evidence') continue;
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) walkMarkdown(file, files);
    else if (stat.isFile() && name.endsWith('.md') && !name.endsWith('.zh.md')) files.push(file);
  }
  return files;
}

function inside(parent, file) {
  const rel = relative(parent, file);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/** A numbered decision heading outside either home is a routing violation. */
function checkStrayDecisions(root, routing, errors) {
  const adrRoot = join(root, routing.adrPath);
  for (const file of walkMarkdown(join(root, 'docs'))) {
    if (inside(adrRoot, file)) continue;
    if (DECISION_HEADING.test(read(file))) {
      errors.push(`${relativePath(root, file)}: decision heading outside ${routing.adrPath}/`);
    }
  }

  const [prefix, suffix] = routing.missionPath.split('<id>');
  const missionsRoot = join(root, prefix);
  const inboxName = suffix.replace(/^[/\\]+/, '');
  if (!existsSync(missionsRoot)) return;
  for (const missionId of readdirSync(missionsRoot)) {
    const missionDir = join(missionsRoot, missionId);
    if (!statSync(missionDir).isDirectory()) continue;
    const inbox = join(missionDir, inboxName);
    for (const file of walkMarkdown(missionDir)) {
      if (inside(inbox, file)) continue;
      if (DECISION_HEADING.test(read(file))) {
        errors.push(`${relativePath(root, file)}: decision heading outside ${inboxName}/`);
      }
    }
  }
}

/** Pure check: returns every routing violation under root. */
export function checkDecisions(root = process.cwd()) {
  const errors = [];
  const checked = [];
  let routing;
  try {
    routing = readRouting(root);
  } catch (error) {
    return { ok: false, errors: [`docs/decision-routing.md: ${error.message}`], checked };
  }
  checkAdrDir(root, routing, errors, checked);
  checkMissionInbox(root, routing, errors, checked);
  checkStrayDecisions(root, routing, errors);
  return { ok: errors.length === 0, errors, checked };
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length > 1) {
    process.stderr.write('usage: node scripts/check-decisions.mjs [root]\n');
    return 2;
  }
  const report = checkDecisions(args[0] ?? process.cwd());
  if (report.ok) {
    process.stdout.write(`decisions: ok (${report.checked.length} files)\n`);
    return 0;
  }
  for (const error of report.errors) process.stderr.write(`${error}\n`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv);
}
