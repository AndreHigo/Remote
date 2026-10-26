[CmdletBinding()]
param(
  [string]$OutputRoot = "",
  [string]$FfmpegPath = "",
  [string]$FfmpegLicensePath = "",
  [string]$FfmpegReadmePath = "",
  [string]$FfmpegSourceUrl = "",
  [string]$FfmpegLicenseName = "",
  [string]$Version = "",
  [switch]$RequireBundledFfmpeg
)

$ErrorActionPreference = "Stop"
$AgentRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RepoRoot = (Resolve-Path (Join-Path $AgentRoot "..\..")).Path
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = if ($env:REMOTO_AGENT_OUTPUT_ROOT) { $env:REMOTO_AGENT_OUTPUT_ROOT } else { Join-Path $AgentRoot "release\RemotoAgent-Windows" }
}
$FfmpegPath = if ([string]::IsNullOrWhiteSpace($FfmpegPath)) { $env:REMOTO_BUNDLE_FFMPEG_PATH } else { $FfmpegPath }
$FfmpegLicensePath = if ([string]::IsNullOrWhiteSpace($FfmpegLicensePath)) { $env:REMOTO_BUNDLE_FFMPEG_LICENSE_PATH } else { $FfmpegLicensePath }
$FfmpegReadmePath = if ([string]::IsNullOrWhiteSpace($FfmpegReadmePath)) { $env:REMOTO_BUNDLE_FFMPEG_README_PATH } else { $FfmpegReadmePath }
$FfmpegSourceUrl = if ([string]::IsNullOrWhiteSpace($FfmpegSourceUrl)) { $env:REMOTO_FFMPEG_SOURCE_URL } else { $FfmpegSourceUrl }
$FfmpegLicenseName = if ([string]::IsNullOrWhiteSpace($FfmpegLicenseName)) { $env:REMOTO_FFMPEG_LICENSE_NAME } else { $FfmpegLicenseName }
$RequireBundledFfmpeg = $RequireBundledFfmpeg -or $env:REMOTO_REQUIRE_BUNDLED_FFMPEG -eq "true"
$Version = if ([string]::IsNullOrWhiteSpace($Version)) { if ($env:REMOTO_RELEASE_VERSION) { $env:REMOTO_RELEASE_VERSION } else { "0.1.0" } } else { $Version }
if ($Version -notmatch '^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$') {
  throw "Version precisa seguir SemVer, por exemplo 0.1.0 ou 1.2.3-rc.1."
}
$OutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)
$ReleaseRoot = Split-Path $OutputRoot -Parent

if ($RequireBundledFfmpeg -and [string]::IsNullOrWhiteSpace($FfmpegPath)) {
  throw "Esta release exige FFmpeg embutido. Informe -FfmpegPath ou REMOTO_BUNDLE_FFMPEG_PATH com um ffmpeg.exe validado."
}

$resolvedFfmpegPath = $null
$ffmpegSha256 = $null
$ffmpegVersion = $null
$ffmpegReadmeText = $null
if (-not [string]::IsNullOrWhiteSpace($FfmpegPath)) {
  $resolvedFfmpegPath = [System.IO.Path]::GetFullPath($FfmpegPath)
  if ([System.IO.Path]::GetFileName($resolvedFfmpegPath) -ine "ffmpeg.exe" -or -not (Test-Path -LiteralPath $resolvedFfmpegPath -PathType Leaf)) {
    throw "FfmpegPath precisa apontar para um arquivo ffmpeg.exe existente."
  }
  $getFileHash = Get-Command Get-FileHash -ErrorAction SilentlyContinue
  if ($getFileHash) {
    $ffmpegSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedFfmpegPath).Hash.ToLowerInvariant()
  } else {
    $sha256 = New-Object System.Security.Cryptography.SHA256Managed
    try {
      $ffmpegSha256 = ([BitConverter]::ToString($sha256.ComputeHash([System.IO.File]::ReadAllBytes($resolvedFfmpegPath)))).Replace("-", "").ToLowerInvariant()
    } finally {
      $sha256.Dispose()
    }
  }
  $ffmpegVersion = (& $resolvedFfmpegPath -hide_banner -version 2>&1 | Select-Object -First 1).ToString().Trim()

  $ffmpegDirectory = Split-Path -Parent $resolvedFfmpegPath
  if ([string]::IsNullOrWhiteSpace($FfmpegLicensePath)) {
    $licenseCandidates = @(
      (Join-Path $ffmpegDirectory "LICENSE"),
      (Join-Path (Split-Path -Parent $ffmpegDirectory) "LICENSE")
    )
    $FfmpegLicensePath = $licenseCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  }
  if ([string]::IsNullOrWhiteSpace($FfmpegReadmePath)) {
    $readmeCandidates = @(
      (Join-Path $ffmpegDirectory "README.txt"),
      (Join-Path (Split-Path -Parent $ffmpegDirectory) "README.txt")
    )
    $FfmpegReadmePath = $readmeCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  }
  if (-not (Test-Path -LiteralPath $FfmpegLicensePath -PathType Leaf)) {
    throw "FFmpeg embutido exige um arquivo de licenca. Informe -FfmpegLicensePath ou REMOTO_BUNDLE_FFMPEG_LICENSE_PATH."
  } else {
    Get-Content -LiteralPath $FfmpegLicensePath -Raw | Out-Null
  }
  if (Test-Path -LiteralPath $FfmpegReadmePath -PathType Leaf) {
    $ffmpegReadmeText = Get-Content -LiteralPath $FfmpegReadmePath -Raw
  } else {
    $FfmpegReadmePath = $null
  }
  if ([string]::IsNullOrWhiteSpace($FfmpegLicenseName) -and $ffmpegReadmeText) {
    $licenseMatch = [regex]::Match($ffmpegReadmeText, '(?im)^License:\s*(.+)$')
    if ($licenseMatch.Success) { $FfmpegLicenseName = $licenseMatch.Groups[1].Value.Trim() }
  }
  if ([string]::IsNullOrWhiteSpace($FfmpegSourceUrl) -and $ffmpegReadmeText) {
    $sourceMatch = [regex]::Match($ffmpegReadmeText, '(?im)^Source Code:\s*(\S+)$')
    if ($sourceMatch.Success) { $FfmpegSourceUrl = $sourceMatch.Groups[1].Value.Trim() }
  }
}

