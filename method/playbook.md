# The fusion playbook

This is the executable map of the method. Every phase names a Cairn floor, the superpowers
practice that makes it better, the Impeccable standard that applies, the seam that keeps Cairn
the source of truth, and a concrete fallback. `node scripts/check-method.mjs --playbook` parses
the block below; the table is the human rendering.

The first superpowers use in this mission is `test-driven-development` for
`scripts/check-method.mjs`; `test/method.test.mjs` is the evidence, recorded in `packs_used`.
Impeccable is installed, but this repository has no UI surface, so its design checks are
`not-applicable` with a reason, not "clean".

```json
{
  "schema": "cairn/playbook@0.1",
  "packs_used": [
    {
      "capability": "test-first",
      "pack": "superpowers",
      "version": "7.0.1",
      "evidence": "test/method.test.mjs"
    }
  ],
  "phases": [
    {
      "phase": "frame",
      "floor": "README.md positioning plus mission.md intent, non-goals, and acceptance; goal-check prints the anchor.",
      "product": {
        "kind": "path",
        "ref": "README.md"
      },
      "superpowers": {
        "skill": "brainstorming",
        "pin": "7.0.1",
        "mode": "human-in-loop",
        "reason": "asks the owner questions before committing to a design",
        "fallback": {
          "text": "write the intent, non-goals, and acceptance in mission.md",
          "product": {
            "kind": "path",
            "ref": ".cairn/missions/001-method-pack/mission.md"
          }
        }
      },
      "impeccable": {
        "standard": "init/document",
        "pin": "4.8.0+df3a4ab",
        "applicability": "not-applicable",
        "reason": "no UI surface; the interview would invent product or visual facts",
        "fallback": {
          "text": "use the in-repo product positioning in README.md",
          "product": {
            "kind": "path",
            "ref": "README.md"
          }
        }
      },
      "seam": "Cairn owns mission.md; pack output is context, never a completion signal.",
      "status": "exists"
    },
    {
      "phase": "plan",
      "floor": "plan.md frontmatter with serves, declared files, and blocking gates; goal-check reports the coverage map.",
      "product": {
        "kind": "path",
        "ref": ".cairn/missions/001-method-pack/plan.md"
      },
      "superpowers": {
        "skill": "writing-plans",
        "pin": "7.0.1",
        "mode": "use",
        "fallback": {
          "text": "write the plan frontmatter directly and check it with goal-check",
          "product": {
            "kind": "path",
            "ref": ".cairn/missions/001-method-pack/plan.md"
          }
        }
      },
      "impeccable": {
        "standard": "document",
        "pin": "4.8.0+df3a4ab",
        "applicability": "not-applicable",
        "reason": "no UI surface; a design-system document has no subject here",
        "fallback": {
          "text": "use the in-repo product positioning in README.md",
          "product": {
            "kind": "path",
            "ref": "README.md"
          }
        }
      },
      "seam": "Cairn's plan and cairn next are authoritative; a superpowers plan stays adapter-local.",
      "status": "exists"
    },
    {
      "phase": "execute",
      "floor": "One tick: a commit, a blocking gate at exit 0, and a task_done event; cairn verify records the gate.",
      "product": {
        "kind": "gate",
        "ref": "test"
      },
      "superpowers": {
        "skill": "test-driven-development",
        "pin": "7.0.1",
        "mode": "use",
        "fallback": {
          "text": "write the test first, then the implementation, then run the gate",
          "product": {
            "kind": "gate",
            "ref": "test"
          }
        }
      },
      "impeccable": {
        "command": "impeccable detect --json",
        "pin": "4.8.0+df3a4ab",
        "applicability": "not-applicable",
        "reason": "no markup or URL target; detect returns [] for markdown",
        "fallback": {
          "text": "use the in-repo design checklist",
          "product": {
            "kind": "path",
            "ref": "method/README.md"
          }
        }
      },
      "seam": "RED to GREEN evidence lands in gate_result; superpowers task-start writes no ledger; Cairn records task_started (T7).",
      "status": "exists"
    },
    {
      "phase": "review",
      "floor": "A fresh-context reviewer uses the checklist and records review_result; cairn review lands in T7.",
      "product": {
        "kind": "command",
        "ref": "cairn review"
      },
      "superpowers": {
        "skill": "requesting-code-review",
        "pin": "7.0.1",
        "mode": "use",
        "fallback": {
          "text": "a fresh-context reviewer runs the same checklist",
          "product": {
            "kind": "path",
            "ref": "method/README.md"
          }
        }
      },
      "impeccable": {
        "command": "impeccable critique",
        "pin": "4.8.0+df3a4ab",
        "applicability": "not-applicable",
        "reason": "critique asks the user and audit is web-only; this repository has no UI surface",
        "fallback": {
          "text": "use the in-repo review checklist",
          "product": {
            "kind": "path",
            "ref": "method/README.md"
          }
        }
      },
      "seam": "Findings map to review_result; a pack report is input, gate evidence is proof.",
      "status": "planned:T7"
    },
    {
      "phase": "close",
      "floor": "cairn record writes task_done; mission_done closes the mission; audit-session runs before the claim.",
      "product": {
        "kind": "command",
        "ref": "cairn record --mission-done"
      },
      "superpowers": {
        "skill": "verification-before-completion",
        "pin": "7.0.1",
        "mode": "use",
        "fallback": {
          "text": "run every blocking gate and the audit before claiming done",
          "product": {
            "kind": "command",
            "ref": "cairn next"
          }
        }
      },
      "impeccable": {
        "standard": "polish/harden",
        "pin": "4.8.0+df3a4ab",
        "applicability": "not-applicable",
        "reason": "UI-only polish and hardening; there is no rendered surface",
        "fallback": {
          "text": "use the in-repo code and docs standards",
          "product": {
            "kind": "path",
            "ref": "method/README.md"
          }
        }
      },
      "seam": "A green gate proves the step, not the goal; an audit failure is recorded, not hidden.",
      "status": "exists"
    },
    {
      "phase": "state",
      "floor": "ledger.jsonl is the only truth; cairn status, next, and reconcile read it.",
      "product": {
        "kind": "path",
        "ref": ".cairn/missions/001-method-pack/ledger.jsonl"
      },
      "superpowers": {
        "skill": "executing-plans",
        "pin": "7.0.1",
        "mode": "use",
        "fallback": {
          "text": "use cairn next, verify, and record",
          "product": {
            "kind": "command",
            "ref": "cairn next"
          }
        }
      },
      "impeccable": {
        "standard": "none",
        "pin": "4.8.0+df3a4ab",
        "applicability": "not-applicable",
        "reason": "design state is not runtime state",
        "fallback": {
          "text": "use the ledger",
          "product": {
            "kind": "path",
            "ref": ".cairn/missions/001-method-pack/ledger.jsonl"
          }
        }
      },
      "seam": "The superpowers progress journal is completion-only, git-ignored scratch; Cairn records task_started and reconciles; the Cairn ledger wins.",
      "status": "exists"
    },
    {
      "phase": "design-check",
      "floor": "The in-repo design checklist applies to docs and code; UI-only dimensions are marked not-applicable with a reason.",
      "product": {
        "kind": "path",
        "ref": "method/README.md"
      },
      "superpowers": {
        "skill": "none",
        "pin": "7.0.1",
        "mode": "not-applicable",
        "reason": "superpowers has no design-check practice",
        "fallback": {
          "text": "use the in-repo design checklist",
          "product": {
            "kind": "path",
            "ref": "method/README.md"
          }
        }
      },
      "impeccable": {
        "command": "impeccable detect --json",
        "pin": "4.8.0+df3a4ab",
        "applicability": "not-applicable",
        "reason": "no markup or URL target; markdown returns [] and that is not a clean result",
        "fallback": {
          "text": "use the in-repo design checklist",
          "product": {
            "kind": "path",
            "ref": "method/README.md"
          }
        }
      },
      "seam": "Detector JSON is gate evidence only when a UI surface exists; an empty result is not a pass.",
      "status": "exists"
    },
    {
      "phase": "handoff",
      "floor": "A dispatch packet names the task, gates, packs, and fallbacks; the report returns evidence.",
      "product": {
        "kind": "path",
        "ref": "templates/dispatch.md"
      },
      "superpowers": {
        "skill": "subagent-driven-development",
        "pin": "7.0.1",
        "mode": "use",
        "fallback": {
          "text": "run the tick single-agent, serially",
          "product": {
            "kind": "path",
            "ref": "templates/dispatch.md"
          }
        }
      },
      "impeccable": {
        "standard": "none",
        "pin": "4.8.0+df3a4ab",
        "applicability": "not-applicable",
        "reason": "no design deliverable to hand off",
        "fallback": {
          "text": "use the dispatch template",
          "product": {
            "kind": "path",
            "ref": "templates/dispatch.md"
          }
        }
      },
      "seam": "One packet per task; an adapter report never writes the ledger; no merge and no second source of truth.",
      "status": "exists"
    },
    {
      "phase": "unattended",
      "floor": "Prepare one tick for an unattended executor: packet, policy stops, and the one-tick loop. Mission #2 adds the long-running scheduler.",
      "product": {
        "kind": "command",
        "ref": "cairn next"
      },
      "superpowers": {
        "skill": "executing-plans",
        "pin": "7.0.1",
        "mode": "human-in-loop",
        "reason": "stops on irreversible work, security, external side effects, or an unrecoverable plan",
        "fallback": {
          "text": "run one tick per session with policy stops",
          "product": {
            "kind": "command",
            "ref": "cairn next"
          }
        }
      },
      "impeccable": {
        "standard": "none",
        "pin": "4.8.0+df3a4ab",
        "applicability": "not-applicable",
        "reason": "unattended design review would need a human; there is no UI surface",
        "fallback": {
          "text": "use the in-repo checklist only",
          "product": {
            "kind": "path",
            "ref": "method/README.md"
          }
        }
      },
      "seam": "Policy stops are Cairn's; superpowers may run continuously; worktree creation asks the human and is skipped unattended.",
      "status": "exists"
    }
  ]
}
```

