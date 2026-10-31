<!-- translation of .cairn/missions/001-method-pack/inbox/0006-completion-integrity.md at the Mission #2 approval revision; the English file is authoritative -->

# 决策 0006 — 完成语义的完整性，以及 Mission #2 的修复计划

状态：人类于 2026-10-31 按本修订批准。具有约束力的记录是 Mission #2 的 `mission_created`
事件（`approval_source: ["0006", "0005"]`）；这一行只是指针，不是记录。Mission #1 保持关闭。
本文件记录关闭后的审计和 Mission #2 的契约；不给 Mission #1 的台账增加事件。

范围：mission escalation。它关闭 Mission #1 的关闭后审计，并定义 Mission #2；它不是项目级
ADR。

日期：2026-10-31。被审计的提交：`700f68c`。

审计输入：一份独立审计报告、对确定性闸门的本地复跑，以及在一个临时仓库里做的新端到端探针。
探针是 P0 的证据；其余发现都对照源码和 Mission #1 台账确认过。

服务对象：`README.md` 里的成功定义——一个全新的会话只靠仓库就能继续；milestone 审计确认
工作仍然服务目标。这个决策不重新打开 Mission #1。它记录 Mission #2 必须先修什么，否则
Mission #2 自己的完成也没有意义。

## 粒度

一份决策文件，八个工作流（D1–D8），八个任务（T1–T8），六个验收标准（A1–A6）。

这些缺陷共享一个根：完成是被事件“声明”的，而不是绑定到支撑它的树和证据。把根因拆成八份
决策文件会重复同一个探针和同一段论证。工作流按可独立关闭的条件拆：

1. 完成绑定（D1 → A1，T1）；
2. 验收与评审绑定（D2 → A2，T3）；
3. 任务级包参与（D3，ADR 0005 → A3，T2）；
4. 任务状态机（D4 → A4，T4）；
5. mission 创建、校验器与 CI（D5 → A5，T5）；
6. 策略执行与授权记录（D6、D8 → A6，T6）；
7. 契约与状态真实性（D7 → A6，T7）；
8. mission 收尾评审与关闭（T8）。

ADR 0005 是 `docs/decisions/` 里的任务级包权威决策。D3 引用它，不再自带 schema。更早的
收件箱决策 `0005-packs-block.md` 批准的是 packet 和 review 的 `packs` 块；它没有把包参与
变成任务属性。

## 已经成立的部分

在 `700f68c`，确定性层是绿的：133 个测试、`tsc --noEmit`、两个 mission 的校验、Mission #1
的 `reconcile`、双语检查、方法产物，以及哈希链（`mission` `6cc8961`、`policy` `c755611`、
`plan` `a1aa5b2`、`protocol` `f9498f3`）。审计没有发现失败测试或坏闸门。它发现的是：绿闸门
没有绑定到完成任务的那棵树。

那之后测试套件继续增长：在 `33ee177`，也就是 Mission #2 之前的 HEAD，`node --test` 有
167 个测试，上面的闸门仍然退出 0。这个缺陷是结构性的，不是回归。

## P0 — 红树可以绿着关闭

在一个临时仓库里复现，只有一个任务和一条读取 `code.txt` 的阻塞闸门：

1. `code.txt` 是好的；`cairn verify` 退出 0。
2. 把 `code.txt` 改成坏的并提交；同一条闸门在 HEAD 上退出 1。
3. `cairn record T1 --status done` 退出 0。
4. `cairn review` 退出 0，verdict 是 pass，没有 coverage、non-goals 或 cold-start 字段。
5. `cairn record --mission-done` 退出 0。
6. `validate-mission`、`reconcile`、`goal-check` 全部退出 0。
7. HEAD 里的台账是 200 字节；工作树里的台账是 1123 字节。`task_done` 和 `mission_done`
   只存在于未提交的工作树台账里。

当前代码为什么允许：

- `verifyTask` 在工作树里跑闸门，写证据，追加 `gate_result`，内容是闸门 id、命令、退出码和
  证据路径。它不记录 HEAD，也不记录 tree。
- `record` 检查 HEAD 存在、`base` 之后至少有一个提交、每条阻塞闸门的最新结果退出 0。它不
  检查闸门结果是否属于当前 HEAD，不检查工作树是否干净，也不检查完成事件是否已提交。
