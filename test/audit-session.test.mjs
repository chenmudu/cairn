import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditTranscript } from '../scripts/audit-session.mjs';

function writeTranscript(t, messages) {
  const dir = mkdtempSync(join(tmpdir(), 'cairn-audit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'model-io-test.jsonl');
  writeFileSync(file, JSON.stringify({ request: { body: { messages } } }) + '\n');
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
    ASSISTANT([TOOL('Bash', { command: 'node scripts/validate-mission.mjs missions/000-bootstrap' })]),
    RESULT('ok: missions/000-bootstrap'),
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

test('does not count the injected system reminder as a human correction', (t) => {
  const file = writeTranscript(t, [
    USER('<system-reminder> Contents of AGENTS.md: 目标是识别真实问题。 </system-reminder>'),
    ASSISTANT([TEXT('继续实现。')]),
  ]);

  const report = auditTranscript(file, { planFiles: [], repoRoot: 'D:/repo' });

  assert.equal(report.signals.alignmentCorrections.length, 0);
  assert.equal(report.turns, 0);
});
