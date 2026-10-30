#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_EXAMPLE = 'method/examples/0001-docs-tick';
const PRODUCT_SECTIONS = ['## Problem', '## Audience', '## Promise', '## Non-goals', '## Acceptance'];
const REQUIRED_FILES = ['mission.md', 'plan.md', 'policy.md', 'ledger.jsonl', 'product.md', 'README.md', 'README.zh.md'];

function option(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1];
}

function checkProduct(dir, errors) {
  const file = join(dir, 'product.md');
  if (!existsSync(file)) {
    errors.push(`${file}: missing`);
    return;
  }
  const text = readFileSync(file, 'utf8');
  for (const section of PRODUCT_SECTIONS) {
    if (!text.includes(section)) errors.push(`product.md: missing ${section}`);
  }
}

function checkLedger(dir, errors) {
  const file = join(dir, 'ledger.jsonl');
  if (!existsSync(file)) {
    errors.push(`${file}: missing`);
    return;
  }
  const events = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        errors.push('ledger.jsonl: not valid JSON');
        return null;
      }
    })
    .filter(Boolean);
  const byName = (name) => events.filter((event) => event.event === name);
  for (const name of ['mission_created', 'gate_result', 'task_done', 'review_result']) {
    if (byName(name).length === 0) errors.push(`ledger.jsonl: missing ${name}`);
  }

  for (const gate of byName('gate_result')) {
    if (gate.data?.exit_code !== 0) errors.push('gate_result: exit_code is not 0');
    const evidence = gate.data?.evidence;
    if (typeof evidence !== 'string' || !existsSync(resolve(dir, evidence))) {
      errors.push(`gate_result: evidence ${String(evidence)} does not exist`);
    }
  }

  for (const done of byName('task_done')) {
    const gates = Array.isArray(done.data?.gates) ? done.data.gates : [];
    if (gates.length === 0) errors.push('task_done: no gates');
    for (const gate of gates) {
      if (gate.exit_code !== 0) errors.push('task_done: a gate exit_code is not 0');
      if (typeof gate.evidence !== 'string' || !existsSync(resolve(dir, gate.evidence))) {
        errors.push(`task_done: evidence ${String(gate.evidence)} does not exist`);
      }
    }
  }

  for (const review of byName('review_result')) {
    if (review.data?.verdict !== 'pass') errors.push('review_result: verdict is not pass');
    const packs = Array.isArray(review.data?.packs) ? review.data.packs : [];
    if (packs.length === 0) errors.push('review_result: no pack records');
    packs.forEach((pack, index) => {
      for (const field of ['capability', 'pack', 'version', 'mode', 'evidence']) {
        if (typeof pack[field] !== 'string' || pack[field].trim() === '') {
          errors.push(`review_result.packs[${index}]: missing ${field}`);
        }
      }
      if (pack.mode === 'not-applicable' && (typeof pack.reason !== 'string' || pack.reason.trim() === '')) {
        errors.push(`review_result.packs[${index}]: not-applicable without a reason`);
      }
    });
  }
}

function checkExample(dir) {
  const errors = [];
  if (!existsSync(dir)) return [`${dir}: missing`];
  for (const name of REQUIRED_FILES) {
    if (!existsSync(join(dir, name))) errors.push(`${join(dir, name)}: missing`);
  }
  checkProduct(dir, errors);
  checkLedger(dir, errors);
  return errors;
}

function main() {
  const argv = process.argv.slice(2);
  const productOnly = argv.includes('--product');
  const example = option(argv, '--example');
  const product = option(argv, '--product');
  const dir = resolve(ROOT, example ?? (productOnly && product ? product : DEFAULT_EXAMPLE));
  const errors = productOnly ? [] : checkExample(dir);
  if (productOnly) checkProduct(dir, errors);
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`example: ${error}`));
    return 1;
  }
  console.log('example: ok');
  return 0;
}

process.exitCode = main();