if (Test-Path $OutputRoot) {
  Remove-Item -LiteralPath $OutputRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputRoot | Out-Null

Push-Location $RepoRoot
try {
  npm run build -w apps/desktop-control
  npm run build -w apps/agent
  $env:REMOTO_AGENT_VERSION = $Version
  node apps/agent/scripts/bundle-agent.cjs
  if ($LASTEXITCODE -ne 0) { throw "Falha ao gerar o bundle standalone do agente." }
  npx --no-install @yao-pkg/pkg apps/agent/dist/standalone.cjs --targets node20-win-x64 --output $OutputRoot\RemotoAgent.exe
} finally {
  Pop-Location
}

$cscCandidates = @(
  "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
  "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
) | Where-Object { Test-Path -LiteralPath $_ }
if (-not $cscCandidates) {
  throw "Compilador C# do Windows nao encontrado para criar o host de servico."
}
$serviceSource = Join-Path $AgentRoot "scripts\windows-service-host.cs"
$serviceExe = Join-Path $OutputRoot "RemotoAgentService.exe"
$cscPath = @($cscCandidates)[0]
& $cscPath /nologo /target:exe /out:$serviceExe /reference:System.dll /reference:System.ServiceProcess.dll $serviceSource
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao compilar o host do servico: codigo $LASTEXITCODE."
}

Copy-Item (Join-Path $AgentRoot "scripts\install-package.ps1") $OutputRoot
Copy-Item (Join-Path $AgentRoot "scripts\repair-installed-agent.ps1") $OutputRoot
Copy-Item (Join-Path $AgentRoot "scripts\uninstall-package.ps1") $OutputRoot
Copy-Item (Join-Path $RepoRoot "scripts\homologate-host.ps1") $OutputRoot

if ($resolvedFfmpegPath) {
  $bundledFfmpegDirectory = Join-Path $OutputRoot "ffmpeg"
  New-Item -ItemType Directory -Path $bundledFfmpegDirectory -Force | Out-Null
  Copy-Item -LiteralPath $resolvedFfmpegPath -Destination (Join-Path $bundledFfmpegDirectory "ffmpeg.exe") -Force
  if ($FfmpegLicensePath) {
    Copy-Item -LiteralPath $FfmpegLicensePath -Destination (Join-Path $bundledFfmpegDirectory "FFMPEG-LICENSE.txt") -Force
  }
  if ($FfmpegReadmePath) {
    Copy-Item -LiteralPath $FfmpegReadmePath -Destination (Join-Path $bundledFfmpegDirectory "FFMPEG-README.txt") -Force
  } else {
    @"
FFmpeg build metadata captured by Remoto Agent

Version reportada: $ffmpegVersion
SHA-256: $ffmpegSha256
Licenca: $(if ($FfmpegLicenseName) { $FfmpegLicenseName } else { "consulte FFMPEG-LICENSE.txt" })
Codigo-fonte/origem: $(if ($FfmpegSourceUrl) { $FfmpegSourceUrl } else { "nao informado pelo empacotador" })

O README do fornecedor nao foi fornecido separadamente para este binario.
"@ | Set-Content -Path (Join-Path $bundledFfmpegDirectory "FFMPEG-README.txt") -Encoding UTF8
  }
  Write-Output "FFmpeg incluido no pacote: $resolvedFfmpegPath"
}

