#!/usr/bin/env node
/**
 * validate-mission.mjs — the T-001 gate.
 *
 * Zero-dependency validator for one Cairn mission directory. It implements the
 * checks named in .cairn/missions/000-bootstrap/plan.md (T-001):
 *
 *  1. required frontmatter fields on mission.md, policy.md, plan.md;
 *  2. task ids unique, dependencies resolvable, status in the allowed set;
 *  3. every task has at least one severity: block gate;
 *  4. ledger.jsonl parses as one JSON object per line, with known event names;
 *  5. every task_done names base, head, and a blocking gate at exit 0;
 *  6. every evidence path named by the ledger exists.
 *
 * Evidence paths are resolved relative to the mission directory, matching the
 * artifact layout in docs/protocol.md.
 *
 * YAML support is a deliberate subset: block mappings and sequences, flow
 * sequences, quoted and bare scalars, and null. Anything else is an error, not
 * a guess. Scalars stay strings; only null and flow sequences are typed.
 *
 * Usage: node scripts/validate-mission.mjs <mission-dir>
 * Exit:  0 valid, 1 invalid, 2 usage error.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const TASK_STATUSES = new Set(['todo', 'active', 'review', 'done', 'parked']);
const SEVERITIES = new Set(['block', 'advisory']);
const EVENT_NAMES = new Set([
  'mission_created',
  'mission_amended',
  'task_started',
  'gate_result',
  'review_result',
  'authorization',
  'ruling',
  'task_done',
  'task_parked',
  'mission_done',
  'mission_aborted',
  'note',
]);

const MISSION_FIELDS = ['schema', 'id', 'title', 'status', 'created', 'owner', 'acceptance'];
const POLICY_FIELDS = [
  'schema',
  'mission',
  'budgets',
  'allowed_commands',
  'forbidden_commands',
  'stop_conditions',
];
const PLAN_FIELDS = ['schema', 'mission', 'tasks'];

/**
 * Read the three frontmatter documents and the ledger without judging them.
 * The goal guard uses this so there is one parser, not two.
 */
export function readMission(dir) {
  const errors = [];
  const missionDir = resolve(dir);

  if (!existsSync(missionDir) || !statSync(missionDir).isDirectory()) {
    return {
      missionDir,
      mission: null,
      policy: null,
      plan: null,
      events: [],
      errors: [`${dir}: not a directory`],
    };
  }

  const mission = readFrontmatter(missionDir, 'mission.md', errors);
  const policy = readFrontmatter(missionDir, 'policy.md', errors);
  const plan = readFrontmatter(missionDir, 'plan.md', errors);
  const events = readLedger(missionDir, mission, errors);
  return { missionDir, mission, policy, plan, events, errors };
}

