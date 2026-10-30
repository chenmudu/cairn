import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/check-method.mjs', import.meta.url));
const PHASES = [
  'frame',
  'plan',
  'execute',
  'review',
  'close',
  'state',
  'design-check',
  'handoff',
  'unattended',
];

function fallback(ref = 'gate:test') {
  const [kind, ...rest] = ref.split(':');
  return { text: ref, product: { kind, ref: rest.join(':') } };
}

function row(phase) {
  return {
    phase,
    floor: `floor for ${phase}`,
    product: { kind: 'path', ref: 'README.md' },
    superpowers: {
      skill: 'test-driven-development',
      pin: '7.0.1',
      mode: 'use',
      fallback: fallback(),
    },
    impeccable: {
      standard: 'critique',
      pin: '4.8.0+df3a4ab',
      applicability: 'not-applicable',
      reason: 'no UI surface',
      fallback: fallback('path:README.md'),
    },
    seam: 'Cairn owns the seam',
    status: 'exists',
  };
}

function playbook(rows = PHASES.map(row)) {
  return {
    schema: 'cairn/playbook@0.1',
    packs_used: [
      {
        capability: 'test-first',
        pack: 'superpowers',
        version: '7.0.1',
        evidence: 'test/method.test.mjs',
      },
    ],
    phases: rows,
  };
}

function writePlaybook(root, data) {
  const text = `# Playbook\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\n| Phase |\n|---|\n`;
  writeFileSync(join(root, 'method/playbook.md'), text);
}