- `mission_done` 检查任务顺序、任务对验收的覆盖、以及更晚的一次通过评审。它不检查任务的
  闸门是否在被完成的那棵树上验证过，也不检查完成事件是否在历史里。
- `validate-mission` 只要 `.some` 一条阻塞闸门退出 0 就接受 `task_done`，只要求 `base`/`head`
  是非空字符串，不重算哈希。坏台账可以通过。
- CI 不跑 `reconcile`，也没有针对这个序列的负向端到端测试。

这是 P0，因为此后的每一个完成声明都不可证伪。在任何其他 Mission #2 任务之前先修 D1。

## 其余发现

**F2 — 验收证据是任务级的，不是验收标准级的。** `mission_done` 从一个验收标准的所有
`serves` 任务的闸门结果拼出证据。B5 要求一个全新上下文评审者的 `review_result`；它记录的证据
是 `evidence/T8/{test,mission,method-products}.json`，没有评审产物。B7 要求任务证据记录包的
使用、`not-applicable` 或 `absent`；它的证据也是同一组 T8 闸门结果，而且没有任何
`task_done` 带 `packs`。任务链接不是它所声称服务的验收标准的证据。

**F3 — 任务级包参与缺失。** 台账有 8 个 `task_done`，没有一个带 `packs`。负载被硬编码成
`base / head / commits / gates`。有 3 个 `review_result`，只有 T8 的最终评审带 `packs`。只有
T7 和 T8 有 `task_started`；T1–T6 早于 packet 注入。会话记录里实际的 `Skill` 工具调用是 0。
注入只是建议，没有任何东西要求执行者返回记录。ADR 0005 是决定；D3 是它的实现。

**F4 — 状态机比契约弱。** `start` 不检查依赖，也不检查是否已有活动任务。`record` 不要求
`task_started`；它回退到 HEAD 的父提交。`task_parked` 没有恢复路径，`cairn answer` 被列出但
没有实现。任务可以没开始就被记录，parked 的任务永远无法恢复。

**F5 — init、校验器和 CI 没有证明它们声称的东西。** `init` 创建 0 字节台账，不追加
`mission_created`，并且校验为干净。校验器只检查三种事件形状，阻塞闸门用 `.some`，不重算目标
产物哈希，也不校验 `review_result` 或 `mission_done`。CI 跑 typecheck、测试、两个 mission
校验、双语、workflow、example、playbook 和方法产物；它不跑 `reconcile`、`goal-check`、
`audit-session`，也没有负向端到端探针。

**F6 — 策略和契约文本是描述性的，不可执行。** 策略字段（`budgets`、`allowed_commands`、
`forbidden_commands`、`stop_conditions`）只被读进 packet，从不执行。Mission #1 禁止
`git push`，但推送在人类的长期授权下发生了，而策略没有记录这个授权。协议说“只有一个写者：
`cairn record`”，但 `start`、`verify`、`review` 也在追加。协议里还留着 T-002 的裁决文本。它
列出 `cairn answer` 和 `cairn export`，两个都没有实现。`src/packet.ts` 渲染 dispatch brief，
没有任何 CLI 入口调用它。`docs/i18n.md` 说 Mission #1 的 plan 在 T3 修订时是最新的，而
`plan.zh.md` 说 T7。状态来源互相矛盾：台账说完成，`plan.md` 说 T7 活动、T8 待办，
`mission.md` 说 active，`README.md` 说完成。

## 决定

### D1 — 完成绑定到被验证的树

- 顺序是 **工作 → 提交工作 → verify → record → 只提交台账**。`verify` 要求 `.cairn/` 之外的
  工作树干净，所以它验证的内容已经提交。它一次性捕获 `head` 和 `tree`，并把两者写进每个
  `gate_result`。如果运行期间被跟踪的内容发生变化，verify 失败。操作指南和协议记录这个顺序；
  指南在 T1 更新，协议文本在 T7 更新。
- `record` 要求每条阻塞闸门的最新结果带有当前 `head` 和 `tree`，且退出 0。它还要求 verify
  之后 `.cairn/` 之外没有工作树改动。结果不匹配或缺失时拒绝 `task_done`。
- `record --mission-done` 要求工作树台账与 HEAD 的台账 blob 完全相同，所以此前每一行
  `task_done` 都已提交。最后的 `mission_done` 由包含它的提交证明。
