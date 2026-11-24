# 当前状态

## M0-PERSONA-STYLE

**S01 等待补充开发素材。** 首批 6 个场景均已登记：4 组沿用初选，2 组按用户重选的本人发言及前后文范围登记。用户逐组允许所选本人发言作为给指定接收者的角色包正例候选。当前计入 6/30 组，距离方案要求还差 24 组，生成尝试 0。下一批继续收集不同场景的本人表达，开发素材整体须覆盖至少两种关系。规则、最终两条正例及 U01–U03 的验收仍待后续确认。[本阶段工作记录](iterations/M0-PERSONA-STYLE/WORKLOG.md)

PLAN r1 已通过 Work 方案审核并获用户实施批准。审核目标为 `a1d5b22425ed4b1536874a316803a36bd405e18c`，批准记录为 `4fd5dfbcf43bd43d3ae67c08ac52faa9c234b63a`。03 已完成固定环境及 A 原件预检。[运行说明](iterations/M0-PERSONA-STYLE/RUNBOOK.md) · [S01 预检](iterations/M0-PERSONA-STYLE/EVIDENCE.md) · [审核及批准](iterations/M0-PERSONA-STYLE/REVIEW.md)

工作分支 `verify/m0-persona-style` 的[草稿 PR #3](https://github.com/z-chenl/desktop_pet/pull/3) 继续以 `verify/m0-local-model` 为目标。

## M0-LOCAL-MODEL

| 项目 | 记录 |
| --- | --- |
| 阶段 | Windows 真实本地模型与人格流程验证。[PLAN r1](iterations/M0-LOCAL-MODEL/PLAN.md) 已通过方案审核并取得实施批准。 |
| 分支与基线 | `verify/m0-local-model`，起点为 `main` 的 M0-WIN-VERIFY 归档提交 `3b2b16cdaed2c17e3ae769e535be4d2e43f9dc25`。 |
| 当前状态 | **技术审核通过；用户报告断网新对话和记忆读取成功**。Work 审核目标为 `32f766ebb6826afb652a00887cab7e1b4aa8f4f4`，T01–T10 全部通过。用户未单列断网后服务重启步骤。[审核报告与用户反馈](iterations/M0-LOCAL-MODEL/REVIEW.md) |
| 受测对象 | 真实模型受测提交 `8ba8c4025b09c4f56585db6e19b43040483fad67`，应用版本 `0.1.0-alpha.1`，驱动 621.24。[分项证据](iterations/M0-LOCAL-MODEL/EVIDENCE.md) |
| U02 体验 | 用户接受当前简单对话的等待时间，认为自然度与本人风格未达目标。资源占用没有单独的用户评价。 |
| 阶段衔接 | 用户确认进入说话风格方案准备。旧阶段整体关闭待决定，[PR #2](https://github.com/z-chenl/desktop_pet/pull/2) 仍为未合并草稿。 |

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
