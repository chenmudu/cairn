import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectPacks, type PackReport } from './packs.ts';
import type { Gate, Packet } from './plan.ts';

const TEMPLATE = resolve(import.meta.dirname, '..', 'templates', 'dispatch.md');
const CODE_FILE = /\.(ts|tsx|js|mjs|cjs|jsx|py|rs|go|java|rb|sh)$/i;
const UI_FILE = /\.(html?|css|scss|sass|less|tsx|jsx|vue|svelte|astro|svg)$/i;

export type PackMode = 'use' | 'human-in-loop' | 'not-applicable' | 'absent';

export interface PacketPack {
  capability: string;
  pack: 'superpowers' | 'impeccable';
  version: string;
  mode: PackMode;
  instruction: string;
  reason?: string;
  fallback: { text: string; product: { kind: string; ref: string } };
}

export interface PacketWithPacks extends Packet {
  packs: PacketPack[];
}

/**
 * Attach the two capability decisions to a packet. Selection is deterministic
 * from the declared files, so an adapter never has to guess whether a pack was
 * considered. Detection is filesystem-only; an absent pack becomes a fallback,
 * never a download.
 */
export function withPacks(packet: Packet, report: PackReport = detectPacks()): PacketWithPacks {
  const code = packet.task.files.some((file) => CODE_FILE.test(file));
  const ui = packet.task.files.some((file) => UI_FILE.test(file));
  const superpowers = report.packs.superpowers;
  const impeccable = report.packs.impeccable;
  const spPresent = superpowers.status === 'present';
  const impPresent = impeccable.status === 'present';

  const packs: PacketPack[] = [
    {
      capability: code ? 'test-first' : 'verify-before-close',
      pack: 'superpowers',
      version: spPresent ? (superpowers.version ?? superpowers.pin) : superpowers.pin,
      mode: spPresent ? 'use' : 'absent',
      instruction: code
        ? 'superpowers:test-driven-development'
        : 'superpowers:verification-before-completion',
      fallback: code
        ? {
            text: 'write the test first, then the implementation, then run the gate',
            product: { kind: 'gate', ref: 'test' },
          }
        : {
            text: 'run every blocking gate and the audit before claiming done',
            product: { kind: 'command', ref: 'cairn verify' },
          },
    },
    {
      capability: ui ? 'design-check' : 'design-review',
      pack: 'impeccable',
      version: impeccable.pin,
      mode: impPresent ? (ui ? 'use' : 'not-applicable') : 'absent',
      instruction: ui
        ? 'impeccable detect --json'
        : 'criteria-based review against method/standards/docs.md',
      ...(impPresent && !ui
        ? { reason: 'task files contain no markup or URL target' }
        : {}),
      fallback: ui
        ? {
            text: 'use the in-repo design checklist',
            product: { kind: 'path', ref: 'method/README.md' },
          }
        : {
            text: 'use the in-repo review checklist',
            product: { kind: 'path', ref: 'method/README.md' },
          },
    },
  ];

  return { ...packet, packs };
}

/**
 * Render the dispatch packet as the markdown brief an adapter receives. The
 * template owns the prose and the report contract; the packet owns the facts.
 */
export function renderDispatch(packet: Packet & { packs?: PacketPack[] }): string {
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
    packs: packLines(packet.packs ?? []),
  };

  return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(`templates/dispatch.md: unknown placeholder {{${key}}}`);
    }
    return value;
  });
}

function packLines(packs: PacketPack[]): string {
  if (packs.length === 0) return '- none declared';
  return packs
    .map((pack) => {
      const reason = pack.reason ? `; reason: ${pack.reason}` : '';
      return `- **${pack.pack} ${pack.version}** — ${pack.capability}, mode \`${pack.mode}\`${reason}; ${pack.instruction}`;
    })
    .join('\n');
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
