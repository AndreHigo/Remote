[CmdletBinding()]
param(
  [string]$ApiUrl = "",
  [string]$RealtimeUrl = "",
  [string]$AgentKey = "",
  [string]$AgentKeyFile = "",
  [string]$FfmpegPath = "",
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

function Assert-SecureEndpoint {
  param([string]$Value, [ValidateSet("api", "realtime")][string]$Kind)
  try { $uri = [Uri]$Value } catch { throw "URL $Kind invalida." }
  if (-not $uri.IsAbsoluteUri -or $uri.UserInfo) { throw "URL $Kind invalida ou com credenciais embutidas." }
  $loopback = $uri.IsLoopback -or $uri.Host -eq "localhost"
  if ($Kind -eq "api") {
    if (($loopback -and $uri.Scheme -notin @("http", "https")) -or (-not $loopback -and $uri.Scheme -ne "https")) {
      throw "A URL da API deve usar https:// fora de localhost."
    }
  } elseif (($loopback -and $uri.Scheme -notin @("ws", "wss")) -or (-not $loopback -and $uri.Scheme -ne "wss")) {
    throw "A URL do relay deve usar wss:// fora de localhost."
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
    throw "O agente precisa estar instalado em uma pasta protegida dentro de Program Files (ex.: C:\Program Files\Remoto Agent)."
  }
}

function Resolve-ConfiguredFfmpeg {
  param([string]$PreferredPath)

  $candidate = $PreferredPath.Trim()
  if ($candidate) {
    try { $candidate = [System.IO.Path]::GetFullPath($candidate) } catch { throw "O caminho do FFmpeg e invalido." }
    if ([System.IO.Path]::GetFileName($candidate) -ine "ffmpeg.exe" -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      throw "O caminho informado precisa apontar para um arquivo ffmpeg.exe existente."
    }
    return Install-ProtectedFfmpeg -SourcePath $candidate
  }

  if ($env:REMOTO_FFMPEG_PATH) {
    try {
      $candidate = [System.IO.Path]::GetFullPath($env:REMOTO_FFMPEG_PATH)
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { return Install-ProtectedFfmpeg -SourcePath $candidate }
    } catch { }
  }

  $command = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
  if ($command -and (Test-Path -LiteralPath $command.Source -PathType Leaf)) {
    return Install-ProtectedFfmpeg -SourcePath $command.Source
  }

  return $null
}

function Install-ProtectedFfmpeg {
  param([string]$SourcePath)

  if (Test-ProtectedFfmpegPath -Path $SourcePath) { return $SourcePath }
  $targetDirectory = Join-Path $AgentRoot "ffmpeg"
  $targetPath = Join-Path $targetDirectory "ffmpeg.exe"
  New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
  Copy-Item -LiteralPath $SourcePath -Destination $targetPath -Force
  if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
    throw "Nao foi possivel copiar o FFmpeg para a pasta protegida do agente."
  }
  Write-Output "FFmpeg copiado para caminho protegido: $targetPath"
  return $targetPath
}

