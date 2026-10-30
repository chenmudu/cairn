import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Gate, Packet } from './plan.ts';

const TEMPLATE = resolve(import.meta.dirname, '..', 'templates', 'dispatch.md');

/**
 * Render the dispatch packet as the markdown brief an adapter receives. The
 * template owns the prose and the report contract; the packet owns the facts.
 */
export function renderDispatch(packet: Packet): string {
  const template = readFileSync(TEMPLATE, 'utf8');
  const values: Record<string, string> = {
    task_id: packet.task.id,
    task_title: packet.task.title,
    mission_id: packet.mission.id,
    mission_title: packet.mission.title,
    serves: packet.task.serves.join(', ') || 'none declared',
    base: packet.base,
    files: bullets(packet.task.files),
    interfaces: fence('json', JSON.stringify(packet.task.interfaces, null, 2)),
    constraints: bullets(packet.constraints),
    allowed_commands: commands(packet.policy.allowed_commands),
    forbidden_commands: commands(packet.policy.forbidden_commands),
    budgets: JSON.stringify(packet.policy.budgets),
    stop_conditions: commands(packet.policy.stop_conditions),
    gates: packet.gates.map(gateLine).join('\n'),
    ledger_tail: fence('jsonl', packet.ledger_tail.map((event) => JSON.stringify(event)).join('\n')),
  };

  return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(`templates/dispatch.md: unknown placeholder {{${key}}}`);
    }
    return value;
  });
}

function gateLine(gate: Gate): string {
  return `- **${gate.id}** (${gate.severity}): \`${[gate.command, ...(gate.args ?? [])].join(' ')}\``;
}

function bullets(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- none declared';
}

function commands(items: string[]): string {
  return items.length > 0 ? items.join(', ') : 'none declared';
}

function fence(language: string, body: string): string {
  return `\`\`\`${language}\n${body}\n\`\`\``;
}
