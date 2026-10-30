<!-- translation of method/standards/docs.md at the T4 commit; the English file is authoritative -->

# 文档标准

- 来源：Cairn 地板；Impeccable 4.8.0+df3a4ab 提供文档表面的标准
  （`critique`、`audit`、`polish`、`harden`）。
- 固定版本：cairn/standards@0.1；Impeccable 技能 4.8.0 / 引擎 0.1.18 / 源码 df3a4ab。

## 读者

- 读者不用追问就能行动：目标、下一步、命令和通过条件都在。
- 每条命令都能在文档指明的目录里照抄运行。
- 关于行为的断言要指名证据：文件、命令或提交。

## 语言

- 英文是机器检查合同的权威。每个面向人的文档都有中文 companion；companion 永不覆盖英文。
- 不写没有解释的协议术语。一个术语第一次影响行动时，先定义它。
- 不要用不同说法重复同一个点。第二句话必须带来新信息。

## 结构

- 一节一个主题；一段一个断言。
- 用能让人验证断言的最短形式。只有内容确实需要对比时才用表格。
- 链接到事实源，不复制它。复制就是第二份合同。

## Impeccable，按标准审查

- 这个仓库没有渲染 UI。`audit` 的 UI 专用维度（性能、响应式、主题、实现完整度）是
  `not-applicable`；记录原因。
- 用 `critique` 和 `polish` 的措辞标准：层级、清晰、克制、一致。不要声称在 markdown 上跑过
  detector；`detect` 返回 `[]`，那是 `not-applicable`，不是干净。
- `harden` 适用于错误和空状态；对文档而言，对应的是缺输入、命令失败或缺包。写清楚会发生
  什么。
