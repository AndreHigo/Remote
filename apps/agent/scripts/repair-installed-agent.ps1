$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $powershell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
  $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  $elevated = Start-Process -FilePath $powershell -ArgumentList $arguments -Verb RunAs -Wait -PassThru
  exit $elevated.ExitCode
}

$agentRoot = Split-Path -Parent $PSCommandPath
$installer = Join-Path $agentRoot "install-package.ps1"
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
  throw "Instalador do agente nao encontrado em $agentRoot."
}

& $installer -RepairExisting
Write-Host "Remoto Agent reparado. Feche e abra a sessao do Windows se o processo desktop ainda nao aparecer." -ForegroundColor Green
