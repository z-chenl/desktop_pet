# BOOTSTRAP 工作记录

2026-11-19，Codex 实现会话。任务依据见 [PLAN r1](PLAN.md)。

## 执行环境

Windows 11 家庭版中文版 x64，系统版本 10.0.26300，PowerShell 7.6.9，Git 2.37.1.windows.1。工作路径与 Git 根目录均为 `D:\tools\IdeaTool\project\desktop_pet`。当前 PATH 中 Node 为 22.15.0，npm 为 10.9.2；应用要求 Node `>=24 <27`，仓库无 `node_modules`。以下为同一台 Windows 本机的记录。

## B01 · 确定范围与分支

- 目的与变更：先保存本次初始化范围、验收方式和授权依据。
- 核对：`git status` 显示 main 尚无提交，根目录只有 .git 和一个未跟踪的源码 ZIP；`git ls-remote --symref origin` 成功且无引用。本地 Codex 工具引用指向 tree，Git 对象库只有 tree 与 blob，没有 commit。GitHub 仓库 API 返回 `z-chenl/desktop_pet`、`public`、默认分支 `main`；origin 读写地址均为 `https://github.com/z-chenl/desktop_pet.git`。
- 问题与处理：预期上级路径找不到源码包；在现有工作区找到同名原件，保留并转入 B02 核对。无需修改 Git 配置。
- 提交与下一步：首次提交 `e69c3fc8cc9f3861c96094bfeee24c317ff44c68` 只含 PLAN。推送成功，并以 `git ls-remote --heads origin refs/heads/main` 核实同号；随后导入基线。

## B02 · 固定 M0 原始基线

- 来源：`D:\tools\IdeaTool\project\desktop_pet\orange-cat-desktop-M0-v0.1.0.zip`，124903 字节。PowerShell `Get-FileHash` 得到 SHA-256 `85428aedcb2415067304a3cedffed987ef099f83958f0cbacbd253e81a9e5dca`，等于用户参考值。ZIP 文件名为 v0.1.0，根包和锁文件声明 `orange-cat-desktop@0.1.0-alpha.1`，人格核心包为 `@orange-cat/persona-core@0.1.0`。
- 变更与验证：检查 ZIP 目录、重复路径与已有文件冲突，随后移除路径前缀 `orange-cat-desktop/`，向仓库根目录只写新文件。42 项逐文件 SHA-256 与包内匹配；按这 42 个路径暂存，核对暂存清单并逐项比较 `git hash-object --no-filters` 和索引 blob，全部一致。`git diff --cached --check` 通过。锁文件资源主机为 registry.npmjs.org，暂存内容常见凭据特征检查无命中。
- 问题与处理：Git 提示未来检出可能转换换行；已核实入库 blob 字节，保留原基线。ZIP 留在用户本地。
- 提交与下一步：基线提交 `b777b37644ecea353f0d5d4fda4ac1d44dcb8f51` 已推送，远程 main 当时核实同号；随后单独整理协作资料。复查原版可用 `git show b777b37644ecea353f0d5d4fda4ac1d44dcb8f51:README.md`。

### 原包历史证据

原版 README 第 6 节记载：在 Linux／Node 24 下完成 Vue/TypeScript 类型检查、41 项核心／适配器／服务与 SQLite 测试及生产构建。测试使用假 HTTP 响应或假的模型客户端。原记录说明图形交互未完成；随包的 M0-ACCEPTANCE.md 是验收项目与后续设想。真实模型、用户风格、断网体验、Windows 与 macOS 运行及打包安装仍欠目标环境证据。

## B03 · 建立协作资料

- 目的与变更：建立协作入口、流程、产品说明、状态、三角色职责、变更记录、工作日志及待审核页。根 README 提供工作台入口并链接原版 README；.gitignore 增补本地原包、私人评估导出、模型目录和密钥文件。包内涉及调整的路径仅 README.md、.gitignore。
- 验证依据：以 B02 固定提交及 ZIP 的逐文件结果为基准，检查本次差异、文档和忽略规则。详见 B04 的交接检查记录。
- 问题、提交与下一步：独立报告及用户验收依据尚待取得。协作资料单独提交至 main，由 B04 核实远程并固定审核目标。

## B04 · 交接检查

目的为核实 Work 将收到的源码与资料。以下均为本次 Windows 静态检查。

| 检查 | 方法与结果 |
| --- | --- |
| ZIP 对提交 | 比较 ZIP 条目清单与 B02 的 `git diff-tree`，直接从各条目原始字节计算 Git blob 并和 B02 树比较，42/42 一致。与交付索引比较仅 README.md 和 .gitignore 有差异；业务源码、测试、依赖与运行配置均与基线一致 |
| 记录 | 核对 12 个指定 Markdown 入口已纳入索引；遍历 15 份 Markdown，30 个相对文件链接均可解析。核对 STATUS 为“初始化待审核”，REVIEW 为“待审核” |
| 忽略与暂存 | `git check-ignore` 的 16 个探针覆盖原包、依赖、产物、数据库、私有导出、模型和凭据；.env.example 可跟踪。索引共 53 项，常见凭据特征无命中，原始 ZIP 显示为已忽略。暂存差异通过 `git diff --cached --check` |
| 源码静态检查 | 5 份 JSON 解析通过；根包与锁文件的包名、版本、依赖及 Node 范围一致。两个入口脚本分别通过 `node --check scripts/build.mjs` 与 `node --check scripts/dev.mjs` |

本机未安装新依赖，未执行 npm run check、构建、运行 GUI、调用模型或测试安装包。当前 Node 版本与依赖缺失影响运行验证，未阻塞上述迁移检查。下一角色为 Work，提交与远程核实结果见本阶段交接卡。
