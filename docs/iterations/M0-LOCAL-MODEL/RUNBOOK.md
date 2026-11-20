# Windows 本地模型运行说明 · PLAN r1

## 当前停点与恢复条件

本机于 2026-11-20 检出 NVIDIA 驱动 546.01，低于 PLAN 第 4.1 节所列 551.61。本轮停在真实模型准备前。以下为恢复后的操作说明。真实服务、双库、断网步骤的运行验证状态见 [EVIDENCE](EVIDENCE.md)。保留现有服务、个人库及上阶段验收窗口。

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
    Write-Host "确认禁云配置已经生效后继续。服务日志：$prefix.err，PID $($svc.Id)"
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

## 5. 用户验收交接条件

待技术交付和 Work 审核后，将已验证的 recipient 绝对路径、服务日志核验例子和上述启动块保存在本机。当前 recipient 为空，U01 尚无可读回的 v2。

用户先退出本阶段窗口和服务，自行断开所有外网出口、保留 loopback。在新终端恢复第 1 节配置与第 3 节函数，仅核对本地已准备的程序、权重和接收库；断网时直接使用本机服务及产物，跳过联网查询、安装和拉取。读回同一 v2，完成一条新中文对话及一次与接收方记忆相关的提问，记录断网方式、窗口路径和结果，正常退出后自行恢复网络。U02 由用户记录等待与资源占用是否可接受、中文回复的实际感受及下一步选择。
