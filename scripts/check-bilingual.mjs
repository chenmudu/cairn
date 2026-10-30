#!/usr/bin/env node
/**
 * check-bilingual.mjs — enforce the documentation contract in docs/i18n.md.
 *
 * Every human-facing canonical file needs a Chinese companion whose first line
 * names its source. Machine-checked contracts stay English; the companion is
 * explanatory and never overrides the English file.
 *
 * Usage: node scripts/check-bilingual.mjs [root]
 * Exit:  0 every pair exists, 1 missing pair or missing header, 2 usage.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXEMPT = new Set(['docs/i18n.md']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'evidence', 'inbox']);

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if (stat.isFile()) files.push(path);
  }
  return files;
}

function canonicalFiles(root) {
  const files = [];
  const readme = join(root, 'README.md');
  if (existsSync(readme)) files.push(readme);

  for (const path of walk(join(root, 'docs'))) {
    if (path.endsWith('.md') && !path.endsWith('.zh.md')) files.push(path);
  }
  for (const path of walk(join(root, 'templates'))) {
    if (path.endsWith('.md') && !path.endsWith('.zh.md')) files.push(path);
  }
  for (const path of walk(join(root, '.cairn', 'missions'))) {
    const base = path.replace(/\\/g, '/');
    if (!base.endsWith('.md') || base.endsWith('.zh.md')) continue;
    if (/\/(mission|plan|policy)\.md$/.test(base)) files.push(path);
  }
  for (const path of walk(join(root, '.zcode', 'skills'))) {
    if (path.endsWith('SKILL.md')) files.push(path);
  }
  return files;
}

function companionFor(file) {
  if (file.endsWith('README.md')) return file.replace(/README\.md$/, 'README.zh-CN.md');
  if (file.endsWith('SKILL.md')) return file.replace(/SKILL\.md$/, 'SKILL.zh.md');
  return file.replace(/\.md$/, '.zh.md');
}

function relativePath(root, file) {
  return relative(root, file).split('\\').join('/');
}

/** Pure check: returns missing companions and companions without a source header. */
export function checkBilingual(root = process.cwd()) {
  const base = resolve(root);
  const missing = [];
  const missingHeader = [];

  for (const file of canonicalFiles(base)) {
    const rel = relativePath(base, file);
    if (EXEMPT.has(rel)) continue;
    const companion = companionFor(file);
    if (!existsSync(companion)) {
      missing.push(rel);
      continue;
    }
    const first = readFileSync(companion, 'utf8').split(/\r?\n/, 1)[0] ?? '';
    if (!/^<!--\s*translation of\s+/.test(first)) {
      missingHeader.push(relativePath(base, companion));
    }
  }

  return { ok: missing.length === 0 && missingHeader.length === 0, missing, missingHeader };
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length > 1) {
    process.stderr.write('usage: node scripts/check-bilingual.mjs [root]\n');
    return 2;
  }
  const report = checkBilingual(args[0] ?? process.cwd());
  if (report.ok) {
    process.stdout.write('bilingual: ok\n');
    return 0;
  }
  for (const file of report.missing) {
    process.stderr.write(`missing Chinese companion: ${file}\n`);
  }
  for (const file of report.missingHeader) {
    process.stderr.write(`missing translation header: ${file}\n`);
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv);
}