function Test-ProtectedFfmpegPath {
  param([string]$Path)

  try { $resolved = [System.IO.Path]::GetFullPath($Path).TrimEnd('\') } catch { return $false }
  $trustedRoots = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramData) |
    Where-Object { $_ } |
    ForEach-Object { [System.IO.Path]::GetFullPath($_).TrimEnd('\') }
  return [bool]($trustedRoots | Where-Object {
    $resolved.StartsWith($_ + '\', [System.StringComparison]::OrdinalIgnoreCase)
  })
}

Assert-Administrator
$AgentRoot = (Resolve-Path $PSScriptRoot).Path
Assert-ProtectedAgentRoot -Path $AgentRoot
$AgentExe = Join-Path $AgentRoot "RemotoAgent.exe"
$ServiceExe = Join-Path $AgentRoot "RemotoAgentService.exe"
$ConfigPath = Join-Path $AgentRoot ".remoto-agent.config.json"
$StateDirectory = Join-Path $env:ProgramData "Remoto\state"
$StatePath = Join-Path $StateDirectory "agent.state.json"
$CurrentUserSid = ([Security.Principal.WindowsIdentity]::GetCurrent()).User.Value
$CurrentUserName = "$env:USERDOMAIN\$env:USERNAME"
$CurrentUserReadGrant = "*{0}:(R)" -f $CurrentUserSid
$CurrentUserModifyGrant = "*{0}:(OI)(CI)(M)" -f $CurrentUserSid
$InteractiveTaskName = "RemotoAgentDesktop"

if (-not (Test-Path $AgentExe) -or -not (Test-Path $ServiceExe)) {
  throw "Arquivos do Remoto Agent nao encontrados em $AgentRoot."
}

if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
  $ApiUrl = Read-Host "URL da API (ex.: https://api.seudominio.com)"
}
if ([string]::IsNullOrWhiteSpace($RealtimeUrl)) {
  $RealtimeUrl = Read-Host "URL do relay realtime (ex.: wss://remoto.seudominio.com/realtime)"
}
if ([string]::IsNullOrWhiteSpace($AgentKey)) {
  if ($AgentKeyFile) {
    try {
      $AgentKey = (Get-Content -LiteralPath $AgentKeyFile -Raw).Trim()
    } finally {
      Remove-Item -LiteralPath $AgentKeyFile -Force -ErrorAction SilentlyContinue
    }
  } else {
    $AgentKey = Read-Host "Chave gerada no painel"
  }
}
if ([string]::IsNullOrWhiteSpace($ApiUrl) -or [string]::IsNullOrWhiteSpace($RealtimeUrl) -or [string]::IsNullOrWhiteSpace($AgentKey)) {
  throw "URL da API, URL do relay e chave sao obrigatorias."
}
Assert-SecureEndpoint -Value $ApiUrl -Kind api
Assert-SecureEndpoint -Value $RealtimeUrl -Kind realtime
$resolvedFfmpegPath = Resolve-ConfiguredFfmpeg -PreferredPath $FfmpegPath

$configJson = @{
  apiUrl = $ApiUrl.TrimEnd("/")
  realtimeUrl = $RealtimeUrl.TrimEnd("/")
  agentKey = $AgentKey.Trim()
  stateFile = $StatePath
  ffmpegPath = $resolvedFfmpegPath
} | ConvertTo-Json
[System.IO.Directory]::CreateDirectory($StateDirectory) | Out-Null
[System.IO.File]::WriteAllText($ConfigPath, $configJson, [System.Text.UTF8Encoding]::new($false))
if (-not (Test-Path -LiteralPath $StatePath)) { [System.IO.File]::WriteAllText($StatePath, "{}", [System.Text.UTF8Encoding]::new($false)) }
& icacls.exe $ConfigPath /inheritance:r /remove "*S-1-5-11" "*S-1-5-32-545" | Out-Host
& icacls.exe $ConfigPath /grant:r "*S-1-5-18:(F)" "*S-1-5-32-544:(F)" $CurrentUserReadGrant | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel proteger a configuracao do agente." }
& icacls.exe $StateDirectory /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)(F)" "*S-1-5-32-544:(OI)(CI)(F)" $CurrentUserModifyGrant | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel proteger o estado operacional do agente." }

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

$legacyRunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Remove-ItemProperty -Path $legacyRunKey -Name "RemotoAgentDesktop" -ErrorAction SilentlyContinue
if (Get-Command Register-ScheduledTask -ErrorAction SilentlyContinue) {
  $action = New-ScheduledTaskAction -Execute $AgentExe -Argument "sessions" -WorkingDirectory $AgentRoot
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUserName
  $principal = New-ScheduledTaskPrincipal -UserId $CurrentUserSid -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $InteractiveTaskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
  try { Start-ScheduledTask -TaskName $InteractiveTaskName -ErrorAction Stop } catch { Write-Warning "O processo interativo sera iniciado no proximo logon: $($_.Exception.Message)" }
} else {
  New-Item -Path $legacyRunKey -Force | Out-Null
  Set-ItemProperty -Path $legacyRunKey -Name "RemotoAgentDesktop" -Value ('"{0}" sessions' -f $AgentExe)
  Write-Warning "O modulo ScheduledTasks nao esta disponivel; usando autostart legado do usuario."
}

Write-Output "Remoto Agent instalado e iniciado."
Write-Output "Config: $ConfigPath"
Write-Output "Processo interativo: tarefa $InteractiveTaskName para $CurrentUserName"
if ($resolvedFfmpegPath) {
  Write-Output "FFmpeg: $resolvedFfmpegPath"
} else {
  Write-Warning "FFmpeg nao encontrado. O gerenciamento continua disponivel, mas o modo jogo exige ffmpeg.exe instalado ou informado no instalador; um caminho de usuario sera copiado para a pasta protegida do agente."
}
