# Desktop_pet · 橘猫桌宠

面向少数朋友的本地橘猫桌宠项目。目前可用的源码是 **M0 离线人格验证工作台**（`0.1.0-alpha.1`）。可以编辑草稿、发布人格快照、管理各朋友的记忆，并用已准备好的本机模型试聊。完整桌宠、正式橘猫素材和朋友安装包仍待实现与验收。[当前状态](docs/STATUS.md)

## 启动工作台

开发环境按 M0 说明使用 Node.js 24.x。在仓库根目录执行以下命令；首次安装依赖和 Electron 需要网络。Windows PowerShell 若限制 npm 脚本，可使用 `npm.cmd`。

```sh
npm ci
npm run dev
```

真实试聊另需本机 Ollama 与已安装的本地 GGUF 模型。先退出已有的 Ollama 实例，在单独的 PowerShell 窗口运行以下命令，确认服务日志显示云功能已关闭，再在工作台检测模型。

```powershell
$env:OLLAMA_NO_CLOUD = "1"
$env:OLLAMA_HOST = "127.0.0.1:11434"
ollama serve
```

macOS 终端可用 `OLLAMA_NO_CLOUD=1 OLLAMA_HOST=127.0.0.1:11434 ollama serve`。在“调教与发布”选择本地模型、保存草稿并发布测试人格，再到“试聊与评估”试用。仅查看界面可运行 `npm run dev:ui`；该预览没有桌面数据与推理接口。

## 验证与资料

安装依赖后，`npm run check` 依次进行类型检查、模拟模型测试和生产构建。原包 README 记载 Linux／Node 24 下 41 项测试和构建通过。本次 Windows 初始化的证据见[工作记录](docs/iterations/BOOTSTRAP/WORKLOG.md)。真实模型风格、断网使用及两个目标系统的运行与安装均待实测。

- [协作入口](AGENTS.md) · [产品要求与模块](docs/PROJECT.md) · [变更记录](CHANGELOG.md)
- [M0 原版使用说明及历史验证记录](https://github.com/z-chenl/desktop_pet/blob/b777b37644ecea353f0d5d4fda4ac1d44dcb8f51/README.md) · [原型验收项目](docs/M0-ACCEPTANCE.md) · [分发说明](docs/DISTRIBUTION.md)

原版资料反映打包时的环境与计划；仓库当前为公开可读。个人数据库、聊天和私人评估导出请保存在本地。
