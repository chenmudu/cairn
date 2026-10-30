---
schema: cairn/plan@0.1
mission: 0001-docs-tick
tasks:
  - id: E1
    title: Write the product brief
    deps: []
    risk: low
    status: done
    serves: [A1, A2]
    files:
      - method/examples/0001-docs-tick/product.md
      - method/examples/0001-docs-tick/README.md
      - method/examples/0001-docs-tick/README.zh.md
      - method/examples/0001-docs-tick/evidence/
      - method/examples/0001-docs-tick/ledger.jsonl
    gates:
      - id: example
        command: node
        args: ["scripts/check-example.mjs", "--product", "method/examples/0001-docs-tick"]
        severity: block
---

# Plan — One tick, one trail

The frontmatter is the machine contract. E1 is the only task; it writes the product and its
record.

## Task notes

- **E1** writes `product.md`, runs the product gate, records the evidence, and records the
  review. It does not add a UI or a scheduler.