## Rendered map

| Phase | Cairn floor | superpowers | Impeccable | Seam | Status |
|---|---|---|---|---|---|
| frame | README positioning + mission intent, non-goals, acceptance; `goal-check` | `brainstorming` @ 7.0.1, human-in-loop | `init`/`document`, not-applicable (no UI) | Cairn owns `mission.md` | exists |
| plan | `plan.md` with serves, files, gates; `goal-check` coverage | `writing-plans` @ 7.0.1 | `document`, not-applicable (no UI) | Cairn plan is authoritative | exists |
| execute | commit + blocking gate + `task_done`; `cairn verify` | `test-driven-development` @ 7.0.1 | `detect`, not-applicable (markdown returns `[]`) | RED→GREEN in `gate_result` | exists |
| review | fresh-context reviewer + `review_result`; `cairn review` | `requesting-code-review` @ 7.0.1 | `critique`/`audit`, not-applicable (web-only, asks the user) | findings → `review_result` | planned:T7 |
| close | `cairn record`, `mission_done`, `audit-session` | `verification-before-completion` @ 7.0.1 | `polish`/`harden`, not-applicable (no UI) | green gate ≠ goal | exists |
| state | `ledger.jsonl` is the only truth | `executing-plans` @ 7.0.1 | none, not-applicable | journal is scratch; ledger wins | exists |
| design-check | in-repo checklist; UI dimensions not-applicable | none, not-applicable | `detect`, not-applicable (no markup/URL) | empty `[]` is not clean | exists |
| handoff | dispatch packet + report | `subagent-driven-development` @ 7.0.1 | none, not-applicable | one packet, no ledger writes | exists |
| unattended | packet + policy stops + one tick; Mission #2 adds the loop | `executing-plans` @ 7.0.1, human-in-loop | none, not-applicable | policy stops are Cairn's | exists |

## Pins

- superpowers `7.0.1`.
- Impeccable skill `4.8.0`, source `df3a4ab`, engine `0.1.18`. The playbook pin
  `4.8.0+df3a4ab` names the skill and source; `check-method --packs` reports the installed
  engine separately.
