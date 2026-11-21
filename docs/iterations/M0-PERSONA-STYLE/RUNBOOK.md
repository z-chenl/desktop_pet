# Windows 风格对照运行说明 · PLAN r1

当前停在 **S01 等待用户资料**。下列启动、发布和生成操作留给资料及用途确认后的实验。首批用户只需编辑本机填写副本。

## 首批资料与目录

在 `private-data/M0-PERSONA-STYLE/r1/development/首批六组.md` 填 D001–D006。每条保留本人的原话、关系、必要前文和单独选择的用途。空白用途仍为待确认。填好后告知 03 本地文件已就绪。用户确认格式和分类后再补足 30–50 组，至少覆盖两种关系。公开[样例模板](SAMPLE-TEMPLATE.md)供复制；填写后的文件只留在私有目录。

同一完整对话、同一事件与相近改写归在同一集合。`development-check/` 只放 6 个不同的开发验证场景。`sealed-inputs/` 的 12 个单轮及 2 段三轮须在配置冻结后才交执行者；`user-reference/` 的本人参考回复及期望由用户保管，直至所有正式输出保存。首批交接无需交封存题或参考回复。资料清单、资料版本摘要和每条用途放在私有目录。

本轮证据根为 `test-results/M0-PERSONA-STYLE/r1/20261121-233638/`。其中 `baseline/` 存实际 v2，`creator/data`、`arm-a/data`、`arm-b/data`、`arm-c/data`、`recipient/data` 为五个独立目录。原始请求、导出、备份分别放 `requests/`、`exports/`、`backups/`。用户盲评材料放 `blind/`；组别、种子和原始记录的映射另存 `private-map/`。公开日志只记录匿名数量、位置与必要摘要。

## 固定环境与受保护启动

以下供 03 使用。开始前核对本轮目录及后续新写入的路径都受 Git 忽略。记录默认及历史库的存在性、目录内 SQLite 文件大小和写入时间。使用新 PowerShell 7 终端，仅修改其进程级环境。

~~~powershell
$ErrorActionPreference = 'Stop'
$repo = 'D:\tools\IdeaTool\project\desktop_pet'
if ($PSVersionTable.PSVersion.Major -ne 7) { throw '请使用 PowerShell 7' }
Set-Location -LiteralPath $repo
$round = Join-Path $repo 'test-results\M0-PERSONA-STYLE\r1\20261121-233638'
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

在同一终端定义以下函数。仅在进入相应任务后调用 `Start-OwnService`；已有服务占用端口时保留现场。

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
    $script:cloudLog = "$prefix.err"
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
    param([Parameter(Mandatory)][ValidateSet('creator','arm-a','arm-b','arm-c','recipient')][string]$Role)
    $fixedRound = Join-Path 'D:\tools\IdeaTool\project\desktop_pet' 'test-results\M0-PERSONA-STYLE\r1\20261121-233638'
    if ($round -ne $fixedRound) { throw '运行目录与本轮不符' }
    $expected = [IO.Path]::GetFullPath((Join-Path $round "$Role\data"))
    if (!(Test-Path -LiteralPath $expected -PathType Container) -or
        [string]::IsNullOrWhiteSpace($env:ORANGE_CAT_DATA_DIR) -or
        ![IO.Path]::IsPathFullyQualified($env:ORANGE_CAT_DATA_DIR) -or
        [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($env:ORANGE_CAT_DATA_DIR)) -ne $expected) { throw '测试目录未设置或与本轮角色不符' }
    for ($item = Get-Item -LiteralPath $expected; $item -and $item.FullName -ne $repo; $item = $item.Parent) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw '目录含重解析点，先核对物理位置' }
    }
    if (@(Get-Process -Name electron -ErrorAction SilentlyContinue | Where-Object Path -eq $exe).Count) { throw '已有项目窗口，先正常关闭' }
    Assert-OwnService
    if (!$cloudLog -or !(Test-Path -LiteralPath $cloudLog -PathType Leaf) -or
        !(Select-String -LiteralPath $cloudLog -SimpleMatch 'Ollama cloud disabled: true' -Quiet)) { throw '当前自有服务缺少禁云日志，停止启动工作台' }
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

调用时明确选择本轮角色。例如在创建库设 `$env:ORANGE_CAT_DATA_DIR = Join-Path $round 'creator\data'`，然后运行 `Open-ModelWorkbench creator`。切到 A 组时先正常退出，再改为 `arm-a\data` 和 `Open-ModelWorkbench arm-a`。B、C 和接收库按相同方式选择各自目录。窗口加载完成后核对实际数据库路径、人格 revision 和模型。已知窗口刚创建即关闭可能以 1 退出，保留该现场。

