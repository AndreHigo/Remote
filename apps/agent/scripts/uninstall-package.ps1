[CmdletBinding()]
param([string]$ServiceName = "RemotoAgent")

$ErrorActionPreference = "Stop"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Execute este desinstalador como Administrador."
}

Get-Process -Name "RemotoAgent" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
& sc.exe stop $ServiceName | Out-Host
& sc.exe delete $ServiceName | Out-Host
$runKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run"
Remove-ItemProperty -Path $runKey -Name "RemotoAgentDesktop" -ErrorAction SilentlyContinue
$stateDirectory = Join-Path $env:ProgramData "Remoto\state"
if (Test-Path -LiteralPath $stateDirectory) { Remove-Item -LiteralPath $stateDirectory -Recurse -Force -ErrorAction SilentlyContinue }
Write-Output "Remoto Agent removido."