export function validateMission(dir) {
  const { mission, policy, plan, events, errors } = readMission(dir);
  const missionDir = resolve(dir);
  if (!mission && !policy && !plan) return { ok: false, errors };

  requireFields(mission, 'mission.md', MISSION_FIELDS, errors);
  requireFields(policy, 'policy.md', POLICY_FIELDS, errors);
  requireFields(plan, 'plan.md', PLAN_FIELDS, errors);

  if (mission && (!Array.isArray(mission.acceptance) || mission.acceptance.length === 0)) {
    fail(errors, 'mission.md', '"acceptance" must be a non-empty list');
  }
  if (policy) {
    for (const field of ['allowed_commands', 'forbidden_commands', 'stop_conditions']) {
      const value = policy[field];
      if (value !== undefined && value !== null && !Array.isArray(value)) {
        fail(errors, 'policy.md', `"${field}" must be a list`);
      }
    }
  }

  const sameMission = (document, file) => {
    if (!mission || !document) return;
    if (document.mission !== mission.id) {
      fail(
        errors,
        file,
        `"mission" is ${JSON.stringify(document.mission)}, expected ${JSON.stringify(mission.id)}`,
      );
    }
  };
  sameMission(policy, 'policy.md');
  sameMission(plan, 'plan.md');

  const tasks = new Map();
  if (plan && Array.isArray(plan.tasks)) {
    if (plan.tasks.length === 0) fail(errors, 'plan.md', '"tasks" must not be empty');
    plan.tasks.forEach((task, index) => {
      const where = `plan.md tasks[${index}]`;
      if (!isMapping(task)) {
        fail(errors, where, 'must be a mapping');
        return;
      }
      if (typeof task.id !== 'string' || task.id === '') {
        fail(errors, where, 'missing a string "id"');
        return;
      }
      if (tasks.has(task.id)) fail(errors, `plan.md ${task.id}`, 'duplicate task id');
      else tasks.set(task.id, task);

      if (!TASK_STATUSES.has(task.status)) {
        fail(
          errors,
          `plan.md ${task.id}`,
          `status ${JSON.stringify(task.status)} is not one of ${[...TASK_STATUSES].join(', ')}`,
        );
      }

      if (!Array.isArray(task.gates)) {
        fail(errors, `plan.md ${task.id}`, '"gates" must be a list');
        return;
      }
      let blocking = 0;
      task.gates.forEach((gate, gateIndex) => {
        const gateWhere = `plan.md ${task.id} gates[${gateIndex}]`;
        if (!isMapping(gate)) {
          fail(errors, gateWhere, 'must be a mapping');
          return;
        }
        if (typeof gate.id !== 'string' || gate.id === '') {
          fail(errors, gateWhere, 'missing a string "id"');
        }
        if (typeof gate.command !== 'string' || gate.command === '') {
          fail(errors, gateWhere, 'missing a string "command"');
        }
        if (!Array.isArray(gate.args) || gate.args.some((arg) => typeof arg !== 'string')) {
          fail(errors, gateWhere, '"args" must be a list of strings');
        }
        if (!SEVERITIES.has(gate.severity)) {
          fail(
            errors,
            gateWhere,
            `severity ${JSON.stringify(gate.severity)} is not block or advisory`,
          );
        }
        if (gate.severity === 'block') blocking += 1;
      });
      if (blocking === 0) {
        fail(errors, `plan.md ${task.id}`, 'has no severity: block gate');
      }
    });

    for (const [id, task] of tasks) {
      if (task.deps === undefined || task.deps === null) continue;
      if (!Array.isArray(task.deps)) {
        fail(errors, `plan.md ${id}`, '"deps" must be a list');
        continue;
      }
      for (const dep of task.deps) {
        if (typeof dep !== 'string' || !tasks.has(dep)) {
          fail(errors, `plan.md ${id}`, `depends on unknown task ${JSON.stringify(dep)}`);
        }
      }
    }
  }

  for (const event of events) {
    if (event.event === 'task_done') checkTaskDone(event, tasks, errors);
    if (event.event === 'gate_result') checkGateResult(missionDir, event, errors);
    if (event.event === 'mission_amended') checkMissionAmended(event, errors);
  }

  return { ok: errors.length === 0, errors };
}

function checkTaskDone(event, tasks, errors) {
  const where = `ledger.jsonl task_done ${event.task ?? '(no task)'}`;
  const task = typeof event.task === 'string' ? tasks.get(event.task) : undefined;
  if (!task) {
    fail(errors, where, 'names a task that is not in plan.md');
    return;
  }
  const data = isMapping(event.data) ? event.data : {};
  if (!isMapping(event.data)) fail(errors, where, 'missing a data object');
  if (typeof data.base !== 'string' || data.base === '') fail(errors, where, 'missing data.base');
  if (typeof data.head !== 'string' || data.head === '') fail(errors, where, 'missing data.head');
  if (
    !Array.isArray(data.commits) ||
    data.commits.length === 0 ||
    data.commits.some((commit) => typeof commit !== 'string')
  ) {
    fail(errors, where, 'missing a non-empty data.commits list');
  }
  if (!Array.isArray(data.gates)) {
    fail(errors, where, 'missing a data.gates list');
    return;
  }
  const blocking = new Set(
    (Array.isArray(task.gates) ? task.gates : [])
      .filter((gate) => isMapping(gate) && gate.severity === 'block')
      .map((gate) => gate.id),
  );
  const passed = data.gates.some(
    (gate) =>
      isMapping(gate) &&
      typeof gate.id === 'string' &&
      blocking.has(gate.id) &&
      gate.exit_code === 0,
  );
  if (!passed) fail(errors, where, 'records no severity: block gate at exit 0');
}

