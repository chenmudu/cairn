import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkDecisions, readRouting, routingLines } from '../scripts/check-decisions.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ROUTING = `---
schema: cairn/decision-routing@0.1
adr:
  path: docs/decisions
  sections: [Context, Decision, Consequences]
mission:
  path: .cairn/missions/<id>/inbox
  fields: [Status, Date]
promotion: "explicit move; update the index; never keep two canonical copies"
---

# Decision routing
`;

const ADR = `# 0001 — Test ADR

- Status: proposed
- Date: 2026-10-31

## Context

Context.

## Decision

Decision.

## Consequences

Consequences.
`;

const INBOX = `# Decision 0001 — Test escalation

Status: waiting
Date: 2026-10-31
Serves: B1

## Why

Because.
`;

function companion(source) {
  return `<!-- translation of ${source} at the fixture commit; the English file is authoritative -->\n\n# Translation\n`;
}

function makeRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'cairn-decisions-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs', 'decisions'), { recursive: true });
  mkdirSync(join(root, '.cairn', 'missions', '001-test', 'inbox'), { recursive: true });
  writeFileSync(join(root, 'docs', 'decision-routing.md'), ROUTING);
  writeFileSync(join(root, 'docs', 'decisions', '0001-test.md'), ADR);
  writeFileSync(
    join(root, 'docs', 'decisions', '0001-test.zh.md'),
    companion('docs/decisions/0001-test.md'),
  );
  writeFileSync(join(root, '.cairn', 'missions', '001-test', 'inbox', '0001-test.md'), INBOX);
  writeFileSync(
    join(root, '.cairn', 'missions', '001-test', 'inbox', '0001-test.zh.md'),
    companion('.cairn/missions/001-test/inbox/0001-test.md'),
  );
  return root;
}

test('the repository satisfies its decision routing', () => {
  const report = checkDecisions(repo);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.ok(report.checked.some((file) => file.startsWith('docs/decisions/')));
  assert.ok(report.checked.some((file) => file.includes('/inbox/')));
});

test('the routing source drives the hook lines', () => {
  const routing = readRouting(repo);
  assert.equal(routing.adrPath, 'docs/decisions');
  assert.match(routingLines(repo).join('\n'), /\.cairn\/missions\/<id>\/inbox/);
});

test('accepts a valid ADR and a valid inbox decision', (t) => {
  const report = checkDecisions(makeRoot(t));
  assert.equal(report.ok, true, report.errors.join('\n'));
});

test('rejects an ADR without a Decision section', (t) => {
  const root = makeRoot(t);
  writeFileSync(join(root, 'docs', 'decisions', '0001-test.md'), ADR.replace('## Decision', '## Choice'));
  const report = checkDecisions(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /missing ## Decision/);
});

test('rejects an inbox decision without Serves or Blocks', (t) => {
  const root = makeRoot(t);
  writeFileSync(
    join(root, '.cairn', 'missions', '001-test', 'inbox', '0001-test.md'),
    INBOX.replace('Serves: B1', ''),
  );
  const report = checkDecisions(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /missing Serves or Blocks/);
});

test('rejects an ADR whose Scope says it is a mission decision', (t) => {
  const root = makeRoot(t);
  writeFileSync(
    join(root, 'docs', 'decisions', '0001-test.md'),
    ADR.replace('- Date: 2026-10-31', '- Date: 2026-10-31\n- Scope: mission escalation'),
  );
  const report = checkDecisions(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /path is project-wide \(ADR\)/);
});

test('rejects an inbox decision whose Scope says it is an ADR', (t) => {
  const root = makeRoot(t);
  writeFileSync(
    join(root, '.cairn', 'missions', '001-test', 'inbox', '0001-test.md'),
    `${INBOX}\nScope: project-wide ADR\n`,
  );
  const report = checkDecisions(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /path is mission-scoped/);
});

test('rejects a decision without a Chinese companion', (t) => {
  const root = makeRoot(t);
  rmSync(join(root, 'docs', 'decisions', '0001-test.zh.md'));
  const report = checkDecisions(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /missing Chinese companion/);
});

test('rejects a decision heading outside docs/decisions', (t) => {
  const root = makeRoot(t);
  writeFileSync(join(root, 'docs', '0002-stray.md'), '# 0002 — Stray decision\n');
  const report = checkDecisions(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /decision heading outside docs\/decisions/);
});

test('rejects a decision heading outside the mission inbox', (t) => {
  const root = makeRoot(t);
  writeFileSync(
    join(root, '.cairn', 'missions', '001-test', '0002-stray.md'),
    '# Decision 0002 — Stray escalation\n',
  );
  const report = checkDecisions(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /decision heading outside inbox/);
});

test('rejects a missing or malformed routing source', (t) => {
  const root = makeRoot(t);
  writeFileSync(join(root, 'docs', 'decision-routing.md'), '# no frontmatter\n');
  const report = checkDecisions(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /decision-routing/);
});
