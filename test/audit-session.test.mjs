import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { auditTranscript, formatAudit } from '../scripts/audit-session.mjs';

function writeTranscript(t, messages) {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-audit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'model-io-test.jsonl');
  writeFileSync(file, JSON.stringify({ request: { body: { messages } } }) + '\n');
  return file;
}

function writeTranscriptRecords(t, records) {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-audit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'model-io-test.jsonl');
  writeFileSync(
    file,
    records.map((messages) => JSON.stringify({ request: { body: { messages } } })).join('\n') + '\n',
  );
  return file;
}

const USER = (text) => ({ role: 'user', content: text });
const ASSISTANT = (blocks) => ({ role: 'assistant', content: blocks });
const TEXT = (text) => ({ type: 'text', text });
const TOOL = (name, input) => ({ type: 'tool_use', name, input });
const RESULT = (text) => ({
  role: 'user',
  content: [{ type: 'tool_result', content: text }],
});

test('reports alignment corrections, gate-less claims, unplanned writes, and confirmation asks', (t) => {
  const file = writeTranscript(t, [
    USER('定位又错了，这个项目到底是做什么的？你理解吗'),
    ASSISTANT([
      TEXT('已完成，全部通过。'),
      TOOL('Write', { file_path: 'D:/project/github/cairn/README.md' }),
    ]),
    RESULT('ok'),
    ASSISTANT([TEXT('需要你确认后再继续。')]),
  ]);

  const report = auditTranscript(file, {
    planFiles: ['src/foo.ts'],
    repoRoot: 'D:/project/github/cairn',
  });

  assert.equal(report.signals.alignmentCorrections.length, 1);
  assert.equal(report.signals.claimsWithoutGate.length, 1);
  assert.equal(report.signals.unplannedWrites.length, 1);
  assert.equal(report.signals.unplannedWrites[0].path, 'README.md');
  assert.equal(report.signals.confirmationRequests.length, 1);
  assert.equal(report.verdict, 'drift');
});

test('does not flag a claim in a turn that ran a gate', (t) => {
  const file = writeTranscript(t, [
    USER('继续'),
    ASSISTANT([TOOL('Bash', { command: 'node scripts/validate-mission.mjs .cairn/missions/000-bootstrap' })]),
    RESULT('ok: .cairn/missions/000-bootstrap'),
    ASSISTANT([TEXT('已完成，闸门 exit 0。')]),
  ]);

  const report = auditTranscript(file, { planFiles: [], repoRoot: 'D:/repo' });

  assert.equal(report.signals.claimsWithoutGate.length, 0);
  assert.equal(report.signals.alignmentCorrections.length, 0);
  assert.equal(report.verdict, 'clean');
});

test('ignores writes outside the repository', (t) => {
  const file = writeTranscript(t, [
    USER('继续'),
    ASSISTANT([TOOL('Write', { file_path: 'C:/Users/Administrator/AppData/Local/Temp/scratch.mjs' })]),
  ]);

  const report = auditTranscript(file, {
    planFiles: [],
    repoRoot: 'D:/project/github/cairn',
  });

  assert.equal(report.signals.unplannedWrites.length, 0);
});

test('reads a long transcript in bounded chunks', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-audit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'model-io-large.jsonl');
  const lines = [];
  for (let index = 0; index < 300; index++) {
    const messages = index === 299
      ? [USER('继续'), ASSISTANT([TEXT('完成。')]), RESULT('ok')]
      : [USER(`turn ${index}`)];
    lines.push(JSON.stringify({ request: { body: { messages } } }));
  }
  writeFileSync(file, `${lines.join('\n')}\n`);

  const report = auditTranscript(file, { planFiles: [], repoRoot: 'D:/repo' });

  assert.equal(report.records, 300);
  assert.equal(report.messages, 3);
});

test('fails on an over-limit line instead of crashing', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-audit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'model-io-oversize.jsonl');
  writeFileSync(file, `${JSON.stringify({ x: 'x'.repeat(4096) })}\n`);

  assert.throws(
    () => auditTranscript(file, { planFiles: [], repoRoot: 'D:/repo', maxLineBytes: 1024 }),
    /line exceeds/,
  );
});

test('does not count the injected system reminder as a human correction', (t) => {
  const file = writeTranscript(t, [
    USER('<system-reminder> Contents of AGENTS.md: 目标是识别真实问题。 </system-reminder>'),
    ASSISTANT([TEXT('继续实现。')]),
  ]);

  const report = auditTranscript(file, { planFiles: [], repoRoot: 'D:/repo' });

  assert.equal(report.signals.alignmentCorrections.length, 0);
  assert.equal(report.turns, 0);
});

