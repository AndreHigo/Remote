[CmdletBinding()]
param(
  [string]$ApiUrl = "",
  [string]$AgentKey = "",
  [string]$ServiceName = "RemotoAgent"
)

$ErrorActionPreference = "Stop"

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Execute este instalador como Administrador."
  }
}

function Invoke-Sc {
  param([string[]]$Arguments)
  & sc.exe @Arguments | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "sc.exe falhou com codigo $LASTEXITCODE."
  }
}

Assert-Administrator
$AgentRoot = (Resolve-Path $PSScriptRoot).Path
$AgentExe = Join-Path $AgentRoot "RemotoAgent.exe"
$ServiceExe = Join-Path $AgentRoot "RemotoAgentService.exe"
$ConfigPath = Join-Path $AgentRoot ".remoto-agent.config.json"

if (-not (Test-Path $AgentExe) -or -not (Test-Path $ServiceExe)) {
  throw "Arquivos do Remoto Agent nao encontrados em $AgentRoot."
}

if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
  $ApiUrl = Read-Host "URL da API (ex.: https://api.seudominio.com)"
}
if ([string]::IsNullOrWhiteSpace($AgentKey)) {
  $AgentKey = Read-Host "Chave gerada no painel"
}
if ([string]::IsNullOrWhiteSpace($ApiUrl) -or [string]::IsNullOrWhiteSpace($AgentKey)) {
  throw "URL da API e chave sao obrigatorias."
}

$configJson = @{
  apiUrl = $ApiUrl.TrimEnd("/")
  agentKey = $AgentKey.Trim()
  stateFile = ".remoto-agent.state.json"
} | ConvertTo-Json
[System.IO.File]::WriteAllText($ConfigPath, $configJson, [System.Text.UTF8Encoding]::new($false))

$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
  if ($existingService.Status -ne "Stopped") {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
  }
  & sc.exe delete $ServiceName | Out-Host
  Start-Sleep -Milliseconds 500
}

$binPath = '"{0}"' -f $ServiceExe
New-Service -Name $ServiceName -BinaryPathName $binPath -DisplayName "Remoto Agent" -Description "Agente Remoto para presenca, inventario e acesso assistido." -StartupType Automatic | Out-Null
Invoke-Sc @("description", $ServiceName, "Agente Remoto para presenca, inventario e acesso assistido.")
Invoke-Sc @("failure", $ServiceName, "reset=", "86400", "actions=", "restart/5000/restart/15000/restart/60000")
Start-Service -Name $ServiceName

Write-Output "Remoto Agent instalado e iniciado."
Write-Output "Config: $ConfigPath"
