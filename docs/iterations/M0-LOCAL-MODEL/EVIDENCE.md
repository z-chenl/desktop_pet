# M0-LOCAL-MODEL 实施证据

## 2026-11-20 · Windows 准备检查

执行者为 03－Codex。受测工作分支提交为 `68ae68db8995e2eff3941e4b925cf104a49a4bfe`（方案审核、批准及文字修订记录），业务代码与 M0-WIN-VERIFY 的 `5257697aa5aef90baae6e8c42a8ec9ee1a287553` 一致。以下为本轮 13:09–13:13（UTC+08:00）实测。原始文件位于本机忽略目录 `test-results/M0-LOCAL-MODEL/r1/20261120-131021/`。

**阻塞项为 NVIDIA 驱动。** `nvidia-smi --query-gpu=name,driver_version,memory.total,memory.used --format=csv` 显示 RTX 3070 Laptop、546.01、8192 MiB，首次采样已用 171 MiB。Windows 设备驱动记录为 31.0.15.4601。两次查询均确认同一驱动版本。PLAN 第 4.1 节及官方资料列明最低 551.61，已在下载大文件和启动真实服务之前停止。下一步需重新核对本机驱动，或由 01 提出修订并由用户决定。[Ollama Windows 系统要求](https://docs.ollama.com/windows)

| 条目 | 03 的结果与证据 |
| --- | --- |
| T01 环境与来源 | **部分完成，驱动阻塞。** Windows 11 家庭版 x64，build 26300，i7-11800H，系统可见 RAM 15.71 GiB，当时可用 4.38 GiB，D 盘可用 222.81 GiB。固定 Node 24.22.3、npm 11.19.1、Electron 45.4.1 已核对，Node ZIP SHA-256 为 `e612af99f626ab415ea225af6bce5c971feb448cb5cae250bb1c3fa50c5f7d9f`。见 `preflight.json` 和下表。 |
| T02 双库与服务归属 | **部分完成。** 本轮新建 creator/data、recipient/data。两目录分别演练环境变量缺失、指向对方、目录正确但无自有服务，共 6 次被启动前检查拦截；两目录文件数均为 0，默认业务库不存在。真实窗口读写及服务监听归属待验。 |
| T03 本地真实回复 | 未执行。服务未启动，禁云生效、真实回复和三组对照均待取证。 |
| T04 发布与修正 | 未执行。v1、草稿及 v2 发布链待真实模型验证。 |
| T05 记忆使用与隔离 | 未执行。尚无本阶段真实回答、选入的记忆 ID 或跨朋友对照。 |
| T06 删除与重启 | 未执行。尚无本阶段含真实聊天的测试库。 |
| T07 角色分享与升级 | 未执行。尚无可导入接收库的 v1、v2 角色文件。 |
| T08 取消、服务失败与恢复 | 未执行。本次启动前检查未发起推理；预检取消、/api/chat 真实生成期间取消、数据写入核对、下一轮恢复及服务失败路径均待取证。 |
| T09 自动检查与资源 | **部分完成。** 固定环境下 `npm.cmd run check` 退出码 0。类型检查通过，模拟测试 41/41，失败、取消、跳过均为 0，生产构建成功。真实模型冷／热延迟及运行资源待测。原始 `check.log` SHA-256 为 `f960e52e855da5c00385314eb11384813a00b4d1edb13e3931e61e98e10d4e00`。 |
| T10 复现与收尾 | **部分完成。** [RUNBOOK](RUNBOOK.md) 的两个 PowerShell 块解析成功，本机实际触发驱动门槛及上述 6 次拦截。最后检查 11434、5173 均无监听。成功启动、重启及相应退出和用户离线流程待验证。 |

### 来源摘要与实际本机模型

| 对象 | 方法与结果 |
| --- | --- |
| 运行时 ZIP | 查询[官方发行资产](https://api.github.com/repos/ollama/ollama/releases/tags/v0.40.16)。固定 ZIP 公布大小 1,618,244,995 字节，公布 SHA-256 为 `50fcf5ad54277f2fa5d173ebfc93bcb017adbc0c9ef2314daabc96ca9e6aa64e`。资产记录见 `release-asset.json`。本机指定路径无该 ZIP 或独立运行时。 |
| 模型 manifest | 对精确 tag 的[官方 manifest](https://registry.ollama.ai/v2/library/qwen3/manifests/4b-instruct-2507-q4_K_M) 使用 HttpClient 读取原始响应字节。859 字节，SHA-256 为 `0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`，符合计划。原始字节见 `official-manifest.json`。 |
| 权重与本机身份 | manifest 列出的权重层为 2,497,280,480 字节，SHA-256 为 `85e4a5b7b8ef0e48af0e8658f5aaab9c2324c76c1641493f4d1e25fce54b18b9`；config 与各层合计 2,497,293,803 字节。专用模型目录不存在，未拉取权重。**实际本机模型 digest 尚未取得。** |

上述结果属于 Codex 实测。Work 的方案审核及随后用户的实施批准见 [REVIEW](REVIEW.md)。本次运行时 ZIP 下载量、权重下载量、真实推理次数、云模型调用次数均为 0，业务代码修复 0。U01 断网和 U02 体验均待用户亲自完成，实施技术审核尚未交付。