test('keeps the human text after an injected reminder', (t) => {
  const file = writeTranscript(t, [
    USER('<system-reminder> context </system-reminder>\n定位又错了，这个项目是做什么的？'),
    ASSISTANT([TEXT('我重新读 README。')]),
  ]);

  const report = auditTranscript(file, { planFiles: [], repoRoot: 'D:/repo' });

  assert.equal(report.turns, 1);
  assert.equal(report.signals.alignmentCorrections.length, 1);
});

test('does not audit writes replayed inside a compaction summary', (t) => {
  const summary = [
    'This session is being continued from a previous conversation that ran out of context.',
    'The summary below covers the earlier portion of the conversation.',
    'Primary Request and Intent: 目标是用自举验证 Cairn。',
    'The last diagnostic output showed 11 unplanned writes; 已完成 repair。',
  ].join('\n');
  const file = writeTranscript(t, [
    USER(summary),
    ASSISTANT([
      TEXT('继续。'),
      TOOL('Write', { file_path: 'D:/repo/src/gates.ts' }),
      TOOL('Write', { file_path: 'D:/repo/README.md' }),
    ]),
    RESULT('ok'),
    USER('1. approve 0005 2. audit-session 仍把摘要里重放的历史写入报成 unplanned writes'),
    ASSISTANT([TOOL('Write', { file_path: 'D:/repo/src/packs.ts' })]),
    RESULT('ok'),
  ]);

  const report = auditTranscript(file, {
    planFiles: ['src/packs.ts'],
    repoRoot: 'D:/repo',
  });

  assert.equal(report.turns, 1);
  assert.equal(report.signals.alignmentCorrections.length, 0);
  assert.equal(report.signals.claimsWithoutGate.length, 0);
  assert.equal(report.signals.unplannedWrites.length, 0);
  assert.equal(report.verdict, 'clean');
});

test('audits work anchored by a summary when no later user turn exists', (t) => {
  const summary = [
    'This session is being continued from a previous conversation that ran out of context.',
    'Primary Request and Intent: 目标是完成 T7。',
  ].join('\n');
  const file = writeTranscript(t, [
    USER(summary),
    ASSISTANT([TOOL('Write', { file_path: 'D:/repo/src/new.ts' })]),
    RESULT('ok'),
  ]);

  const report = auditTranscript(file, { planFiles: [], repoRoot: 'D:/repo' });

  assert.equal(report.turns, 1);
  assert.equal(report.signals.alignmentCorrections.length, 0);
  assert.deepEqual(
    report.signals.unplannedWrites.map((item) => item.path),
    ['src/new.ts'],
  );
});

test('audits the latest request, not a larger pre-compaction snapshot', (t) => {
  const stale = [
    USER('定位又错了，这个项目是做什么的？'),
    ASSISTANT([TOOL('Write', { file_path: 'D:/repo/src/old.ts' })]),
    RESULT('ok'),
    ASSISTANT([TEXT('继续')]),
    RESULT('ok'),
  ];
  const latest = [
    USER('继续'),
    ASSISTANT([TOOL('Write', { file_path: 'D:/repo/src/new.ts' })]),
    RESULT('ok'),
  ];
  const file = writeTranscriptRecords(t, [stale, latest]);

  const report = auditTranscript(file, { planFiles: [], repoRoot: 'D:/repo' });

  assert.equal(report.messages, 3);
  assert.equal(report.turns, 1);
  assert.deepEqual(
    report.signals.unplannedWrites.map((item) => item.path),
    ['src/new.ts'],
  );
  assert.equal(report.signals.alignmentCorrections.length, 0);
});

test('ignores runtime evidence writes under the mission directory', (t) => {
  const file = writeTranscript(t, [
    USER('继续'),
    ASSISTANT([
      TOOL('Write', {
        file_path: 'D:/repo/.cairn/missions/001/evidence/T8/review.json',
      }),
    ]),
  ]);

  const report = auditTranscript(file, { planFiles: [], repoRoot: 'D:/repo' });

  assert.equal(report.signals.unplannedWrites.length, 0);
});