- 当完成事件存在于工作树台账、但不存在于 HEAD 的台账时，`reconcile` 失败。CI 在推上去的
  提交上跑 `reconcile`。
- 完成判据：P0 探针在 `record` 处失败；干净树通过；测试覆盖树不匹配、脏工作树和未提交的
  `task_done`；CI 把探针作为负向测试运行。

### D2 — 验收和评审证据指名验收标准

- `review_result` 要求为每个验收 id 提供 `coverage`，每项写明验收标准、任务、证据（闸门 id
  加证据路径，或评审产物）和 verdict。`mission_done` 校验每个被引用的产物存在，被引用的闸门
  结果退出 0。只有任务的 `serves` 链接不算证据。
- `review_result` 要求 `non_goals`（每个非目标、verdict、证据）和 `cold_start`（评审者、
  产物、verdict）。`mission_done` 拒绝缺少任一字段的评审。
- 评审者来源是证据：`reviewer`、`context: fresh | coordinator`，以及产物（子代理 id 或会话
  记录路径）。由协调者启动的全新子代理算全新上下文，但不是独立签名；人类检查点仍然是独立性
  的证明。评审产物是它所覆盖的验收标准的证据。
- `mission_done` 要求一条人类授权事件，`scope: mission_done`、`approved_by: human` 并带原因，
  且记录在最后一次评审之后。评审者证明工作；人类授权关闭。
- Mission #1 的 B5/B7 证据会违反这条规则。这是预期结果；规则适用于修订之后关闭的 mission。
- 完成判据：在新规则下重放 Mission #1 的 B5/B7 证据会失败；新 mission 的评审用逐验收标准
  产物通过；`mission_done` 拒绝缺字段或缺少授权事件。

### D3 — 按任务记录包的参与（ADR 0005）

- ADR 0005 是任务级包参与的权威决策。D3 不再自带 schema 或新规则；它是那个 ADR 的实现。
- Mission #2 T2 实现它；A3 是验收标准。选择规则、记录形状、证据文件要求和三条硬约束都在
  ADR 0005 里。
- 祖父条款只在“兼容与 grandfather”一节写一次。

### D4 — 任务状态机被执行

- 依赖未完成或已有活动任务时，`start` 拒绝。
- `record` 要求任务有 `task_started` 事件。新事件移除 `gitParent` 回退；历史事件保持有效。
- 实现 `cairn answer`：记录人类决定并恢复 parked 任务。`task_parked` 保留原意；它不再是
  死路。
- 完成判据：没有 `start` 的直接 `record` 失败；乱序 `start` 失败；parked 任务可以被回答并
  完成；没有 `task_started` 的历史任务保持有效。

### D5 — init、校验器和 CI 与契约一致

- `init` 是 `mission_created` 的写者：追加 mission id、owner、批准来源，以及脚手架
  `mission.md`、`plan.md`、`policy.md` 的 sha256；仓库里有 `docs/protocol.md` 时也一并冻结。
  之后对目标产物的编辑是带旧/新哈希的 `mission_amended` 事件；T5 同时加上这个事件的运行时
  写者，所以 T5 之后没有目标产物靠手工修改。
- `validate-mission` 要求 `mission_created`；校验每种事件形状；要求全部阻塞闸门，而不是
  `.some`；检查 `base` 和 `head` 能解析到提交；对活动 mission 在 HEAD 上重算目标产物哈希并
  与最新修订比较；校验 `review_result` 字段和 `mission_done` 覆盖。新形状检查只适用于
  `mission_created` 带 `approval_source` 的 mission；已关闭的历史 mission 保留旧形状，和
  `check-targets` 只作用于活动 mission 是同一原则。
- CI 增加 `reconcile` 和 P0 负向探针。探针放在测试套件里，不只放在 workflow 里，这样本地
  `node --test` 也能抓到。
- 完成判据：`init` 产生非空台账并带 `mission_created`；被篡改的哈希、不存在的提交、只有
  部分阻塞闸门、未提交的完成事件分别失败；CI 跑这两项检查。

### D6 — 策略可执行，或明确标注为人类判断

- 闸门运行前，用 `allowed_commands` 和 `forbidden_commands` 检查命令。被禁止的命令拒绝该
  tick；不在允许列表里的命令带着策略路径拒绝。
