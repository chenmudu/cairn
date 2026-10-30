#!/usr/bin/env node
/**
 * goal-check.mjs — read the mission, name the next task, and refuse to proceed
 * when the task has no acceptance link or an acceptance criterion is uncovered.
 *
 * This is the pre-flight guard. It answers three questions from the repository
 * alone: what are we building, what is the next task, and which acceptance
 * criterion does that task serve?
 *
 * Usage: node scripts/goal-check.mjs [mission-dir] [--brief] [--json]
 * Exit:  0 ok, 1 goal problem, 2 usage error.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readMission } from './validate-mission.mjs';
import { resolveMission } from '../src/paths.ts';

export function checkGoal(missionDir = resolveMission()) {
  const loaded = readMission(resolveMission(missionDir));
  const errors = [...loaded.errors];
  const { mission, plan, events } = loaded;

  if (!mission || !plan) {
    return {
      ok: false,
      errors,
      mission: mission ? { id: mission.id, title: mission.title } : null,
      intent: '',
      nonGoals: [],
      currentTask: null,
      coverage: {},
      complete: false,
      ledger: { total: events.length, last: events.at(-1) ?? null },
    };
  }

  const acceptance = (Array.isArray(mission.acceptance) ? mission.acceptance : []).filter(isMapping);
  const acceptanceById = new Map(acceptance.map((item) => [item.id, item]));
  const tasks = (Array.isArray(plan.tasks) ? plan.tasks : []).filter(isMapping);
  const done = new Set(
    events
      .filter((event) => event.event === 'task_done' && typeof event.task === 'string')
      .map((event) => event.task),
  );

  const coverage = Object.fromEntries(acceptance.map((item) => [item.id, []]));
  for (const task of tasks) {
    if (!Array.isArray(task.serves) || task.serves.length === 0) {
      errors.push(`plan.md ${task.id}: missing "serves" link`);
      continue;
    }
    for (const id of task.serves) {
      if (!acceptanceById.has(id)) {
        errors.push(`plan.md ${task.id}: serves unknown acceptance ${JSON.stringify(id)}`);
        continue;
      }
      coverage[id].push(task.id);
    }
  }
  for (const [id, taskIds] of Object.entries(coverage)) {
    if (taskIds.length === 0) errors.push(`acceptance ${id}: uncovered by any task`);
  }

  const depsOf = (task) => (Array.isArray(task.deps) ? task.deps : []);
  const incomplete = tasks.filter((task) => !done.has(task.id));
  const runnable = incomplete.filter((task) => depsOf(task).every((dep) => done.has(dep)));
  const next = runnable[0] ?? null;
  const complete = incomplete.length === 0;

  const lastReview = events.filter((event) => event.event === 'review_result').at(-1);
  const doneSinceReview = events.filter(
    (event) =>
      event.event === 'task_done' &&
      (!lastReview || Date.parse(event.ts) > Date.parse(lastReview.ts)),
  ).length;
  if (doneSinceReview >= 3) {
    errors.push(
      `milestone audit due: ${doneSinceReview} tasks completed since ${lastReview ? lastReview.ts : 'mission start'}`,
    );
  }

  if (complete) {
    const lastDone = events.filter((event) => event.event === 'task_done').at(-1);
    const passing = [...events]
      .reverse()
      .find(
        (event) =>
          event.event === 'review_result' &&
          event.data &&
          event.data.verdict === 'pass',
      );
    if (!passing || (lastDone && Date.parse(passing.ts) <= Date.parse(lastDone.ts))) {
      errors.push('mission-end audit due: no passing review_result after the last task_done');
    }
  }

  if (!next && incomplete.length > 0) {
    errors.push(
      `no runnable task: ${incomplete.map((task) => task.id).join(', ')} blocked by dependencies`,
    );
  }

  const currentTask = next
    ? {
        id: next.id,
        title: next.title ?? '',
        serves: Array.isArray(next.serves) ? next.serves : [],
        acceptance: (Array.isArray(next.serves) ? next.serves : [])
          .map((id) => acceptanceById.get(id))
          .filter(Boolean)
          .map((item) => ({ id: item.id, check: item.check })),
        gates: (Array.isArray(next.gates) ? next.gates : [])
          .filter(isMapping)
          .map((gate) => ({
            id: gate.id,
            command: [gate.command, ...(Array.isArray(gate.args) ? gate.args : [])].join(' '),
            severity: gate.severity,
          })),
      }
    : null;

  const body = stripFrontmatter(
    readFileSync(join(loaded.missionDir, 'mission.md'), 'utf8'),
  );

  return {
    ok: errors.length === 0,
    errors,
    mission: { id: mission.id, title: mission.title },
    intent: firstParagraph(section(body, 'Intent')),
    nonGoals: bullets(section(body, 'Non-goals')),
    currentTask,
    coverage,
    complete,
    blocked: !next && incomplete.length > 0 ? incomplete.map((task) => task.id) : [],
    ledger: { total: events.length, last: events.at(-1) ?? null },
  };
}

export function formatBrief(report) {
  if (!report.ok) {
    return [`Cairn goal check FAILED (${report.mission?.id ?? 'unknown mission'})`, ...report.errors.map((error) => `- ${error}`)].join('\n');
  }
  const task = report.currentTask;
  const lines = [
    `Cairn goal anchor — ${report.mission.id} ${report.mission.title}`,
    `Intent: ${report.intent}`,
  ];
  if (task) {
    const serves = task.acceptance.map((item) => `${item.id} (${item.check})`).join('; ');
    lines.push(`Current task: ${task.id} — ${task.title}`);
    lines.push(`Serves: ${serves}`);
    lines.push(`Gates: ${task.gates.map((gate) => `${gate.id}: ${gate.command}`).join(' | ')}`);
  } else {
    lines.push('Current task: none — the mission is complete or blocked.');
  }
  const covered = Object.values(report.coverage).filter((taskIds) => taskIds.length > 0).length;
  lines.push(`Coverage: ${covered}/${Object.keys(report.coverage).length} acceptance criteria covered`);
  lines.push(`Non-goals: ${report.nonGoals.join(' ')}`);
  lines.push(`Ledger: ${report.ledger.total} events, last ${report.ledger.last?.event ?? 'none'}`);
  lines.push('Before claiming done: run the gates, then node scripts/audit-session.mjs.');
  return lines.join('\n');
}

export function formatReport(report) {
  const lines = [
    `goal: ${report.ok ? 'ok' : 'FAILED'}`,
    `mission: ${report.mission ? `${report.mission.id} — ${report.mission.title}` : 'missing'}`,
    `intent: ${report.intent || '(none)'}`,
    `current task: ${report.currentTask ? `${report.currentTask.id} — ${report.currentTask.title}` : 'none'}`,
    `serves: ${report.currentTask ? report.currentTask.serves.join(', ') : 'n/a'}`,
    `gates: ${report.currentTask ? report.currentTask.gates.map((gate) => `${gate.id} (${gate.severity}): ${gate.command}`).join('; ') : 'n/a'}`,
    `coverage:`,
    ...Object.entries(report.coverage).map(
      ([id, taskIds]) => `  ${id}: ${taskIds.length > 0 ? taskIds.join(', ') : 'UNCOVERED'}`,
    ),
    `ledger: ${report.ledger.total} events, last ${report.ledger.last?.event ?? 'none'}`,
  ];
  if (report.nonGoals.length > 0) lines.push(`non-goals: ${report.nonGoals.join(' ')}`);
  if (!report.ok) lines.push(...report.errors.map((error) => `error: ${error}`));
  return lines.join('\n');
}

function stripFrontmatter(text) {
  const normalized = text.replace(/^\uFEFF/, '');
  const match = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(normalized);
  return match ? normalized.slice(match[0].length) : normalized;
}

function section(body, title) {
  const heading = new RegExp(`^##\\s+${title}\\s*$`, 'm').exec(body);
  if (!heading) return '';
  const rest = body.slice(heading.index + heading[0].length);
  const next = /^##\s+/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function firstParagraph(text) {
  const paragraph = text.trim().split(/\r?\n\s*\r?\n/)[0] ?? '';
  return paragraph.replace(/\s+/g, ' ').trim();
}

function bullets(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => /^\s*-\s+/.test(line))
    .map((line) => line.replace(/^\s*-\s+/, '').trim());
}

function isMapping(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function main(argv) {
  const args = argv.slice(2);
  const brief = args.includes('--brief');
  const json = args.includes('--json');
  const positional = args.filter((arg) => !arg.startsWith('--'));
  if (positional.length > 1 || args.some((arg) => arg.startsWith('--') && !['--brief', '--json'].includes(arg))) {
    process.stderr.write('usage: node scripts/goal-check.mjs [mission-dir] [--brief] [--json]\n');
    return 2;
  }
  const report = checkGoal(positional[0]);
  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else if (brief) {
    process.stdout.write(formatBrief(report) + '\n');
  } else {
    process.stdout.write(formatReport(report) + '\n');
  }
  return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv);
}
