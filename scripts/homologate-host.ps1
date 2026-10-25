[CmdletBinding()]
param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

function Get-SafeCommandOutput {
  param(
    [string]$Executable,
    [string[]]$Arguments
  )

  try {
    return (& $Executable @Arguments 2>&1 | Out-String)
  } catch {
    return ""
  }
}

function Get-OptionalCimInstance {
  param([string]$ClassName)

  try {
    return Get-CimInstance -ClassName $ClassName -ErrorAction Stop
  } catch {
    return $null
  }
}

function Test-UnderTrustedRoot {
  param([string]$Path)

  if (-not $Path) { return $false }
  try { $resolved = [System.IO.Path]::GetFullPath($Path).TrimEnd('\') } catch { return $false }
  $trustedRoots = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramData) |
    Where-Object { $_ } |
    ForEach-Object { [System.IO.Path]::GetFullPath($_).TrimEnd('\') }
  return [bool]($trustedRoots | Where-Object {
    $resolved.StartsWith($_ + '\', [System.StringComparison]::OrdinalIgnoreCase)
  })
}

function Find-ProtectedFfmpeg {
  $candidates = @(
    (Join-Path $env:ProgramFiles "Remoto Agent\ffmpeg\ffmpeg.exe"),
    (Join-Path $env:ProgramFiles "ffmpeg\bin\ffmpeg.exe"),
    (Join-Path $env:ProgramFiles "FFmpeg\bin\ffmpeg.exe"),
    (Join-Path $env:ProgramData "chocolatey\bin\ffmpeg.exe")
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) }
  return @($candidates | Where-Object { Test-UnderTrustedRoot $_ } | Select-Object -First 1)
}

function Get-SafeEndpointSummary {
  param([object]$Value)

  if ([string]::IsNullOrWhiteSpace([string]$Value)) { return $null }
  try {
    $uri = [Uri]$Value
    return [ordered]@{
      scheme = $uri.Scheme
      host = $uri.Host
      port = if ($uri.IsDefaultPort) { $null } else { $uri.Port }
      path = $uri.AbsolutePath
    }
  } catch {
    return [ordered]@{ invalid = $true }
  }
}

$os = Get-OptionalCimInstance -ClassName "Win32_OperatingSystem"
$computer = Get-OptionalCimInstance -ClassName "Win32_ComputerSystem"
$controllers = @(Get-OptionalCimInstance -ClassName "Win32_VideoController")
$agentConfigPath = Join-Path ${env:ProgramFiles} "Remoto Agent\.remoto-agent.config.json"
$agentConfig = $null
try {
  if (Test-Path -LiteralPath $agentConfigPath -PathType Leaf) {
    $agentConfig = Get-Content -LiteralPath $agentConfigPath -Raw -ErrorAction Stop | ConvertFrom-Json
  }
} catch {
  $agentConfig = $null
}

$ffmpegCommand = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
$pathFfmpegPath = if ($ffmpegCommand) { $ffmpegCommand.Source } else { $null }
$configuredFfmpegPath = if ($agentConfig -and -not [string]::IsNullOrWhiteSpace([string]$agentConfig.ffmpegPath) -and (Test-Path -LiteralPath ([string]$agentConfig.ffmpegPath) -PathType Leaf)) {
  [string]$agentConfig.ffmpegPath
} else {
  $null
}
$protectedCandidates = @($configuredFfmpegPath, (Find-ProtectedFfmpeg)) |
  Where-Object { $_ -and (Test-UnderTrustedRoot $_) -and (Test-Path -LiteralPath $_ -PathType Leaf) } |
  Select-Object -First 1
$protectedFfmpegPath = if ($protectedCandidates) { [string]$protectedCandidates } else { $null }
$ffmpegPath = @($configuredFfmpegPath, $pathFfmpegPath, $protectedFfmpegPath) |
  Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } |
  Select-Object -First 1
$ffmpegSource = if (-not $ffmpegPath) { $null }
  elseif ($configuredFfmpegPath -eq $ffmpegPath) { "agent-config" }
  elseif ($pathFfmpegPath -eq $ffmpegPath) { "PATH" }
  else { "protected-discovery" }
$serviceFfmpegPath = if ($configuredFfmpegPath -and (Test-UnderTrustedRoot $configuredFfmpegPath)) {
  $configuredFfmpegPath
} elseif ($pathFfmpegPath -and (Test-UnderTrustedRoot $pathFfmpegPath)) {
  $pathFfmpegPath
} elseif ($protectedFfmpegPath) {
  $protectedFfmpegPath
} else {
  $null
}
$encoderOutput = if ($ffmpegPath) { Get-SafeCommandOutput $ffmpegPath @("-hide_banner", "-encoders") } else { "" }
$filterOutput = if ($ffmpegPath) { Get-SafeCommandOutput $ffmpegPath @("-hide_banner", "-filters") } else { "" }
$deviceOutput = if ($ffmpegPath) { Get-SafeCommandOutput $ffmpegPath @("-hide_banner", "-devices") } else { "" }
$gpuEncoderNames = @("h264_nvenc", "h264_amf", "h264_qsv") | Where-Object { $encoderOutput -match "\b$($_)\b" }
$hasDesktopDuplication = $filterOutput -match "(?m)\bddagrab\b"
$hasDirectShow = $deviceOutput -match "(?m)\bdshow\b"
$hasNativeWasapi = $deviceOutput -match "(?im)\bwasapi\b"
$service = Get-Service -Name "RemotoAgent" -ErrorAction SilentlyContinue
$configurationStatus = if (-not $agentConfig) {
  "missing"
} elseif ([string]::IsNullOrWhiteSpace([string]$agentConfig.apiUrl)) {
  "missing-api-url"
} elseif ([string]::IsNullOrWhiteSpace([string]$agentConfig.realtimeUrl)) {
  "missing-realtime-url"
} elseif ([string]::IsNullOrWhiteSpace([string]$agentConfig.agentKey)) {
  "missing-agent-key"
} else {
  "configured"
}
$interactiveTask = $null
try { $interactiveTask = Get-ScheduledTask -TaskName "RemotoAgentDesktop" -ErrorAction Stop } catch { $interactiveTask = $null }
$sessionProcesses = @()
try {
  $sessionProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'RemotoAgent.exe'" -ErrorAction Stop | Where-Object { $_.CommandLine -match "(?i)(^|\s)sessions(\s|$)" })
} catch {
  $sessionProcesses = @()
}
$nextChecks = [System.Collections.Generic.List[string]]::new()
if ($configurationStatus -ne "configured") {
  $nextChecks.Add("Corrigir a configuracao instalada do agente ($configurationStatus) usando o instalador oficial.")
}
if (-not $interactiveTask) {
  $nextChecks.Add("Instalar a tarefa RemotoAgentDesktop em uma sessao elevada e confirmar o processo interativo.")
}
if ($ffmpegPath -and -not $serviceFfmpegPath) {
  $nextChecks.Add("Instalar o FFmpeg em uma pasta protegida (Program Files/ProgramData); o servico nao executa binarios do perfil do usuario.")
}
$nextChecks.Add("Confirmar o dispositivo no painel depois do primeiro heartbeat.")
$nextChecks.Add("Executar uma sessao em duas maquinas e registrar RTT, FPS, perda e tempo ate o primeiro frame.")
$nextChecks.Add("Validar audio de sistema separadamente; o FFmpeg comum nao garante loopback WASAPI.")
$nextChecks.Add("Testar UAC, bloqueio de tela, troca de usuario, gamepad e jogos com anti-cheat.")

$report = [ordered]@{
  schemaVersion = 1
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  machine = [ordered]@{
    hostname = $env:COMPUTERNAME
    username = $env:USERNAME
    os = if ($os) { "$($os.Caption) $($os.Version)" } else { $null }
    architecture = $env:PROCESSOR_ARCHITECTURE
    cpu = if ($computer) { $computer.SystemFamily } else { $null }
    memoryBytes = if ($computer) { [int64]$computer.TotalPhysicalMemory } else { $null }
    videoAdapters = @($controllers | ForEach-Object {
      [ordered]@{
        name = $_.Name
        driverVersion = $_.DriverVersion
        adapterRamBytes = if ($_.AdapterRAM) { [int64]$_.AdapterRAM } else { $null }
      }
    })
  }
  capture = [ordered]@{
    ffmpegPath = $ffmpegPath
    ffmpegSource = $ffmpegSource
    ffmpegAvailable = [bool]$ffmpegPath
    serviceFfmpegPath = $serviceFfmpegPath
    serviceFfmpegAvailable = [bool]$serviceFfmpegPath
    userProfileFfmpegOnly = [bool]($ffmpegPath -and -not (Test-UnderTrustedRoot $ffmpegPath) -and -not $serviceFfmpegPath)
    videoEncoder = if ($gpuEncoderNames.Count -gt 0) { @($gpuEncoderNames) } else { @("libx264") }
    recommendedEncoder = "auto"
    desktopDuplication = [bool]$hasDesktopDuplication
    recommendedCaptureMethod = if ($hasDesktopDuplication) { "ddagrab" } else { "gdigrab" }
    directShowAvailable = [bool]$hasDirectShow
    nativeWasapiListedByFfmpeg = [bool]$hasNativeWasapi
    audioStatus = if (-not $ffmpegPath) { "ffmpeg-missing" } elseif ($hasNativeWasapi) { "requires-validation" } elseif ($hasDirectShow) { "directshow-device-required" } else { "video-only" }
  }
  agent = [ordered]@{
    configurationPath = $agentConfigPath
    configurationStatus = $configurationStatus
    apiEndpoint = Get-SafeEndpointSummary $agentConfig.apiUrl
    realtimeEndpoint = Get-SafeEndpointSummary $agentConfig.realtimeUrl
    apiUrlConfigured = [bool]($agentConfig -and -not [string]::IsNullOrWhiteSpace([string]$agentConfig.apiUrl))
    realtimeUrlConfigured = [bool]($agentConfig -and -not [string]::IsNullOrWhiteSpace([string]$agentConfig.realtimeUrl))
    agentKeyConfigured = [bool]($agentConfig -and -not [string]::IsNullOrWhiteSpace([string]$agentConfig.agentKey))
    serviceInstalled = [bool]$service
    serviceStatus = if ($service) { [string]$service.Status } else { "NotInstalled" }
    interactiveTaskInstalled = [bool]$interactiveTask
    interactiveTaskState = if ($interactiveTask) { [string]$interactiveTask.State } else { "NotInstalled" }
    interactiveSessionProcess = ($sessionProcesses.Count -gt 0)
  }
  nextChecks = @($nextChecks)
}

$json = $report | ConvertTo-Json -Depth 8
if ($OutputPath) {
  $resolved = [System.IO.Path]::GetFullPath($OutputPath)
  $parent = Split-Path -Parent $resolved
  if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Set-Content -LiteralPath $resolved -Value $json -Encoding UTF8
  Write-Output "Relatorio salvo em $resolved"
} else {
  Write-Output $json
}
