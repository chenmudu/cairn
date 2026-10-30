---
schema: cairn/plan@0.1
mission: 000-bootstrap
tasks:
  - id: T-001
    title: Protocol schema and validator
    deps: []
    risk: low
    status: todo
    files:
      - docs/protocol.md
      - scripts/validate-mission.mjs
      - package.json
    interfaces:
      produces:
        - "validateMission(dir): { ok: boolean, errors: string[] }"
    gates:
      - id: validate
        command: node
        args: ["scripts/validate-mission.mjs", "missions/000-bootstrap"]
        severity: block
  - id: T-002
    title: Ledger and CLI skeleton
    deps: [T-001]
    risk: medium
    status: todo
    files:
      - src/ledger.ts
      - src/plan.ts
      - src/cli.ts
      - package.json
      - tsconfig.json
    interfaces:
      consumes:
        - "validateMission(dir)"
      produces:
        - "appendEvent(event): void"
        - "readLedger(missionDir): Event[]"
        - "buildPacket(missionDir, taskId): Packet"
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: test
        command: node
        args: ["--test"]
        severity: block
  - id: T-003
    title: Verify and gate registry
    deps: [T-002]
    risk: medium
    status: todo
    files:
      - src/gates.ts
      - src/verify.ts
      - test/gates.test.ts
    interfaces:
      consumes:
        - "readLedger(missionDir)"
      produces:
        - "runGate(gate): GateResult"
        - "verifyTask(missionDir, taskId): VerifyResult"
    gates:
      - id: test
        command: node
        args: ["--test"]
        severity: block
      - id: fixture
        command: node
        args: ["scripts/validate-mission.mjs", "test/fixtures/missing-gate"]
        severity: block
  - id: T-004
    title: Generic adapter and dispatch packet
    deps: [T-003]
    risk: low
    status: todo
    files:
      - docs/adapter.md
      - templates/dispatch.md
      - src/packet.ts
      - test/packet.test.ts
    interfaces:
      consumes:
        - "buildPacket(missionDir, taskId)"
      produces:
        - "renderDispatch(packet): string"
    gates:
      - id: typecheck
        command: pnpm
        args: ["typecheck"]
        severity: block
      - id: packet
        command: node
        args: ["--test", "test/packet.test.ts"]
        severity: block
  - id: T-005
    title: Self-host the first tick
    deps: [T-004]
    risk: low
    status: todo
    files:
      - docs/self-hosting.md
      - missions/000-bootstrap/ledger.jsonl
    interfaces:
      consumes:
        - "cairn next"
        - "cairn verify"
        - "cairn record"
      produces:
        - "a task delivered with no manual ledger edit"
    gates:
      - id: reconcile
        command: node
        args: ["scripts/validate-mission.mjs", "missions/000-bootstrap"]
        severity: block
---

# Plan — Mission #0

A task is the smallest unit that carries its own gate and commit. Do them in order; each
one's interface block is what the next task may rely on.

## T-001 — Protocol schema and validator

**Goal:** Make the protocol machine-checkable before any runtime code exists.

**Deliverable:** a zero-dependency Node ESM script `scripts/validate-mission.mjs` that
validates one mission directory:

- required frontmatter fields on `mission.md`, `policy.md`, `plan.md`;
- task ids unique, dependencies resolvable, status in `todo | active | review | done | parked`;
- every task has at least one `severity: block` gate;
- `ledger.jsonl` parses as one JSON object per line, with known event names;
- every `task_done` event names `base`, `head`, and at least one blocking gate at exit 0;
- every evidence path named by the ledger exists.

Add a `package.json` with `"type": "module"` and no dependencies. No TypeScript yet.

**Gate:** `node scripts/validate-mission.mjs missions/000-bootstrap`

**Done when:** the command exits 0 on this mission, and exits non-zero on a fixture with a
task that has no gate.

## T-002 — Ledger and CLI skeleton

**Goal:** One writer for the ledger, and read-only commands that prove the plan is legible.

**Deliverable:** `src/ledger.ts`, `src/plan.ts`, `src/cli.ts`, `tsconfig.json`. Commands:

- `cairn status [--json]` — task states derived from the ledger, not from frontmatter status;
- `cairn next` — the first `todo` task whose dependencies are `done`, as a dispatch packet on
  stdout; exit 2 when none;
- `cairn record <task> --status done` — refuses unless a commit exists, a blocking gate at
  exit 0 is recorded, and the task's evidence files exist.

`appendEvent` is the only write path. It appends one line and fsyncs.

**Gate:** `pnpm typecheck` and `node --test`

**Done when:** `cairn record T-001 --status done` refuses because T-001 has no evidence yet,
and the refusal names the missing condition.

## T-003 — Verify and gate registry

**Goal:** The runtime runs gates itself; implementer reports are not evidence.

**Deliverable:** `src/gates.ts`, `src/verify.ts`, and tests. `cairn verify <task>`:

- reads the task's gates from `plan.md`;
- runs each as a fixed argv with a timeout and an output cap;
- writes `evidence/<task>/<gate>.json` (command, argv, exit code, duration, tail);
- appends one `gate_result` per gate;
- exits 2 if any blocking gate failed.

Advisory gates are recorded but never change the exit state.

**Gate:** `node --test` plus a fixture mission whose blocking gate exits 1.

**Done when:** a failing gate writes exit 1, `cairn record` still refuses, and an advisory
failure does not block.

## T-004 — Generic adapter and dispatch packet

**Goal:** Any coding agent can execute a task from a file, with no Cairn-specific runtime.

**Deliverable:** `docs/adapter.md`, `templates/dispatch.md`, `src/packet.ts`. The packet
contains mission, task, policy, constraints, gates, ledger tail, and base commit. The adapter
contract returns the report JSON defined in `docs/protocol.md`; it never writes the ledger.

**Gate:** `pnpm typecheck` and `node --test test/packet.test.ts`

**Done when:** `cairn next` output validates against the documented packet schema, and a human
can hand `templates/dispatch.md` to a different coding agent and get a report back.

## T-005 — Self-host the first tick

**Goal:** Prove the protocol can carry its own development.

**Deliverable:** `docs/self-hosting.md` written through the loop: `cairn next` selects T-005,
a fresh agent executes from the packet, `cairn verify` runs the gate, `cairn record` appends
`task_done`. No manual ledger edit.

**Gate:** `node scripts/validate-mission.mjs missions/000-bootstrap`

**Done when:** the ledger contains `task_started`, `gate_result`, `review_result`, and
`task_done` for T-005, and `cairn status` shows the mission complete.

## Review Focus

The five failure modes most likely to bite, each owned by a task's tests:

1. **Ledger/commit divergence** — a `task_done` without a commit, or a commit without an
   event. T-002 must refuse it; T-005 must reconcile it.
2. **Adapter writes the ledger** — two writers, duplicated events. T-004's contract says the
   adapter returns a report only; T-005 proves it.
3. **A gate that cannot fail** — an always-zero command that makes every task look done.
   T-003 needs a fixture that fails.
4. **Windows paths and case** — `C:\` vs `/`, case-insensitive file systems. T-001 and T-003
   run on win32 first.
5. **Ledger ordering and timestamps** — concurrent appends or clock skew. T-002 fsyncs and
   rejects non-monotonic `ts`.