- `stop_conditions` 拆成 `auto` 和 `human`。`write_outside_repo`、`budget_exhausted`、
  `gate_weakened_without_amendment`、`irreversible_or_destructive` 可检测；
  `goal_drift_suspected` 和 `acceptance_unreachable` 仍是人类检查点。策略逐条标注；运行时不
  假装自动判断。
- `budgets` 对尝试次数、修复轮次、墙钟时间和评审间隔强制执行。token 预算在测量前保持 null。
- 人类例外记录为 `approved_exceptions`，带命令、范围、批准人、日期和原因。`main` 的长期推送
  授权属于这里；Mission #1 的策略没有记录它，所以策略和实践互相矛盾。
- 完成判据：列表外的闸门被拒绝；`write_outside_repo` 尝试会 park；推送需要已记录的例外；
  策略和 packet 对“什么是建议”保持一致。

### D7 — 契约和状态来源说真话

- 协议：把单写者那句话替换成实际的归属表（`start`、`verify`、`record`、`review`、`answer`、
  `init` 各自拥有自己的事件类型）。删除过时的 T-002 文本。从命令列表里删除 `cairn export`，
  并删除未使用的 `renderDispatch` 路径，直到出现消费者。按 D4 实现 `cairn answer`。记录 D1
  的顺序和 D3 记录的任务级 `packs`。
- 状态：台账是唯一状态。`mission.md.status` 是初始声明；`plan.md` 任务的 `status` 是弃用的
  提示。`goal-check` 已经从台账推导。新 plan 不写 `status`；已有值作为历史保留，不编辑。
- 双语：修复已知的 plan/i18n 不一致。`check-bilingual` 校验每个头部的源路径存在、命名的提交
  可达；内容新鲜度仍然是人类 milestone 检查，不是检查器声称的能力。
- 可移植性：为 type-stripping 下限（Node ≥ 22.18）添加 `engines.node`，并在 CI 测试支持的
  版本。记录 Windows 闸门 shell 行为并用测试覆盖；不要把 `.cmd` 解析留给隐式回退。
- 审计：`audit-session` 接受显式会话记录路径，或在报告里记录选中的 session id 和路径。
  mission 结束时，报告写到 `evidence/audit/` 下，并被评审引用。它仍然是诊断，不是闸门。
- 完成判据：`docs/protocol.md` 与 CLI 一致；每个状态表面都指明台账是来源；`check-bilingual`
  检查它声称的内容；CI 证明 Node 下限；一个 mission 有记录的审计产物。

### D8 — 人类授权的写入要被记录，不是被推断

- `cairn record --authorized --paths <a,b> --why <text> --approved-by human` 追加
  `authorization` 事件，带 `paths`、`approved_by`、`why` 和 `date`。授权按 mission 作用域；
  事件写在活动 mission 的台账里。
- `audit-session` 把落在授权路径内的写入视为已授权，不是漂移。既不在任何授权内、也不在计划内
  的写入仍然是漂移。
- 事件是人类批准的记录，不是闸门。它不会让未授权写入变得合法；它让已授权写入可见。
- 完成判据：已授权写入不再报漂移；没有对应写入的授权会被报告，且不能掩盖其他写入；路径外的
  写入仍然是漂移。

## Mission #2 契约

Id：`002-completion-integrity`。标题：`Completion integrity`。Owner：`chenmudu`。

### 验收

- **A1** — 完成绑定到被验证的树。检查：P0 探针在 `record` 处失败；干净树通过；测试覆盖树
  不匹配、脏工作树和未提交的 `task_done`；CI 跑探针。
- **A2** — 验收和评审证据指名验收标准，评审者是证据，`mission_done` 需要人类授权事件。检查：
  逐验收标准的产物通过校验；缺 `non_goals`、`cold_start`、评审者来源或 `ui_surface` 的评审
  被拒绝；缺人类授权事件的 `mission_done` 被拒绝；在新规则下重放 Mission #1 的 B5/B7 证据
  失败。
- **A3** — 按任务记录包参与（ADR 0005）。检查：每个新 `task_done` 有两个合法条目；`record`
  拒绝缺失或非法记录；至少一个 superpowers `mode: use` 的证据通过 `isEvidenceFile` 且有
  RED→GREEN；只有 mission 无 UI 表面且收尾评审记录 `ui_surface: none` 时 Impeccable 才允许
  全 `not-applicable`；`absent` 带原因和地板证据。