function fixture({ rows = PHASES.map(row), tasks = ['T1', 'T7'] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cairn-method-'));
  mkdirSync(join(root, 'method'), { recursive: true });
  mkdirSync(join(root, 'test'), { recursive: true });
  mkdirSync(join(root, '.cairn/missions/m1'), { recursive: true });
  writeFileSync(join(root, 'README.md'), '# fixture\n');
  writeFileSync(join(root, 'test/method.test.mjs'), '// fixture\n');
  writeFileSync(join(root, '.cairn/config.json'), '{"active_mission":"m1"}\n');
  const plan = [
    '---',
    'schema: cairn/plan@0.1',
    'tasks:',
    ...tasks.flatMap((id) => [
      `  - id: ${id}`,
      '    gates:',
      '      - id: test',
      '        command: node',
      '        args: ["--test"]',
      '        severity: block',
    ]),
    '---',
    '',
  ].join('\n');
  writeFileSync(join(root, '.cairn/missions/m1/plan.md'), plan);
  writePlaybook(root, playbook(rows));
  return root;
}

function run(root, args, env = {}) {
  const result = spawnSync(process.execPath, [SCRIPT, '--root', root, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return result;
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test('accepts a complete playbook', () => {
  const root = fixture();
  try {
    const result = run(root, ['--playbook']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /playbook: ok/);
  } finally {
    cleanup(root);
  }
});

test('rejects a row with no floor', () => {
  const rows = PHASES.map(row);
  rows[0].floor = '';
  const root = fixture({ rows });
  try {
    const result = run(root, ['--playbook']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /floor/i);
  } finally {
    cleanup(root);
  }
});

test('rejects an empty fallback', () => {
  const rows = PHASES.map(row);
  rows[2].superpowers.fallback.text = '';
  const root = fixture({ rows });
  try {
    const result = run(root, ['--playbook']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /fallback/i);
  } finally {
    cleanup(root);
  }
});

test('rejects not-applicable without a reason', () => {
  const rows = PHASES.map(row);
  delete rows[3].impeccable.reason;
  const root = fixture({ rows });
  try {
    const result = run(root, ['--playbook']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /reason/i);
  } finally {
    cleanup(root);
  }
});

test('reports a planned row and fails it only under --strict', () => {
  const rows = PHASES.map(row);
  rows[4].status = 'planned:T7';
  const root = fixture({ rows });
  try {
    const pending = run(root, ['--products']);
    assert.equal(pending.status, 0, pending.stderr);
    assert.match(pending.stdout, /pending: close -> planned:T7/);

    const strict = run(root, ['--products', '--strict']);
    assert.equal(strict.status, 1);
    assert.match(strict.stderr, /planned:T7/);
  } finally {
    cleanup(root);
  }
});

const STANDARDS = ['docs', 'code', 'workflow'];
const TEMPLATES = ['mission', 'task', 'review', 'adr', 'handoff'];

function writePair(root, dir, name, options = {}) {
  mkdirSync(join(root, 'method', dir), { recursive: true });
  const source = options.source === false
    ? ''
    : '- Source: Cairn floor; Impeccable 4.8.0+df3a4ab for UI dimensions\n';
  const pin = options.pin === false
    ? ''
    : '- Pin: cairn/standards@0.1; Impeccable 4.8.0 / engine 0.1.18 / df3a4ab\n';
  writeFileSync(
    join(root, 'method', dir, `${name}.md`),
    `# ${name}\n\n${source}${pin}\nBody.\n`,
  );
  if (options.zh !== false) {
    writeFileSync(
      join(root, 'method', dir, `${name}.zh.md`),
      `<!-- translation of method/${dir}/${name}.md at the T4 commit; the English file is authoritative -->\n\n# ${name}\n`,
    );
  }
}

function standardsFixture(options = {}) {
  const root = fixture();
  STANDARDS.forEach((name) => writePair(root, 'standards', name, options[name] ?? {}));
  TEMPLATES.forEach((name) => writePair(root, 'templates', name));
  return root;
}

test('accepts complete standards and templates', () => {
  const root = standardsFixture();
  try {
    const result = run(root, ['--standards']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /standards: ok/);
  } finally {
    cleanup(root);
  }
});

test('rejects a standard without a source', () => {
  const root = standardsFixture({ docs: { source: false } });
  try {
    const result = run(root, ['--standards']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /source/i);
  } finally {
    cleanup(root);
  }
});

test('rejects a standard without a Chinese companion', () => {
  const root = standardsFixture({ code: { zh: false } });
  try {
    const result = run(root, ['--standards']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /companion/i);
  } finally {
    cleanup(root);
  }
});

test('reports installed and absent packs from environment overrides', () => {
  const root = fixture();
  try {
    const sp = join(root, 'packs/superpowers/7.0.1');
    const imp = join(root, 'packs/impeccable');
    const engine = join(root, 'packs/engine.exe');
    mkdirSync(sp, { recursive: true });
    mkdirSync(join(imp, 'scripts'), { recursive: true });
    writeFileSync(join(imp, 'SKILL.md'), '---\nversion: 4.8.0\n---\n');
    writeFileSync(join(imp, 'scripts/VERSION'), '0.1.18\n');
    writeFileSync(engine, '');

    const present = run(root, ['--packs', '--json'], {
      CAIRN_SUPERPOWERS_DIR: sp,
      CAIRN_IMPECCABLE_DIR: imp,
      CAIRN_IMPECCABLE_BIN: engine,
    });
    assert.equal(present.status, 0, present.stderr);
    const report = JSON.parse(present.stdout);
    assert.equal(report.packs.superpowers.status, 'present');
    assert.equal(report.packs.superpowers.version, '7.0.1');
    assert.equal(report.packs.impeccable.status, 'present');
    assert.equal(report.packs.impeccable.skill_version, '4.8.0');
    assert.equal(report.packs.impeccable.engine_version, '0.1.18');

    const absent = run(root, ['--packs', '--json'], {
      CAIRN_SUPERPOWERS_DIR: join(root, 'missing/superpowers'),
      CAIRN_IMPECCABLE_DIR: join(root, 'missing/impeccable'),
      CAIRN_IMPECCABLE_BIN: join(root, 'missing/engine'),
    });
    assert.equal(absent.status, 0, absent.stderr);
    const missing = JSON.parse(absent.stdout);
    assert.equal(missing.packs.superpowers.status, 'absent');
    assert.equal(missing.packs.impeccable.status, 'absent');
  } finally {
    cleanup(root);
  }
});
