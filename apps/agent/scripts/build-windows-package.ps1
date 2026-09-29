[CmdletBinding()]
param(
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
$AgentRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RepoRoot = (Resolve-Path (Join-Path $AgentRoot "..\..")).Path
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $AgentRoot "release\RemotoAgent-Windows"
}
$OutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)
$ReleaseRoot = Split-Path $OutputRoot -Parent

if (Test-Path $OutputRoot) {
  Remove-Item -LiteralPath $OutputRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputRoot | Out-Null

Push-Location $RepoRoot
try {
  npm run build -w apps/agent
  npx --yes esbuild@0.25.9 apps/agent/src/index.ts --bundle --platform=node --format=cjs --target=node20 --outfile=apps/agent/dist/standalone.cjs
  npx --yes @yao-pkg/pkg@6.5.0 apps/agent/dist/standalone.cjs --targets node20-win-x64 --output $OutputRoot\RemotoAgent.exe
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
Copy-Item (Join-Path $AgentRoot "scripts\uninstall-package.ps1") $OutputRoot

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
& $isccPath "/DAppVersion=0.1.0" "/DStagingDir=$OutputRoot" "/DOutputDir=$ReleaseRoot" $issPath
if ($LASTEXITCODE -ne 0) {
  throw "Inno Setup falhou com codigo $LASTEXITCODE."
}
Write-Output "Instalador criado: $(Join-Path $ReleaseRoot 'RemotoAgent-Setup.exe')"

$zip = Join-Path $ReleaseRoot "RemotoAgent-Windows.zip"
if (Test-Path $zip) {
  Remove-Item -LiteralPath $zip -Force
}
Compress-Archive -Path (Join-Path $OutputRoot "*") -DestinationPath $zip -Force
Write-Output "Pacote compactado: $zip"
