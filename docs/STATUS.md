# 当前状态

## M0-LOCAL-MODEL

| 项目 | 记录 |
| --- | --- |
| 阶段 | Windows 真实本地模型与人格流程验证。[PLAN r1](iterations/M0-LOCAL-MODEL/PLAN.md) 已通过方案审核并取得实施批准。 |
| 分支与基线 | `verify/m0-local-model`，起点为 `main` 的 M0-WIN-VERIFY 归档提交 `3b2b16cdaed2c17e3ae769e535be4d2e43f9dc25`。 |
| 当前状态 | **技术审核通过；U01、U02 待用户验收**。Work 对 `32f766ebb6826afb652a00887cab7e1b4aa8f4f4` 判定 T01–T10 全部通过，阻塞项为零，无需整改复核。[独立审核报告与处置](iterations/M0-LOCAL-MODEL/REVIEW.md) |
| 受测对象 | 真实模型受测提交 `8ba8c4025b09c4f56585db6e19b43040483fad67`，应用版本 `0.1.0-alpha.1`，驱动 621.24。[分项证据](iterations/M0-LOCAL-MODEL/EVIDENCE.md) |
| 体验待评价 | 首次推理约 60 秒。删去记忆后仍虚构饮料细节、答对代号后附加多余建议，两项观察保留给 U02。 |
| 下一步 | 用户按第 5 节自行断开外网，读回既有接收库 v2，分别把 U01 试聊结果和 U02 体验意见交回 01。[离线操作说明](iterations/M0-LOCAL-MODEL/RUNBOOK.md) |

## M0-WIN-VERIFY 归档

| 项目 | 记录 |
| --- | --- |
| 阶段 | M0-WIN-VERIFY 已合并至 `main` 并归档。独立审核及用户运行效果验收通过。 |
| 已批准方案 | Windows 本机运行与无模型基础流程验证，W01–W07、A01–A10。[PLAN r1](iterations/M0-WIN-VERIFY/PLAN.md) |
| 工作分支与起点 | `verify/m0-win-runtime`，从 `main` 的 BOOTSTRAP 归档提交 `ba8a687b06a53c187ab8c6732b93a57de542fe74` 分出 |
| 验证代码 | `5257697aa5aef90baae6e8c42a8ec9ee1a287553`。Windows 上 41 项模拟测试通过，开发窗口重启和构建产物窗口均已读回同一测试库。[证据](iterations/M0-WIN-VERIFY/EVIDENCE.md) |
| 实现审核 | Work 对 `bb15a7534bdd1178372770e759bb1b68b6fdfd3f` 的 A01–A09 及 W06 审核结果继续有效。[报告与处置](iterations/M0-WIN-VERIFY/REVIEW.md) |
| A10 复核 | Work 对 `ed9a7f0733d506187647a059cf0bc2879434d74d` 独立复核通过，原阻塞项关闭。受测 RUNBOOK 提交为 `8635a814d6a683484fa8a9f2569e5e73bc4d6c08`。[复现证据](iterations/M0-WIN-VERIFY/EVIDENCE.md) |
| 已知事项 | 窗口刚创建即主动关闭可能误报启动失败并以 1 退出。该项未修复，属非阻塞事项。 |
| 用户验收 | 朋友 B 的记忆经确认删除后从 1 条变为 0 条。用户确认重启后的保留和删除结果正常。[用户验收记录](iterations/M0-WIN-VERIFY/REVIEW.md#用户运行效果验收) |
| 合并记录 | [PR #1](https://github.com/z-chenl/desktop_pet/pull/1) 的验收记录提交为 `da069b9bbfe0be673ce0fcac7e1cf6de3504a34c`，合并提交为 [`51ccb3f1ec1d48e96333b764ed16bccf2d1840a8`](https://github.com/z-chenl/desktop_pet/commit/51ccb3f1ec1d48e96333b764ed16bccf2d1840a8)。 |

BOOTSTRAP 已验收并归档，范围为 B01–B04。[BOOTSTRAP 审核与验收](iterations/BOOTSTRAP/REVIEW.md)
