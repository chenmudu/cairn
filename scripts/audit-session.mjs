#!/usr/bin/env node
/**
 * audit-session.mjs — read a ZCode model-io transcript and report drift signals.
 *
 * The point is to make the agent's own trajectory observable:
 *  - how often the human had to correct the goal or positioning;
 *  - claims of completion made in a turn that ran no gate;
 *  - writes outside the files the plan declares;
 *  - questions that push a decision back to the human.
 *
 * It is diagnostic, not a gate. --strict turns a "drift" verdict into exit 1.
 *
 * Usage: node scripts/audit-session.mjs [transcript] [--mission <dir>] [--json]
 *        [--strict] [--out <file>]
 * Exit:  0 report written, 1 strict drift, 2 usage or unreadable transcript.
 */

import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { StringDecoder } from 'node:string_decoder';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readMission } from './validate-mission.mjs';
import { forbiddenMatch } from '../src/gates.ts';
import { resolveMission } from '../src/paths.ts';
const WRITE_TOOLS = new Set(['Write', 'Edit']);
const CLAIM =
  /(已完成|已经完成|已改完|已提交|全部通过|全过|12\/12|任务完成|T-\d+\s*完成|闸门[^\n。]{0,6}(?:通过|绿灯))/i;
const GATE =
  /(validate-mission|--test|typecheck|goal-check|reconcile|node\s+--test|pnpm\s+typecheck|(?:src\/cli\.ts|cairn)\s+verify|check-method|check-bilingual|check-workflow|check-example)/i;
const ALIGN = /(定位|偏离|走偏|理解|目标|做什么|？？)/;
const CONFIRM = /(需要你|请你|回一句|要不要|等你|确认后|由你|你来决定|你确认)/;

export function auditTranscript(file, options = {}) {
  const planFiles = Array.isArray(options.planFiles) ? options.planFiles : [];
  const authorizations = Array.isArray(options.authorizations) ? options.authorizations : [];
  const policy =
    options.policy && typeof options.policy === 'object' ? options.policy : null;
  const repoRoot = options.repoRoot ? resolve(options.repoRoot) : null;
  const { records, messages } = readLatest(file, options.maxLineBytes);
  const turns = buildTurns(messages);

  const alignmentCorrections = turns
    .filter((turn) => !turn.synthetic && ALIGN.test(turn.user))
    .map((turn) => ({
      turn: turn.index,
      message: turn.messageIndex,
      quote: excerpt(turn.user),
    }));

  const claimsWithoutGate = turns
    .filter((turn) => !ranGate(turn) && findClaim(turn.assistant))
    .map((turn) => {
      const match = findClaim(turn.assistant);
      return {
        turn: turn.index,
        message: turn.messageIndex,
        quote: excerpt(turn.assistant, match.index),
      };
    });

  const writes = new Map();
  for (const turn of turns) {
    for (const tool of turn.tools) {
      if (!WRITE_TOOLS.has(tool.name)) continue;
      const raw = tool.input?.file_path ?? tool.input?.path;
      if (typeof raw !== 'string' || raw === '') continue;
      const path = toRepoRelative(raw, repoRoot);
      if (!path) continue;
      const key = path.toLowerCase();
      if (writes.has(key)) continue;
      writes.set(key, { turn: turn.index, message: turn.messageIndex, path });
    }
  }
  const allWrites = [...writes.values()];
  const authorized = (path) =>
    authorizations.some((auth) => matchesDeclared(path, auth?.paths ?? []));
  const unplannedWrites = allWrites.filter(
    (write) =>
      !matchesPlan(write.path, planFiles) &&
      !isMissionEvidence(write.path) &&
      !authorized(write.path),
  );
  const unusedAuthorizations = authorizations.filter((auth) => {
    const paths = Array.isArray(auth?.paths) ? auth.paths : [];
    return !allWrites.some((write) => matchesDeclared(write.path, paths));
  });

  const policyViolations = [];
  if (policy) {
    const seen = new Set();
    for (const turn of turns) {
      for (const tool of turn.tools) {
        if (tool.name !== 'Bash' || typeof tool.input?.command !== 'string') continue;
        for (const command of commandSegments(tool.input.command)) {
          const forbidden = forbiddenMatch(command, policy);
          if (!forbidden) continue;
          const key = `${turn.index}:${command}`;
          if (seen.has(key)) continue;
          seen.add(key);
          policyViolations.push({
            turn: turn.index,
            message: turn.messageIndex,
            command,
            forbidden,
          });
        }
      }
    }
  }

  const confirmationRequests = turns
    .filter((turn) => CONFIRM.test(turn.assistant))
    .map((turn) => {
      const match = CONFIRM.exec(turn.assistant);
      return {
        turn: turn.index,
        message: turn.messageIndex,
        quote: excerpt(turn.assistant, match?.index ?? 0),
      };
    });

  const critical =
    claimsWithoutGate.length + unplannedWrites.length + policyViolations.length;
  const attention =
    alignmentCorrections.length + confirmationRequests.length + unusedAuthorizations.length;
  const verdict = critical > 0 ? 'drift' : attention > 0 ? 'attention' : 'clean';

  return {
    transcript: resolve(file),
    records,
    messages: messages.length,
    turns: turns.length,
    verdict,
    amendmentRecorded: hasAmendment(options.ledgerFile),
    signals: {
      alignmentCorrections,
      claimsWithoutGate,
      unplannedWrites,
      unusedAuthorizations,
      policyViolations,
      confirmationRequests,
    },
  };
}

