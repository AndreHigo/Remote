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
$ConfigPath = Join-Path $AgentRoot ".remoto-agent.config.json"

if (-not (Test-Path $AgentExe)) {
  throw "RemotoAgent.exe nao encontrado em $AgentRoot."
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

@{
  apiUrl = $ApiUrl.TrimEnd("/")
  agentKey = $AgentKey.Trim()
  stateFile = ".remoto-agent.state.json"
} | ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding UTF8

try { Invoke-Sc @("stop", $ServiceName) } catch { }
try { Invoke-Sc @("delete", $ServiceName) } catch { }

$binPath = '"{0}" loop' -f $AgentExe
Invoke-Sc @("create", $ServiceName, "binPath=", $binPath, "start=", "auto", "DisplayName=", "Remoto Agent")
Invoke-Sc @("description", $ServiceName, "Agente Remoto para presenca, inventario e acesso assistido.")
Invoke-Sc @("failure", $ServiceName, "reset=", "86400", "actions=", "restart/5000/restart/15000/restart/60000")
Invoke-Sc @("start", $ServiceName)

Write-Output "Remoto Agent instalado e iniciado."
Write-Output "Config: $ConfigPath"