- **A4** — 任务状态机被执行。检查：没有 `start` 的 `record` 失败；乱序 `start` 失败；parked
  任务可以被回答并完成；没有 `task_started` 的历史任务保持有效。
- **A5** — `init`、校验器和 CI 与契约一致。检查：`init` 追加 `mission_created`；被篡改的
  哈希、不存在的提交、只有部分阻塞闸门、未提交的完成事件分别失败；CI 跑 `reconcile` 和探针。
- **A6** — 策略可执行或标注人类，契约与 CLI 一致，每条审计发现都有覆盖。检查：列表外的闸门
  被拒绝；推送需要已记录的例外；`docs/protocol.md` 与 CLI 一致；`cairn record --authorized`
  写 `authorization` 事件且 `audit-session` 接受被覆盖的路径；每条可机械化的审计发现变成负向
  测试，不可机械化的标 `human` 或 `review`。

### 任务

- **T1 — 把完成绑定到被验证的树（D1，serves A1）。** 先写 P0 探针，再做 `verify` 的
  head/tree 绑定、`record` 的树与干净工作树检查、`mission_done` 的已提交台账、`reconcile`
  的未提交完成检测、操作顺序和 CI。
- **T2 — 按任务记录包参与（D3，ADR 0005，serves A3）。** 记录、校验、证据文件规则、三条硬
  约束，以及一个真实的 RED→GREEN 测试。T1 是 grandfather；T2 是第一个带 packs 的
  `task_done`。
- **T3 — 绑定验收与评审证据，授权关闭（D2，serves A2）。** 逐验收标准 coverage、non-goals、
  cold start、评审者来源、`ui_surface`，以及 `mission_done` 的人类授权事件。
- **T4 — 执行任务状态机（D4，serves A4）。** 依赖与单活动任务检查、要求 `task_started`，以及
  带恢复路径的 `cairn answer`。
- **T5 — 让 init、校验器和 CI 与契约一致（D5，serves A5）。** `mission_created` 写者、
  `mission_amended` 写者、更严格的校验器，以及 CI。
- **T6 — 让策略可执行并记录授权（D6、D8，serves A6）。** 闸门命令策略、预算与停止条件、
  `approved_exceptions`、`authorization` 写者，以及 `audit-session` 覆盖。
- **T7 — 让契约和状态来源说真话（D7，serves A6）。** 协议文本、CLI 真实性、双语声明、
  Node 下限、Windows 闸门 shell，以及审计产物路径。
- **T8 — mission 收尾评审与关闭（serves A2，覆盖 A1–A6）。** 全新上下文评审，带逐验收标准
  证据、冷启动检查、审计产物，以及 `mission_done` 之前的人类授权事件。

### 非目标

- 不改写 Mission #0 或 Mission #1 的台账、证据或目标产物。它们保持字节不变且有效；新规则只
  作用于新事件。
- 不 vendor、不合并 superpowers 或 Impeccable 仓库。它们保持外部。
- 不做 UI 表面、设计系统或托管服务。Impeccable 的参与是标准式的；`not-applicable` 是预期
  结果，必须记录。
- 不做无人值守调度器或多 tick 循环。完成完整性优先；循环放到后续 mission。
- D1–D8 之外不加新的运行时功能。
- 不重开 GitHub issues #1–#5。它们已按被本决策取代关闭；只有本决策被拒绝才重开。
- 协议变更必须 `approved_by: human`。

### 顺序

T1 D1 → T2 D3 → T3 D2 → T4 D4 → T5 D5 → T6 D6 + D8 → T7 D7 → T8 评审。

每个任务有 `serves` 链接和至少一条阻塞闸门。任何任务不得削弱闸门。每完成三个任务和 mission
结束时，在下一个任务之前跑 milestone 审计。

## 顺序

1. D1 — 完成绑定。在红树不能记录完成之前，别的都不可信。
2. D3 — 任务级包。它排在 D1 之后，因为之后每个任务都必须带包记录。
3. D2 — 验收和评审绑定。绿完成仍然需要语义链接。
4. D4–D5 — 状态机、init、校验器、CI。让契约可执行。
5. D6 + D8 — 策略与授权记录。人类授权的写入变得可见。
6. D7 — 契约和状态真实性。文本追平行为。