export function formatAudit(report) {
  const lines = [
    '# Session drift audit',
    '',
    `Transcript: ${report.transcript}`,
    `Records: ${report.records}; messages: ${report.messages}; turns: ${report.turns}`,
    `Verdict: ${report.verdict}`,
    `Plan amendment recorded: ${report.amendmentRecorded ? 'yes' : 'no'}`,
    '',
  ];

  const section = (title, items, render) => {
    lines.push(`## ${title} (${items.length})`);
    if (items.length === 0) {
      lines.push('none');
    } else {
      for (const item of items) lines.push(render(item));
    }
    lines.push('');
  };

  section(
    'Alignment corrections by the human',
    report.signals.alignmentCorrections,
    (item) => `- turn ${item.turn} (message ${item.message}): "${item.quote}"`,
  );
  section(
    'Completion claims with no gate in the same turn',
    report.signals.claimsWithoutGate,
    (item) => `- turn ${item.turn} (message ${item.message}): "${item.quote}"`,
  );
  section(
    'Writes outside the plan declared files',
    report.signals.unplannedWrites,
    (item) => `- ${item.path} (turn ${item.turn}, message ${item.message})`,
  );
  section(
    'Authorizations with no matching write',
    report.signals.unusedAuthorizations,
    (item) => `- ${(item.paths ?? []).join(', ')}${item.why ? `: ${item.why}` : ''}`,
  );
  section(
    'Forbidden commands without a recorded exception',
    report.signals.policyViolations,
    (item) =>
      `- turn ${item.turn} (message ${item.message}):\n  \`${item.command}\` matches forbidden \`${item.forbidden}\``,
  );
  section(
    'Confirmation requests to the human',
    report.signals.confirmationRequests,
    (item) => `- turn ${item.turn} (message ${item.message}): "${item.quote}"`,
  );

  lines.push(
    'Interpretation: alignment corrections count the human doing the guard\'s job;',
    'claims without a gate are the failure the ledger exists to prevent;',
    'unplanned writes are drift unless a ruling or amendment records them;',
    'an authorization covers only the paths it names.',
  );
  return lines.join('\n');
}

const MAX_LINE_BYTES = 64 * 1024 * 1024;

/**
 * Stream the transcript line by line. A whole-file read dies on a transcript
 * larger than the V8 string limit; a bounded buffer keeps memory flat and a
 * single over-limit line fails with a clear error instead of a crash.
 *
 * Keep the last request, not the largest one. Compaction shortens the context,
 * so the largest request after a compaction is a pre-compaction snapshot; it
 * cannot see the turns that followed.
 */
function readLatest(file, maxLineBytes = MAX_LINE_BYTES) {
  const fd = openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const decoder = new StringDecoder('utf8');
  let carry = '';
  let latest = null;
  let records = 0;

  const consume = (line) => {
    if (line.trim() === '') return;
    if (Buffer.byteLength(line, 'utf8') > maxLineBytes) {
      throw new Error(`${file}: line exceeds ${maxLineBytes} bytes`);
    }
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      return;
    }
    records += 1;
    const messages = record?.request?.body?.messages;
    if (Array.isArray(messages)) latest = { messages };
  };

  try {
    for (;;) {
      const bytes = readSync(fd, buffer, 0, buffer.length, null);
      if (bytes === 0) break;
      carry += decoder.write(buffer.subarray(0, bytes));
      let index = carry.indexOf('\n');
      while (index !== -1) {
        consume(carry.slice(0, index));
        carry = carry.slice(index + 1);
        index = carry.indexOf('\n');
      }
      if (carry.length > maxLineBytes) {
        throw new Error(`${file}: line exceeds ${maxLineBytes} bytes`);
      }
    }
    carry += decoder.end();
    if (carry !== '') consume(carry);
  } finally {
    closeSync(fd);
  }

  if (!latest) throw new Error(`${file}: no request.body.messages found`);
  return { records, messages: latest.messages };
}

