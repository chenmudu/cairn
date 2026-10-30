<!-- translation of method/examples/0001-docs-tick/product.md at the T7 commit; the English file is authoritative -->

# 一个 tick，一条轨迹

## 问题

新的操作者看到闸门和台账，却看不到一个完成的 tick 留下了什么。协议解释了规则，却没有展示
结果的形状。

## 受众

全新会话、新贡献者，或想在跑真实 mission 之前先看一个具体 tick 的审查者。

## 承诺

一个小的、可验证的样例：一个任务、一个产品、一个退出 0 的闸门、一个证据文件、一个
`task_done`，以及一次说明用了哪些包、或为什么不适用的审查。

## 非目标

- 不做 UI、数据库或托管服务。
- 不做调度器或多 tick 循环。
- 不建第二本台账或包自有的进度文件。

## 验收

- `node scripts/check-example.mjs --example method/examples/0001-docs-tick` 退出 0。
- 台账包含退出 0 的 `gate_result` 且证据存在、一个 `task_done`，以及带包记录的
  `review_result`。
- 审查把 Impeccable 记为 `present, not-applicable` 并给出原因；不声称对 markdown 跑过
  detector。
