# 分发与好友内测

更新日期：2026-11-19。

## 当前状态：M0 开发验证

M0 需要开发者**单独安装 Ollama，并准备本地模型**；工程尚未内置推理器或模型。源码和预置的 `electron-builder` 打包脚本，不代表已经生成、签名、公证或实测过 Windows/macOS 安装包。

以下是后续交付计划。是否改为内置推理运行时，需在模型和目标电脑验证后确定；不得把计划描述为当前已完成的功能。

## 未来交给朋友的文件

| 目标系统    | 计划产物                                                      | 使用前提                                                                                  |
| ----------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Windows x64 | `.exe` 安装包，或包含完整应用目录的 `.zip`                    | 匹配系统、驱动与所选模型；不能只复制目录中的一个 EXE。                                    |
| macOS       | 对应芯片的 `.app`，通过 `.dmg` 或保留应用包结构的 `.zip` 分发 | 确认 Apple Silicon / Intel 及内存，再选择 arm64 / x64 包；是否提供 universal 包另行决定。 |

交付目标是朋友安装后无需配置 Java、Node.js 等开发环境。模型可以单独作为资源包导入，或首次联网下载；需要完全离线安装时，必须提前准备全部资源。

目前朋友只提供了“MacBook Pro 13 英寸、macOS 26.5.2”，还缺芯片和内存信息，不能据此确认架构或模型适配结果。

### 构建环境

日常开发以 Windows 为主，发布分别使用对应目标平台的构建与验证流程。Mac 包安排在 macOS 环境制作；标准 Developer ID 签名、公证流程还需要 macOS/Xcode。可使用可用的 Mac 或远程 macOS 构建环境，不必立即购买新电脑；远程构建资源费用另行评估。[1]

必须在实际 Windows 和 Mac 桌面验证安装、透明窗口、鼠标交互和本地推理。源码可跨平台、构建成功，均不等于安装体验已经通过验收。

## 是否必须付费签名

**少数好友内测可以先不购买发布者签名；系统是否允许运行，要以目标电脑为准。** 朋友无需购买开发者会员或签名证书。

### macOS

- 首轮可采用未使用付费 Developer ID 的测试包；构建时仍应完成平台所需的临时签名或完整性处理。Apple 官方也列有不进行代码签名的 `Copy App` 分发方式。[2]
- 未公证或开发者未验证的应用可能被 Gatekeeper 提示或拦截。可信应用可能需要用户按系统提供的“隐私与安全性”确认流程打开；不能承诺每类拦截均可跳过。[3]
- 面向普通用户正式分发时，采用 **Developer ID 签名＋Apple 公证**，可以直接分发，无须强制上 Mac App Store。Apple Developer Program 当前年费为 **99 USD**，本地币种及税费以实际购买页面为准；这是发布者费用。[1][4]
- 完成签名、公证后仍可能出现首次下载确认或权限请求，不能承诺“完全没有任何提示”。[3]

### Windows

- 普通未签名 EXE/MSI 可用于开发内测，但 SmartScreen 可能提示；通常可出现“仍要运行”，企业策略可能禁止继续。自签名不等于公众电脑默认信任的发布者签名。[5]
- Windows 11 的 **Smart App Control** 是另一套机制：它可能阻止不受信任的应用，且没有针对单个应用的“仍要运行”例外。不要把普通 SmartScreen 的处理方式泛化到所有 Windows 电脑。[6]
- 后续可评估可信代码签名或商店分发。购买证书、使用 EV 或 Artifact Signing，也不保证每个新版本立即没有 SmartScreen 提示；信誉仍可能需要积累。[5]

## 打包内容清单

未来独立安装包需要分别管理下列内容；**当前 M0 不代表这些内容均已内置**：

1. **应用运行时：**编译后的桌宠程序、Electron 及必要依赖。
2. **推理运行时：**选定的本地推理程序及匹配操作系统、架构和加速后端的依赖；仍使用外置 Ollama 的版本必须明确告知安装前提。正式签名时也要覆盖相应辅助可执行组件。
3. **模型资源：**记录模型来源、版本、量化格式、文件校验值和兼容配置。资源包可与程序分开，升级应用不应要求重复下载未变更的模型。
4. **角色素材：**动画、图片和声音等实际使用的资源；橘猫最终素材尚未提供，不视为已经具备。
5. **许可证与归属：**分别核对并附带应用依赖、推理引擎、模型和素材的适用许可证及声明；不能用某个代码库的开源许可代替其他资源的授权。

用户记忆和配置应与安装目录分开保存；导出给朋友的内容由用户明确选择，不把开发者的个人聊天记录、账号凭据或缓存默认装进安装包。

## 首轮更新与验收

首轮采用**手动安装更新**。更新前备份或导出本地数据，验证升级后的数据保留与恢复；自动更新留待正式发布流程完善后再接入。Electron 的 macOS 自动更新及部分系统集成行为依赖稳定有效的签名，未付费内测包不能视为已验证这些能力。[1]

每个目标系统分别记录：安装与首次启动结果、实际安全提示、所用模型及硬件、断网后的聊天和动作、记忆导出导入、重启和手动更新后的数据状态。只有在对应目标机完成测试，才能标记为“Windows 安装已验证”或“macOS 安装已验证”。

## 官方参考

- [1] [Electron：代码签名、公证及 macOS 系统集成限制](https://www.electronjs.org/docs/latest/tutorial/code-signing)。Windows SmartScreen 的具体行为以以下微软文档为准。
- [2] [Apple：测试和发布分发方式，包含 Copy App](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases.md)。
- [3] [Apple：在 Mac 上安全打开应用](https://support.apple.com/en-gb/102445)。
- [4] [Apple：Developer Program 注册与年费](https://developer.apple.com/help/account/membership/program-enrollment)。
- [5] [Microsoft：SmartScreen 信誉、未签名及可信签名的行为](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)。
- [6] [Microsoft：Smart App Control 常见问题](https://support.microsoft.com/en-gb/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions)。