## S02–S05 操作顺序与取证

1. 取得足量开发样例和逐条用途。用户确认规则、两条允许进入角色包的简短正例及使用对象。核对 `baseline/character-v2.json` 与 S01 摘要。创建库导入 A，保存并发布 B（规则经本人确认，样例为空），立即导出；再发布 C，立即导出。每版保留完整角色、revision、发布时间和 SHA-256。向三个独立试聊库分别导入 A、B、C，核对固定模型配置、同一 `COMMON_POLICY` 和人格模式，记录逻辑朋友与实际 UUID 映射。
2. 用本提交的 `buildMessages` 对开发题及虚构多轮长度占位预检。system 与 user 正文合计上限 2048 个 JavaScript UTF-16 单位。各次记录计数、样例 ID、选入记忆、遗漏历史与记忆。三组单轮都从空历史、空记忆起步，使用完全相同的关系背景和输入。正式题超限保留题号和技术失败；多轮按各组真实历史逐轮记录裁剪。
3. 在批准的本机取证入口先用最少的虚构输入核实实际请求及真实响应原样通过。每次 `/api/chat` 发出前登记尝试号，服务端／客户端结果回填本轮 `attempts.tsv`。保留 runId、caseId、组、revision 与角色摘要、代码 SHA、模型 digest、参数、请求和回复或错误、完整等待、token、字符预算和遗漏；将评估导出的 recordId 与请求、角色文件关联。只有重建提示时将 T05 标为证据不足。
4. 单轮先导出评估、验证 recordId 可读，再清空该朋友上下文；多轮到段末再导出并清空。开发用 6 题 × 3 组。按匿名反馈最多一次 B/C 配置修订，复测 6 题 × 2 组。由用户预选 B 或 C，记录选择和理由，冻结 A/B/C 各次导出、规则和正例摘要，记录实际组运行顺序。之后才领取正式输入，所有输出保存之前不接触参考回复。
5. 正式单轮按 12 题 × 3 组运行；正式多轮按 2 段 × 3 轮 × 3 组运行。每题独立打乱 X/Y/Z，每段多轮在段内保持同组历史，匿名时保留整段顺序。种子、映射、原文摘要、缺答状态均私存。使用[匿名评分空表](BLIND-SCORE-TEMPLATE.md)的本地副本；每轮输出按原样呈现。正式纠正写入私有旁表。
6. 在模拟接收库导入预选候选，最多 4 条短请求，核对自己的一条虚构记忆、其他朋友信息不可用、关系分寸，以及重启后候选和记忆读回。使用普通 Electron 产物窗口核对真实路径。

### 角色导出检查（开发导出和模拟接收均执行）

解析角色快照，核对格式、schema 版本、personaId、revision、模型及完整 digest。B 的 `examples` 必须为空；C 的 `examples` 必须恰好两条，按用户确认的 sampleId、文本和可分享许可逐项比对。B/C 除样例及必要的 revision、publishedAt 外，其余人格字段一致，modelProfile 完全一致。核对简介、规则等字段，防止夹带其他开发语料、封存题、本人参考答案、创建方朋友数据或评价记录。任何夹带或授权缺失时停止使用该导出。角色包可分享权限与公开 GitHub 入库权限分别处理。

### 计数、缺答和评分

开发 18 次、一次可选修订复测 12 次、正式单轮 36 次、多轮 18 次、接收至多 4 次，计划至多 88 次；无修订至多 76 次。所有热身、取证、失败、取消和重试计入阶段 120 次总尝试，version／tags／show 单列预检。每个明确运行故障最多一次技术重试；坏回答按质量问题保留。顺序执行，每次恢复先汇总本阶段各 run 的既有尝试，遇中断保留已登记号，核对实际请求；上限处停止。

保留全部 12 个单轮题号。缺某一组时标该标签技术缺答；候选或 A 无输出时，此题无法比较两者。汇总须列原定 12、实际可比较数、技术失败题数／组次及质量问题，不以缺答代替并列、不缩小门槛分母。待用户锁定评分后再揭盲，按 PLAN 第 9.2 节逐项判定。普通窗口体验由用户给出，等待单列冷轮及热身，再列样本量、中位数、P90 和最大值。

## S06–S07 收尾

各重要节点正常关闭窗口后备份完整测试目录，恢复到新位置并复查目录归属。保留本地文件摘要清单。用下列块结束本次自有服务，再复核端口、测试进程、默认及历史库前后元数据，最后关闭专用终端。只有自己启动并验证归属的服务才执行收尾。

~~~powershell
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

按 T01–T09 保留证据或未验证项并交 Work。U01 用途及分享范围、U02 风格评分、U03 使用感受均须用户亲自提供。
