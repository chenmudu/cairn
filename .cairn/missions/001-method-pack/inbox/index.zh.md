<!-- translation of .cairn/missions/001-method-pack/inbox/index.md at the Mission #2 approval revision; the English file is authoritative -->

# Mission #1 收件箱

等待人类决定的事项。每个决定一个文件；每个文件都有中文 companion。阻塞性问题是一次
escalation：在得到回答前，任务保持 parked。没有人类参与的决定是 ruling，记入台账。

放置规则：关闭或阻塞某个 mission 验收标准的决策，放在这个收件箱。`docs/decisions/` 保存
项目级 ADR 系列；mission 决策只有在超出 mission 生命周期时才通过显式迁移提升到那里。

已回答：

- `0005-packs-block.md` — 收件箱决策 0005，人类于 2026-10-31 批准。`packs` 块、两个 CLI
  命令和不变量 3 的措辞已作为协议修订记录，`approved_by: human`；T7 解除暂停。

已批准：

- `0006-completion-integrity.md` — 人类于 2026-10-31 批准。它定义 Mission #2
  （`002-completion-integrity`）、A1–A6、T1–T8 和 D1–D8 工作流。具有约束力的批准是 Mission #2
  的 `mission_created` 事件，`approval_source: ["0006", "0005"]`；决策文件不是记录。Mission #1
  保持关闭。

当前待决：无。Mission #2 由人类授权的一次手工 `mission_created` 冻结创建，这是最后一次
bootstrap 例外；T5 让 `cairn init` 成为写者。

T3 里程碑审计没有待决事项。T6 审计发现已记入台账；样例和双语修复已落地，剩余运行时缺口
属于 T7。关闭后的审计和 Mission #2 契约在 `0006-completion-integrity.md`。