function checkMissionAmended(event, errors) {
  const where = 'ledger.jsonl mission_amended';
  const data = isMapping(event.data) ? event.data : null;
  if (!data) {
    fail(errors, where, 'missing a data object');
    return;
  }
  for (const field of ['old', 'new']) {
    if (!isMapping(data[field]) || Object.keys(data[field]).length === 0) {
      fail(errors, where, `data.${field} must be a non-empty mapping of path to sha256`);
      continue;
    }
    for (const [path, hash] of Object.entries(data[field])) {
      if (typeof hash !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(hash)) {
        fail(errors, where, `data.${field}.${path} must be sha256:<64 hex>`);
      }
    }
  }
  if (
    !Array.isArray(data.acceptance) ||
    data.acceptance.length === 0 ||
    data.acceptance.some((id) => typeof id !== 'string')
  ) {
    fail(errors, where, 'data.acceptance must be a non-empty list of acceptance ids');
  }
  if (typeof data.why !== 'string' || data.why === '') {
    fail(errors, where, 'missing data.why');
  }
  if (data.approved_by !== 'human' && data.approved_by !== 'cairn') {
    fail(errors, where, 'data.approved_by must be human or cairn');
  }
}

function checkGateResult(missionDir, event, errors) {
  const where = `ledger.jsonl gate_result ${event.task ?? ''}`.trim();
  const data = isMapping(event.data) ? event.data : null;
  if (!data) {
    fail(errors, where, 'missing a data object');
    return;
  }
  for (const field of ['gate', 'command', 'evidence']) {
    if (typeof data[field] !== 'string' || data[field] === '') {
      fail(errors, where, `missing data.${field}`);
    }
  }
  if (!Number.isInteger(data.exit_code)) fail(errors, where, 'data.exit_code must be an integer');
  if (typeof data.evidence !== 'string' || data.evidence === '') return;

  const evidencePath = resolve(missionDir, data.evidence);
  if (!isInside(missionDir, evidencePath)) {
    fail(errors, where, `evidence path escapes the mission directory: ${data.evidence}`);
    return;
  }
  if (!existsSync(evidencePath) || !statSync(evidencePath).isFile()) {
    fail(errors, where, `evidence file does not exist: ${data.evidence}`);
  }
}

function readLedger(missionDir, mission, errors) {
  const file = join(missionDir, 'ledger.jsonl');
  if (!existsSync(file) || !statSync(file).isFile()) {
    fail(errors, 'ledger.jsonl', 'missing');
    return [];
  }
  const text = readFileSync(file, 'utf8');
  if (text.trim() === '') return [];

  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();

  const events = [];
  lines.forEach((line, index) => {
    const where = `ledger.jsonl:${index + 1}`;
    if (line.trim() === '') {
      fail(errors, where, 'blank line');
      return;
    }
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      fail(errors, where, 'not valid JSON');
      return;
    }
    if (!isMapping(event)) {
      fail(errors, where, 'must be a JSON object');
      return;
    }
    if (!EVENT_NAMES.has(event.event)) {
      fail(errors, where, `unknown event ${JSON.stringify(event.event)}`);
      return;
    }
    if (typeof event.ts !== 'string' || Number.isNaN(Date.parse(event.ts))) {
      fail(errors, where, 'missing or unparseable "ts"');
    }
    if (typeof event.actor !== 'string' || event.actor === '') {
      fail(errors, where, 'missing "actor"');
    }
    if (mission && event.mission !== mission.id) {
      fail(
        errors,
        where,
        `"mission" is ${JSON.stringify(event.mission)}, expected ${JSON.stringify(mission.id)}`,
      );
    }
    events.push(event);
  });
  return events;
}

function requireFields(document, file, fields, errors) {
  if (!document) return;
  for (const field of fields) {
    const value = document[field];
    if (value === undefined || value === null || value === '') {
      fail(errors, file, `missing required field "${field}"`);
    }
  }
}

function fail(errors, file, message) {
  errors.push(`${file}: ${message}`);
}

/**
 * Parse one document's YAML frontmatter. Throws on missing or unsupported
 * YAML; callers decide whether that is a validation error or a hard failure.
 */
export function parseFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(normalized);
  if (!match) throw new Error('missing or unterminated YAML frontmatter');
  return parseYaml(match[1], 1);
}

