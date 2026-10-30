#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
const MODES = new Set(['use', 'human-in-loop', 'not-applicable']);
const PRODUCT_KINDS = new Set(['path', 'gate', 'command']);
const STANDARDS = ['docs', 'code', 'workflow'];
const TEMPLATES = ['mission', 'task', 'review', 'adr', 'handoff'];
const SP_PIN = '7.0.1';
const IMP_PIN = '4.8.0+df3a4ab';
const IMP_SKILL_PIN = '4.8.0';
const IMP_ENGINE_PIN = '0.1.18';

function isMapping(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function readText(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

function readLineVersion(file) {
  const text = readText(file);
  return text ? text.trim().split(/\r?\n/)[0].trim() : null;
}

function frontmatterVersion(file) {
  const text = readText(file);
  if (!text) return null;
  const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const line = block?.[1].match(/^version:\s*(.+)$/m);
  return line ? line[1].trim() : null;
}

function activePlanPath(root) {
  const config = readText(join(root, '.cairn/config.json'));
  if (!config) return null;
  try {
    const parsed = JSON.parse(config);
    if (hasText(parsed.active_mission)) {
      return join(root, '.cairn/missions', parsed.active_mission, 'plan.md');
    }
  } catch {
    return null;
  }
  return null;
}

function planText(root) {
  const file = activePlanPath(root);
  return file ? readText(file) : null;
}

function idPattern(id) {
  return new RegExp(`^\\s*-\\s+id:\\s*${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
}

function taskExists(root, id) {
  const text = planText(root);
  return text ? idPattern(id).test(text) : false;
}

function gateExists(root, id) {
  return taskExists(root, id);
}

function readPlaybook(root) {
  const file = join(root, 'method/playbook.md');
  const text = readText(file);
  if (text === null) throw new Error(`${file}: missing`);
  const block = text.match(/```json\s*\r?\n([\s\S]*?)\r?\n```/);
  if (!block) throw new Error(`${file}: missing a fenced json block`);
  try {
    return JSON.parse(block[1]);
  } catch (error) {
    throw new Error(`${file}: invalid json (${error.message})`);
  }
}

function checkText(value, where, errors) {
  if (!hasText(value)) errors.push(`${where}: must be a non-empty string`);
}

function checkProduct(product, where, errors) {
  if (!isMapping(product)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  if (!PRODUCT_KINDS.has(product.kind)) {
    errors.push(`${where}.kind: must be path, gate, or command`);
  }
  checkText(product.ref, `${where}.ref`, errors);
}

function checkFallback(fallback, where, errors) {
  if (!isMapping(fallback)) {
    errors.push(`${where}: must be an object with text and product`);
    return;
  }
  checkText(fallback.text, `${where}.text`, errors);
  checkProduct(fallback.product, `${where}.product`, errors);
}

function checkSuperpowers(pack, where, errors) {
  if (!isMapping(pack)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  checkText(pack.skill, `${where}.skill`, errors);
  if (pack.pin !== SP_PIN) errors.push(`${where}.pin: must be ${SP_PIN}`);
  if (!MODES.has(pack.mode)) errors.push(`${where}.mode: must be use, human-in-loop, or not-applicable`);
  if (pack.mode === 'not-applicable') checkText(pack.reason, `${where}.reason`, errors);
  checkFallback(pack.fallback, `${where}.fallback`, errors);
}

function checkImpeccable(pack, where, errors) {
  if (!isMapping(pack)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  if (!hasText(pack.command) && !hasText(pack.standard)) {
    errors.push(`${where}: needs command or standard`);
  }
  if (pack.pin !== IMP_PIN) errors.push(`${where}.pin: must be ${IMP_PIN}`);
  if (!MODES.has(pack.applicability)) {
    errors.push(`${where}.applicability: must be use, human-in-loop, or not-applicable`);
  }
  if (pack.applicability === 'not-applicable') {
    checkText(pack.reason, `${where}.reason`, errors);
  }
  checkFallback(pack.fallback, `${where}.fallback`, errors);
}

function placeholder(value, where, errors) {
  if (typeof value === 'string' && /\b(TBD|TODO)\b/i.test(value)) {
    errors.push(`${where}: contains ${value.match(/\b(TBD|TODO)\b/i)[0]}`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => placeholder(item, `${where}[${index}]`, errors));
  } else if (isMapping(value)) {
    for (const [key, item] of Object.entries(value)) {
      placeholder(item, `${where}.${key}`, errors);
    }
  }
}

function checkStatus(status, root, where, errors) {
  if (status === 'exists') return;
  if (typeof status === 'string' && status.startsWith('planned:')) {
    const task = status.slice('planned:'.length);
    if (!hasText(task)) {
      errors.push(`${where}: planned status needs a task id`);
    } else if (!taskExists(root, task)) {
      errors.push(`${where}: ${status} names no task in the active plan`);
    }
    return;
  }
  errors.push(`${where}: must be exists or planned:T#`);
}

function checkPacksUsed(packsUsed, root, errors) {
  if (!Array.isArray(packsUsed) || packsUsed.length === 0) {
    errors.push('packs_used: must be a non-empty list');
    return;
  }
  packsUsed.forEach((used, index) => {
    const where = `packs_used[${index}]`;
    if (!isMapping(used)) {
      errors.push(`${where}: must be an object`);
      return;
    }
    for (const field of ['capability', 'pack', 'version', 'evidence']) {
      checkText(used[field], `${where}.${field}`, errors);
    }
    if (used.pack === 'superpowers' && used.version !== SP_PIN) {
      errors.push(`${where}.version: must be ${SP_PIN}`);
    }
    if (hasText(used.evidence) && !existsSync(resolve(root, used.evidence))) {
      errors.push(`${where}.evidence: ${used.evidence} does not exist`);
    }
  });
}

function checkPlaybook(doc, root) {
  const errors = [];
  if (!isMapping(doc)) return ['playbook: must be an object'];
  if (doc.schema !== 'cairn/playbook@0.1') {
    errors.push('schema: must be cairn/playbook@0.1');
  }
  checkPacksUsed(doc.packs_used, root, errors);
  if (!Array.isArray(doc.phases)) return [...errors, 'phases: must be a list'];

  const seen = new Set();
  doc.phases.forEach((row, index) => {
    const where = `phases[${index}]`;
    if (!isMapping(row)) {
      errors.push(`${where}: must be an object`);
      return;
    }
    if (!PHASES.includes(row.phase)) {
      errors.push(`${where}.phase: must be one of ${PHASES.join(', ')}`);
    } else if (seen.has(row.phase)) {
      errors.push(`${where}.phase: duplicate ${row.phase}`);
    } else {
      seen.add(row.phase);
    }
    checkText(row.floor, `${where}.floor`, errors);
    checkProduct(row.product, `${where}.product`, errors);
    checkSuperpowers(row.superpowers, `${where}.superpowers`, errors);
    checkImpeccable(row.impeccable, `${where}.impeccable`, errors);
    checkText(row.seam, `${where}.seam`, errors);
    checkStatus(row.status, root, `${where}.status`, errors);
    placeholder(row, where, errors);
  });
  for (const phase of PHASES) {
    if (!seen.has(phase)) errors.push(`phases: missing ${phase}`);
  }
  return errors;
}

function resolveProduct(product, root, where, errors) {
  if (!isMapping(product) || !PRODUCT_KINDS.has(product.kind) || !hasText(product.ref)) {
    errors.push(`${where}: must name a path, gate, or command`);
    return;
  }
  if (product.kind === 'path' && !existsSync(resolve(root, product.ref))) {
    errors.push(`${where}: path ${product.ref} does not exist`);
  }
  if (product.kind === 'gate' && !gateExists(root, product.ref)) {
    errors.push(`${where}: gate ${product.ref} is not in the active plan`);
  }
  if (product.kind === 'command') {
    const command = product.ref.trim();
    if (!/^(cairn|node)\s+/.test(command)) {
      errors.push(`${where}: command must start with cairn or node`);
    } else if (command.startsWith('node ')) {
      const script = command.split(/\s+/)[1];
      if (!existsSync(resolve(root, script))) {
        errors.push(`${where}: script ${script} does not exist`);
      }
    }
  }
}

function resolvePack(pack, kind, root, errors) {
  const where = `phases.${kind}`;
  if (!isMapping(pack)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  const mode = kind === 'superpowers' ? pack.mode : pack.applicability;
  if (!MODES.has(mode)) {
    errors.push(`${where}: has no usable mode`);
    return;
  }
  resolveProduct(pack.fallback.product, root, `${where}.fallback.product`, errors);
}

function checkProducts(doc, root, strict) {
  const errors = [];
  const pending = [];
  doc.phases.forEach((row, index) => {
    if (!isMapping(row)) {
      errors.push(`phases[${index}]: must be an object`);
      return;
    }
    if (typeof row.status === 'string' && row.status.startsWith('planned:')) {
      pending.push(`${row.phase} -> ${row.status}`);
      if (strict) errors.push(`${row.phase}: ${row.status} is still planned`);
      return;
    }
    resolveProduct(row.product, root, `phases[${index}].product`, errors);
    resolvePack(row.superpowers, 'superpowers', root, errors);
    resolvePack(row.impeccable, 'impeccable', root, errors);
  });
  return { errors, pending };
}

function detectSuperpowers() {
  const override = process.env.CAIRN_SUPERPOWERS_DIR;
  const candidates = override
    ? [resolve(override)]
    : [
        join(homedir(), '.zcode/cli/plugins/cache/superpowers-dev/superpowers', SP_PIN),
        join(homedir(), '.claude/plugins/cache/superpowers-dev/superpowers', SP_PIN),
      ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    return {
      status: 'absent',
      path: candidates[0],
      version: null,
      pin: SP_PIN,
      invocable: false,
    };
  }
  const basename = path.split(/[\\/]/).at(-1);
  const version = readLineVersion(join(path, 'VERSION'))
    ?? (/^\d+\.\d+\.\d+$/.test(basename) ? basename : null);
  return {
    status: version === SP_PIN ? 'present' : 'mismatch',
    path,
    version,
    pin: SP_PIN,
    invocable: existsSync(join(path, 'skills')),
  };
}

function detectImpeccable() {
  const override = process.env.CAIRN_IMPECCABLE_DIR;
  const candidates = override
    ? [resolve(override)]
    : [join(homedir(), '.zcode/skills/impeccable')];
  if (!override && hasText(process.env.CAIRN_IMPECCABLE_SRC)) {
    candidates.push(join(resolve(process.env.CAIRN_IMPECCABLE_SRC), '.claude/skills/impeccable'));
  }
  const path = candidates.find((candidate) => existsSync(join(candidate, 'SKILL.md')));
  if (!path) {
    return {
      status: 'absent',
      path: candidates[0],
      pin: IMP_PIN,
      skill_version: null,
      engine_version: null,
      engine: null,
    };
  }
  const skillVersion = frontmatterVersion(join(path, 'SKILL.md'));
  const engineVersion = readLineVersion(join(path, 'scripts/VERSION')) ?? skillVersion;
  const engineCandidates = process.env.CAIRN_IMPECCABLE_BIN
    ? [resolve(process.env.CAIRN_IMPECCABLE_BIN)]
    : [
        join(homedir(), '.impeccable/bin', engineVersion ?? '', process.platform === 'win32' ? 'impeccable.exe' : 'impeccable'),
        join(path, 'scripts', process.platform === 'win32' ? 'impeccable.cmd' : 'impeccable'),
      ];
  const engine = engineCandidates.find((candidate) => existsSync(candidate));
  const status = !engine
    ? 'not-invocable'
    : skillVersion === IMP_SKILL_PIN && engineVersion === IMP_ENGINE_PIN
      ? 'present'
      : 'mismatch';
  return {
    status,
    path,
    pin: IMP_PIN,
    skill_version: skillVersion,
    engine_version: engineVersion,
    engine: engine ?? null,
  };
}

function checkStandards(root) {
  const errors = [];
  for (const name of STANDARDS) {
    const en = join(root, 'method/standards', `${name}.md`);
    const zh = join(root, 'method/standards', `${name}.zh.md`);
    if (!existsSync(en)) {
      errors.push(`standards/${name}.md: missing`);
      continue;
    }
    if (!existsSync(zh)) errors.push(`standards/${name}.zh.md: missing Chinese companion`);
    const text = readText(en) ?? '';
    if (!/^\s*-\s*Source:\s*\S+/m.test(text)) errors.push(`standards/${name}.md: missing Source`);
    if (!/^\s*-\s*Pin:\s*\S+/m.test(text)) errors.push(`standards/${name}.md: missing Pin`);
    if (text.trim() === '') errors.push(`standards/${name}.md: empty`);
  }
  for (const name of TEMPLATES) {
    const en = join(root, 'method/templates', `${name}.md`);
    const zh = join(root, 'method/templates', `${name}.zh.md`);
    if (!existsSync(en)) errors.push(`templates/${name}.md: missing`);
    if (!existsSync(zh)) errors.push(`templates/${name}.zh.md: missing Chinese companion`);
  }
  return errors;
}

function detectPacks() {
  return {
    schema: 'cairn/packs@0.1',
    packs: {
      superpowers: detectSuperpowers(),
      impeccable: detectImpeccable(),
    },
  };
}

function printPacks(report, json) {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  for (const [name, pack] of Object.entries(report.packs)) {
    const detail = pack.status === 'present'
      ? `${pack.skill_version ? `skill ${pack.skill_version} ` : ''}${pack.engine_version ? `engine ${pack.engine_version}` : pack.version ?? ''}`.trim()
      : pack.path;
    console.log(`${name}: ${pack.status}${detail ? ` (${detail})` : ''}`);
  }
}

function parseArgs(argv) {
  const opts = {
    root: ROOT,
    playbook: false,
    packs: false,
    products: false,
    standards: false,
    strict: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      const value = argv[++index];
      if (!value) throw new Error('--root needs a directory');
      opts.root = resolve(value);
    } else if (arg.startsWith('--root=')) {
      opts.root = resolve(arg.slice('--root='.length));
    } else if (arg === '--playbook') {
      opts.playbook = true;
    } else if (arg === '--packs') {
      opts.packs = true;
    } else if (arg === '--products') {
      opts.products = true;
    } else if (arg === '--standards') {
      opts.standards = true;
    } else if (arg === '--strict') {
      opts.strict = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }
  if (!opts.playbook && !opts.packs && !opts.products && !opts.standards) {
    opts.playbook = true;
    opts.standards = true;
  }
  return opts;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    return 1;
  }
  if (opts.packs) printPacks(detectPacks(), opts.json);
  if (opts.standards) {
    const errors = checkStandards(opts.root);
    if (errors.length) {
      errors.forEach((error) => console.error(`standards: ${error}`));
      return 1;
    }
    console.log('standards: ok');
  }
  if (!opts.playbook && !opts.products) return 0;

  let doc;
  try {
    doc = readPlaybook(opts.root);
  } catch (error) {
    console.error(error.message);
    return 1;
  }
  const errors = checkPlaybook(doc, opts.root);
  if (errors.length) {
    errors.forEach((error) => console.error(`playbook: ${error}`));
    return 1;
  }
  if (opts.products) {
    const result = checkProducts(doc, opts.root, opts.strict);
    result.pending.forEach((line) => console.log(`pending: ${line}`));
    if (result.errors.length) {
      result.errors.forEach((error) => console.error(`products: ${error}`));
      return 1;
    }
    console.log('products: ok');
  }
  if (opts.playbook) console.log('playbook: ok');
  return 0;
}

process.exitCode = main();
