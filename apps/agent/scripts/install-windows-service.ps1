[CmdletBinding()]
param(
  [string]$ServiceName = "RemotoAgent",
  [string]$AgentRoot = "",
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

function Assert-ProtectedAgentRoot {
  param([string]$Path)
  $resolved = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
  $programFilesRoots = @($env:ProgramFiles, ${env:ProgramFiles(x86)}) |
    Where-Object { $_ } |
    ForEach-Object { [System.IO.Path]::GetFullPath($_).TrimEnd('\') }
  $isUnderProgramFiles = $programFilesRoots | Where-Object {
    $resolved.StartsWith($_ + '\', [System.StringComparison]::OrdinalIgnoreCase)
  }
  if (-not $isUnderProgramFiles -or [System.IO.Path]::GetFileName($resolved) -ne 'Remoto Agent') {
    throw "O agente precisa estar instalado em uma pasta protegida dentro de Program Files."
  }
}

Assert-Administrator
if ([string]::IsNullOrWhiteSpace($AgentRoot)) {
  $AgentRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}
$AgentRoot = (Resolve-Path $AgentRoot).Path
Assert-ProtectedAgentRoot -Path $AgentRoot
$CurrentUserSid = ([Security.Principal.WindowsIdentity]::GetCurrent()).User.Value
$CurrentUserName = "$env:USERDOMAIN\$env:USERNAME"
$InteractiveTaskName = "RemotoAgentDesktop"

if ($Uninstall) {
  try { Invoke-Sc @("stop", $ServiceName) } catch { }
  Invoke-Sc @("delete", $ServiceName)
  if (Get-Command Unregister-ScheduledTask -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $InteractiveTaskName -Confirm:$false -ErrorAction SilentlyContinue
  }
  Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "RemotoAgentDesktop" -ErrorAction SilentlyContinue
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

$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Remove-ItemProperty -Path $runKey -Name "RemotoAgentDesktop" -ErrorAction SilentlyContinue
if (Get-Command Register-ScheduledTask -ErrorAction SilentlyContinue) {
  $action = New-ScheduledTaskAction -Execute $NodePath -Argument ('"{0}" sessions' -f $runner) -WorkingDirectory $AgentRoot
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUserName
  $principal = New-ScheduledTaskPrincipal -UserId $CurrentUserSid -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $InteractiveTaskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
  try { Start-ScheduledTask -TaskName $InteractiveTaskName -ErrorAction Stop } catch { Write-Warning "O processo interativo sera iniciado no proximo logon: $($_.Exception.Message)" }
} else {
  $desktopCommand = '"{0}" "{1}" sessions' -f $NodePath, $runner
  New-Item -Path $runKey -Force | Out-Null
  New-ItemProperty -Path $runKey -Name "RemotoAgentDesktop" -PropertyType String -Value $desktopCommand -Force | Out-Null
  Write-Warning "O modulo ScheduledTasks nao esta disponivel; usando autostart legado do usuario."
}

Write-Output "Servico instalado e iniciado: $ServiceName"
Write-Output "Root: $AgentRoot"
Write-Output "Processo interativo: tarefa $InteractiveTaskName para $CurrentUserName"
