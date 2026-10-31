import { detectPacks, expectedPacks, type PackReport } from './packs.ts';
import type { Packet } from './plan.ts';

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
  const expected = expectedPacks(packet.task.files);
  const code = expected.superpowers.capability === 'test-first';
  const ui = expected.impeccable.capability === 'design-check';
  const superpowers = report.packs.superpowers;
  const impeccable = report.packs.impeccable;
  const spPresent = superpowers.status === 'present';
  const impPresent = impeccable.status === 'present';

  const packs: PacketPack[] = [
    {
      capability: expected.superpowers.capability,
      pack: 'superpowers',
      version: spPresent ? (superpowers.version ?? superpowers.pin) : superpowers.pin,
      mode: spPresent ? 'use' : 'absent',
      instruction: expected.superpowers.skill,
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
      capability: expected.impeccable.capability,
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
