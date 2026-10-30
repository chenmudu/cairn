# 0003 — The project is the method; Cairn is its first artifact

- Status: accepted
- Date: 2026-10-31

## Context

The original goal was to judge whether **superpowers** and **Impeccable** can be fused into one
way of working that raises the efficiency of building products (docs, code, workflows), then to
explore a mode where long-horizon work runs unattended and still lands. The same project is the
test: use the thing being built as its own best practice.

Earlier docs described Cairn as "a mission runtime for long-horizon coding work". That narrowed
the scope to code and put the artifact at the center. It also let a session read the protocol,
see green gates, and still lose the goal.

## Decision

The project is the method. Cairn is its first artifact.

- The target is a repeatable, auditable, self-iterating way of building products.
- superpowers supplies process; Impeccable supplies standards; Cairn supplies continuity,
  evidence, and drift control.
- Cairn may be replaced. The method must survive that.
- The first user is the author: prove it on this repository before generalizing.

## Consequences

- `README.md` leads with the method and the goal, not the runtime.
- Every task declares `serves: [A#]`; reviews ask "does this serve the goal?", not only "is the
  gate green?".
- `docs/drift-control.md` is part of the contract: every safeguard names its enforcement point.
- The scope is docs, code, and workflows — not coding alone.
