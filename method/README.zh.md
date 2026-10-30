<!-- translation of method/README.md at the T3 commit; the English file is authoritative -->

# 方法

Cairn 是一个 git 原生的 mission 运行时，完成是仓库属性：提交、阻塞闸门退出 0、`task_done`
事件。方法是决定“做什么、怎么判断”的部分；Cairn 是它的第一个产物，也可以被替换。

方法有三层：

1. **地板**——仓库内始终可运行的版本：mission 合同、计划、台账、闸门、审查清单和 dispatch
   packet。
2. **包**——更好的实现，按引用消费并 pin：superpowers 提供流程纪律，Impeccable 提供设计标准
   和 UI 检查。
3. **接缝**——Cairn 的协调层：检测、注入、记录、对账。包的报告是输入，闸门证据才是证明。

`playbook.md` 把每个阶段映射到这三层。JSON 块是机器合同；表格是给人看的同一张图。

## 运行检查

在仓库根目录：

```sh
node scripts/check-method.mjs --playbook
node scripts/check-method.mjs --packs
node scripts/check-method.mjs --products
node scripts/check-method.mjs --products --strict
```

- `--playbook` 校验矩阵：每个阶段、每个地板、每个回退、每个 pin，且没有 `TBD` 或 `TODO`。
- `--packs` 检测两个包，报告 `present`、`absent`、`mismatch` 或 `not-invocable`。它是
  advisory，永不阻塞闸门，也不下载引擎。
- `--products` 解析每个 `exists` 行的地板产物和每个回退。`planned:T#` 行报告为 pending。
- `--strict` 在 pending 行上失败。T8 在 `mission_done` 前跑它；现在每个 playbook 行都是
  `exists`。

## 零包运行

每一行都有地板和回退，所以循环仍然能跑：

1. 读 `README.md` 和活动 mission。
2. 运行 `node scripts/goal-check.mjs`；它说出下一个任务和闸门。
3. 做 tick：先写测试，再做改动，再跑闸门。
4. 写证据，用 `cairn record` 记 `task_done`，提交。
5. 用全新上下文和下面的清单审查。

没有用包的 tick 在报告里写 `absent, floor used`，不假装包跑过。

## 单包运行

- **只有 superpowers**：执行用 `test-driven-development`，审查用
  `requesting-code-review`，声明前用 `verification-before-completion`。Impeccable 行在
  docs 和 code 上保持 `not-applicable`。
- **只有 Impeccable**：只有存在 UI 表面时才用 detector 和 critique。docs 和 code 用仓库
  内清单，并记录原因。执行走地板。

## 两包都在

playbook 的 `packs` 行就是指令。适配器收到 skill 或命令、pin、mode 和回退。它返回报告，
写明用了什么。协调器记录结果；台账仍然是唯一的完成事实源。

检测根，按顺序：

- superpowers：`CAIRN_SUPERPOWERS_DIR`，然后 ZCode 插件缓存。
- Impeccable：`CAIRN_IMPECCABLE_DIR`，然后 `~/.zcode/skills/impeccable`，然后
  `$CAIRN_IMPECCABLE_SRC/.claude/skills/impeccable`。
- Impeccable 引擎：`CAIRN_IMPECCABLE_BIN`，然后
  `~/.impeccable/bin/<version>/impeccable.exe` 或技能的启动器。

环境变量指向不存在的路径就是 `absent`；检测不会回落到真实安装。缺失运行的存在，是为了
测试地板，而不是假设地板。

## 清单

这是 docs 和 code 的地板。它故意比 Impeccable 短；有 UI 表面时，包会加 UI 专用检查。

- **Docs**：读者能照着做；命令可照抄运行；英文权威文件和中文 companion 一致；新的面向人的
  文件有 companion。
- **Code**：测试在改动前失败、改动后通过；改动是满足任务的最小改动；没有无关重构；闸门是
  证明，不是提交信息。
- **Workflow**：tick 只写一个任务、它的 `serves` 链接、闸门和证据；失败记录命令和退出码；
  缺包记录 `absent, floor used`。
- **UI（仅在存在表面时）**：对 markup 或 URL 跑 Impeccable `detect`；`critique` 用两个隔离
  评估；`audit` 查五个维度。Markdown 上空的 `detect` 结果是 `not-applicable`，不是干净。

## 这里不做什么

- 不做 UI、数据库、托管服务。
- 不做无人值守调度器。`unattended` 行只准备一个 tick；Mission #2 才跑循环。
- 不 vendor 任何一个包。仓库保持外部；pin 在 playbook 里。
- 不设第二套台账。包可以保留适配器本地临时状态；`cairn reconcile` 比较它，Cairn 台账赢。