@'
@echo off
fltmc >nul 2>&1
if errorlevel 1 (
  powershell.exe -NoProfile -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-package.ps1"
if errorlevel 1 pause
'@ | Set-Content -Path (Join-Path $OutputRoot "install.cmd") -Encoding ASCII

@'
Remoto Agent - pacote Windows de teste

1. Extraia este pacote em uma pasta.
2. Execute install.cmd; ele pedira elevacao administrativa.
3. Informe a URL publica da API e a chave criada no painel.
4. O servico RemotoAgent sera iniciado automaticamente.
5. Para coletar diagnostico da maquina, execute: powershell -ExecutionPolicy Bypass -File .\homologate-host.ps1 -OutputPath .\remoto-host-report.json

Modo jogo: o manifesto RemotoAgent-package.json informa se o FFmpeg foi embutido. Quando nao foi, o instalador continua apto para suporte e exige um ffmpeg.exe validado no passo de configuracao do modo jogo.
Quando o FFmpeg e embutido, os avisos de terceiros ficam em ffmpeg\FFMPEG-LICENSE.txt e ffmpeg\FFMPEG-README.txt. O arquivo THIRD-PARTY-NOTICES.txt resume a origem e o hash do binario distribuido.

Este pacote ainda e uma release de teste. O instalador oficial assinado e a atualizacao automatica permanecem pendentes.
'@ | Set-Content -Path (Join-Path $OutputRoot "README.txt") -Encoding UTF8

if ($resolvedFfmpegPath) {
  @"
Remoto Agent - avisos de terceiros

Este pacote inclui o FFmpeg em ffmpeg\ffmpeg.exe.
Versao reportada: $ffmpegVersion
SHA-256: $ffmpegSha256
Licenca informada pelo fornecedor: $(if ($FfmpegLicenseName) { $FfmpegLicenseName } else { "consulte ffmpeg\FFMPEG-LICENSE.txt" })
Codigo-fonte/origem: $(if ($FfmpegSourceUrl) { $FfmpegSourceUrl } else { "consulte ffmpeg\FFMPEG-README.txt" })

Os termos completos da licenca e as informacoes do build acompanham o pacote nos arquivos
ffmpeg\FFMPEG-LICENSE.txt e ffmpeg\FFMPEG-README.txt.
"@ | Set-Content -Path (Join-Path $OutputRoot "THIRD-PARTY-NOTICES.txt") -Encoding UTF8
}

$packageManifest = [ordered]@{
  schemaVersion = 1
  product = "Remoto Agent"
  version = $Version
  ffmpegBundled = [bool]$resolvedFfmpegPath
  ffmpegSha256 = $ffmpegSha256
  ffmpegVersion = $ffmpegVersion
  ffmpegLicense = if ($resolvedFfmpegPath) { if ($FfmpegLicenseName) { $FfmpegLicenseName } else { "see-included-license-file" } } else { $null }
  ffmpegSourceUrl = $FfmpegSourceUrl
  ffmpegLicenseFile = if ($resolvedFfmpegPath -and $FfmpegLicensePath) { "ffmpeg/FFMPEG-LICENSE.txt" } else { $null }
  ffmpegReadmeFile = if ($resolvedFfmpegPath -and $FfmpegReadmePath) { "ffmpeg/FFMPEG-README.txt" } else { $null }
  gameMode = [ordered]@{
    videoCapture = "ffmpeg"
    cpuFallback = $true
    systemAudio = "optional-and-hardware-dependent"
    virtualGamepad = $false
  }
  generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
}
$packageManifest | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $OutputRoot "RemotoAgent-package.json") -Encoding UTF8

Write-Output "Pacote criado: $OutputRoot"
$isccCandidates = @(
  (Get-Command iscc.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
  (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"),
  "C:\Program Files\Inno Setup 6\ISCC.exe",
  "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

if (-not $isccCandidates) {
  throw "Inno Setup nao encontrado. Instale o Inno Setup 6 para gerar o instalador."
}

$issPath = Join-Path $AgentRoot "scripts\remoto-agent.iss"
$isccPath = @($isccCandidates)[0]
& $isccPath "/DAppVersion=$Version" "/DStagingDir=$OutputRoot" "/DOutputDir=$ReleaseRoot" $issPath
if ($LASTEXITCODE -ne 0) {
  throw "Inno Setup falhou com codigo $LASTEXITCODE."
}
Write-Output "Instalador criado: $(Join-Path $ReleaseRoot 'RemotoAgent-Setup.exe') (versao $Version)"

$zip = Join-Path $ReleaseRoot "RemotoAgent-Windows.zip"
if (Test-Path $zip) {
  Remove-Item -LiteralPath $zip -Force
}
Compress-Archive -Path (Join-Path $OutputRoot "*") -DestinationPath $zip -Force
Write-Output "Pacote compactado: $zip"
