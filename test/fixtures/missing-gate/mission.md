---
schema: cairn/mission@0.1
id: missing-gate
title: Fixture with a task that has no gate
status: active
created: 2026-10-31
owner: fixture
acceptance:
  - id: F1
    check: the validator rejects this mission
---

# Missing-gate fixture

Deliberately invalid: `T-001` declares no gate at all, so no blocking gate can
exist. The validator must reject this directory.
