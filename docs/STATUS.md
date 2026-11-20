# 当前状态

| 项目 | 记录 |
| --- | --- |
| 阶段 | M0-WIN-VERIFY · 独立审核通过，用户运行效果验收通过，待合并。 |
| 已批准方案 | Windows 本机运行与无模型基础流程验证，W01–W07、A01–A10。[PLAN r1](iterations/M0-WIN-VERIFY/PLAN.md) |
| 工作分支与起点 | `verify/m0-win-runtime`，从 `main` 的 BOOTSTRAP 归档提交 `ba8a687b06a53c187ab8c6732b93a57de542fe74` 分出 |
| 验证代码 | `5257697aa5aef90baae6e8c42a8ec9ee1a287553`。Windows 上 41 项模拟测试通过，开发窗口重启和构建产物窗口均已读回同一测试库。[证据](iterations/M0-WIN-VERIFY/EVIDENCE.md) |
| 实现审核 | Work 对 `bb15a7534bdd1178372770e759bb1b68b6fdfd3f` 的 A01–A09 及 W06 审核结果继续有效。[报告与处置](iterations/M0-WIN-VERIFY/REVIEW.md) |
| A10 复核 | Work 对 `ed9a7f0733d506187647a059cf0bc2879434d74d` 独立复核通过，原阻塞项关闭。受测 RUNBOOK 提交为 `8635a814d6a683484fa8a9f2569e5e73bc4d6c08`。[复现证据](iterations/M0-WIN-VERIFY/EVIDENCE.md) |
| 已知事项 | 窗口刚创建即主动关闭可能误报启动失败并以 1 退出。该项未修复，属非阻塞事项。 |
| 用户验收 | 朋友 B 的记忆经确认删除后从 1 条变为 0 条。用户确认重启后的保留和删除结果正常。[用户验收记录](iterations/M0-WIN-VERIFY/REVIEW.md#用户运行效果验收) |
| 下一角色 | 用户决定是否授权将[草稿 PR #1](https://github.com/z-chenl/desktop_pet/pull/1) 合并到 `main`。 |

BOOTSTRAP 已验收并归档，范围为 B01–B04。[BOOTSTRAP 审核与验收](iterations/BOOTSTRAP/REVIEW.md)
