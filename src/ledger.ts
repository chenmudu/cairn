import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';

export interface LedgerEvent {
  ts: string;
  event: string;
  mission: string;
  task?: string;
  actor: string;
  data: Record<string, unknown>;
}

export type NewEvent = Omit<LedgerEvent, 'mission'> & { mission?: string };

/** Read ledger.jsonl as events. The validator owns the full shape check. */
export function readLedger(missionDir: string): LedgerEvent[] {
  const file = join(missionDir, 'ledger.jsonl');
  if (!existsSync(file)) throw new Error(`${file}: missing`);
  const text = readFileSync(file, 'utf8');
  if (text.trim() === '') return [];

  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line, index) => {
      try {
        return JSON.parse(line) as LedgerEvent;
      } catch {
        throw new Error(`ledger.jsonl:${index + 1}: not valid JSON`);
      }
    });
}

/**
 * The only write path. Append one line, fsync it, and refuse a timestamp that
 * does not advance. A caller cannot rewrite history by passing an old ts.
 */
export function appendEvent(missionDir: string, event: NewEvent): LedgerEvent {
  const file = join(missionDir, 'ledger.jsonl');
  const events = readLedger(missionDir);
  const last = events.at(-1);
  const ts = Date.parse(event.ts);
  if (Number.isNaN(ts)) throw new Error(`invalid ts: ${event.ts}`);
  if (last && ts <= Date.parse(last.ts)) {
    throw new Error(`non-monotonic ts: ${event.ts} is not after ${last.ts}`);
  }

  const record: LedgerEvent = {
    ...event,
    mission: event.mission ?? last?.mission ?? '',
  };
  if (record.mission === '') throw new Error('event.mission is required when the ledger is empty');

  const text = readFileSync(file, 'utf8');
  const prefix = text === '' || text.endsWith('\n') ? '' : '\n';
  const line = `${prefix}${JSON.stringify(record)}\n`;
  const fd = openSync(file, 'a');
  try {
    writeSync(fd, line);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  return record;
}

/** A timestamp that is strictly after the last event, even if the clock is behind. */
export function nextTimestamp(events: LedgerEvent[]): string {
  const last = events.at(-1);
  const now = Date.now();
  const base = last ? Math.max(now, Date.parse(last.ts) + 1) : now;
  return new Date(base).toISOString();
}