function readFrontmatter(missionDir, name, errors) {
  const file = join(missionDir, name);
  if (!existsSync(file) || !statSync(file).isFile()) {
    fail(errors, name, 'missing');
    return null;
  }
  try {
    return parseFrontmatter(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(errors, name, error.message);
    return null;
  }
}

/** Parse a YAML subset. Throws on any construct outside it. */
function parseYaml(text, lineOffset) {
  const lines = [];
  const raw = text.split(/\r?\n/);
  for (let index = 0; index < raw.length; index++) {
    const stripped = stripComment(raw[index]);
    if (stripped.trim() === '') continue;
    if (stripped.includes('\t')) {
      throw new Error(`line ${index + 1 + lineOffset}: tab indentation is not supported`);
    }
    lines.push({
      indent: stripped.length - stripped.trimStart().length,
      text: stripped.trim(),
      line: index + 1 + lineOffset,
    });
  }
  if (lines.length === 0) return {};

  const [value, position] = parseBlock(lines, 0);
  if (position !== lines.length) {
    throw new Error(`line ${lines[position].line}: unexpected content`);
  }
  if (!isMapping(value)) throw new Error('frontmatter must be a mapping');
  return value;
}

function parseBlock(lines, position) {
  const line = lines[position];
  if (isSequenceLine(line)) return parseSequence(lines, position);
  return parseMapping(lines, position);
}

function parseMapping(lines, position) {
  const indent = lines[position].indent;
  const result = {};
  while (position < lines.length) {
    const line = lines[position];
    if (line.indent < indent) break;
    if (line.indent > indent) throw new Error(`line ${line.line}: unexpected indentation`);
    if (isSequenceLine(line)) {
      throw new Error(`line ${line.line}: sequence item where a key was expected`);
    }
    const entry = splitKey(line.text);
    if (!entry) throw new Error(`line ${line.line}: expected "key: value"`);
    const [key, rest] = entry;
    if (Object.hasOwn(result, key)) throw new Error(`line ${line.line}: duplicate key "${key}"`);

    if (rest !== '') {
      result[key] = parseValue(rest, line.line);
      position += 1;
      continue;
    }
    const next = lines[position + 1];
    if (next && next.indent > indent) {
      const [value, nextPosition] = parseBlock(lines, position + 1);
      result[key] = value;
      position = nextPosition;
    } else if (next && next.indent === indent && isSequenceLine(next)) {
      const [value, nextPosition] = parseSequence(lines, position + 1);
      result[key] = value;
      position = nextPosition;
    } else {
      result[key] = null;
      position += 1;
    }
  }
  return [result, position];
}

function parseSequence(lines, position) {
  const indent = lines[position].indent;
  const result = [];
  while (position < lines.length) {
    const line = lines[position];
    if (line.indent !== indent) break;
    if (!isSequenceLine(line)) break;

    const rest = line.text === '-' ? '' : line.text.slice(2).trim();
    if (rest === '') {
      const next = lines[position + 1];
      if (next && next.indent > indent) {
        const [value, nextPosition] = parseBlock(lines, position + 1);
        result.push(value);
        position = nextPosition;
      } else {
        result.push(null);
        position += 1;
      }
      continue;
    }
    if (isMappingEntry(rest)) {
      const [value, nextPosition] = parseItemMapping(lines, position, indent, rest);
      result.push(value);
      position = nextPosition;
      continue;
    }
    result.push(parseValue(rest, line.line));
    position += 1;
  }
  return [result, position];
}

function parseItemMapping(lines, position, sequenceIndent, firstEntry) {
  const indent = sequenceIndent + 2;
  const result = {};
  let [key, rest] = splitKey(firstEntry);
  let line = lines[position];

  if (rest !== '') {
    result[key] = parseValue(rest, line.line);
    position += 1;
  } else {
    const next = lines[position + 1];
    if (next && next.indent > indent) {
      const [value, nextPosition] = parseBlock(lines, position + 1);
      result[key] = value;
      position = nextPosition;
    } else {
      result[key] = null;
      position += 1;
    }
  }

  while (position < lines.length) {
    line = lines[position];
    if (line.indent < indent) break;
    if (line.indent > indent) throw new Error(`line ${line.line}: unexpected indentation`);
    if (isSequenceLine(line)) {
      throw new Error(`line ${line.line}: unexpected sequence item`);
    }
    const entry = splitKey(line.text);
    if (!entry) throw new Error(`line ${line.line}: expected "key: value"`);
    [key, rest] = entry;
    if (Object.hasOwn(result, key)) throw new Error(`line ${line.line}: duplicate key "${key}"`);

    if (rest !== '') {
      result[key] = parseValue(rest, line.line);
      position += 1;
      continue;
    }
    const next = lines[position + 1];
    if (next && next.indent > indent) {
      const [value, nextPosition] = parseBlock(lines, position + 1);
      result[key] = value;
      position = nextPosition;
    } else if (next && next.indent === indent && isSequenceLine(next)) {
      const [value, nextPosition] = parseSequence(lines, position + 1);
      result[key] = value;
      position = nextPosition;
    } else {
      result[key] = null;
      position += 1;
    }
  }
  return [result, position];
}

function parseValue(text, line) {
  const value = text.trim();
  if (value === '') return null;
  if (value === '[]') return [];
  if (value.startsWith('[')) return parseFlowSequence(value, line);
  if (value.startsWith('{')) {
    throw new Error(`line ${line}: flow mappings are not supported`);
  }
  if (value.startsWith('|') || value.startsWith('>')) {
    throw new Error(`line ${line}: block scalars are not supported`);
  }
  if (value.startsWith('"')) return parseDoubleQuoted(value, line);
  if (value.startsWith("'")) return parseSingleQuoted(value, line);
  if (value === 'null' || value === '~') return null;
  return value;
}

function parseFlowSequence(text, line) {
  if (!text.endsWith(']')) throw new Error(`line ${line}: unterminated flow sequence`);
  const inner = text.slice(1, -1);
  if (inner.trim() === '') return [];
  return splitFlow(inner).map((part) => parseValue(part, line));
}

function splitFlow(text) {
  const parts = [];
  let current = '';
  let quote = null;
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote) {
      current += char;
      if (char === '\\' && quote === '"') {
        current += text[index + 1] ?? '';
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '[') {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ']') {
      depth -= 1;
      current += char;
      continue;
    }
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

function parseDoubleQuoted(text, line) {
  let value = '';
  for (let index = 1; index < text.length; index++) {
    const char = text[index];
    if (char === '\\') {
      const next = text[index + 1];
      if (next === undefined) throw new Error(`line ${line}: unterminated escape`);
      value += next;
      index += 1;
      continue;
    }
    if (char === '"') {
      if (text.slice(index + 1).trim() !== '') {
        throw new Error(`line ${line}: unexpected text after quoted scalar`);
      }
      return value;
    }
    value += char;
  }
  throw new Error(`line ${line}: unterminated quoted scalar`);
}

function parseSingleQuoted(text, line) {
  let value = '';
  for (let index = 1; index < text.length; index++) {
    const char = text[index];
    if (char === "'") {
      if (text[index + 1] === "'") {
        value += "'";
        index += 1;
        continue;
      }
      if (text.slice(index + 1).trim() !== '') {
        throw new Error(`line ${line}: unexpected text after quoted scalar`);
      }
      return value;
    }
    value += char;
  }
  throw new Error(`line ${line}: unterminated quoted scalar`);
}

function stripComment(line) {
  let quote = null;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quote) {
      if (char === '\\' && quote === '"') {
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '#' && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index);
    }
  }
  return line;
}

