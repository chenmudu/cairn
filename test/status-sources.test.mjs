import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

/**
 * Status sources are read-only. This test parses only the active mission in
 * `.cairn/config.json`, the "Read first" list in `AGENTS.md`, and the `Status:`
 * paragraph in `README.md`. It does not grep the repository for mission ids,
 * and it exempts archive mentions and the missions' own contracts.
 */

const repo = resolve(import.meta.dirname, '..');
const missionsDir = join(repo, '.cairn', 'missions');

const config = JSON.parse(readFileSync(join(repo, '.cairn', 'config.json'), 'utf8'));
const active = config.active_mission;

function missionIdsIn(line) {
  return [...line.matchAll(/\.cairn\/missions\/([A-Za-z0-9][A-Za-z0-9-]*)\//g)].map(
    (match) => match[1],
  );
}

function readFirstItems() {
  const text = readFileSync(join(repo, 'AGENTS.md'), 'utf8');
  const section = /^##\s+Read first\s*$([\s\S]*?)(?=^##\s)/m.exec(text);
  assert.ok(section, 'AGENTS.md must keep a "## Read first" section');
  return section[1].split(/\r?\n/).filter((line) => /^\d+\.\s/.test(line));
}

function statusParagraph() {
  const lines = readFileSync(join(repo, 'README.md'), 'utf8').split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('Status:'));
  assert.ok(start >= 0, 'README.md must keep a Status: paragraph');
  const paragraph = [];
  for (const line of lines.slice(start)) {
    if (line.trim() === '') break;
    paragraph.push(line);
  }
  return paragraph.join(' ');
}

function closedMissions() {
  const closed = new Set();
  for (const name of readdirSync(missionsDir)) {
    const dir = join(missionsDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const ledger = join(dir, 'ledger.jsonl');
    if (!existsSync(ledger)) continue;
    const done = readFileSync(ledger, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .some((line) => JSON.parse(line).event === 'mission_done');
    if (done) closed.add(name);
  }
  return closed;
}

test('AGENTS.md Read first points only at the active mission or a generic <id>', () => {
  assert.ok(
    existsSync(join(missionsDir, active)),
    `.cairn/config.json names ${active}, which is not a mission directory`,
  );
  const pointers = readFirstItems().filter((line) => line.includes('.cairn/missions/'));
  assert.ok(pointers.length > 0, 'Read first must name the mission path from the config');
  for (const line of pointers) {
    const ids = missionIdsIn(line);
    const archived = /archiv/i.test(line) && ids.includes('000-bootstrap');
    for (const id of ids) {
      if (archived && id === '000-bootstrap') continue;
      assert.equal(
        id,
        active,
        `AGENTS.md Read first names ${id} while ${active} is the active mission`,
      );
    }
  }
});

test('README.md Status does not call a closed mission active', () => {
  const closed = closedMissions();
  assert.ok(closed.size >= 2, 'the repository must record closed missions for this check');
  const paragraph = statusParagraph();
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  for (const id of closed) {
    const number = String(Number(id.split('-')[0]));
    const label = new RegExp(`(?:${id}\\b|mission\\s*#\\s*${number}\\b)`, 'i');
    for (const sentence of sentences) {
      if (!label.test(sentence)) continue;
      assert.doesNotMatch(
        sentence,
        /\bactive\b|\bin progress\b|\bcurrent mission\b/i,
        `README.md Status calls the closed mission ${id} active: ${sentence}`,
      );
    }
  }
});