<!-- translation of docs/decision-routing.md at the decision-routing rule commit; the English file is authoritative -->

# 决策路由

一个决策，一个家。scope 决定放在哪里；路径就是检查。

- **ADR**——`docs/decisions/` 里的编号项目级决策。它跨 mission 存在，回答“项目为什么长成
  这样”。它要求 Context、Decision、Consequences 三个部分。
- **Mission escalation**——关闭或阻塞某个 mission 验收标准、需要人类回答的决策。它放在
  `.cairn/missions/<id>/inbox/`。它要求 Status、Date 和 Serves（或 Blocks）。在得到回答前，
  任务保持 parked。
- **政策文档**——就地生效、就地修订的规则（`docs/i18n.md`、`docs/drift-control.md`、本文件）。
  它陈述当前规则，不是决策记录。一次性的选择，附带备选与后果，才是 ADR。
- **提升**——mission 决策只有通过显式迁移到 `docs/decisions/`、更新索引并记录一条 note，才
  成为 ADR。不要复制；不要保留两个权威副本。
- **Legacy**——早于这条规则的决策可以带 `Legacy: true`。检查器仍然执行路径和中文 companion
  检查；它不会回头给历史补字段。

SessionStart hook 配置在 `startup|resume`，运行 `node scripts/goal-check.mjs --anchor`，由它
从前置元数据带上这条规则。`scripts/check-decisions.mjs` 执行它。`cairn-guard` skill 在决策点
运行检查。改这个文件，不要改副本：前置元数据是机器契约。

工作区 hook 在 `~/.zcode/security/workspace-hook-trust-v1.json` 包含它之前处于
`pending_trust`；在此之前手动运行 `node scripts/goal-check.mjs --anchor`。授信并开启新会话
后，上下文中出现 `Cairn goal anchor` 才是真实注入的证据。脚本通过测试不等于 harness 真的
运行了它。

## 为什么单独成规则

Mission #1 关闭时，同一个决策被拆在 hook 字符串、文档页、收件箱索引和 Scope 行里。一个新
会话可以读完所有这些，仍然不知道新决策该放哪里。修法不是再加一段话，而是一个来源、一个
检查、一个注入点。
