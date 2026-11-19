# 在 Windows 复现 M0 无模型验证

在 Windows x64 的 PowerShell 7 中运行。项目入口是 Electron 工作台。已验证的业务代码提交为 `5257697aa5aef90baae6e8c42a8ec9ee1a287553`，应用版本为 `0.1.0-alpha.1`。本次实际结果及截图见 [EVIDENCE](EVIDENCE.md)。

## 1. 选择固定运行时

使用新的 PowerShell 窗口，以下变量仅对该窗口及其子进程有效。

```powershell
$ErrorActionPreference = 'Stop'
$repo = 'D:\tools\IdeaTool\project\desktop_pet'
Set-Location -LiteralPath $repo
git branch --show-current
git status --short --branch
$runtimeDir = 'D:\tools\IdeaTool\runtimes'
$fixed = Join-Path $runtimeDir 'node-v24.22.3-win-x64'
$zip = "$fixed.zip"
$nodeHash = 'e612af99f626ab415ea225af6bce5c971feb448cb5cae250bb1c3fa50c5f7d9f'
```

本机已有经校验的独立运行时，可直接复用。首次准备时从 [Node 官方发行目录](https://nodejs.org/dist/v24.22.3/) 获取 ZIP。只向新路径下载、解压；已有同名目录且来源不明时，先核对其内容。

```powershell
[void][IO.Directory]::CreateDirectory($runtimeDir)
if (!(Test-Path -LiteralPath $zip)) {
    curl.exe --disable --fail --location --output $zip https://nodejs.org/dist/v24.22.3/node-v24.22.3-win-x64.zip
    if ($LASTEXITCODE) { throw 'Node ZIP 下载失败' }
}
if ((Get-FileHash -LiteralPath $zip).Hash -ne $nodeHash) { throw 'Node ZIP 校验失败' }
if (!(Test-Path -LiteralPath $fixed)) { [IO.Compression.ZipFile]::ExtractToDirectory($zip, $runtimeDir) }
$env:Path = "$fixed;$env:Path"
(Get-Command node.exe,npm.cmd).Source
node.exe -v
npm.cmd -v
```

两个可执行文件都应来自 `$fixed`，版本应为 `v24.22.3` 和 `11.19.1`。保留原本的 Node 环境与永久 PATH。

## 2. 每轮准备

### 2.1 每轮必做：建立并选定测试目录

在第 1 节的新 PowerShell 中执行一次。首次开发启动、开发重启和产物启动都沿用此终端的 `$run` 及其 `data` 子目录。只有开始新一轮验收才新建目录。依赖已装好的机器也从此步开始。

```powershell
$run = Join-Path $repo ("test-results\M0-WIN-VERIFY\r1\" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $run) { throw '运行编号已存在' }
$env:ORANGE_CAT_DATA_DIR = (New-Item -ItemType Directory -Path "$run\data" -Force).FullName
$env:electron_config_cache = Join-Path $run 'electron-cache'
```

### 2.2 按需执行：安装锁定依赖或准备缺少的 Electron 二进制

若锁定依赖和 Electron 二进制均已就绪，跳过本小节，接着执行 **2.3**。需要安装依赖时先检查 `node_modules` 的归属，`npm ci` 会替换其中内容。含有手工改动时可另用同提交的隔离工作区。用户已采纳 Work 对 W02 的建议，此次安装关闭依赖审计。

```powershell
npm.cmd ci --include=dev --no-audit
if ($LASTEXITCODE) { throw '锁定依赖安装失败' }
```

若仅缺锁定的 Electron 平台二进制，使用项目内安装器。下载恢复步骤见本节末尾。

```powershell
& .\node_modules\.bin\install-electron.cmd
if ($LASTEXITCODE) { throw 'Electron 二进制准备失败' }
```

### 2.3 所有路径必做：解析并核验 Electron

```powershell
$exe = (Resolve-Path -LiteralPath (Join-Path $repo 'node_modules\electron\dist\electron.exe') -ErrorAction Stop).Path
$electronVersion = (Get-Item -LiteralPath $exe).VersionInfo.ProductVersion
if ($electronVersion -ne '45.4.1') { throw "Electron 版本不符：$electronVersion" }
Write-Output "$exe ($electronVersion)"
git diff HEAD -- package.json package-lock.json
```

包清单和锁文件应无差异。需要核对内嵌运行时时可在此终端执行以下块；完成后退出 Node 模式。

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
try { & $exe -p 'JSON.stringify(process.versions)' | Out-Host }
finally { Remove-Item Env:ELECTRON_RUN_AS_NODE }
```

### 官方 Electron 下载较慢时

仅在第 2.2 节确需恢复下载时使用。成功后回到第 2.3 节解析并核验 `$exe`。

先结束本次安装器并核对所属 PID。以下为本机实际验证过的恢复方式。在同一 PowerShell 使用锁定 npm 包附带的校验值与缓存路径规则，将官方 ZIP 放入本轮缓存后重新运行本地安装器。使用新临时文件，保留已有缓存。

```powershell
$file = 'electron-v45.4.1-win32-x64.zip'
$url = "https://github.com/electron/electron/releases/download/v45.4.1/$file"
$part = Join-Path $run 'electron-recovery.zip.part'
if (Test-Path -LiteralPath $part) { throw '先核对已有临时文件' }
curl.exe --disable --fail --location --output $part $url
if ($LASTEXITCODE) { throw 'Electron ZIP 下载失败' }
$expected = (Get-Content -Raw node_modules/electron/checksums.json | ConvertFrom-Json -AsHashtable)[$file]
if ((Get-FileHash -LiteralPath $part).Hash -ne $expected) { throw 'Electron ZIP 校验失败' }
$cacheFile = node.exe --input-type=module -e "import {Cache} from './node_modules/@electron/get/dist/Cache.js'; console.log(new Cache(process.env.electron_config_cache).getCachePath(process.argv[1],process.argv[2]))" $url $file
if ($LASTEXITCODE -or !$cacheFile.StartsWith($env:electron_config_cache + '\')) { throw '缓存路径异常' }
[void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($cacheFile))
[IO.File]::Move($part, $cacheFile)
& .\node_modules\.bin\install-electron.cmd
if ($LASTEXITCODE) { throw '本地安装器失败' }
```

## 3. 启动前检查与桌面验证

完整的 A02 自动检查使用 `npm.cmd run check`。本次 A10 定向复现可复用相同业务代码已验证的依赖和构建产物。产物缺失时，先运行 `npm.cmd run build`，确认退出码 0。

### 在本轮 PowerShell 定义启动操作

复制整个函数块执行一次。后面三次调用都会在同一个函数内先校验再启动。目录缺失、变量错误或端口已占用时，按报错核对本轮设置，再调用同一函数。此函数只存在于当前 PowerShell 会话。

```powershell
function Start-M0Verification {
    param([Parameter(Mandatory)][ValidateSet('Dev','Product')][string]$Mode)
    $ErrorActionPreference = 'Stop'
    if ([string]::IsNullOrWhiteSpace($run) -or ![IO.Path]::IsPathFullyQualified($run)) {
        throw '尚未设置本轮运行目录 $run'
    }
    $expected = [IO.Path]::GetFullPath((Join-Path $run 'data'))
    if (!(Test-Path -LiteralPath $expected -PathType Container)) {
        throw "本轮测试目录不存在：$expected"
    }
    $setting = $env:ORANGE_CAT_DATA_DIR
    if ([string]::IsNullOrWhiteSpace($setting)) { throw 'ORANGE_CAT_DATA_DIR 为空' }
    if (![IO.Path]::IsPathFullyQualified($setting)) { throw '测试库路径必须是绝对路径' }
    $actual = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($setting))
    if (![string]::Equals($actual, $expected, [StringComparison]::OrdinalIgnoreCase)) {
        throw "测试库路径与本轮不符。预期 $expected，实际 $actual"
    }
    if ([string]::IsNullOrWhiteSpace($exe) -or !(Test-Path -LiteralPath $exe -PathType Leaf)) {
        throw '请先完成第 2.3 节的 Electron 核验'
    }
    if ([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port -contains 5173) {
        throw '5173 已被占用，请核对此前的开发进程'
    }
    Set-Location -LiteralPath $repo
    if ($Mode -eq 'Dev') {
        npm.cmd run dev
        if ($LASTEXITCODE) { throw "开发入口退出码 $LASTEXITCODE" }
    } else {
        Remove-Item Env:ORANGE_CAT_DEV_URL -ErrorAction SilentlyContinue
        $p = Start-Process -FilePath $exe -ArgumentList '.' -WorkingDirectory $repo -PassThru
        $p.WaitForExit()
        if ($p.ExitCode -ne 0) { throw "产物入口退出码 $($p.ExitCode)" }
    }
}
```

### 首次开发启动

```powershell
Start-M0Verification -Mode Dev
```

在真实“橘猫 · 离线验证工作台”窗口，打开“记忆与交付 → 本地数据位置”，核对 SQLite 路径为本轮 `$run\data\orange-cat-lab.sqlite`。路径异常时退出并保留现场。完整功能验收使用下列虚构素材；A10 定向复现只需核对真实窗口、选库和正常退出。

1. 在“试聊与评估”选一个虚构场景，输入框应有内容，两个生成按钮仍不可用。
2. 在“调教与发布”把名称改为 `WIN_VERIFY_CAT`，设置一条含 `WIN_VERIFY_RULE` 的规则并保存。切页再读回，核对草稿已同步。未选模型时“发布测试版本”应不可用。
3. 在“记忆与交付”新建 `WIN_VERIFY_C`，展开顶部选择框核对并选择它。按名字分别切换“朋友 A”和“朋友 B”，各保存一条 `WIN_VERIFY_A` 和 `WIN_VERIFY_B`。来回切换，各页只能看到本朋友的标记。“导出角色文件”应不可用。
4. 在 A 页对本轮标记点“删除 → 确认删除”，检查 A 为 0 条且 B 的标记仍在。正常关闭加载完成的窗口，等待终端返回。

### 同轮开发重启

在同一终端再次调用开发入口。函数会重新检查当前的目录和环境变量。核对窗口内数据库路径和本轮已有数据，正常关闭并等待终端返回。

```powershell
Start-M0Verification -Mode Dev
```

### 同轮构建产物启动

```powershell
Start-M0Verification -Mode Product
```

产物窗口加载 `pet://app/index.html`。核对“本地数据位置”及同轮数据，页面加载完成后正常关闭，预期退出码 0。复查本轮进程均已结束、5173 已释放。退出该 PowerShell 即可恢复原环境。保留已关闭的测试库及原始记录供复核。应用的常规 SQLite 默认路径仍在 Electron 用户数据目录。
