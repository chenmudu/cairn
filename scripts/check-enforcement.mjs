#!/usr/bin/env node
/**
 * check-enforcement.mjs — enforce the failure-mode map in docs/drift-control.md.
 *
 * The "Enforced by" cell is the machine contract. It contains only a
 * comma-separated list of backticked repo-relative paths to a script or test,
 * or `human` / `review`. A script must be run by CI or a test; a test runs
 * under `node --test`. A historical task id is not a check, and prose in that
 * cell is not a check.
 *
 * The Chinese table must carry the same tokens: translations explain the rule,
 * they do not get a different enforcement map.
 *
 * Usage: node scripts/check-enforcement.mjs [root]
 * Exit:  0 valid, 1 violation, 2 usage.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const COLUMNS = 5;
const HUMAN = new Set(['human', 'review']);
const TEST_NAME = /\.test\.(mjs|ts|js)$/;
const TASK_ID = /\bT-\d+\b/i;

function read(file) {
  return readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function relativePath(root, file) {
  return relative(root, file).split('\\').join('/');
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) walk(file, files);
    else if (stat.isFile()) files.push(file);
  }
  return files;
}

/**
 * Parse the failure-mode table. The header must contain both "#" and the
 * localized enforcement column name.
 */
function parseTable(text, header) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(
    (line) => line.startsWith('|') && line.includes('| # |') && line.includes(`| ${header} |`),
  );
  if (start === -1) return null;

  const rows = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows;
}

function parseCell(cell, where, errors) {
  const tokens = cell.split(',').map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) {
    errors.push(`${where}: empty enforcement cell`);
    return [];
  }

  const parsed = [];
  for (const token of tokens) {
    const quoted = token.startsWith('`') && token.endsWith('`');
    const value = quoted ? token.slice(1, -1).trim() : token;
    if (HUMAN.has(value)) {
      parsed.push({ kind: 'human', value });
      continue;
    }
    if (!quoted) {
      errors.push(`${where}: "${token}" must be a backticked path or human/review`);
      continue;
    }
    if (TASK_ID.test(value)) {
      errors.push(`${where}: "${value}" is a historical task id, not a check`);
      continue;
    }
    parsed.push({ kind: 'path', value });
  }
  return parsed;
}

function referencedByTest(root, path) {
  const name = basename(path);
  for (const file of walk(join(root, 'test'))) {
    if (!/\.(mjs|ts|js)$/.test(file)) continue;
    const text = read(file);
    if (text.includes(path) || text.includes(name)) return true;
  }
  return false;
}

function referencedByCi(root, path) {
  const workflow = join(root, '.github', 'workflows', 'gates.yml');
  return existsSync(workflow) && read(workflow).includes(path);
}

function checkPath(root, path, where, errors) {
  if (isAbsolute(path) || path.split('/').includes('..')) {
    errors.push(`${where}: "${path}" must be repo-relative`);
    return;
  }
  const file = resolve(root, path);
  const rel = relative(root, file);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    errors.push(`${where}: "${path}" escapes the repository`);
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    errors.push(`${where}: "${path}" does not exist`);
    return;
  }
  if (path.startsWith('test/')) {
    if (!TEST_NAME.test(path)) {
      errors.push(`${where}: "${path}" is not a node --test file`);
    }
    return;
  }
  if (!path.startsWith('scripts/')) {
    errors.push(`${where}: "${path}" must be under scripts/ or test/`);
    return;
  }
  if (!referencedByCi(root, path) && !referencedByTest(root, path)) {
    errors.push(`${where}: "${path}" is run by neither CI nor a test`);
  }
}

function checkRows(root, rows, source, errors) {
  if (!rows || rows.length === 0) {
    errors.push(`${source}: no failure-mode rows`);
    return [];
  }

  const parsed = [];
  for (const [index, cells] of rows.entries()) {
    const where = `${source} row ${index + 1}`;
    if (cells.length !== COLUMNS) {
      errors.push(`${where}: expected ${COLUMNS} cells, found ${cells.length}`);
      continue;
    }
    const number = Number(cells[0]);
    if (!Number.isInteger(number) || number !== index + 1) {
      errors.push(`${where}: row number must be ${index + 1}`);
    }
    const tokens = parseCell(cells[COLUMNS - 1], where, errors);
    for (const token of tokens) {
      if (token.kind === 'path') checkPath(root, token.value, where, errors);
    }
    parsed.push(tokens);
  }
  return parsed;
}

function tokenKey(tokens) {
  return tokens.map((token) => `${token.kind}:${token.value}`).sort();
}

/** Pure check: returns every enforcement-map violation under root. */
export function checkEnforcement(root = process.cwd()) {
  const errors = [];
  const enFile = join(root, 'docs', 'drift-control.md');
  const zhFile = join(root, 'docs', 'drift-control.zh.md');
  if (!existsSync(enFile)) {
    return { ok: false, errors: [`${relativePath(root, enFile)}: missing`], rows: 0, human: 0 };
  }
  if (!existsSync(zhFile)) {
    return { ok: false, errors: [`${relativePath(root, zhFile)}: missing`], rows: 0, human: 0 };
  }

  const enRows = parseTable(read(enFile), 'Enforced by');
  const zhRows = parseTable(read(zhFile), '执行点');
  if (!enRows) return { ok: false, errors: ['docs/drift-control.md: missing the failure-mode table'], rows: 0, human: 0 };
  if (!zhRows) return { ok: false, errors: ['docs/drift-control.zh.md: missing the failure-mode table'], rows: 0, human: 0 };

  const en = checkRows(root, enRows, 'docs/drift-control.md', errors);
  const zh = checkRows(root, zhRows, 'docs/drift-control.zh.md', errors);

  if (enRows.length !== zhRows.length) {
    errors.push(
      `docs/drift-control.zh.md: ${zhRows.length} rows, English has ${enRows.length}`,
    );
  } else {
    for (let index = 0; index < enRows.length; index += 1) {
      const left = tokenKey(en[index] ?? []);
      const right = tokenKey(zh[index] ?? []);
      if (left.join('|') !== right.join('|')) {
        errors.push(
          `docs/drift-control.zh.md row ${index + 1}: enforcement tokens differ from the English table`,
        );
      }
    }
  }

  const human = en.flat().filter((token) => token.kind === 'human').length;
  return { ok: errors.length === 0, errors, rows: enRows.length, human };
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length > 1) {
    process.stderr.write('usage: node scripts/check-enforcement.mjs [root]\n');
    return 2;
  }
  const report = checkEnforcement(args[0] ?? process.cwd());
  if (report.ok) {
    process.stdout.write(`enforcement: ok (${report.rows} rows, ${report.human} human/review)\n`);
    return 0;
  }
  for (const error of report.errors) process.stderr.write(`${error}\n`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv);
}