## 兼容与 grandfather

- Mission #0 和 Mission #1 的目标产物与台账保持字节不变。它们的事件继续有效；新规则只作用于
  新事件。新形状校验由 `mission_created.approval_source` 触发，所以已关闭 mission 不会被它
  之前不存在的规则重判。
- 不改写历史。目标产物（`mission.md`、`policy.md`、`plan.md`、`docs/protocol.md`）没有
  `mission_amended` 和旧/新哈希就不改。
- T1 早于 D3，所以它的 `task_done` 没有 `packs`；这是 Mission #2 里唯一的 grandfather。
  从 T2 起每个 `task_done` 都带 packs。
- Mission #1 的 8 个 `task_done` 保持有效，并由本注明登记为 grandfather。
- P0 探针使用全新的临时仓库；不碰两个历史台账。
- 完成规则变严，不变松。以前通过的任务在新规则下可能失败；这正是目的，并且只作用于新事件。

## CI 为什么没抓到 P0

CI 跑 `pnpm typecheck`、`node --test`、两个 mission 校验、`check-bilingual`、
`check-workflow`、`check-example`、`check-method --playbook` 和
`check-method --products --strict`。这证明确定性层没有回归。它不证明完成：

- CI 检查已提交产物。P0 活在已提交台账和未提交工作树台账之间的缝里；checkout 看不到这个缝。
- `validate-mission` 比契约弱：只检查三种事件形状，阻塞闸门用 `.some`，不把闸门结果绑定到
  树或提交。
- 测试套件没有“坏树已提交、闸门红、record 仍成功”的端到端负向用例。探针是手工做的，不在
  CI 里。
- `reconcile` 不在 CI 里；在探针里它也接受了未提交台账。

修法是 D1 加 D5：把闸门结果绑定到树，把探针放进 `node --test`，在 CI 跑 `reconcile`，并让
校验器检查契约写明的东西。CI 仍然是回归网，不是完成预言机。本地守卫（`record` 拒绝未提交的
此前事件，`mission_done` 拒绝未提交的任务事件）在坏状态被推上去之前拦住它；推上去的提交是
最终证明。

## 与 0005 的关系

ADR 0005 是任务级的权威决策。人类于 2026-10-31 接受了它；Mission #2 的 `mission_created`
事件通过 `approval_source` 记录批准。它的 Status 行保持 `proposed`，作为指向该事件的指针；
改它会让文档而不是台账成为记录。D3 是它的实现。ADR 的向后兼容规则保留：新 `task_done`
要求 packs；Mission #1 用一条 note 登记为 grandfather。

## 观察——第一次路由闭环自审

决策路由守卫落在 `5e9d3df`。它的第一次自审报告了两个计划外写入：`docs/decision-routing.md`
及其中文 companion。工作得到了人类明确授权，但 Mission #1 已关闭，没有 plan 声明这些文件，
也没有运行时命令能写 `ruling` 或 `note`。因此审计无法区分“获授权的关闭后工作”和漂移。

这是 D4/D5/D8 的输入，不是新的工作流：获授权的人类写入需要运行时记录，或者审计需要一个已
声明的授权来源。在那之前，关闭后的守卫改动会持续产生这个 verdict。两个文件保留，因为其中
定义的规则正是人类要求的修复；删掉文件只会删掉检查，不会删掉发现。

### 执行地图自审

执行地基落在 `aa6490d`。`audit-session` 报告 `drift`：六个计划外写入
（`docs/drift-control.md` 及其中文 companion、`scripts/check-enforcement.mjs`、
`test/check-enforcement.test.mjs`、`.github/workflows/gates.yml`、`test/hook.test.mjs`）、
一次目标纠正、一次确认请求。写入得到了人类授权（“如果没有我们就去执行”）；计划缺口是同一个
D4/D5 问题。目标纠正是真实的：第一版计划没有写清 harness 约束——只有一个 workspace
`AGENTS.md`，`Stop` hook 最多可以 continuation 三次，skill 拆成 SOP、references、scripts
——直到人类点名。这些约束现在写进了 `docs/automation.md` 和 `docs/drift-control.md`，下一个
会话读到它们，而不是重新发现。确认请求是仓库要求的范围闸门，不是漂移。

### 目标哈希自审

