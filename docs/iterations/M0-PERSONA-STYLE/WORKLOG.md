# M0-PERSONA-STYLE 工作记录

## D01 · 上阶段反馈与路线确认

2026-11-21，03 在 Windows 项目目录 `D:\tools\IdeaTool\project\desktop_pet` 执行本条文档授权。旧分支 `verify/m0-local-model` 起始提交为 `4bae7cef9b5238eb1cae167832743f3e2ae0ea5b`。已保存用户原话及其适用范围，核对早先 Work 报告原文未变。[上阶段反馈](../M0-LOCAL-MODEL/REVIEW.md#用户断网与体验反馈--d01)

记录提交 `02c46a9278fa329849c84fdf6b07830894a52db9` 已推送，远程旧分支及未合并的草稿 PR #2 head 均已核实。main 为 `3b2b16cdaed2c17e3ae769e535be4d2e43f9dc25`。

## D02 · 文档准备

依照 PLAN 第 1.3 节，从 D01 记录提交 `02c46a9278fa329849c84fdf6b07830894a52db9` 创建 `verify/m0-persona-style`，以该提交为方案父提交。PR #2 仍为未合并草稿，新草稿 PR 以 `verify/m0-local-model` 为目标。

本次授权限 D01–D03。按用户提供的字节数和 SHA-256 核对原件。聊天粘贴文本的字节数和摘要均有差异，未用作方案或研究稿的入库源。

| 入库文件 | 核实的本机原件 | 字节数 | SHA-256 |
| --- | --- | ---: | --- |
| [PLAN.md](PLAN.md) | 下载目录中的 `Desktop_pet-M0-PERSONA-STYLE-PLAN-r1.md` | 38,132 | `7d6e3a13835bd96f218aae5f46d91c8cc5a16ba79b34b09d805738366b9828da` |
| [RESEARCH-r1.md](RESEARCH-r1.md) | 项目根目录中的 `Desktop_pet-PERSONA-RESEARCH-r1.md` | 20,903 | `fb07225a1faf0a14d0daa11a2a3801253ab377b64fb602c824608c4ce88bce40` |

用户随后提供的根目录同名 PLAN 为 37,357 字节，SHA-256 为 `a8fabe9c73207023bff0bc7749a97179de85498aebb13d8a201ef5b8cd9f887c`，缺少部分 Markdown 格式和外部研究链接。采用与用户指定指纹吻合的下载目录原件；根目录四份附件均保留。D01 中的用户反馈已与完整研究稿第 2 节逐字核对。

03 在本机静态核对 PLAN 的 13 个相对文件引用，以及研究稿内 5 个指定 Git 提交中的文件引用，均可定位。PLAN 包含 D01–D03 和 S01–S07 的完整编号。方案、研究稿与 Git 暂存对象按原字节校验。提交范围为本阶段四份文档和 STATUS。

`git diff --cached --check` 仅提示 PLAN 第 546 行和研究稿第 238 行的末尾空行，两处均来自原件，按字节保留。

## D03 · 方案送审

请 02 对交接卡和草稿 PR 指定的完整提交执行独立方案审核，按 [审核入口](REVIEW.md) 核对附录 C。提交和远程指针由 03 在推送后核实，结果随交接卡返回。实施尚未批准。
