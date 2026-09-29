[CmdletBinding()]
param([string]$ServiceName = "RemotoAgent")

$ErrorActionPreference = "Stop"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Execute este desinstalador como Administrador."
}

& sc.exe stop $ServiceName | Out-Host
& sc.exe delete $ServiceName | Out-Host
Write-Output "Remoto Agent removido."
