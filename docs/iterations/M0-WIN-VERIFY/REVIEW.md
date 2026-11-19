# M0-WIN-VERIFY PLAN r1 独立方案审核报告

**总体结论：通过，附一项非阻塞建议。** r1 可以提交用户作实施决定。两条 Electron 启动路径、独立测试数据库和重启读回步骤，能够为本阶段的 Windows 无模型验证提供证据。**用户尚未批准实施，A01–A10 均待执行。**

| 审核项 | 记录 |
|---|---|
| 类型与日期 | 方案审核，2026-11-20，Work 独立审核 |
| 版本与分支 | M0-WIN-VERIFY，PLAN r1，`verify/m0-win-runtime` |
| 完整审核目标 | [`a7a9511ed20adf9a5a18db6a96009855e7e98885`](https://github.com/z-chenl/desktop_pet/commit/a7a9511ed20adf9a5a18db6a96009855e7e98885) |
| 归档基线 | `ba8a687b06a53c187ab8c6732b93a57de542fe74`，应用版本 `0.1.0-alpha.1` |
| 批准情况 | 当前授权覆盖文档入库、推送和草稿 PR。已读 BOOTSTRAP 归档中的用户确认原文，其验收范围止于 B01–B04。[本阶段工作记录](https://github.com/z-chenl/desktop_pet/blob/a7a9511ed20adf9a5a18db6a96009855e7e98885/docs/iterations/M0-WIN-VERIFY/WORKLOG.md) · [BOOTSTRAP 验收记录](https://github.com/z-chenl/desktop_pet/blob/ba8a687b06a53c187ab8c6732b93a57de542fe74/docs/iterations/BOOTSTRAP/REVIEW.md) |

## Work 独立核对结果

1. **交接对象与附件一致。** 在指定 Windows 仓库用 Git 核对了根目录、分支、父提交、四份文档的变更清单及远程分支指针。原附件的 SHA-256 为 `ce3436ee86f2454493da716f32ac75f7fd519707a3ccfac0775d9e34dbf0f452`。用 `git hash-object --no-filters` 计算的附件对象编号与目标提交中的 PLAN 完全相同。GitHub 返回 PR #1 已打开、为草稿、目标为 `main`，PR head 指向本次审核提交。审核结束时，已跟踪文件无改动，根目录原附件仍为未跟踪文件。[草稿 PR #1](https://github.com/z-chenl/desktop_pet/pull/1)

2. **固定运行环境有可核验的来源。** Node 官方归档列明 24.22.3 随附 npm 11.19.1，官方摘要清单中 Windows x64 ZIP 的 SHA-256 与 PLAN 第 72 行完全一致。项目锁文件固定 Electron 45.4.1 并声明了 `install-electron` 本地入口，官方发布清单也列有对应 Windows x64 二进制。W02 将依赖安装与 Electron 可执行性分开检查，能发现仅装好 npm 包、桌面程序仍无法启动的情况。本次只查询了发布信息与摘要。[Node 版本归档](https://nodejs.org/en/download/archive/v24.22.3) · [官方摘要清单](https://nodejs.org/dist/v24.22.3/SHASUMS256.txt) · [Electron 45.4.1 发布清单](https://github.com/electron/electron/releases/tag/v45.4.1)

3. **两条启动路径各有可观察的结果。** 已读开发脚本、Vite 配置和 Electron 主进程。开发入口启动 `127.0.0.1:5173` 和原生窗口；构建产物入口可在开发服务关闭后加载 `pet://app/index.html`。主进程在打开 SQLite 前读取 `ORANGE_CAT_DATA_DIR`，界面通过 IPC 取得实际数据库路径。A03、A07、A09 要求两条路径显示正确位置，并在正常退出后从同一测试库读回数据，足以区分浏览器预览、桌面窗口和持久化成功。方案也准确限定了隔离范围，Electron 自身的 profile 仍可能产生运行文件。[开发入口](https://github.com/z-chenl/desktop_pet/blob/a7a9511ed20adf9a5a18db6a96009855e7e98885/scripts/dev.mjs#L6-L21) · [主进程的数据路径](https://github.com/z-chenl/desktop_pet/blob/a7a9511ed20adf9a5a18db6a96009855e7e98885/src/main/index.ts#L70-L78)

4. **无模型验收与现有功能相符。** 对照服务层和界面后确认，草稿保存、新增朋友、手动记忆增删都有独立操作入口。A06–A07 先分别写入 A、B 两个标记，再删除 A 的标记，重启后同时核对“A 已删除、B 仍保留”。这组步骤能检查朋友之间的界面数据隔离和删除持久化。A08 核对未发布状态下的操作限制，全程可使用虚构数据。真实模型回复、记忆对回复的影响、安装包及 macOS 体验均留有明确的后续验收边界。[验收标准 A01–A10](https://github.com/z-chenl/desktop_pet/blob/a7a9511ed20adf9a5a18db6a96009855e7e98885/docs/iterations/M0-WIN-VERIFY/PLAN.md#L137-L161)

## 发现与待验证事项

**阻塞问题及整改要求：无。**

**非阻塞建议一项。** PLAN 第 83 行给出的 `npm.cmd ci --include=dev` 按 npm 默认配置还会向注册表提交依赖审计请求，涉及包名及版本。第 9 节列出的联网用途是下载固定运行时、依赖和 Electron 二进制。建议在 W02 的运行说明中使用 `npm.cmd ci --include=dev --no-audit`，使实际请求与所列用途一致。这是一次安装的命令选项，无需更改锁文件、全局配置或验收标准。[PLAN 安装步骤](https://github.com/z-chenl/desktop_pet/blob/a7a9511ed20adf9a5a18db6a96009855e7e98885/docs/iterations/M0-WIN-VERIFY/PLAN.md#L81-L89) · [npm 的 audit 默认行为](https://docs.npmjs.com/cli/v11/commands/npm-ci/#audit)

**证据边界。** 本次亲自完成的是文档、源码、Git 对象、远程状态和官方发行信息的只读核对。交接卡与 WORKLOG 记载实施尚未开始。历史 41 项测试来自 Linux／Node 24 的模拟环境。Work 本次未安装依赖、启动 Electron、运行自动测试或调用模型；Windows 测试数与退出码、两个真实窗口、SQLite 重启读回及进程收尾均须在实施阶段取证。

**下一步与复核范围。** 由用户将报告交 01 讨论、确认，再交 03 原样保存。用户明确批准 r1 及操作范围后，03 可执行 W01–W07。下次 Work 审核绑定实际实现与验证提交，按 A01–A10 核对证据，并复核 W06 如有发生的兼容性修改。用户另行验收实际运行结果。

**待实现会话原样入库。**

---

# 用户实施批准原文

2026-11-20，03－开发实现会话用户消息 `01a1f4b2-8db1-74c2-b8e1-c0bb52b02c35`。原文如下。

我批准实施 Desktop_pet 的 M0-WIN-VERIFY 阶段。

一、批准对象

仓库：[https://github.com/z-chenl/desktop_pet](https://github.com/z-chenl/desktop_pet)\
本机路径：D:\tools\IdeaTool\project\desktop_pet\
工作分支：verify/m0-win-runtime\
现有草稿 PR：[https://github.com/z-chenl/desktop_pet/pull/1](https://github.com/z-chenl/desktop_pet/pull/1)

批准方案为以下提交中的 PLAN r1：

a7a9511ed20adf9a5a18db6a96009855e7e98885

方案位置：\
docs/iterations/M0-WIN-VERIFY/PLAN.md

本次批准覆盖该方案的 W01–W07，验收标准维持 A01–A10。

二、采纳 Work 的非阻塞建议

W02 安装依赖时使用：

npm.cmd ci --include=dev --no-audit

这是针对本次安装命令的操作细化，不改变依赖、锁文件、任务范围或验收标准，不修改全局 npm 配置。

保留已审核 PLAN r1 原文。在 REVIEW 的独立处置章节、WORKLOG 和后续 RUNBOOK 中记录这项决定。不要把处置说明混入 Work 原报告，也不要将新增记录冒充已经审核过的文本。

三、先保存批准与审核记录，再开展实施

请按仓库协作规则：

1. 核对仓库、分支、提交和工作区，保留已有内容及用户改动。
2. 将我一并转交的 Work《M0-WIN-VERIFY PLAN r1 独立方案审核报告》完整原样保存到本阶段 REVIEW\.md，继续绑定审核提交：\
   a7a9511ed20adf9a5a18db6a96009855e7e98885
3. 单独保存本条用户批准原话、对应方案、批准范围及可取得的消息或时间依据；记录建议处置，更新 STATUS，按既定流程提交和推送。
4. 随后连续执行 W01–W07。范围内的下载、环境准备、依赖安装、检查、真实窗口验证、必要兼容修复及记录工作，无需逐命令再次向我确认。

四、实施边界

- 模型 API 预算为 0；不调用付费模型、不下载模型、不训练、不购买其他服务。
- 使用方案规定的固定运行环境、独立测试数据库和虚构验收数据。
- 保留原有运行环境、默认个人数据库及其他项目内容。
- 修复范围遵循 PLAN 第 5.5 节；超出范围或改变验收条件时，先说明具体问题和影响，提交方案修订。
- 在 verify/m0-win-runtime 分支完成记录、必要代码修改、提交和推送，并维护现有草稿 PR。
- 本次不授权合并 main、打标签或发布 Release。
- 按本次变更清单暂存文件；根目录未跟踪的原方案附件保留，不误加入提交，也不擅自删除。

五、结果与交接要求

按 A01–A10 保存实际验证证据，明确区分自动检查、真实 GUI 操作、用户实测以及尚未验证的项目。

如当前会话无法操作本机 GUI，请完成可执行部分，并提供明确的用户实测步骤及所需证据；缺少真实窗口或重启读回证据时，不得将相应项目标为通过。

完成后交付 RUNBOOK.md、EVIDENCE.md 及更新后的迭代记录，返回完整实现／验证提交 SHA、远程同步结果、工作区状态、实际测试结果、必要修复和未验证事项，交给 02－独立审核。

Work 的实施审核和我的最终运行效果验收仍需分别完成。

## 建议处置与后续审核

用户采纳 Work 的非阻塞建议。W02 使用 `npm.cmd ci --include=dev --no-audit`，该次安装关闭审计。方案审核绑定 `a7a9511ed20adf9a5a18db6a96009855e7e98885`，以上 Work 报告正文取自本项目「02－独立审核」的同名报告。此处处置由 Codex 归档。实施审核和用户运行效果验收待进行。

## 实施审核与运行效果验收

**待 Work 实施审核。** 本次 Codex 实测使用业务代码提交 `5257697aa5aef90baae6e8c42a8ec9ee1a287553`。请 02 按交接卡中含运行说明与证据的完整提交，复核 W06 主进程启动修复、A01–A10 结果及其边界。[验证证据](EVIDENCE.md) · [运行说明](RUNBOOK.md)

用户的实施批准已在上节登记，最终运行效果验收待用户另行确认。

---

# M0-WIN-VERIFY 实现独立审核报告

**总体结论：需要整改。阻塞项仅涉及 A10 运行说明。** W06 启动修复符合批准范围，A01–A09 的证据足以支持本机 Windows 无模型验证结果。Work 独立重跑了自动检查，41 项模拟测试全部通过，并从测试库副本核实了草稿、朋友档案和记忆的最终状态。

A10 面向下一位实际操作者。当前说明给已有依赖的用户提供了一条可跳过测试目录设置的路径。Work 在临时 Electron 用户目录中复现了后果：窗口出现时，应用已经创建默认位置的 SQLite。建议先修正文档，再交用户按说明验收。

| 审核项        | 绑定记录                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 审核类型与日期    | 实现及验证证据审核，2026-11-20，02－独立审核（Work）                                                                                                                                         |
| 版本与分支      | M0-WIN-VERIFY，应用 `0.1.0-alpha.1`，`verify/m0-win-runtime`                                                                                                                   |
| **完整审核目标** | [`bb15a7534bdd1178372770e759bb1b68b6fdfd3f`](https://github.com/z-chenl/desktop_pet/commit/bb15a7534bdd1178372770e759bb1b68b6fdfd3f)                                       |
| 实测业务代码     | [`5257697aa5aef90baae6e8c42a8ec9ee1a287553`](https://github.com/z-chenl/desktop_pet/commit/5257697aa5aef90baae6e8c42a8ec9ee1a287553)。至审核目标的后续差异仅含文档和三张截图。                  |
| 方案与批准      | PLAN r1 绑定 `a7a9511ed20adf9a5a18db6a96009855e7e98885`。已读取 `a5403b263071091be349cf9f8793f07d90e4e9c2` 中保存的用户原话，批准 W01–W07、A01–A10，并采纳 W02 的 `--no-audit` 参数。用户最终运行效果验收仍待进行。 |

## 阻塞项：复用已安装依赖时，可能跳过测试库设置

RUNBOOK 第 41 行告诉已有完整依赖的用户可以“直接核对 Electron 并进入第 3 节”。同段也要求新建运行目录，但设置 `ORANGE_CAT_DATA_DIR` 的命令在这句话之后，而第 3 节启动前只检查 5173 端口。按“直接进入第 3 节”操作，新 PowerShell 中可能没有测试目录变量。主进程会回退到 Electron 用户目录，在窗口显示之前打开或创建默认业务库。此时再看界面里的“本地数据位置”，已经晚于首次数据库写入。[RUNBOOK 第 41–60 行](https://github.com/z-chenl/desktop_pet/blob/bb15a7534bdd1178372770e759bb1b68b6fdfd3f/docs/iterations/M0-WIN-VERIFY/RUNBOOK.md#L41-L60) · [启动步骤](https://github.com/z-chenl/desktop_pet/blob/bb15a7534bdd1178372770e759bb1b68b6fdfd3f/docs/iterations/M0-WIN-VERIFY/RUNBOOK.md#L95-L105) · [主进程选库逻辑](https://github.com/z-chenl/desktop_pet/blob/bb15a7534bdd1178372770e759bb1b68b6fdfd3f/src/main/index.ts#L70-L79)

**Work 复现。** 在目标提交的隔离副本中，将 Electron 用户目录重定向到专用临时目录。省略 `ORANGE_CAT_DATA_DIR` 启动时，该临时用户目录出现 `orange-cat-lab.sqlite`；明确设置测试目录后启动，数据库出现在指定测试目录，另一份临时用户目录中没有默认业务库。真实个人数据库未参与试验。03 原验证正确设置了变量，其 A09 结果仍然成立。

**整改与通过条件。** 将第 2 节拆清楚：每轮都执行测试目录设置；仅在需要安装时执行 `npm ci`；两条路径随后都解析 `$exe`。在启动命令前校验 `ORANGE_CAT_DATA_DIR` 指向本轮 `$run\data`，缺失或不符就停止。用新的 PowerShell 按“依赖已安装”路径复走一次，记录无需重装即可启动、两次入口使用同一测试目录，并确认漏设变量时会在启动前停止。修订运行说明即可，无需改变应用日常使用默认数据库的行为。

## 实现与证据核验

| 范围                   | Work 核验结果                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W06 启动修复             | 排除缩进后，业务差异集中在 `app.whenReady().then(startWorkbench)` 和启动失败处理。原数据库、IPC、权限检查及模型路径均保留。03 记录的“修复前等待 51 秒仍无窗口”属于实现者观测。Work 在隔离副本中复验了修复后的产物入口，取得真实工作台窗口，等待加载后正常关闭，退出码 0。                                                                                                                                                                                                                              |
| A01–A02 环境与自动检查      | Work 重算本机 Node ZIP 和 Electron ZIP 摘要，分别与 r1 固定值及锁定 Electron 包附带的校验值一致。使用独立 Node `24.22.3`、npm `11.19.1`，在目标提交副本执行 `npm.cmd run check`，类型检查、41 项模拟测试和生产构建全部通过，失败、跳过、取消均为 0，退出码 0。                                                                                                                                                                                                                |
| A03–A08 双入口、草稿、朋友与记忆 | 已检查 03 的原始窗口控件记录和三张提交内截图。记录分别显示开发地址和 `pet://app/index.html`、相同 SQLite 路径、A/B 切换与确认删除，以及未发布时禁用的生成、发布、角色导出按钮。Work 另以只读方式查询已关闭测试库的副本，核实 `WIN_VERIFY_CAT` 和 `WIN_VERIFY_RULE` 已保存，朋友 A、B、`WIN_VERIFY_C` 各一份，A 的记忆为空，B 仅保留 `WIN_VERIFY_B`。完整点击与重启流程由 03 实测。[逐项证据与截图](https://github.com/z-chenl/desktop_pet/blob/bb15a7534bdd1178372770e759bb1b68b6fdfd3f/docs/iterations/M0-WIN-VERIFY/EVIDENCE.md) |
| A09 进程与数据收尾          | 03 记录了三次成功运行的正常退出及永久 PATH 前后核对。Work 独立确认审核时 5173 无监听、实际默认个人数据库不存在、新终端仍解析到 Node `22.15.0`。历史 PID 的退出过程和当时的 PATH 对照归属 03。                                                                                                                                                                                                                                                                         |
| A10 交接与复现            | 已核实本地 HEAD、远程方案分支和草稿 PR head 均为审核目标，`main` 仍指向 BOOTSTRAP 归档。已跟踪文件无改动，原方案附件仍为未跟踪文件。交接对象、日志与截图可定位。复用依赖的运行步骤待上述整改。[草稿 PR #1](https://github.com/z-chenl/desktop_pet/pull/1)                                                                                                                                                                                                                        |

## 非阻塞发现与审核边界

**窗口刚创建就关闭时，可能误报启动失败。** Work 在隔离副本中复现：窗口标题刚出现即发送正常关闭请求，`loadURL` 返回 `ERR_FAILED`，外层启动异常处理使进程以 1 退出；同一入口等待页面加载后关闭，退出码为 0。03 完成界面操作后的三次正常退出证据有效。本次将提前关闭的表现列为非阻塞建议，后续可区分用户主动关闭和真实加载错误。[页面加载](https://github.com/z-chenl/desktop_pet/blob/bb15a7534bdd1178372770e759bb1b68b6fdfd3f/src/main/index.ts#L48-L56) · [启动异常处理](https://github.com/z-chenl/desktop_pet/blob/bb15a7534bdd1178372770e759bb1b68b6fdfd3f/src/main/index.ts#L205-L208)

Work 的首次隐藏窗口探测未取得主窗口句柄，已结束该次自启进程；随后按所属进程定位工作台窗口，完成上述复验。测试仅使用临时副本，模型下载及调用均为 0。真实模型风格、断网对话、安装包、macOS 体验和最终桌宠行为仍待各自阶段验证。

**下一步。** 由用户转 01 讨论、确认，再由 03 原样保存本报告并单独记录整改。若变更限于 RUNBOOK 和复现证据，Work 下次只复核 A10 的这条路径，无需重跑 A01–A09。用户对实际运行效果另行验收。

**待实现会话原样入库。**

---

## 03 整改处置 · W07／A10

2026-11-20，用户转交上方 Work 报告并授权 A10 定向整改。审核目标为 `bb15a7534bdd1178372770e759bb1b68b6fdfd3f`。A10 需整改；A01–A09 及 W06 保留本次审核结果；用户最终验收待进行。整改限于运行说明和复现证据。窗口标题刚出现即主动关闭可能导致 `loadURL` 报 `ERR_FAILED`、退出码 1；页面加载完成后正常关闭为 0。该项按 Work 意见登记为已知、未修复的非阻塞事项。