test('recognizes a mission_amended event as an amendment', (t) => {
  const file = writeTranscript(t, [USER('继续'), ASSISTANT([TEXT('ok')])]);
  const dir = mkdtempSync(join(tmpdir(), 'cairn-audit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const ledger = join(dir, 'ledger.jsonl');
  writeFileSync(
    ledger,
    `${JSON.stringify({
      ts: '2026-10-31T00:00:00.000Z',
      event: 'mission_amended',
      mission: 'demo',
      actor: 'cairn',
      data: { old: {}, new: {}, acceptance: ['A1'], why: 'test', approved_by: 'cairn' },
    })}\n`,
  );

  const report = auditTranscript(file, { planFiles: [], repoRoot: 'D:/repo', ledgerFile: ledger });

  assert.equal(report.amendmentRecorded, true);
});

test('a write inside an authorized path is not drift', (t) => {
  const file = writeTranscript(t, [
    USER('继续'),
    ASSISTANT([TOOL('Write', { file_path: 'D:/repo/docs/guide.md' })]),
    ASSISTANT([TOOL('Write', { file_path: 'D:/repo/README.md' })]),
  ]);
  const report = auditTranscript(file, {
    planFiles: [],
    repoRoot: 'D:/repo',
    authorizations: [{ paths: ['docs/guide.md'], why: 'human widened the write set' }],
  });
  assert.equal(report.signals.unplannedWrites.length, 1);
  assert.equal(report.signals.unplannedWrites[0].path, 'README.md');
  assert.equal(report.signals.unusedAuthorizations.length, 0);
  assert.equal(report.verdict, 'drift');
});

test('an authorization with no matching write is reported separately', (t) => {
  const file = writeTranscript(t, [USER('继续'), ASSISTANT([TEXT('nothing written')])]);
  const report = auditTranscript(file, {
    planFiles: [],
    repoRoot: 'D:/repo',
    authorizations: [{ paths: ['src/new.ts'], why: 'expected a new file' }],
  });
  assert.equal(report.signals.unplannedWrites.length, 0);
  assert.equal(report.signals.unusedAuthorizations.length, 1);
  assert.equal(report.signals.unusedAuthorizations[0].paths[0], 'src/new.ts');
  assert.equal(report.verdict, 'attention');
});

test('a forbidden command without an exception is a violation', (t) => {
  const file = writeTranscript(t, [
    USER('继续'),
    ASSISTANT([TOOL('Bash', { command: 'git push origin dev' })]),
    RESULT('refused'),
  ]);
  const report = auditTranscript(file, {
    planFiles: [],
    repoRoot: 'D:/repo',
    policy: {
      forbidden_commands: ['git push'],
      approved_exceptions: [{ command: 'git push origin main' }],
    },
  });
  assert.equal(report.signals.policyViolations.length, 1);
  assert.equal(report.signals.policyViolations[0].command, 'git push origin dev');
  assert.equal(report.signals.policyViolations[0].forbidden, 'git push');
  assert.equal(report.verdict, 'drift');
});

test('a forbidden command covered by an exception is not a violation', (t) => {
  const file = writeTranscript(t, [
    USER('继续'),
    ASSISTANT([TOOL('Bash', { command: 'git push origin main' })]),
    RESULT('ok'),
  ]);
  const report = auditTranscript(file, {
    planFiles: [],
    repoRoot: 'D:/repo',
    policy: {
      forbidden_commands: ['git push'],
      approved_exceptions: [{ command: 'git push origin main' }],
    },
  });
  assert.equal(report.signals.policyViolations.length, 0);
  assert.equal(report.verdict, 'clean');
});

test('the report names the transcript it read', (t) => {
  const file = writeTranscript(t, [USER('hello')]);
  const report = auditTranscript(file, { planFiles: [], repoRoot: 'D:/repo' });
  assert.equal(report.transcript, resolve(file));
  assert.ok(formatAudit(report).includes(`Transcript: ${resolve(file)}`));
});

test('without an explicit path the report names the latest transcript', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'cairn-home-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const debug = join(home, '.zcode', 'cli', 'debug');
  mkdirSync(debug, { recursive: true });
  const file = join(debug, 'model-io-default.jsonl');
  writeFileSync(file, JSON.stringify({ request: { body: { messages: [USER('hello')] } } }) + '\n');

  const repo = resolve(import.meta.dirname, '..');
  const result = spawnSync(
    process.execPath,
    ['scripts/audit-session.mjs', '--mission', '.cairn/missions/002-completion-integrity'],
    {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, HOME: home, USERPROFILE: home },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(resolve(file)), `report must name ${file}`);
});