function splitKey(text) {
  const match = /^([A-Za-z0-9_.-]+):(?: (.*))?$/.exec(text);
  if (!match) return null;
  return [match[1], match[2] ?? ''];
}

function isMappingEntry(text) {
  if (
    text.startsWith('"') ||
    text.startsWith("'") ||
    text.startsWith('[') ||
    text.startsWith('{')
  ) {
    return false;
  }
  return splitKey(text) !== null;
}

function isSequenceLine(line) {
  return line.text === '-' || line.text.startsWith('- ');
}

function isMapping(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isInside(root, target) {
  const normalize = (value) => (process.platform === 'win32' ? value.toLowerCase() : value);
  const parent = normalize(root);
  const child = normalize(target);
  return child === parent || child.startsWith(parent.endsWith(sep) ? parent : parent + sep);
}

function main(argv) {
  const args = argv.slice(2);
  const expectInvalid = args.includes('--expect-invalid');
  const rest = args.filter((arg) => arg !== '--expect-invalid');
  if (rest.length !== 1) {
    process.stderr.write(
      'usage: node scripts/validate-mission.mjs [--expect-invalid] <mission-dir>\n',
    );
    return 2;
  }
  const [dir] = rest;
  const result = validateMission(dir);

  if (expectInvalid) {
    if (result.ok) {
      process.stderr.write(`unexpected valid: ${dir}\n`);
      return 1;
    }
    process.stdout.write(`invalid as expected: ${dir}\n`);
    return 0;
  }

  if (!result.ok) {
    process.stderr.write(`invalid: ${dir}\n`);
    for (const error of result.errors) process.stderr.write(`  ${error}\n`);
    return 1;
  }
  process.stdout.write(`ok: ${dir}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv);
}
