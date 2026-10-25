[CmdletBinding()]
param(
  [string]$OutputRoot = "",
  [string]$FfmpegPath = "",
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$AgentRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RepoRoot = (Resolve-Path (Join-Path $AgentRoot "..\..")).Path
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = if ($env:REMOTO_AGENT_OUTPUT_ROOT) { $env:REMOTO_AGENT_OUTPUT_ROOT } else { Join-Path $AgentRoot "release\RemotoAgent-Windows" }
}
$FfmpegPath = if ([string]::IsNullOrWhiteSpace($FfmpegPath)) { $env:REMOTO_BUNDLE_FFMPEG_PATH } else { $FfmpegPath }
$Version = if ([string]::IsNullOrWhiteSpace($Version)) { if ($env:REMOTO_RELEASE_VERSION) { $env:REMOTO_RELEASE_VERSION } else { "0.1.0" } } else { $Version }
if ($Version -notmatch '^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$') {
  throw "Version precisa seguir SemVer, por exemplo 0.1.0 ou 1.2.3-rc.1."
}
$OutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)
$ReleaseRoot = Split-Path $OutputRoot -Parent

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

if (-not [string]::IsNullOrWhiteSpace($FfmpegPath)) {
  $resolvedFfmpegPath = [System.IO.Path]::GetFullPath($FfmpegPath)
  if ([System.IO.Path]::GetFileName($resolvedFfmpegPath) -ine "ffmpeg.exe" -or -not (Test-Path -LiteralPath $resolvedFfmpegPath -PathType Leaf)) {
    throw "FfmpegPath precisa apontar para um arquivo ffmpeg.exe existente."
  }
  $bundledFfmpegDirectory = Join-Path $OutputRoot "ffmpeg"
  New-Item -ItemType Directory -Path $bundledFfmpegDirectory -Force | Out-Null
  Copy-Item -LiteralPath $resolvedFfmpegPath -Destination (Join-Path $bundledFfmpegDirectory "ffmpeg.exe") -Force
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

Este pacote ainda e uma release de teste. O instalador oficial assinado e a atualizacao automatica permanecem pendentes.
'@ | Set-Content -Path (Join-Path $OutputRoot "README.txt") -Encoding UTF8

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
