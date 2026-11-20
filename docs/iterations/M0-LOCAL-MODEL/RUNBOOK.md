# Windows 本地模型运行说明 · PLAN r1

## 运行条件

本机 2026-11-20 首次检出驱动 546.01。用户更新后，03 再次实测 RTX 3070 Laptop 使用 621.24，符合 PLAN 第 4.1 节所列 551.61 门槛。各次实际验证结果见 [EVIDENCE](EVIDENCE.md)。

## 1. 新终端与运行目录

在本机 PowerShell 7 使用以下块。重新进入同一轮沿用同一目录。若用户另行决定新的硬件或运行范围，先记录修订。以下驱动判断仅针对本机的单张 NVIDIA 卡。

~~~powershell
$ErrorActionPreference = 'Stop'
$repo = 'D:\tools\IdeaTool\project\desktop_pet'
Set-Location -LiteralPath $repo
$round = Join-Path $repo 'test-results\M0-LOCAL-MODEL\r1\20261120-131021'
$driver = (& nvidia-smi --query-gpu=driver_version --format=csv,noheader)
if ($LASTEXITCODE -or !$driver -or [version]$driver.Trim() -lt [version]'551.61') {
    throw "驱动检查停止：$driver。请按 PLAN 第 4.1 节处理。"
}
$fixed = 'D:\tools\IdeaTool\runtimes\node-v24.22.3-win-x64'
$env:Path = "$fixed;$env:Path"
if ((Get-Command node.exe).Source -ne "$fixed\node.exe" -or (node.exe -v) -ne 'v24.22.3' -or
    (Get-Command npm.cmd).Source -ne "$fixed\npm.cmd" -or (npm.cmd -v) -ne '11.19.1') { throw '固定 Node/npm 不符' }
$exe = (Resolve-Path '.\node_modules\electron\dist\electron.exe').Path
if ((Get-Item $exe).VersionInfo.ProductVersion -ne '45.4.1') { throw 'Electron 版本不符' }
$cli = 'D:\tools\IdeaTool\runtimes\ollama-v0.40.16-win-x64\ollama.exe'
$tag = 'qwen3:4b-instruct-2507-q4_K_M'
$digest = '0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0'
$api = 'http://127.0.0.1:11434'
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MODELS = 'D:\tools\IdeaTool\models\desktop_pet\ollama'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_CONTEXT_LENGTH = '4096'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_MAX_LOADED_MODELS = '1'
$env:OLLAMA_KEEP_ALIVE = '5m'
~~~

本轮已有锁定依赖和生产构建。仅在联网准备时依赖确实缺失且归属明确，才按 r1 恢复锁定依赖。固定 Node 下的 `npm.cmd run check` 包含构建。离线阶段只使用本地已备齐的文件。

## 2. 联网准备与身份核验

1. 复核 D 盘可用空间、固定目录的归属和 11434 监听。已有监听时记录所有者并停止；保留原服务。参见 [PLAN 第 3–4 节](PLAN.md) 的固定 URL、大小和摘要。
2. 下载官方 `ollama-windows-amd64.zip` 至本轮新的临时文件。用 `Get-FileHash -Algorithm SHA256` 核对 ZIP 及字节数，符合第 3.2 节后才解压到新的指定程序目录，确认 `$cli` 的实际位置。已存在且来源不明的目录交用户核对。为本轮专用模型目录建立归属记录。
3. 从第 3.3 节的精确 tag 官方 manifest 地址读取**原始字节**，用 SHA-256 与 `$digest` 比较；重新联网恢复时也须核对可变 tag。只有匹配后才允许对下节启动的自有服务执行 `& $cli pull $tag`，检查退出码。无须重新下载的可信副本仍要核对本地身份。离线读回跳过本节联网操作。
4. 下载后核对本机 `/api/tags` 返回的完整 digest 和 `/api/show` 的 GGUF、qwen3、Q4_K_M、completion，记录实际服务版本。按官方 manifest 核验本地权重 blob 的字节数与哈希，保留首次准备的证据。

## 3. 自有服务与产物窗口

在同一 PowerShell 定义以下函数。仅在驱动、程序和目录来源都核实后调用。每次启动服务使用新的日志名，日志留在本轮本地目录。