`scripts/check-targets.mjs` 落在 `84ed257`，带 `test/check-targets.test.mjs` 的八个测试。
全部闸门退出 0（167 个测试），CI 把检查作为独立步骤运行。它存在的原因：执行地图自审发现第 1
行声称目标冻结，但没有任何脚本做过哈希——校验器从不重算哈希链。

- 检查从 `mission_created` 和每个 `mission_amended` 重建四个目标的期望哈希，再对工作树哈希。
  台账 key 有两种形式——裸文件名（`plan.md`）和仓库相对路径
  （`.cairn/missions/<id>/plan.md`）；比较前都归一化。混合形式正是朴素比较报假 DIFF 的原因。
- 它只作用于活动 mission。Mission #0 的哈希描述它关闭时的树；`docs/protocol.md` 在 Mission #1
  期间改过，所以用今天的树重查 Mission #0 必然报不匹配。已关闭 mission 不重查。
- 这次改动的审计 verdict：`drift`，一个计划外写入——`docs/drift-control.zh.md`。英文文件和
  其余部分落在 `aa6490d`，companion 的 header 更新在后。还是同一个 D4/D5 缺口：人类授权的
  关闭后工作没有 plan 声明它，也没有运行时命令记录授权。零目标纠正、零无闸门声明、零确认请求。

### Bootstrap 阻塞点及其解决

`cairn init` 生成 `mission.md`、`plan.md`、`policy.md` 和空的 `ledger.jsonl`；它不追加
`mission_created`。在临时仓库验证：`init` 退出 0，台账 0 行，`check-targets` 退出 1，报
`no mission_created event`。今天创建的 mission 没有冻结目标，D5 依赖的哈希链从空开始。

这个阻塞点只对一个 mission 解决：由人类授权，为 Mission #2 手工追加一次 `mission_created`
冻结。人类在 2026-10-31 明确授权了这一次追加。这是最后一次 bootstrap 例外：

- 事件只写一次，`actor: human`、`approved_by: human`、
  `approval_source: ["0006", "0005"]`，以及 `mission.md`、`plan.md`、`policy.md` 和
  `docs/protocol.md` 的 sha256；
- 追加之后，每个事件都由运行时命令写入；
- T5 加上 `init` 写者，从 T5 起不再手工创建 mission。

如果冻结被拒绝，Mission #2 要等 D5 落地才能开始；那条路更慢，而且会让本决策的顺序无法成立。

## 批准

人类于 2026-10-31 批准本修订并接受 ADR 0005。具有约束力的记录是 Mission #2 的
`mission_created` 事件，`approval_source: ["0006", "0005"]`；本文件是计划，台账是批准。下面
的选项作为历史保留：

- `approve 0006` — 接受 D1–D8 和顺序。
- `adjust 0006 -- ...` — 修改某个决定、粒度边界或顺序。
- `reject 0006` — 保持 Mission #1 关闭，并记录原因。

## Issue 映射

五个 issue 已于 2026-10-31 按“被本决策取代”关闭。它们不会重开；只有本决策被拒绝才重开其中
之一。

| Issue | 工作流 | 关闭条件 | 状态 |
|---|---|---|---|
| [#1](https://github.com/chenmudu/cairn/issues/1) P0：把完成绑定到被验证的树 | D1 | P0 探针在 `record` 处失败；干净任务通过；CI 跑探针 | 已关闭，被取代 |
| [#2](https://github.com/chenmudu/cairn/issues/2) 把验收和评审证据绑定到验收标准 | D2 | 逐验收标准产物通过校验；Mission #1 B5/B7 重放失败 | 已关闭，被取代 |
| [#3](https://github.com/chenmudu/cairn/issues/3) 按任务记录包的参与（ADR 0005） | D3 | 每个新 `task_done` 有两个合法包条目 | 已关闭，被取代 |
| [#4](https://github.com/chenmudu/cairn/issues/4) 执行任务状态、mission 创建、校验器和 CI | D4–D5 | start/record/answer 被执行；init/validator/reconcile/探针通过 | 已关闭，被取代 |
| [#5](https://github.com/chenmudu/cairn/issues/5) 让策略可执行、契约说真话 | D6–D8 | 策略执行或标注人类；文档与 CLI 一致；授权被记录；审计发现被覆盖 | 已关闭，被取代 |
