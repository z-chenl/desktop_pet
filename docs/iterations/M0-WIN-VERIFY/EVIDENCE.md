# M0-WIN-VERIFY · Windows 验证证据

**后续实施审核。** Work 对 `bb15a7534bdd1178372770e759bb1b68b6fdfd3f` 的结论为 A10 需整改；A01–A09 及 W06 保留本次审核结果。下文保留原提交中的 Codex 自测记录。[Work 实现审核报告与处置](REVIEW.md)

## 原提交的 Codex 自测记录

**Codex 实测结果：A01–A10 均有证据，待 Work 实施审核和用户验收。** 本轮由 03 操作本机 Electron 窗口，未使用模型或私聊数据。运行时间为 2026-11-20 00:48–01:04（UTC+08:00）。用户批准的方案提交为 `a7a9511ed20adf9a5a18db6a96009855e7e98885`，批准记录为 `a5403b263071091be349cf9f8793f07d90e4e9c2`。实际验证的修复代码为 `5257697aa5aef90baae6e8c42a8ec9ee1a287553`。含本证据的交付提交通过交接卡及[草稿 PR #1](https://github.com/z-chenl/desktop_pet/pull/1)定位。

## 环境与证据位置

Windows 11 家庭版 x64（10.0.26300），i7-11800H，系统报告约 15.71 GiB 内存，RTX 3070 Laptop GPU。宿主 Node 24.22.3、npm 11.19.1 位于 `D:\tools\IdeaTool\runtimes\node-v24.22.3-win-x64`。项目根目录为 `D:\tools\IdeaTool\project\desktop_pet`。本轮原始日志、应用窗口控件快照和测试库均在本机项目下的 `test-results/M0-WIN-VERIFY/r1/20261120-004844/`。下文短文件名相对于此目录。

| 项目 | 结果与依据 |
| --- | --- |
| A01 固定环境 | 通过。官方 Node ZIP 37,762,649 字节，SHA-256 `e612af99f626ab415ea225af6bce5c971feb448cb5cae250bb1c3fa50c5f7d9f`。实际使用独立目录的 node.exe、npm.cmd。直接执行项目 `node_modules/electron/dist/electron.exe` 查询得到 Electron 45.4.1、内嵌 Node 24.22.3、Chromium 156.0.8078.100、x64。见 `embedded.log`。结束后新终端仍解析到原 Node 22.15.0、npm 10.9.2，用户与机器的永久 PATH 前后摘要分别相等 |
| A02 Windows 自动检查 | 通过。在修复提交上运行 `npm.cmd run check`，`vue-tsc --noEmit`、测试、生产构建依序成功，退出码 0。41 项通过，失败、跳过、取消均为 0。测试使用模拟模型响应／客户端。构建生成主进程、预加载与渲染产物。见 `check-5257697.log` |
| A03 两条真实 GUI 路径 | 通过。Windows 应用窗口的文档地址分别为 `http://127.0.0.1:5173/` 和 `pet://app/index.html`；后者启动时开发服务已退出。两者均能切页、通过 IPC 读取状态，并在“本地数据位置”显示同一测试库。见 `gui-states.txt`、`dev-fixed.log`、`production.stderr.log` |
| A04 草稿保存 | 通过。开发窗口修改名称为 `WIN_VERIFY_CAT`，规则为“WIN_VERIFY_RULE：先回应，再用一句话说明。”。保存后显示“草稿已保存，已发布的性格未受影响。”，切页再次读取两项值。[开发窗口中的已同步草稿](screenshots/dev-saved-draft.jpg) |
| A05 朋友档案 | 通过。在记忆页新建并选择 `WIN_VERIFY_C`。关闭开发窗口，再启动后展开选择框，明确列出朋友 B、朋友 A、WIN_VERIFY_C，各一次；按名称选择 C 成功。见 `gui-states.txt` |
| A06 朋友记忆隔离 | 通过。B 保存 `WIN_VERIFY_B`，切至 A 时列表为空；A 保存 `WIN_VERIFY_A`。再选 B 只显示 B 标记，回 A 只显示 A 标记。按名字核对，未使用列表位置代替身份 |
| A07 删除与重启 | 通过。对 A 的虚构标记点“删除 → 确认删除”，A 回到空列表。关闭开发窗口、以同目录重启后，草稿名称和规则、C 档案、B 标记仍在，A 为 0 条。构建产物入口再次读回相同结果。[开发入口重启后的 A](screenshots/dev-reopen-A.jpg) · [产物入口中的 B 及 SQLite 路径](screenshots/production-B-path.jpg) |
| A08 无模型限制 | 通过。从空库开始，界面始终“尚未发布”。选择内置虚构场景后输入框已有文字，两个生成按钮仍禁用；未选模型时发布按钮禁用，未发布时角色导出禁用。草稿与手动记忆功能可操作。未调用模型检测、发布、推理或导入角色 |
| A09 进程与数据收尾 | 通过。修复后开发两次、产物一次均正常关闭，退出码均为 0。逐次核对相应主进程和子进程退出，5173 已释放。SQLite 路径为本轮 `data/orange-cat-lab.sqlite`，关闭后为 12,288 字节。实际 profile 为 `%APPDATA%\orange-cat-desktop`，该目录下的默认业务库运行前后均不存在，Electron 自身缓存保留。依赖、原始日志、数据库和缓存均在提交清单外 |
| A10 复现与交接 | 已备齐。[RUNBOOK](RUNBOOK.md) 载有固定环境、一次性安装参数、下载恢复、两种启动方式和恢复步骤。本表、三张仅含工作台的截图及代码提交供 02 复核。远程完整交付 SHA 在交接卡核实。用户实测与最终验收尚待进行 |

## 运行、故障与资源记录

| 运行 | 观察结果 |
| --- | --- |
| 基线开发启动 | `a5403b2` 的业务源码与 r1 相同。00:53，开发服务 PID 26992 监听 5173，Electron PID 20044 运行 51 秒仍无窗口句柄，测试目录文件数为 0。核对可执行路径和父 PID 后结束此挂起进程，此次退出码 -1。见 `dev.log` |
| W06 修复后首次开发启动 | 主进程不再在 ES 模块顶层等待 `app.whenReady()`；模块加载结束后由就绪回调执行原初始化。开发服务 PID 12996、窗口主进程 PID 27952。完成写入和删除，正常退出 |
| 开发入口重启 | 服务 PID 29708，窗口主进程 PID 21692。复用同一 SQLite 目录，完成 A04–A08 的重启读回。见 `dev-reopen.log` |
| 构建产物入口 | 开发服务已关闭，清除进程级 `ORANGE_CAT_DEV_URL`，从项目根执行锁定 Electron。主进程 PID 18168，实际页面 `pet://app/index.html`。正常关闭后三次成功运行的已记录 PID 均已退出，项目路径下的 Electron 进程数为 0 |

- W02 从锁文件引用的 npm 注册表安装 333 个包，耗时 17 秒，退出码 0。npm 提示两项安装脚本未列入 allowScripts，保留原有策略；类型检查、测试和构建实际通过。个别依赖的弃用提示见 `npm-ci.log`，本轮未升级依赖。npm 使用 `%LOCALAPPDATA%\npm-cache`，缓存复用与联网下载的流量未单独计量。
- Electron 本地安装器首次下载在观察期间未完成。核对后仅结束本次安装器 PID 21648；其临时文件位于 `%TEMP%\electron-download-gAlh2e`。随后用 curl 下载同一官方发行 ZIP，158,296,013 字节，SHA-256 `2ba6223afa9121f42831fefe92c434334907540165294fc56697449d12e7cfe9`，与锁定 Electron 包的 checksums.json 一致。放入本轮 `electron-cache` 后原安装器执行成功，退出码 0。
- 运行后按文件长度求和，独立 Node 目录 107,375,290 字节，`node_modules`（含 Electron）565,026,235 字节，`dist` 184,818 字节。npm 缓存、Electron 正常 profile 和临时文件保留在本机。模型调用与模型下载均为 0。
- 本阶段没有用户实测结果。真实模型风格、断网对话、Windows 安装包、macOS 体验和最终桌宠形象／行为仍待各自验收。

## A10 整改定向复现 · Codex 本机实测

**03 复现通过，待 02 仅复核 A10。** 2026-11-20 01:41:56–01:44:33（UTC+08:00），Windows 11 x64，新进程 `pwsh -NoLogo -NoProfile`（7.6.9，PID 13456）。Work 的原审核目标为 `bb15a7534bdd1178372770e759bb1b68b6fdfd3f`；本次直接执行文档提交 `8635a814d6a683484fa8a9f2569e5e73bc4d6c08` 的 RUNBOOK 代码块，业务代码为 `5257697aa5aef90baae6e8c42a8ec9ee1a287553`。[逐次命令、拦截结果与窗口读数](A10-reproduction.txt)

新终端原 Node 为 22.15.0。依次执行第 1 节、2.1、2.3 以及第 3 节的函数定义和三处调用。复用已安装的 Node 24.22.3、npm 11.19.1、Electron 45.4.1 及已有产物，跳过 2.2。统一解析的 `$exe` 为项目下 `node_modules\electron\dist\electron.exe`。首次创建 `test-results/M0-WIN-VERIFY/r1/20261120-014157/data`，随后全部正常启动复用该目录。仅开发入口自身按原脚本构建主进程和预加载，未重装依赖或重跑 A01–A09。

| 正常操作 | 实际调用及窗口来源 | 窗口读取和收尾 |
| --- | --- | --- |
| 首次开发 | `Start-M0Verification -Mode Dev`，`http://127.0.0.1:5173/` | 01:42:59 读取本轮库，退出码 0 |
| 同轮开发重启 | 再次执行 `Start-M0Verification -Mode Dev`，`http://127.0.0.1:5173/` | 01:43:50 读回同一路径，退出码 0 |
| 构建产物 | `Start-M0Verification -Mode Product`，`pet://app/index.html` | 01:44:32 读回同一路径，退出码 0 |

Codex 在每个已加载的真实窗口打开“记忆与交付 → 本地数据位置”，读数均以 `20261120-014157\data\orange-cat-lab.sqlite` 结尾。正常关闭后测试库均为 12,288 字节，检查未发现本项目 Electron／开发脚本进程或 5173 监听。

| 启动前错误设置 | 实际操作（仅本次进程） | 首次开发 / 开发重启 / 产物 |
| --- | --- | --- |
| 环境变量缺失 | `Remove-Item Env:ORANGE_CAT_DATA_DIR` | 三处均抛出“ORANGE_CAT_DATA_DIR 为空” |
| 指向其他测试目录 | `$env:ORANGE_CAT_DATA_DIR = $other`，其中 `$other` 是本轮新建的 `negative-other` | 三处均抛出“测试库路径与本轮不符” |
| 本轮变量未设置 | `$run = $null` | 三处均抛出“尚未设置本轮运行目录” |
| 预期 data 子目录不存在 | `$run = $other`，保留正确环境变量，`$other\data` 不存在 | 三处均抛出“本轮测试目录不存在” |

每例都执行 RUNBOOK 对应的原调用。只计数的命令断点监测 `npm.cmd` 和 `Start-Process`；12 次拦截均命中预期错误，两条启动命令调用数均为 0。三次正常对照各记录一次启动调用。每例前后均检查进程和端口。负例结束时两个测试目录均为空；实际默认 `%APPDATA%\orange-cat-desktop\orange-cat-lab.sqlite` 及其 WAL、SHM、journal 全程各检查点均不存在。原始执行脚本、终端输出及窗口读数保存在本机 `test-results/M0-WIN-VERIFY/a10-review/20261120-014050/`。模型下载和模型 API 调用均为 0。
