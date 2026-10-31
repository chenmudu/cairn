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

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXEMPT = new Set(['docs/i18n.md']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'evidence']);

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
  for (const path of walk(join(root, 'method'))) {
    if (path.endsWith('.md') && !path.endsWith('.zh.md')) files.push(path);
  }
  for (const path of walk(join(root, '.cairn', 'missions'))) {
    const base = path.replace(/\\/g, '/');
    if (!base.endsWith('.md') || base.endsWith('.zh.md')) continue;
    if (/\/(mission|plan|policy)\.md$/.test(base) || /\/inbox\/[^/]+\.md$/.test(base)) {
      files.push(path);
    }
  }
  for (const path of walk(join(root, '.zcode', 'skills'))) {
    if (path.endsWith('SKILL.md')) files.push(path);
  }
  return files;
}

function companionFor(file) {
  if (file.endsWith('README.md')) {
    const nested = file.replace(/README\.md$/, 'README.zh.md');
    return existsSync(nested) ? nested : file.replace(/README\.md$/, 'README.zh-CN.md');
  }
  if (file.endsWith('SKILL.md')) return file.replace(/SKILL\.md$/, 'SKILL.zh.md');
  return file.replace(/\.md$/, '.zh.md');
}

function relativePath(root, file) {
  return relative(root, file).split('\\').join('/');
}

/**
 * The header names the source path and, optionally, a revision. A revision that
 * contains a hex commit is checked against git; label-only revisions are for a
 * human to judge, because the checker cannot know what "the T1 commit" means.
 */
function headerOf(first) {
  const match = /^<!--\s*translation of\s+(\S+?)(?:\s+at\s+(.+?))?\s*(?:;|-->)/.exec(first);
  return match ? { source: match[1], revision: (match[2] ?? '').trim() } : null;
}

function isReachableCommit(root, sha) {
  try {
    execFileSync('git', ['-C', root, 'merge-base', '--is-ancestor', sha, 'HEAD'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/** Pure check: returns missing companions and companions with a bad header. */
export function checkBilingual(root = process.cwd()) {
  const base = resolve(root);
  const missing = [];
  const missingHeader = [];
  const sourceErrors = [];
  const unreachableCommit = [];

  for (const file of canonicalFiles(base)) {
    const rel = relativePath(base, file);
    if (EXEMPT.has(rel)) continue;
    const companion = companionFor(file);
    if (!existsSync(companion)) {
      missing.push(rel);
      continue;
    }
    const first = readFileSync(companion, 'utf8').split(/\r?\n/, 1)[0] ?? '';
    const header = headerOf(first);
    if (!header) {
      missingHeader.push(relativePath(base, companion));
      continue;
    }
    const companionRel = relativePath(base, companion);
    if (header.source !== rel) {
      sourceErrors.push(`${companionRel}: header names ${header.source}, expected ${rel}`);
    }
    if (!existsSync(resolve(base, header.source))) {
      sourceErrors.push(`${companionRel}: source does not exist: ${header.source}`);
    }
    const commit = /\b([0-9a-f]{7,40})\b/i.exec(header.revision)?.[1];
    if (commit && !isReachableCommit(base, commit)) {
      unreachableCommit.push(`${companionRel}: commit ${commit} is not reachable from HEAD`);
    }
  }

  return {
    ok:
      missing.length === 0 &&
      missingHeader.length === 0 &&
      sourceErrors.length === 0 &&
      unreachableCommit.length === 0,
    missing,
    missingHeader,
    sourceErrors,
    unreachableCommit,
  };
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
  for (const message of report.sourceErrors) {
    process.stderr.write(`source header mismatch: ${message}\n`);
  }
  for (const message of report.unreachableCommit) {
    process.stderr.write(`unreachable commit: ${message}\n`);
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv);
}