~~~powershell
function Assert-OwnService {
    if (!$svc -or $svc.HasExited) { throw '自启服务不在运行' }
    $list = @(Get-NetTCPConnection -State Listen -LocalPort 11434 -ErrorAction SilentlyContinue)
    $proc = Get-Process -Id $svc.Id -ErrorAction Stop
    if ($list.Count -ne 1 -or $list[0].LocalAddress -ne '127.0.0.1' -or
        $list[0].OwningProcess -ne $svc.Id -or $proc.Path -ne $cli -or
        $proc.StartTime.ToUniversalTime() -ne $svc.StartTime.ToUniversalTime()) { throw '监听归属或绑定地址不符' }
    if ((Invoke-RestMethod "$api/api/version").version -ne '0.40.16') { throw '服务版本不符' }
}
function Start-OwnService {
    if (!(Test-Path -LiteralPath $cli -PathType Leaf) -or !(Test-Path -LiteralPath $env:OLLAMA_MODELS -PathType Container)) { throw '请先核实程序与模型目录' }
    if ([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port -contains 11434) { throw '11434 已占用' }
    $prefix = Join-Path $round ('serve-' + [guid]::NewGuid().ToString('N'))
    $script:svc = Start-Process -FilePath $cli -ArgumentList 'serve' -PassThru -WindowStyle Hidden -RedirectStandardOutput "$prefix.out" -RedirectStandardError "$prefix.err"
    $until = (Get-Date).AddSeconds(30)
    do {
        if ($svc.HasExited) { throw "自启进程已退出，见 $prefix.err" }
        if (Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue) { break }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $until)
    Assert-OwnService
    if (!(Select-String -LiteralPath "$prefix.err" -SimpleMatch 'Ollama cloud disabled: true' -Quiet)) {
        throw "本次启动日志缺少禁云确认，先停止本轮进程：$prefix.err"
    }
    Write-Host "已核实本机监听及禁云日志：$prefix.err，PID $($svc.Id)"
}
function Open-ModelWorkbench {
    param([Parameter(Mandatory)][ValidateSet('creator','recipient')][string]$Role)
    $expected = [IO.Path]::GetFullPath((Join-Path $round "$Role\data"))
    if (!(Test-Path -LiteralPath $expected -PathType Container) -or
        [string]::IsNullOrWhiteSpace($env:ORANGE_CAT_DATA_DIR) -or
        ![IO.Path]::IsPathFullyQualified($env:ORANGE_CAT_DATA_DIR) -or
        [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($env:ORANGE_CAT_DATA_DIR)) -ne $expected) { throw '测试目录未设置或与本轮角色不符' }
    Assert-OwnService
    $models = @((Invoke-RestMethod "$api/api/tags").models | Where-Object name -ceq $tag)
    if ($models.Count -ne 1 -or $models[0].digest -ne $digest) { throw '本机模型身份不符' }
    $show = Invoke-RestMethod "$api/api/show" -Method Post -ContentType 'application/json' -Body (@{model=$tag}|ConvertTo-Json)
    if ($show.details.format -ne 'gguf' -or $show.details.family -ne 'qwen3' -or $show.details.quantization_level -ne 'Q4_K_M' -or $show.capabilities -notcontains 'completion') {throw '模型元数据不符'}
    if (!(Test-Path -LiteralPath "$repo\dist\renderer\index.html") -or (Get-Item $exe).VersionInfo.ProductVersion -ne '45.4.1' -or (Test-Path Env:ELECTRON_RUN_AS_NODE)) {throw '产物或 Electron 不符'}
    Remove-Item Env:ORANGE_CAT_DEV_URL -ErrorAction SilentlyContinue
    $window = Start-Process -FilePath $exe -ArgumentList '.' -WorkingDirectory $repo -PassThru
    $window.WaitForExit()
    if ($window.ExitCode -ne 0) {throw "工作台退出码 $($window.ExitCode)"}
}
~~~

先执行 `Start-OwnService`，核实本轮日志的禁云配置并完成第 2 节模型检查。设置 `$env:ORANGE_CAT_DATA_DIR = Join-Path $round 'creator\data'`，再调用 `Open-ModelWorkbench creator`。在加载完成的原生窗口展开“记忆与交付 → 本地数据位置”，核对对应的 `orange-cat-lab.sqlite`。切库前正常关闭本轮窗口。接收库使用 `recipient\data` 和 `Open-ModelWorkbench recipient`；同库重启复用原目录。端口、路径或版本不符时先定位原因。

## 4. 技术操作与留证顺序

| 操作 | 应保存的记录 |
| --- | --- |
| 用虚构短规则及两条示例发布 v1，显式选 4096、384、0.7、42 | 导出当前 v1 和摘要、完整 modelProfile；核对字符预算。每个留出场景从空历史开始，先通用再人格；三组分别导出评估再清空，最后一组保留供评分。 |
| 修正最后一组风格案例，再发布 v2 | 保存修正后核对草稿与 v1；发布前试聊仍用 v1。导出 v2 和摘要，核对快照、试聊 revision、遗漏字段，重试原题及相近新题。 |
| A、B 分别存不同虚构标记，跨档案提问；删除 A 后重启 | 删前先导出；每轮保留实际回答、selectedMemoryIds、history 和遗漏字段。核对 A 的评估及聊天清理、旧标记不再入 prompt，B 资料仍在。程序选入和模型是否答对分别判定。 |
| 普通输入／记忆声称永久改性格 | 保存对照输出和前后已发布快照的摘要。 |
| recipient 导入 v1，建立自己的记忆并试聊，再导入 v2 | 核对同 personaId、版本递增、模型摘要；接收方旧上下文重置、自己的记忆保留。重启同库读回，并记录可供 U01 使用的绝对路径。 |
| 真实取消与服务失败 | 在点击停止时记时间，并与服务端处理 /api/chat 的证据对齐，包括请求开始和结束的时间边界；仅出现忙碌或 /api/tags、/api/show 属预检。核对取消前后聊天及评估数量、下一轮能否正常生成。再仅停止本轮已核实 PID 的服务，取明确错误，核对无误写，恢复后再试。 |
| 冷加载一次、热运行三次 | 冷启动前 /api/ps 无目标模型，热运行确认仍已加载。逐次记录完整回复等待时间、加载／输入／生成时长、token 数、token/s、显存及进程内存，并注明采样方法。异常及未提供的指标原样保留。 |

双库备份在相应窗口关闭后复制完整测试目录（含 SQLite 附属文件）。记录角色与相应评估导出的对应关系。只有虚构的脱敏摘要可入库。正常退出窗口并核对该次进程退出；只结束本轮已核实的服务进程，复查 11434、用过的 5173 及本轮子进程。保留其他已有进程及缓存；关闭专用终端后进程级环境失效。

## 5. 用户验收 · Work 技术审核后的本机操作

03 已用普通构建产物打开接收库。在“橘猫 · 离线验证工作台”中读到 v2、朋友 A 的一条虚构饮料代号记忆，以及下列数据库。此库可直接读回。

```text
D:\tools\IdeaTool\project\desktop_pet\test-results\M0-LOCAL-MODEL\r1\20261120-131021\recipient\data\orange-cat-lab.sqlite
```

**U01 操作。** 先在本机打开本文件，保存其他需要网络的工作。关闭本阶段工作台及自有服务。由用户自行断开可通外网的 Wi-Fi、网线及其他出口，保留本机环回，记下断开了哪些连接。下面所有命令在同一个新 PowerShell 7 终端运行。

1. 复制执行第 1 节的整块命令，再复制执行第 3 节的整块函数定义。依赖、运行时、模型和构建产物已备齐。离线过程只使用本地文件及 127.0.0.1。
2. 执行下面整块命令。缺少既有接收库时会停止。11434 的监听、自有进程、禁云日志、实际模型 digest、接收目录都经核对才会打开窗口。

~~~ps1
& {
    $env:ORANGE_CAT_DATA_DIR = Join-Path $round 'recipient\data'
    $db = Join-Path $env:ORANGE_CAT_DATA_DIR 'orange-cat-lab.sqlite'
    if (!(Test-Path -LiteralPath $db -PathType Leaf) -or (Get-Item -LiteralPath $db).Length -eq 0) { throw '接收库缺失或为空' }
    Start-OwnService
    Open-ModelWorkbench recipient
}
~~~

3. 核对窗口显示 v2，在“记忆与交付”展开“本地数据位置”，与上面的绝对路径逐项核对。选择朋友 A，在“试聊与评估”使用人格模式发一条全新的中文问题；再问“我的验证饮料代号是什么？”并对照该档案的记忆。记录断网方式、两个问题的实际回复或错误、等待感受。将截图和原文留在本机，只向 01／03 转交必要摘要。
4. 正常关闭已加载的工作台，终端会恢复提示符。如要在同一服务读回，可在原终端保持接收库环境变量并运行 `Open-ModelWorkbench recipient`。本次完成后执行下列收尾，再关闭专用终端，自行恢复网络。若启动未成功，端口归属不符时保留现场，交 03 核对。

~~~ps1
& {
    Assert-OwnService
    if ((Invoke-RestMethod "$api/api/ps").models.name -contains $tag) {
        & $cli stop $tag
        if ($LASTEXITCODE) { throw '本轮模型卸载失败' }
    }
    Assert-OwnService
    $svc.Kill()
    if (!$svc.WaitForExit(10000)) { throw '自有服务仍在运行' }
    if (Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue) { throw '11434 仍有监听，请核对归属' }
}
~~~

**U02 反馈。** 请分别说明等待及电脑占用是否可接受，哪一句听起来自然、哪一句需要改，以及是否希望进入少量真实说话样例阶段。U01 的断网结果和 U02 的体验结论分别由用户给出。
