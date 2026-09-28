[CmdletBinding()]
param(
  [string]$ServiceName = "RemotoAgent",
  [string]$AgentRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$NodePath = "",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Abra o PowerShell como Administrador para instalar ou remover o servico."
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
$AgentRoot = (Resolve-Path $AgentRoot).Path

if ($Uninstall) {
  try { Invoke-Sc @("stop", $ServiceName) } catch { }
  Invoke-Sc @("delete", $ServiceName)
  Write-Output "Servico removido: $ServiceName"
  exit 0
}

if ([string]::IsNullOrWhiteSpace($NodePath)) {
  $NodePath = (Get-Command node.exe -ErrorAction Stop).Source
}

$entryPoint = Join-Path $AgentRoot "dist\index.js"
$runner = Join-Path $AgentRoot "scripts\service-runner.cjs"
$configPath = Join-Path $AgentRoot ".remoto-agent.config.json"

if (-not (Test-Path $entryPoint)) {
  throw "Build do agente ausente: $entryPoint. Execute npm run build antes."
}

if (-not (Test-Path $runner)) {
  throw "Runner do servico ausente: $runner"
}

if (-not (Test-Path $configPath)) {
  throw "Configuracao ausente: $configPath. Execute npm run agent:config:init e preencha agentKey."
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace([string]$config.agentKey)) {
  throw "agentKey vazio em $configPath. O servico nao sera instalado sem uma chave."
}

$binPath = '"{0}" "{1}"' -f $NodePath, $runner
try { Invoke-Sc @("stop", $ServiceName) } catch { }
try { Invoke-Sc @("delete", $ServiceName) } catch { }
Invoke-Sc @("create", $ServiceName, "binPath=", $binPath, "start=", "auto", "DisplayName=", "Remoto Agent")
Invoke-Sc @("description", $ServiceName, "Agente Remoto para inventario, heartbeat e comandos autorizados.")
Invoke-Sc @("failure", $ServiceName, "reset=", "86400", "actions=", "restart/5000/restart/15000/restart/60000")
Invoke-Sc @("start", $ServiceName)

Write-Output "Servico instalado e iniciado: $ServiceName"
Write-Output "Root: $AgentRoot"
