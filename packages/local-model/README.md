# 本地模型客户端（M0）

零第三方运行时依赖的 TypeScript 模块，供 Electron 主进程调用本机已有的 Ollama。
它不安装 Ollama、不下载或拉取模型、不打开浏览器、不注册账户，也不切换到云端服务。

## 接口

从 `./index.ts` 导入 `createLocalModelClient`、`LocalModelError` 和类型。

```ts
const client = createLocalModelClient();
await client.health(); // { ok: true, version }; 无法连接时抛 LocalModelError
const models = await client.listModels(); // 只列经 /api/show 核验的本地 GGUF 模型
const result = await client.chat(
  [{ role: 'user', content: '今天有点累。' }],
  selectedModel.name,
  { expectedDigest: selectedModel.digest, temperature: 0.7, numCtx: 4096, numPredict: 384 },
  abortController.signal,
);
// result.content / result.model / result.digest / result.metrics
```

发布的人格包应保存模型名称和完整 manifest SHA-256 digest，并在每次 `chat` 传入
`expectedDigest`。每次调用重新读取 `/api/tags`，不复用之前的验证结果；同名模型的
digest 改变时返回 `DIGEST_MISMATCH`。返回的 digest 是推理前本地目录中的 manifest
摘要，不是对输出文本的加密签名。不要在生成期间替换或重命名所选模型。

默认上下文预算 4096、最大输出 384 tokens、temperature 0.7；`seed` 可选。
上下文、输出预算和 seed 严格验证为整数；temperature 接受 0–2 之间的有限数值。
这些设置不保证特定电脑的速度或内存占用。指标来自 Ollama，时长从 ns 转为 ms；
未返回的指标保持缺省，不以 0 冒充测量值。`health` 仅检查服务版本，不加载模型。

## 必须先关闭 Ollama 云功能

Ollama 的本地 HTTP 服务也能转发到云模型，使用 localhost 本身不足以证明离线。
**先退出已有的 Ollama 进程，再在启动 Ollama 的环境中设置 `OLLAMA_NO_CLOUD=1`。**
例如，在手动运行服务的终端中：

Windows PowerShell：

```powershell
$env:OLLAMA_NO_CLOUD = '1'
ollama serve
```

macOS 终端：

```sh
OLLAMA_NO_CLOUD=1 ollama serve
```

使用桌面启动项时，应设置其继承的环境变量并重启 Ollama。官方也支持在
`~/.ollama/server.json` 配置 `disable_ollama_cloud: true`。变更后查看 Ollama 日志中的
`Ollama cloud disabled: true`。本模块无法从 `/api/version` 远程证明该服务配置已生效。

## 离线边界

- 端点硬编码为 `http://127.0.0.1:11434`，没有可配置远程 URL。
- 仅调用 `/api/version`、`/api/tags`、`/api/show`、`/api/chat`；所有请求使用
  `redirect: 'error'`，同时拒绝重定向状态和返回 URL 不符的响应。
- 聊天前要求已有模型、正的权重大小、完整 digest，以及 `/api/show` 的 `gguf` 格式、
  `general.architecture`、`general.file_type` 正面元数据。缺少证据则拒绝推理。
- 拒绝 cloud/remote 名称、`remote_host`、`remote_model` 等上游元数据与远程来源；
  普通别名不能绕过 `/api/show` 校验。聊天响应也会复核上游字段。
- 不发送工具、图像、任意 options 或用户提供的 HTTP 头。固定 `think: false`、
  `stream: false`，只返回文本结果。服务不支持这些选项时直接报错。
- 默认每个响应上限 2 MiB，按读取的实际字节计数；整个操作默认限时 120 秒，支持
  `AbortSignal`。输入消息、模型名称和生成预算也有限额。
- `fetchImpl` 仅用于主进程的可信依赖注入/测试，不能作为来自渲染进程的设置开放。
- 本模块信任用户运行的本地 Ollama 服务；元数据检查不是操作系统防火墙或对恶意
  本地服务的证明。Ollama 自身更新、其他进程和用户另行启用的联网功能不受本模块控制。

模型与资源需由用户事先准备好。最终离线验收要在断网情况下检查完整应用，不能只看
请求地址是否 localhost。朋友电脑同样需要已经准备好的模型和足够的硬件资源。

## 验证

所有测试使用注入的 fake fetch；不会连接本地服务、下载模型或产生推理费用。
在工程根目录运行 `node --import tsx --test packages/local-model/test/client.test.ts`。
测试覆盖远程地址/重定向/云别名拒绝、模型摘要漂移、限额、取消、超时和坏响应。

## 官方依据

- [Show model details](https://docs.ollama.com/api-reference/show-model-details.md)
- [Chat API](https://docs.ollama.com/api/chat)
- [Local model inventory](https://docs.ollama.com/api/tags)
- [Ollama API types: remote_host / remote_model](https://github.com/ollama/ollama/blob/main/api/types.go)
- [Ollama FAQ: disabling cloud features and server environment](https://docs.ollama.com/faq)
