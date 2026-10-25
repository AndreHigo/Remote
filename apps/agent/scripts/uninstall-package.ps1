[CmdletBinding()]
param([string]$ServiceName = "RemotoAgent")

$ErrorActionPreference = "Stop"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Execute este desinstalador como Administrador."
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service -and $service.Status -ne "Stopped") {
  Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
}
$deadline = (Get-Date).AddSeconds(10)
while (($service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) -and
  $service.Status -ne "Stopped" -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 250
}

Get-Process -Name "RemotoAgentService", "RemotoAgent" -ErrorAction SilentlyContinue |
  Stop-Process -Force -ErrorAction SilentlyContinue
$deadline = (Get-Date).AddSeconds(10)
while ((Get-Process -Name "RemotoAgentService", "RemotoAgent" -ErrorAction SilentlyContinue) -and
  (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 250
}

& sc.exe delete $ServiceName | Out-Host
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Remove-ItemProperty -Path $runKey -Name "RemotoAgentDesktop" -ErrorAction SilentlyContinue
$stateDirectory = Join-Path $env:ProgramData "Remoto\state"
if (Test-Path -LiteralPath $stateDirectory) { Remove-Item -LiteralPath $stateDirectory -Recurse -Force -ErrorAction SilentlyContinue }
Write-Output "Remoto Agent removido."
