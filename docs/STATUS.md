# 当前状态

| 项目 | 记录 |
| --- | --- |
| 阶段 | M0-WIN-VERIFY · A10 需整改；A01–A09 及 W06 保留本次审核结果；用户最终验收待进行 |
| 已批准方案 | Windows 本机运行与无模型基础流程验证，W01–W07、A01–A10。[PLAN r1](iterations/M0-WIN-VERIFY/PLAN.md) |
| 工作分支与起点 | `verify/m0-win-runtime`，从 `main` 的 BOOTSTRAP 归档提交 `ba8a687b06a53c187ab8c6732b93a57de542fe74` 分出 |
| 验证代码 | `5257697aa5aef90baae6e8c42a8ec9ee1a287553`。Windows 上 41 项模拟测试通过，开发窗口重启和构建产物窗口均已读回同一测试库。[证据](iterations/M0-WIN-VERIFY/EVIDENCE.md) |
| 审核依据 | Work 的实现审核绑定 `bb15a7534bdd1178372770e759bb1b68b6fdfd3f`；唯一阻塞项是复用依赖时可能跳过测试目录设置。[审核报告与处置](iterations/M0-WIN-VERIFY/REVIEW.md) |
| 整改进度 | 03 已完成 A10 说明修订及定向复现，受测说明提交 `8635a814d6a683484fa8a9f2569e5e73bc4d6c08`。三个真实窗口均读到同一测试库，12 个负例均在启动前停止。[A10 证据](iterations/M0-WIN-VERIFY/EVIDENCE.md) |
| 下一角色 | 02－独立审核，仅复核 A10 整改路径和证据。窗口刚创建即主动关闭时可能误报启动失败，已知、未修复，属非阻塞事项。 |

BOOTSTRAP 已验收并归档，范围为 B01–B04。[BOOTSTRAP 审核与验收](iterations/BOOTSTRAP/REVIEW.md)
