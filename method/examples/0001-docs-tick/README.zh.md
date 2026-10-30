<!-- translation of method/examples/0001-docs-tick/README.md at the T6 commit; the English file is authoritative -->

# 0001 — 一个记录在案的 docs tick

这是一个博物馆展品：一个真实的小 tick，用和活动 mission 相同的形状记录。它不是活动 mission，
也不是 Cairn 的第二事实源。

## 发生了什么

- **任务 E1** 写了 `product.md`，一份给新操作者的一页说明。
- **闸门** `node scripts/check-example.mjs --product method/examples/0001-docs-tick` 退出 0。
- **证据** 在 `evidence/E1/example.json`。
- **台账** `ledger.jsonl` 记录 `mission_created`、`gate_result`、`task_done` 和
  `review_result`。
- **审查** 通过，包记录见下。

在仓库根目录跑完整检查：

```sh
node scripts/check-example.mjs --example method/examples/0001-docs-tick
```

只跑产品闸门：

```sh
node scripts/check-example.mjs --product method/examples/0001-docs-tick
```

## 包记录

- **superpowers 7.0.1**：用 `test-driven-development` 构建检查器和这个样例。证据：
  `test/example.test.mjs`（先 RED，后 GREEN）。
- **Impeccable 4.8.0+df3a4ab**：存在，但这个表面 `not-applicable`。原因：没有 markup 或
  URL；`detect` 对 markdown 返回 `[]`，那不是干净结果。审查按标准进行：通过读文本应用
  `critique`（层级、清晰、克制）和 `polish`（措辞、不重复合同），没有跑 detector。
- **引擎** `0.1.18` 已安装；这个样例不调用它，因为表面是 markdown。不声称跑过 detector。

## 为什么这就够了

重点不是产品，是形状：一个任务、一个闸门、一个证据文件、一个 `task_done`，以及一个记录
用了什么、没用什么的审查。全新会话读这个目录，就能看到一个完成的 tick 留下什么。
