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

## 2. 建立本轮测试目录，准备依赖

每次从空库开始时新建运行目录；同一轮的全部启动共用同一个 `$run`。完整依赖已经按锁文件安装的本机，可以直接核对 Electron 并进入第 3 节。需要重装时先检查 `node_modules` 的归属，`npm ci` 会替换其中内容。含有手工改动时可另用同提交的隔离工作区。

```powershell
$run = Join-Path $repo ("test-results\M0-WIN-VERIFY\r1\" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $run) { throw '运行编号已存在' }
$env:ORANGE_CAT_DATA_DIR = (New-Item -ItemType Directory -Path "$run\data" -Force).FullName
$env:electron_config_cache = Join-Path $run 'electron-cache'
```

用户采纳了 Work 对 W02 的建议，下列命令只对本次安装关闭依赖审计。

```powershell
npm.cmd ci --include=dev --no-audit
if ($LASTEXITCODE) { throw '锁定依赖安装失败' }
if (!(Test-Path -LiteralPath 'node_modules\electron\dist\electron.exe')) {
    & .\node_modules\.bin\install-electron.cmd
    if ($LASTEXITCODE) { throw 'Electron 二进制准备失败，见下方下载恢复步骤' }
}
$exe = (Resolve-Path -LiteralPath 'node_modules\electron\dist\electron.exe').Path
(Get-Item -LiteralPath $exe).VersionInfo.ProductVersion
git diff HEAD -- package.json package-lock.json
```

Electron 应为 `45.4.1`，包清单和锁文件应无差异。要查询内嵌运行时，可执行下列命令；在开启 GUI 前退出 Node 模式。

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
try { & $exe -p 'JSON.stringify(process.versions)' | Out-Host }
finally { Remove-Item Env:ELECTRON_RUN_AS_NODE }
```

### 官方 Electron 下载较慢时

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
$exe = (Resolve-Path -LiteralPath 'node_modules\electron\dist\electron.exe').Path
```

## 3. 自动检查与两条启动路径

```powershell
npm.cmd run check
if ($LASTEXITCODE) { throw '先记录失败的分项及输出' }
if ([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port -contains 5173) {
    throw '5173 已占用，请核对所属进程'
}
npm.cmd run dev
```

开发服务监听 `127.0.0.1:5173`。在真实“橘猫 · 离线验证工作台”窗口操作，先打开“记忆与交付 → 本地数据位置”，核对 SQLite 文件位于 `$env:ORANGE_CAT_DATA_DIR`；路径不符时退出，保留现有数据。测试中保持未发布状态。

1. 在“试聊与评估”选一个虚构场景，输入框应有内容，两个生成按钮仍不可用。
2. 在“调教与发布”把名称改为 `WIN_VERIFY_CAT`，设置一条含 `WIN_VERIFY_RULE` 的规则并保存。切页再读回，核对草稿已同步。未选模型时“发布测试版本”应不可用。
3. 在“记忆与交付”新建 `WIN_VERIFY_C`，展开顶部选择框核对并选择它。按名字分别切换“朋友 A”和“朋友 B”，各保存一条 `WIN_VERIFY_A` 和 `WIN_VERIFY_B`。来回切换，各页只能看到本朋友的标记。“导出角色文件”应不可用。
4. 在 A 页对本轮标记点“删除 → 确认删除”。检查 A 显示 0 条，B 的标记仍在。正常关闭窗口，等待终端返回并检查端口释放。再执行 `npm.cmd run dev`，用同一测试目录逐项读回草稿、C 档案、B 记忆及 A 删除结果，并核对默认 A/B 各出现一次。
5. 正常关闭开发窗口，在同一终端运行以下命令。产物入口应显示真实窗口且无需 5173 服务。再次核对资料和“本地数据位置”，随后正常关闭窗口。

```powershell
if ([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port -contains 5173) {
    throw '开发服务尚未释放端口'
}
Remove-Item Env:ORANGE_CAT_DEV_URL -ErrorAction SilentlyContinue
$p = Start-Process -FilePath $exe -ArgumentList '.' -WorkingDirectory $repo -PassThru
$p.WaitForExit()
$p.ExitCode
```

产物入口为 `pet://app/index.html`，预期进程退出码 0。复查本轮 PID、开发服务和端口均已释放。退出本次 PowerShell 即可恢复原运行环境。保留已关闭的测试库及原始记录供复核。默认业务库位于 Electron 用户数据目录，`ORANGE_CAT_DATA_DIR` 只指定应用 SQLite 路径。
