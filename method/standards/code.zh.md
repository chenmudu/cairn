<!-- translation of method/standards/code.md at the T4 commit; the English file is authoritative -->

# 代码标准

- 来源：Cairn 地板；Impeccable 4.8.0+df3a4ab 提供界面标准，不用它的 detector 检查非 UI 代码。
- 固定版本：cairn/standards@0.1；Impeccable 技能 4.8.0 / 引擎 0.1.18 / 源码 df3a4ab。

## 改动

- 一个 tick 一个任务。diff 只包含满足任务的最小改动。
- 先写测试。看到它因为预期原因失败，再让它通过。
- 不重构无关代码、不改历史命名、不为了新偏好重排整个文件。邻近缺陷如果阻塞当前任务，记录
  它；不要扩大 diff。
- 优先消除特殊情况，而不是加分支。超过三层缩进是设计信号，不是格式问题。

## 证明

- 阻塞闸门退出 0，证据文件存在，台账里有结果。
- 提交信息不是证据。绿色闸门证明这一步，不是 mission。
- 每个回退都可执行。写“以后再处理”的注释不是回退。

## 形状

- 函数短小，按它返回或改变的东西命名。用布尔参数切换行为，通常说明该拆成两个函数。
- 错误要写明失败的输入和下一步。不要为了保持绿色而吞掉错误。
- 边界上的类型和 schema 要显式。不要从样本猜形状。

## Impeccable

- `detect` 只扫 markup 和 URL。对 TypeScript、脚本和 markdown 是 `not-applicable`；空结果
  不是通过。
- 改动产生渲染表面时，对该表面跑 `detect` 和 `critique`，记录命令和结果。
- 对非 UI 代码，用同一套标准检查人读的界面：错误信息、CLI 输出和文件名。
