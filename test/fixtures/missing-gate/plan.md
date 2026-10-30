---
schema: cairn/plan@0.1
mission: missing-gate
tasks:
  - id: T-001
    title: Task without a gate
    deps: []
    risk: low
    status: todo
    files:
      - nothing.txt
    interfaces:
      produces:
        - "nothing(): void"
    gates: []
---

# Fixture plan

One task, zero gates.
