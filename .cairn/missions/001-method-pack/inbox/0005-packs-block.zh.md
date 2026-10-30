<!-- translation of .cairn/missions/001-method-pack/inbox/0005-packs-block.md at the T7 amendment; the English file is authoritative -->

# 决策 0005 — packet 与 review report 里的 packs 块

状态：等待人类批准。`docs/protocol.md` 尚未修改。
日期：2026-10-31
当前协议哈希：`sha256:35115bd851eb2435778380d84bb2a6a46b57915c802add1b5ef656b551a0bcba`。
服务：B7；声明这些 T7 文件的计划修订已由 Cairn 以 `approved_by: cairn` 批准。

## 为什么这是人类决定

B7 要求 `cairn next` 注入对应能力，任务证据记录 `use`、`not-applicable`，或 `absent` 加
地板回退。这会改动 dispatch packet 和 `review_result` 的形状。mission 合同规定：packet 或
report 的 schema 变更属于协议修订，必须有 `approved_by: human`。检测器、`cairn review`
写入者、`task_started` 写入者和审计修复已经实现并测试；本文件只请求 schema 和不变量 3
的措辞。

## 提议的合同

### 1. 一套词表

packet 和 report 里的 `mode` 只能是 `use`、`human-in-loop`、`not-applicable`、`absent`。
playbook 已经在用 `use` 和 `human-in-loop`；样例里的 `used` 已改成 `use`，只保留一种拼法。

- `use`：包存在，能力适用。
- `human-in-loop`：包存在，但能力需要问人类。
- `not-applicable`：包存在，但任务没有对应表面；必须写 `reason`。
- `absent`：包不存在，或版本不符 / 不可调用；使用地板，report 必须用 `evidence` 指明地板。

### 2. dispatch packet 的 `packs`

`cairn next` 在现有 packet 上增加 `packs` 数组。每个 packet 恰好两个条目，适配器不需要猜
是否考虑过某个包。

```json
"packs": [
  {
    "capability": "test-first",
    "pack": "superpowers",
    "version": "7.0.1",
    "mode": "use",
    "instruction": "superpowers:test-driven-development",
    "fallback": {
      "text": "write the test first, then the implementation, then run the gate",
      "product": { "kind": "gate", "ref": "test" }
    }
  },
  {
    "capability": "design-review",
    "pack": "impeccable",
    "version": "4.8.0+df3a4ab",
    "mode": "not-applicable",
    "reason": "task files contain no markup or URL target",
    "instruction": "criteria-based review against method/standards/docs.md",
    "fallback": {
      "text": "use the in-repo review checklist",
      "product": { "kind": "path", "ref": "method/README.md" }
    }
  }
]
```

选择完全由任务声明的文件决定：

- **superpowers**：任一文件以 `.ts`、`.tsx`、`.js`、`.mjs`、`.cjs`、`.jsx`、`.py`、`.rs`、
  `.go`、`.java`、`.rb` 或 `.sh` 结尾时用 `test-first`；否则用 `verify-before-close`
  （`superpowers:verification-before-completion`）。
- **Impeccable**：任一文件以 `.html`、`.htm`、`.css`、`.scss`、`.sass`、`.less`、`.tsx`、
  `.jsx`、`.vue`、`.svelte`、`.astro` 或 `.svg` 结尾时用 `design-check`；否则用
  `design-review`，模式 `not-applicable`，原因同上。
- `version` 是检测到的版本；不存在时用 pin。
- 检测结果为 `absent`、`mismatch` 或 `not-invocable` 时，`mode` 是 `absent`，此时
  `fallback` 就是指令。
- `reason` 可选，但 `not-applicable` 时必需。
- packet 是只读上下文。任何包都不能把任务标成完成。

### 3. report 的 `packs`

适配器报告和 `cairn review` 使用同一形状，用 `evidence` 取代 `instruction` 和 `fallback`：

```json
"packs": [
  {
    "capability": "test-first",
    "pack": "superpowers",
    "version": "7.0.1",
    "mode": "use",
    "evidence": "test/method.test.mjs, RED then GREEN"
  },
  {
    "capability": "design-review",
    "pack": "impeccable",
    "version": "4.8.0+df3a4ab",
    "mode": "not-applicable",
    "reason": "no markup or URL; detect on markdown returns []",
    "evidence": "README.md criteria-based review"
  }
]
```

规则：

- 每个 `review_result` 的 `packs` 都是非空列表。
- `capability`、`pack`、`version`、`mode`、`evidence` 都是非空字符串。
- `pack` 只能是 `superpowers` 或 `impeccable`。
- `not-applicable` 必须有非空 `reason`。
- `absent` 的 `evidence` 必须指明跑过的地板（gate id、命令或路径）。
- 包报告是输入；闸门证据才是证明。审查不能把红闸门变绿。

### 4. CLI

向 v0.1 表加入两个命令：

| 命令 | 退出 | 行为 |
|---|---|---|
| `cairn start <task>` | 0 / 2 拒绝 | 追加 `task_started`，`base` 为当前 HEAD；拒绝已完成、已暂停或已开始的任务。 |
| `cairn review --file <json>` | 0 / 2 拒绝 | 校验 `reviewer`、`verdict`、`findings`、`packs`，然后追加 `review_result`。 |

`cairn start` 不打印 packet；`cairn next` 仍是唯一的 packet 命令。

### 5. 不变量 3

把：

> **台账和代码落在同一个提交。** 没有台账事件的提交不是进展；没有提交的台账事件不是进展。

改为：

> **一个任务是一次提交事务。** 工作提交携带代码、证据和 `gate_result`；`task_done` 落在
> 紧随其后的台账提交里。没有 `task_done` 的工作提交不是进展；没有工作提交的 `task_done`
> 也不是进展。

这与 T1–T6 已记录的模式一致：`T6: record the worked example tick`，然后
`T6: record task_done`。

## 批准后对协议的确切修改

- `docs/protocol.md`：不变量 3、`review_result` 行、CLI 表、dispatch packet JSON、report
  JSON，以及一条简短的“Pack record”小节，写明上面五条规则。
- `docs/protocol.zh.md`：同样的小节中文版，翻译头注明本次提交。
- `templates/dispatch.md` 和 `.zh.md`：`packs` 小节和 report 占位符。
- `docs/adapter.md` 和 `.zh.md`：report 示例和 `renderDispatch` 输入都包含 `packs`。
- `method/playbook.md`：`review` 行从 `planned:T7` 改为 `exists`。
- `docs/i18n.md`：记录 protocol/protocol.zh 的状态。

## 不变的部分

- 不新增事件名；`task_started` 和 `review_result` 已存在。
- 不改闸门语义、三段式完成规则或台账格式。
- 不内嵌任一包；packet 只引用版本和指令。
- 包缺失时不联网、不调启动器。
- Mission #0 不动。

## 如果拒绝

packet 和 report 保持现状；B7 仍未证明，Mission #1 不能关闭。检测器和 review/start
写入者仍然有用，但 review 不能要求包记录，`cairn next` 也不能声称注入。

## 批准

回复其一：

- `approve 0005` — 以 `approved_by: human` 实施协议修改，完成 T7，然后 T8。
- `change 0005: <什么>` — 先改本文件；协议不动。
- `reject 0005` — 记录拒绝并暂停 B7。
