<!-- translation of method/examples/0001-docs-tick/policy.md at the T6 commit; the English file is authoritative -->

# 策略 — 一个 tick，一条轨迹

- **预算**：一个任务、一个 tick、一个提交。
- **停止条件**：闸门失败、证据文件缺失，或包记录没有原因。
- **写入**：只写 E1 声明的文件。台账由运行时写，适配器永不写。
- **人类检查点**：无；这是一个已关闭的样例，没有活动副作用。
- **包规则**：包报告是输入；闸门和台账是证明。包缺失时用地板，记录 `absent, floor used`。