function buildTurns(messages) {
  const turns = [];
  let current = null;
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (!message || message.role === 'system') continue;

    const isResult = isToolResult(message);
    if (message.role === 'user' && !isResult) {
      const text = stripReminders(collectText(message.content));
      if (text !== '') {
        if (isCompactionSummary(text)) {
          // A summary followed by a later real user message is replayed
          // history: the later turn anchors the audit and the summary is
          // skipped. With no later user message, the summary is the only
          // anchor for the work that follows, so it opens a synthetic turn.
          if (hasLaterUserTurn(messages, index)) {
            current = null;
            continue;
          }
          current = {
            index: turns.length,
            messageIndex: index,
            user: text,
            assistant: '',
            tools: [],
            synthetic: true,
          };
          turns.push(current);
          continue;
        }
        current = {
          index: turns.length,
          messageIndex: index,
          user: text,
          assistant: '',
          tools: [],
        };
        turns.push(current);
      }
      continue;
    }

    if (message.role === 'assistant' && current) {
      const text = collectText(message.content);
      if (text !== '') current.assistant += `${text}\n`;
      for (const block of Array.isArray(message.content) ? message.content : []) {
        if (block?.type === 'tool_use') {
          current.tools.push({ name: block.name, input: block.input ?? {} });
        }
      }
    }
  }
  return turns;
}

function collectText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
}

function isToolResult(message) {
  return (
    Array.isArray(message.content) &&
    message.content.some((block) => block?.type === 'tool_result')
  );
}

/**
 * The harness injects reminders as blocks inside the user message. Keep the
 * human text that follows them; only a message that is nothing but reminders
 * is not a turn.
 */
function stripReminders(text) {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '').trim();
}

/**
 * Compaction replaces prior messages with a synthetic summary that replays the
 * earlier conversation, including its tool calls. That text is not a human
 * turn: the replayed writes already happened and were judged by the turns that
 * made them. Skipping the summary keeps old history out of the audit.
 */
function isCompactionSummary(text) {
  return /This session is being continued from a previous conversation that ran out of context|本次会话从一段超出上下文的对话继续/i.test(
    text,
  );
}

function hasLaterUserTurn(messages, startIndex) {
  for (let index = startIndex + 1; index < messages.length; index++) {
    const message = messages[index];
    if (!message || message.role !== 'user' || isToolResult(message)) continue;
    if (stripReminders(collectText(message.content)) !== '') return true;
  }
  return false;
}

/**
 * A completion mention is only a claim when it is not quoted and not part of
 * "T-001 完成后…" prose. The heuristic is deliberately conservative; the point
 * is to surface likely claims, not to prove intent.
 */
function findClaim(text) {
  const pattern = new RegExp(CLAIM.source, 'gi');
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const before = text[match.index - 1] ?? '';
    const after = text[match.index + match[0].length] ?? '';
    if (/["'“”「」]/.test(before) || /["'“”「」]/.test(after)) continue;
    if (match[0].endsWith('完成') && after === '后') continue;
    return { index: match.index, text: match[0] };
  }
  return null;
}

function ranGate(turn) {
  return turn.tools.some(
    (tool) =>
      tool.name === 'Bash' &&
      typeof tool.input?.command === 'string' &&
      GATE.test(tool.input.command),
  );
}

function toRepoRelative(file, repoRoot) {
  const normalized = file.replace(/\\/g, '/');
  if (!repoRoot) return normalized;
  const absolute = resolve(file);
  const rel = relative(repoRoot, absolute);
  if (rel === '' || rel.startsWith('..') || /^[A-Za-z]:/.test(rel) || isAbsolute(rel)) {
    return null;
  }
  return rel.split(sep).join('/');
}

function matchesPlan(path, planFiles) {
  return matchesDeclared(path, planFiles);
}

/** A declared path is a file, or a directory when it ends with `/`. */
function matchesDeclared(path, entries) {
  if (!Array.isArray(entries)) return false;
  const lower = path.toLowerCase();
  return entries.some((entry) => {
    if (typeof entry !== 'string' || entry.trim() === '') return false;
    const declared = entry.replace(/\\/g, '/').toLowerCase();
    return declared.endsWith('/') ? lower.startsWith(declared) : lower === declared;
  });
}

/**
 * Shell commands in the transcript arrive as one string. Split the compound
 * forms so `cd x && git push` is still seen as a push, and drop redirections
 * so `git push origin main 2>&1` matches the recorded exception.
 */
function commandSegments(command) {
  return command
    .split(/&&|\|\||[;|\n]/)
    .map((segment) => stripRedirections(segment))
    .map((segment) => segment.trim().replace(/\s+/g, ' '))
    .filter((segment) => segment !== '');
}

function stripRedirections(segment) {
  return segment
    .split(/\s+/)
    .filter((token) => !/^\d*(?:>>?|<)\S*$/.test(token) && !/^\d*>&\d+$/.test(token))
    .join(' ');
}

/**
 * Evidence is runtime-owned: cairn verify and cairn review write under
 * .cairn/missions/<id>/evidence/, and the plan cannot enumerate the generated
 * filenames. The runtime's own output is not drift.
 */
function isMissionEvidence(path) {
  return /(^|\/)\.cairn\/missions\/[^/]+\/evidence\//.test(path);
}

function hasAmendment(ledgerFile) {
  if (!ledgerFile || !existsSync(ledgerFile)) return false;
  const lines = readFileSync(ledgerFile, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (
        event.event === 'mission_amended' ||
        (event.event === 'ruling' &&
          event.data &&
          typeof event.data === 'object' &&
          event.data.amends)
      ) {
        return true;
      }
    } catch {
      // The validator reports malformed ledger lines; the audit only cares about amendments.
    }
  }
  return false;
}

