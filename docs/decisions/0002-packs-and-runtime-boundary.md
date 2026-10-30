# 0002 — Consume the packs; do not merge them

- Status: accepted
- Date: 2026-10-31

## Context

The project started as a question: can **superpowers** (MIT; process skills, subagent
workflows, execution discipline) and **Impeccable** (Apache-2.0; design and critique
standards) be fused into one way of working that raises the quality and speed of docs, code,
and workflows, and then supports unattended long-horizon work?

Two constraints shaped the answer:

- The runtime is usually ZCode but may be another coding agent; nothing may depend on a
  ZCode-only API.
- The project must prove itself on itself: Mission #0 builds Cairn with Cairn.

## Decision

1. **No code merge.** superpowers and Impeccable stay external repositories, consumed by
   reference. Absorbing either would fork it and lose upstream updates.
2. **Role split.** superpowers supplies process content ("how to work"), Impeccable supplies
   review criteria ("what good looks like"), Cairn supplies the runtime and the evidence layer
   ("what counts as done").
3. **Harness-neutral boundary.** Cairn owns the protocol, the dispatch packet, and the ledger.
   Adapters execute tasks and return reports; they never write the ledger (`T-004`).
4. **One ledger.** A pack may not bring its own progress file. If a skill wants durable state,
   it is expressed as ledger events, or it is not used.

## Evidence from T-001

Executing T-001 with superpowers surfaced the exact boundary this decision describes:

- `executing-plans` expects a `.superpowers/sdd/<plan>/progress.md` ledger, a dedicated git
  worktree, and `task-start` / `task-done` scripts. Cairn already has a ledger and a
  one-active-task-per-worktree rule. We adopted the discipline — brief, RED→GREEN,
  verification before claims, rulings for every unrequested decision — and did not
  materialize the second bookkeeping system.
- `test-driven-development` required a durable test. That produced
  `test/validate-mission.test.mjs`, which is outside `T-001`'s declared file list; it is
  recorded as a ruling in the ledger rather than added silently.
- Impeccable is not installed as a skill. Its standards are used as review criteria by
  reference; it becomes a vendored skill only if adopted wholesale.

## Consequences

- Any future pack integration is an adapter or a gate, never a second source of truth.
- If a pack's workflow cannot be expressed in Cairn's protocol, that is a protocol bug to fix,
  not an exception to grant.
- The integration point for coding agents is the dispatch packet and report contract in
  `docs/protocol.md` (`T-004`).