function excerpt(text, index = 0) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 180) return clean;
  const start = Math.max(0, Math.min(index - 60, clean.length - 180));
  return `${start > 0 ? '…' : ''}${clean.slice(start, start + 180)}${start + 180 < clean.length ? '…' : ''}`;
}

function findLatestTranscript() {
  const dir = join(homedir(), '.zcode', 'cli', 'debug');
  if (!existsSync(dir)) throw new Error(`no transcript directory: ${dir}`);
  const files = readdirSync(dir)
    .filter((name) => name.startsWith('model-io-') && name.endsWith('.jsonl'))
    .map((name) => join(dir, name))
    .filter((file) => statSync(file).isFile())
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (files.length === 0) throw new Error(`no model-io transcript under ${dir}`);
  return files[0];
}

function parseArgs(argv) {
  const options = {
    transcript: null,
    mission: null,
    json: false,
    strict: false,
    out: null,
  };
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--mission') options.mission = args[++index];
    else if (arg === '--out') options.out = args[++index];
    else if (arg.startsWith('--')) return { error: `unknown option ${arg}` };
    else if (!options.transcript) options.transcript = arg;
    else return { error: `unexpected argument ${arg}` };
  }
  return { options };
}

function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    process.stderr.write(`usage: node scripts/audit-session.mjs [transcript] [--mission <dir>] [--json] [--strict] [--out <file>]\n`);
    process.stderr.write(`${parsed.error}\n`);
    return 2;
  }
  const { options } = parsed;

  let transcript;
  try {
    transcript = options.transcript ?? findLatestTranscript();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }

  let planFiles = [];
  let ledgerFile = null;
  let authorizations = [];
  let policy = null;
  const missionDir = resolveMission(options.mission ?? undefined);
  if (existsSync(missionDir)) {
    const loaded = readMission(missionDir);
    const tasks = Array.isArray(loaded.plan?.tasks) ? loaded.plan.tasks : [];
    planFiles = tasks.flatMap((task) =>
      Array.isArray(task?.files) ? task.files : [],
    );
    ledgerFile = join(loaded.missionDir, 'ledger.jsonl');
    authorizations = loaded.events
      .filter((event) => event.event === 'authorization' && event.data?.scope === 'writes')
      .map((event) => ({
        paths: Array.isArray(event.data.paths) ? event.data.paths : [],
        why: typeof event.data.why === 'string' ? event.data.why : '',
      }));
    policy = {
      forbidden_commands: Array.isArray(loaded.policy?.forbidden_commands)
        ? loaded.policy.forbidden_commands
        : [],
      approved_exceptions: Array.isArray(loaded.policy?.approved_exceptions)
        ? loaded.policy.approved_exceptions
        : [],
    };
  }

  let report;
  try {
    report = auditTranscript(transcript, {
      planFiles,
      repoRoot: process.cwd(),
      ledgerFile,
      authorizations,
      policy,
    });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }

  const markdown = formatAudit(report);
  if (options.out) writeFileSync(options.out, `${markdown}\n`);
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else if (options.out) process.stdout.write(`wrote ${options.out}\nverdict: ${report.verdict}\n`);
  else process.stdout.write(`${markdown}\n`);

  if (options.strict && report.verdict === 'drift') return 1;
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv);
}
